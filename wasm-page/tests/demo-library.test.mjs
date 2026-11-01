import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { deflateRawSync } from 'node:zlib';
const ctx = vm.createContext({ Uint8Array, DataView, TextDecoder, Blob, DecompressionStream, URL });
vm.runInContext(readFileSync(new URL('../public/demo-library.js', import.meta.url), 'utf8'), ctx);
const api = ctx.PPSSPPDemos;
function zip(entries, method = 8) {
  const locals = [], directory = []; let offset = 0;
  for (const [name, bytes] of entries) {
    const data = Buffer.from(bytes), filename = Buffer.from(name), packed = method === 8 ? deflateRawSync(data) : data;
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(method, 8);
    local.writeUInt32LE(api.crc32(data), 14); local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(filename.length, 26);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(method, 10);
    central.writeUInt32LE(api.crc32(data), 16); central.writeUInt32LE(packed.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(filename.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, filename, packed); directory.push(central, filename); offset += local.length + filename.length + packed.length;
  }
  const cd = Buffer.concat(directory), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, cd, end]));
}
const pbp = Buffer.alloc(40); pbp.writeUInt32LE(0x50425000);
test('stored and deflated demo ZIPs preserve EBOOT and relative companion files', async () => {
  for (const method of [0, 8]) {
    const files = await api.unzip(zip([['PSP/GAME/UCES00302/EBOOT.PBP', pbp], ['PSP/GAME/UCES00302/data/config.bin', [1, 2, 3]]], method));
    const [pkg] = api.packages(files, 'demo.zip');
    assert.equal(pkg.name, 'UCES00302.pbp'); assert.equal(pkg.boot, true);
    assert.equal(pkg.files[0].name, 'data/config.bin');
    assert.deepEqual([...pkg.files[0].data], [1, 2, 3]);
  }
});
test('ISO archives keep their original executable format', async () => {
  const [pkg] = api.packages(await api.unzip(zip([['demo/game.iso', [1, 2]]])), 'demo.zip');
  assert.equal(pkg.name, 'game.iso'); assert.equal(pkg.boot, undefined);
});
test('rejects traversal, absolute paths, duplicates, bad CRC and malformed ZIPs', async () => {
  for (const path of ['../bad', '/bad', 'a/../bad', 'C:/bad', 'a\\bad']) await assert.rejects(api.unzip(zip([[path, [1]]])), /Unsafe/);
  await assert.rejects(api.unzip(zip([['same', [1]], ['SAME', [1]]])), /Duplicate/);
  const corrupt = zip([['a', [1]]], 0); corrupt[31] = 2;
  await assert.rejects(api.unzip(corrupt), /checksum/);
  await assert.rejects(api.unzip(new Uint8Array([1, 2, 3])), /Invalid ZIP/);
  const encrypted = zip([['a', [1]]]); const at = encrypted.findIndex((_, i) => new DataView(encrypted.buffer).getUint8(i) === 0x50 && i > 30 && encrypted[i+1] === 0x4b && encrypted[i+2] === 1); encrypted[at + 8] = 1;
  await assert.rejects(api.unzip(encrypted), /Encrypted/);
});
test('rejects ZIP bombs before decompression and unsupported archives', async () => {
  const huge = zip([['a', [1]]]); const central = huge.length - 22 - 47; new DataView(huge.buffer).setUint32(central + 24, 600 * 1024 * 1024, true);
  await assert.rejects(api.unzip(huge), /exceeds/);
  assert.throws(() => api.packages([{name: 'readme.txt', data: pbp}], 'demo.zip'), /No PSP/);
  assert.throws(() => api.packages([{name: 'EBOOT.PBP', data: new Uint8Array(40)}], 'demo.zip'), /Invalid EBOOT/);
});
test('catalog accepts only the expected HTTPS download origin', () => {
  const good = { title: 'Ape Academy', productCode: 'UCES00302', region: 'eu', url: 'https://data.playdreamcreate.com/ape-academy-2_EU.zip' };
  const records = api.catalog([good, {...good, url: 'https://evil.example/demo.zip'}, {...good, url: 'https://data.playdreamcreate.com/a.zip?redirect=x'}]);
  assert.equal(records.length, 1); assert.equal(records[0].region, 'EU'); assert.equal(records[0].name, 'UCES00302.pbp');
});
