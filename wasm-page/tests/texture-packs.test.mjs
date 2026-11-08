import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { webcrypto } from 'node:crypto';

const context = vm.createContext({ Uint8Array, TextDecoder, TextEncoder, DataView, Uint32Array, Blob, crypto: webcrypto });
vm.runInContext(readFileSync(new URL('../public/demo-library.js', import.meta.url), 'utf8'), context);
vm.runInContext(readFileSync(new URL('../public/texture-packs.js', import.meta.url), 'utf8'), context);
const textures = context.PPSSPPTextures;
const encoder = new TextEncoder();
const file = (name, data = 'texture') => ({ name, data: encoder.encode(data) });
const missing = () => Object.assign(new Error('Missing'), { name: 'NotFoundError' });

// OPFS writes become visible only at close, matching createWritable's commit contract.
class Directory {
  kind = 'directory';
  children = new Map();
  constructor(control = {}) { this.control = control; }
  async getDirectoryHandle(name, { create = false } = {}) {
    if (!this.children.has(name) && create) this.children.set(name, new Directory(this.control));
    const result = this.children.get(name);
    if (!result) throw missing();
    if (result.kind !== 'directory') throw new Error('TypeMismatch');
    return result;
  }
  async getFileHandle(name, { create = false } = {}) {
    if (!this.children.has(name) && create) {
      const control = this.control;
      this.children.set(name, {
        kind: 'file', bytes: new Uint8Array(),
        async getFile() { return new Blob([this.bytes]); },
        async createWritable() {
          const target = this;
          let staged;
          return {
            async write(data) { staged = new Uint8Array(await new Blob([data]).arrayBuffer()); },
            async close() {
              if (control.fail?.(name)) throw new Error('Quota exceeded');
              target.bytes = staged;
            },
            async abort() {},
          };
        },
      });
    }
    const result = this.children.get(name);
    if (!result) throw missing();
    if (result.kind !== 'file') throw new Error('TypeMismatch');
    return result;
  }
  async removeEntry(name) { if (!this.children.delete(name)) throw missing(); }
  async *entries() { yield* Array.from(this.children.entries()); }
}
const id = 'ULUS10567';
const pack = (data = 'old') => textures.prepare([file('PSP/TEXTURES/' + id + '/textures.ini', '[options]\nversion=1'), file('PSP/TEXTURES/' + id + '/sub/abc.png', data)], id);
const fakeFS = () => ({ files: new Map(), mkdirTree() {}, writeFile(path, data) { this.files.set(path, data); } });

test('normalizes standard layouts while preserving image subfolders and case', () => {
  for (const prefix of ['', id + '/', 'PSP/TEXTURES/' + id + '/', 'download/PSP/TEXTURES/' + id + '/']) {
    const p = textures.prepare([file(prefix + 'textures.ini'), file(prefix + 'Images/AbC.png')], id.toLowerCase());
    assert.equal(p.id, id);
    assert.equal(p.entries[1].name, 'Images/AbC.png');
  }
});

test('rejects unsafe paths, region mismatches, collisions and oversized imports before writes', () => {
  for (const name of ['../a.png', '/a.png', 'a\\b.png', 'a//b.png', 'C:/a.png', 'x/./a.png', 'a\0.png']) {
    assert.throws(() => textures.prepare([file(name)], id));
  }
  assert.throws(() => textures.prepare([file('ULES12345/a.png')], id), /match/);
  assert.throws(() => textures.prepare([file('a.png'), file('A.png')], id), /Duplicate/);
  assert.throws(() => textures.prepare([file('a.png'), file('a.png/b.png')], id), /conflict/);
  assert.throws(() => textures.prepare([{ name: 'a.png', file: { size: textures.MAX_BYTES + 1 } }], id), /512/);
  assert.throws(() => textures.prepare([file('a.png')], '../../SYSTEM'), /game ID/);
});

test('committed packs survive a fresh restore and replacement removes stale images', async () => {
  const root = new Directory();
  await textures.install(root, pack());
  const fresh = fakeFS();
  await textures.restore(root, fresh, '/memstick');
  assert.equal(new TextDecoder().decode(fresh.files.get('/memstick/PSP/TEXTURES/' + id + '/sub/abc.png')), 'old');
  await textures.install(root, textures.prepare([file('new.png', 'new')], id));
  const next = fakeFS();
  await textures.restore(root, next, '/memstick');
  assert.equal(next.files.size, 1);
  assert.equal(new TextDecoder().decode(next.files.get('/memstick/PSP/TEXTURES/' + id + '/new.png')), 'new');
  const dir = await root.getDirectoryHandle(id);
  assert.equal([...dir.children.values()].filter(entry => entry.kind === 'directory').length, 1);
});

test('quota failures during data writes and manifest commit preserve the installed generation', async () => {
  for (const failName of ['new.png', 'manifest.json']) {
    const control = {}, root = new Directory(control);
    const before = await textures.install(root, pack());
    control.fail = name => name === failName;
    await assert.rejects(textures.install(root, textures.prepare([file('new.png')], id)), /Quota/);
    control.fail = null;
    const [after] = await textures.list(root);
    assert.equal(after.generation, before.generation);
    const fs = fakeFS();
    await textures.restore(root, fs, '/memstick');
    assert.equal(new TextDecoder().decode(fs.files.get('/memstick/PSP/TEXTURES/' + id + '/sub/abc.png')), 'old');
  }
});

test('failed first installation stays invisible and a later import cleans abandoned staging', async () => {
  const control = { fail: name => name === 'manifest.json' }, root = new Directory(control);
  await assert.rejects(textures.install(root, pack()));
  assert.equal((await textures.list(root)).length, 0);
  control.fail = null;
  await textures.install(root, pack());
  assert.equal((await textures.list(root)).length, 1);
});

test('removal takes effect on the next boot and local profiles remain isolated', async () => {
  const guest = new Directory(), account = new Directory();
  await textures.install(guest, pack());
  assert.equal((await textures.list(account)).length, 0);
  await textures.remove(guest, id);
  assert.equal((await textures.list(guest)).length, 0);
  const fs = fakeFS();
  await textures.restore(guest, fs, '/memstick');
  assert.equal(fs.files.size, 0);
});

test('an incomplete committed pack fails visibly instead of silently booting with missing textures', async () => {
  const root = new Directory();
  const committed = await textures.install(root, pack());
  const dir = await (await root.getDirectoryHandle(id)).getDirectoryHandle(committed.generation);
  await dir.removeEntry('sub');
  await assert.rejects(textures.restore(root, fakeFS(), '/memstick'), /Missing/);
});

test('total installed size is bounded before reading or staging another pack', async () => {
  const root = new Directory();
  const dir = await root.getDirectoryHandle(id, { create: true });
  const handle = await dir.getFileHandle('manifest.json', { create: true });
  handle.bytes = encoder.encode(JSON.stringify({ id, generation: 'g-existing', bytes: 300 * 1024 * 1024, files: [{ name: 'a.png', size: 300 * 1024 * 1024 }] }));
  const plan = textures.prepare([{ name: 'b.png', file: { size: 300 * 1024 * 1024, arrayBuffer() { assert.fail('must reject before reading'); } } }], 'ULES12345');
  await assert.rejects(textures.install(root, plan), /512 MiB browser limit/);
  assert.ok(!root.children.has('ULES12345'));
});
