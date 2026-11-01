# Console dashboard

The dashboard opens in Library, with horizontal sections for Saves, Network,
Drive, Storage, System, Logs and About. Opening it does not resize the game canvas
or pause emulation or multiplayer.

Library has one focusable tile per game. Select it to open the game details and
Play; startup preload, Drive upload and deletion live under Game options. Add
game imports local files. Library options contains the emulator start action,
URL download and refresh. Search filters titles and filenames; sorting uses the
game title or file size. Reloading a collection preserves the focused tile.

Icons and titles come from embedded ISO/PBP metadata. Unsupported formats or
missing artwork use a PSP placeholder. No cover images are fetched externally.

Saves are grouped by game ID. Each game tile shows its native PSP icon and counts
of save data slots and emulator states. Opening it shows slot titles and details
from PARAM.SFO, ICON0 artwork, and paired state previews. Expanding a slot exposes
Export, Drive upload when connected, and Delete. State previews are not counted
as separate saves. If a native icon is missing, matching library artwork or a
state preview is used, followed by the PSP placeholder.

Save slot exports and backups use the latest live emulator bytes over persisted
copies. Deletion confirmations can be operated with a controller; Cancel is
focused first. After a refresh or deletion, focus returns to the corresponding
game or an available neighboring tile. Import saves accepts both slot and full
backup files; Save options also provides native PSP folder import and backup
export.

Forms have visible labels and shared input/select/checkbox styles. Enter submits
URL download, multiplayer settings, Drive configuration and invitation import
without reloading the page. Multiplayer changes are applied by Save settings.

| Action | Standard controller | Keyboard |
| --- | --- | --- |
| Move focus | D-pad / left stick | Arrow keys / Tab / Shift+Tab |
| Select | Bottom face button (A / Cross) | Enter / Space |
| Back / return to game | Right face button (B / Circle) | Escape |
| Previous / next section | LB / RB (L1 / R1) | Focus a section and press Enter |
| Open / close dashboard | L3 + R3 together | F1 |
| Change a focused selector | Left / right; select advances | Native select keys |
| Enter text | Select a field to open the on-screen keyboard | Type normally |

The on-screen keyboard supports letters, digits, URL punctuation, Shift, Space,
Delete, Clear, Cancel and Done. Passwords remain masked. Native text editing,
mouse and touch remain available. Details, checkboxes, file labels, collection tiles and dialogs participate in
focus navigation. Back collapses open slot/options details before closing the
containing dialog.

## Controllers and compatibility

The UI uses the browser's [Gamepad API standard layout](https://www.w3.org/TR/gamepad/#remapping).
Xbox, PlayStation and other devices work with the default layout when the browser
maps them to `standard`. For generic devices or a different button preference,
open **System → Configure UI controller**. Follow the nine prompts using a D-pad
for directions and separate buttons for Select, Back, Previous, Next and Menu.
The left stick remains enabled. Mappings are stored per device ID in this browser;
**Reset UI mapping** clears them. Gameplay mapping inside PPSSPP is independent.

The active controller selector also applies to dashboard navigation. If that
controller disconnects, available controllers can take over. Devices must first
return to neutral after connection, tab switching or focus loss. Directions use a
dead zone, hysteresis and a repeat delay; action buttons fire only on a new press.
Input is ignored while the document is hidden or unfocused.

While a dashboard or dialog is open, the emulator receives neutral controller
states. On return to the game, all controls must be released before gameplay
input resumes. This prevents a menu selection from also pressing a gameplay button.

Gamepad exposure depends on the browser, operating system and device; press a
controller button if it has not appeared. Serve over HTTPS or localhost. Browser
file pickers, fullscreen prompts and external authentication can require a trusted keyboard, mouse or touch gesture; a controller's
synthetic click is not guaranteed to open them. Once imported, library games can
be selected without a file picker. Physical controller/browser combinations still
need device testing; simulated input cannot establish hardware compatibility.

## Validation

`npm test` in `wasm-page` includes navigation regression tests for standard and
custom mappings, stick drift/hysteresis, button edge/repeat behavior, neutral
release checks and spatial focus movement, alongside the runtime and transport
suites. Metadata tests cover SFO bounds checks, bounded PBP icon reads, save
grouping, state/preview pairing and exporting current live bytes. `npm run build` checks the Angular template and production bundle.
