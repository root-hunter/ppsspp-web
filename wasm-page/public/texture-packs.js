/* Replacement texture packs. Immutable generations + atomic manifest publication. */
(() => {
  'use strict';
  const MAX_BYTES = 512 * 1024 * 1024, MAX_FILES = 20000;
  function gameID(value) {
    const id = String(value).trim().toUpperCase();
    if (!/^[A-Z]{4}[0-9]{5}$/.test(id)) throw new Error('Enter a PSP game ID, for example ULUS10567.');
    return id;
  }
  function path(value) {
    globalThis.PPSSPPDemos.safePath(value);
    if (value.length > 1024 || value.split('/').some(p => !p || p.length > 255)) throw new Error('Invalid texture path');
    return value;
  }
  function prepare(files, selectedID) {
    const id = gameID(selectedID), seen = new Set();
    let total = 0;
    const entries = files.filter(f => !/(^|\/)__MACOSX\//.test(f.name) && !/(^|\/)\.DS_Store$/.test(f.name)).map(file => {
      const parts = path(file.name).split('/');
      const textures = parts.findIndex(p => p.toUpperCase() === 'TEXTURES');
      const game = parts.findIndex(p => /^[A-Z]{4}[0-9]{5}$/i.test(p));
      let start = 0;
      if (textures >= 0) {
        if (parts[textures + 1]?.toUpperCase() !== id) throw new Error('The texture folder does not match the selected game ID.');
        start = textures + 2;
      } else if (game >= 0) {
        if (parts[game].toUpperCase() !== id) throw new Error('The texture folder does not match the selected game ID.');
        start = game + 1;
      }
      const name = path(parts.slice(start).join('/'));
      const key = name.toLowerCase();
      if (seen.has(key)) throw new Error('Duplicate texture path: ' + name);
      seen.add(key);
      const size = file.data?.byteLength ?? file.file?.size;
      if (!Number.isSafeInteger(size) || size < 0) throw new Error('Invalid texture file size');
      total += size;
      return { ...file, name, size };
    });
    if (!entries.length || entries.length > MAX_FILES || total > MAX_BYTES) throw new Error('Texture packs support up to 20,000 files and 512 MiB.');
    // Ambiguous named wrappers must be removed by selecting the actual game folder.
    if (!entries.some(f => /^(textures\.ini|[^/]+\.(png|dds|ktx2|zip))$/i.test(f.name))) throw new Error('Select the game ID folder or a ZIP containing textures.ini or texture images at its root.');
    for (const { name } of entries) {
      const parts = name.split('/');
      parts.pop();
      while (parts.length) {
        if (seen.has(parts.join('/').toLowerCase())) throw new Error('Texture file/directory conflict');
        parts.pop();
      }
    }
    return { id, entries, bytes: total };
  }
  async function write(dir, name, data) {
    const handle = await dir.getFileHandle(name, { create: true });
    const stream = await handle.createWritable();
    try { await stream.write(data); await stream.close(); }
    catch (error) { try { await stream.abort(); } catch (_) {} throw error; }
  }
  async function read(dir, name) { return (await dir.getFileHandle(name)).getFile(); }
  async function manifest(dir, id) {
    const text = await (await read(dir, 'manifest.json')).text();
    // A crash before the first atomic close may leave an empty placeholder.
    if (!text) throw Object.assign(new Error('Uncommitted texture pack'), { name: 'NotFoundError' });
    const m = JSON.parse(text);
    if (m.id !== id || !/^[a-z0-9-]+$/.test(m.generation) || !Array.isArray(m.files) || !m.files.length || m.files.length > MAX_FILES) throw new Error('Invalid texture manifest for ' + id);
    const plan = prepare(m.files.map(f => ({ name: f.name, file: { size: f.size } })), id);
    if (plan.bytes !== m.bytes) throw new Error('Invalid texture manifest size');
    return m;
  }
  async function list(root) {
    const packs = [];
    for await (const [id, dir] of root.entries()) {
      if (dir.kind !== 'directory' || !/^[A-Z]{4}[0-9]{5}$/.test(id)) continue;
      try { packs.push(await manifest(dir, id)); }
      catch (error) { if (error.name !== 'NotFoundError') throw error; }
    }
    return packs.sort((a, b) => a.id.localeCompare(b.id));
  }
  async function clean(dir, keep) {
    for await (const [name, handle] of dir.entries()) {
      if (handle.kind === 'directory' && name !== keep) await dir.removeEntry(name, { recursive: true });
    }
  }
  async function install(root, plan, progress = () => {}) {
    // Revalidate callers and bound total startup memory across installed packs.
    plan = prepare(plan.entries, plan.id);
    const installed = await list(root);
    if (installed.filter(p => p.id !== plan.id).reduce((n, p) => n + p.bytes, plan.bytes) > MAX_BYTES) throw new Error('Installed texture packs exceed the 512 MiB browser limit. Remove another pack first.');
    const dir = await root.getDirectoryHandle(plan.id, { create: true });
    const old = installed.find(p => p.id === plan.id);
    await clean(dir, old?.generation);
    const generation = 'g-' + crypto.randomUUID();
    const stage = await dir.getDirectoryHandle(generation, { create: true });
    let committed = false;
    try {
      let completed = 0;
      for (const entry of plan.entries) {
        const parts = entry.name.split('/'), name = parts.pop();
        let target = stage;
        for (const part of parts) target = await target.getDirectoryHandle(part, { create: true });
        const data = entry.data || new Uint8Array(await entry.file.arrayBuffer());
        if (data.byteLength !== entry.size) throw new Error('Texture file changed during import');
        await write(target, name, data);
        await progress(++completed, plan.entries.length);
      }
      const m = { id: plan.id, generation, bytes: plan.bytes, files: plan.entries.map(({ name, size }) => ({ name, size })) };
      await write(dir, 'manifest.json', JSON.stringify(m));
      committed = true;
      return m;
    } finally {
      // Cleanup errors cannot turn a successful commit into an apparent failure.
      try { if (committed) await clean(dir, generation); else await dir.removeEntry(generation, { recursive: true }); } catch (_) {}
    }
  }
  async function remove(root, id) {
    const dir = await root.getDirectoryHandle(gameID(id));
    await dir.removeEntry('manifest.json');
    try { await clean(dir); } catch (_) {}
  }
  async function restore(root, FS, memstick) {
    const packs = await list(root);
    if (packs.reduce((n, p) => n + p.bytes, 0) > MAX_BYTES) throw new Error('Installed textures exceed the browser memory limit');
    for (const pack of packs) {
      const dir = await (await root.getDirectoryHandle(pack.id)).getDirectoryHandle(pack.generation);
      for (const entry of pack.files) {
        const parts = entry.name.split('/'), name = parts.pop();
        let source = dir;
        for (const part of parts) source = await source.getDirectoryHandle(part);
        const file = await read(source, name);
        if (file.size !== entry.size) throw new Error('Incomplete texture pack: ' + pack.id);
        const target = memstick + '/PSP/TEXTURES/' + pack.id + '/' + entry.name;
        FS.mkdirTree(target.slice(0, target.lastIndexOf('/')));
        FS.writeFile(target, new Uint8Array(await file.arrayBuffer()));
      }
    }
    return packs;
  }
  globalThis.PPSSPPTextures = { gameID, prepare, install, list, remove, restore, MAX_BYTES };
})();
