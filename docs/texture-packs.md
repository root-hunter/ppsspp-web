# Replacement textures in the browser

Open **Storage → Replacement textures**, enter the game's ID (including the
correct region, for example `ULUS10567`), and import either a ZIP or the extracted
game ID folder. Find the ID in PPSSPP's game information. Supported layouts:

- `PSP/TEXTURES/ULUS10567/textures.ini` and images/subfolders.
- `ULUS10567/textures.ini` and images/subfolders.
- A ZIP with `textures.ini` and images directly at its root.

Keep the original filenames, subfolders and `textures.ini`. Packs without an INI
are accepted when texture images are present at the root. A pack's texture formats
and configuration must be compatible with the PPSSPP core and browser GPU.
ZIPs support stored and deflate compression; encrypted, multipart and ZIP64 archives
are unsupported. If browser ZIP decompression is unavailable, extract the ZIP
locally and import the game ID folder.

Restart the emulator after importing, replacing or removing a pack. On startup,
the app restores installed packs to `PSP/TEXTURES/<GAME_ID>/` and enables
`Graphics.ReplaceTextures` in the main config and existing overrides for those
games. Importing while playing does not change the running game's textures.

An import replaces the entire pack for that ID after confirmation. Images are
written into a new generation; the manifest is committed only after every file
has been saved. A failed import leaves the previous generation usable. Interrupted
staging is discarded on the next import. Web Locks serialize access across tabs
where supported. The storage list provides removal for each installed pack.

Limits are 20,000 files per pack, 512 MiB per ZIP (compressed and extracted), and
512 MiB of installed textures across all packs. Imports may temporarily need space
for both old and new generations. Large packs also consume browser and emulator
memory; these limits do not guarantee that every device can load a pack.

Packs are stored locally in OPFS, separately for guests and each server account.
They survive reloads, but are not included in save exports or cloud/server save
synchronization. Browser site-data deletion or **Clear All Saved Data** removes
local packs. Storage totals include installed textures. Managed texture files are
excluded from periodic save scanning, avoiding repeated copies into save storage.

## Validation

`npm --prefix wasm-page test` covers path and region validation, ZIP checksums and
entry limits, interrupted writes, failed manifest commits, complete replacement,
removal, profile separation, aggregate memory bounds, startup configuration, and
exclusion from periodic save scanning. Production packaging is checked with
`npm --prefix wasm-page run build`.

A Chrome smoke check also exercised the actual ZIP/folder inputs and OPFS:
install, page reload, startup filesystem restore, corrupt ZIP retention, complete
replacement and removal followed by another reload. Game rendering still needs
a check with a real game and its matching texture pack on the target device.
