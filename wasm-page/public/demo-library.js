/* Public demo catalog and bounded ZIP reader. No remote scripts are executed. */
(() => {
  'use strict';
  const MAX_BYTES = 512 * 1024 * 1024;
  function catalog(records) {
    if (!Array.isArray(records)) throw new Error('Invalid demo catalog');
    return records.flatMap(record => {
      const url = new URL(record.url);
      if (url.origin !== 'https://data.playdreamcreate.com' || !/^\/[a-zA-Z0-9_./-]+\.zip$/i.test(url.pathname) || url.search || url.hash || url.username || url.password) return [];
      if (!/^[a-zA-Z0-9_-]+$/.test(record.productCode) || typeof record.title !== 'string') return [];
      return [{ ...record, url: url.href, region: String(record.region).toUpperCase(), name: record.productCode + '.pbp' }];
    });
  }
  const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
    for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
    return value >>> 0;
  });
  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255];
    return (crc ^ 0xffffffff) >>> 0;
  }
  function safePath(path) {
    if (!path || path.includes('\\') || path.startsWith('/') || path.includes(':') || /[\x00-\x1f]/.test(path) || path.split('/').some(p => p === '..' || p === '.')) throw new Error('Unsafe ZIP path');
    return path;
  }
  async function unzip(input, onProgress = () => {}) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    if (bytes.length > MAX_BYTES) throw new Error('ZIP exceeds 512 MB');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let end = bytes.length - 22;
    for (; end >= Math.max(0, bytes.length - 65557); end--) {
      if (view.getUint32(end, true) === 0x06054b50 && end + 22 + view.getUint16(end + 20, true) === bytes.length) break;
    }
    if (end < 0 || end < bytes.length - 65557) throw new Error('Invalid ZIP directory');
    const count = view.getUint16(end + 10, true);
    if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true) || count !== view.getUint16(end + 8, true) || count > 4096) throw new Error('Unsupported ZIP volume or entry count');
    let offset = view.getUint32(end + 16, true), total = 0;
    const directoryEnd = offset + view.getUint32(end + 12, true);
    if (directoryEnd > end) throw new Error('Invalid ZIP directory bounds');
    const entries = [], seen = new Set();
    for (let i = 0; i < count; i++) {
      if (offset + 46 > directoryEnd || view.getUint32(offset, true) !== 0x02014b50) throw new Error('Invalid ZIP entry');
      const flags = view.getUint16(offset + 8, true), method = view.getUint16(offset + 10, true);
      const crc = view.getUint32(offset + 16, true), compressed = view.getUint32(offset + 20, true), size = view.getUint32(offset + 24, true);
      const nameLength = view.getUint16(offset + 28, true);
      const next = offset + 46 + nameLength + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
      if (next > directoryEnd) throw new Error('Invalid ZIP name bounds');
      const name = safePath(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(offset + 46, offset + 46 + nameLength)));
      const local = view.getUint32(offset + 42, true);
      const mode = view.getUint32(offset + 38, true) >>> 16;
      if (flags & 1 || ![0, 8].includes(method) || (mode & 0xf000) === 0xa000) throw new Error('Encrypted ZIP, links or compression method unsupported');
      if (seen.has(name.toLowerCase())) throw new Error('Duplicate ZIP path');
      seen.add(name.toLowerCase());
      total += size;
      if (total > MAX_BYTES) throw new Error('Extracted ZIP exceeds 512 MB');
      if (local + 30 > offset || view.getUint32(local, true) !== 0x04034b50) throw new Error('Invalid ZIP local header');
      const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
      if (start + compressed > view.getUint32(end + 16, true)) throw new Error('Invalid ZIP data bounds');
      if (!name.endsWith('/')) entries.push({ name, method, crc, size, compressed: bytes.subarray(start, start + compressed) });
      offset = next;
    }
    if (offset !== directoryEnd) throw new Error('Invalid ZIP directory size');
    const files = [];
    let extracted = 0;
    await onProgress({ completed: 0, total, files: entries.length, name: "" });
    for (const entry of entries) {
      let data = entry.compressed;
      if (entry.method === 8) {
        let stream;
        try { stream = new DecompressionStream('deflate-raw'); }
        catch (_) { throw new Error('This browser cannot extract ZIP files. Update your browser or import the extracted PBP.'); }
        const reader = new Blob([data]).stream().pipeThrough(stream).getReader();
        const chunks = []; let size = 0;
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.length;
          if (size > entry.size) { await reader.cancel(); throw new Error('Invalid ZIP expanded size'); }
          chunks.push(part.value);
          await onProgress({ completed: extracted + size, total, files: entries.length, name: entry.name });
        }
        data = new Uint8Array(size); let at = 0;
        for (const chunk of chunks) { data.set(chunk, at); at += chunk.length; }
      }
      if (data.length !== entry.size || crc32(data) !== entry.crc) throw new Error('ZIP checksum mismatch: ' + entry.name);
      files.push({ name: entry.name, data });
      extracted += entry.size;
      await onProgress({ completed: extracted, total, files: entries.length, name: entry.name });
    }
    return files;
  }
  function packages(files, archiveName) {
    const boots = files.filter(f => /(^|\/)EBOOT\.PBP$/i.test(f.name));
    if (boots.length) return boots.map(boot => {
      const root = boot.name.slice(0, -9);
      const id = root.split('/').filter(Boolean).pop() || archiveName.replace(/\.zip$/i, '');
      if (boot.data.length < 40 || new DataView(boot.data.buffer, boot.data.byteOffset, boot.data.byteLength).getUint32(0, true) !== 0x50425000) throw new Error('Invalid EBOOT.PBP');
      return { name: id.replace(/[^a-zA-Z0-9._-]/g, '_') + '.pbp', data: boot.data, boot: true,
        files: files.filter(f => f !== boot && f.name.startsWith(root)).map(f => ({ name: safePath(f.name.slice(root.length)), data: f.data })) };
    });
    const games = files.filter(f => /\.(iso|cso|chd|pbp|elf|prx)$/i.test(f.name));
    if (!games.length) throw new Error('No PSP game found in ZIP');
    return games.map(f => ({ name: f.name.split('/').pop(), data: f.data, files: [] }));
  }
  function browse(records, installed, options = {}) {
    const query = (options.query || '').trim().toLocaleLowerCase();
    const matches = records.filter(d => (!options.region || d.region === options.region)
      && (!options.installedOnly || installed.has(d.name))
      && (d.title + ' ' + d.productCode + ' ' + d.region).toLocaleLowerCase().includes(query));
    matches.sort((a, b) => options.sort === 'size'
      ? (a.fileSizeBytes || 0) - (b.fileSizeBytes || 0) || a.title.localeCompare(b.title)
      : (options.sort === 'title-desc' ? -1 : 1) * a.title.localeCompare(b.title));
    const pageSize = Math.max(1, options.pageSize || 12);
    const pages = Math.max(1, Math.ceil(matches.length / pageSize));
    const page = Math.min(pages, Math.max(1, options.page || 1));
    return { records: matches.slice((page - 1) * pageSize, page * pageSize), total: matches.length, page, pages,
      first: matches.length ? (page - 1) * pageSize + 1 : 0, last: Math.min(page * pageSize, matches.length) };
  }
  function transferMetrics(received, total, started, now) {
    const elapsed = Math.max(0, (now - started) / 1000);
    const speed = elapsed >= 1 ? received / elapsed : 0;
    return { percent: total > 0 ? Math.min(100, Math.floor(received / total * 100)) : null,
      speed, remaining: total > received && speed > 0 ? Math.ceil((total - received) / speed) : null };
  }
  globalThis.PPSSPPDemos = { catalog, unzip, packages, safePath, crc32, browse, transferMetrics };
})();
