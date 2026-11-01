# Console dashboard

The dashboard opens in Library, with horizontal sections for Saves, Network,
Drive, Storage, System, Logs and About. A short fade/scale transition connects
the dashboard and the emulator without changing the game canvas layout.

The menu uses animated vector waves inspired by the PSP interface. Animations
stop while the menu or document is hidden. System → Animated menu background
turns them off, and the operating system's reduced-motion preference is always
respected. Section changes, game details and launch artwork share short
transitions; the game canvas has no continuous effects while playing.

Fullscreen is available directly in the header, with a visible exit command in
the fullscreen game toolbar and dashboard. F10 toggles it from the keyboard;
Y / Triangle does so while navigating a menu. During gameplay that face button
continues to reach the PSP. If the browser refuses native fullscreen (including
controller input without a trusted gesture), an immersive shell hides the header
and fills the page. Escape can exit that fallback during gameplay.

Opening the dashboard suspends a ready **local** emulator using its main-loop
controls and silences its audio contexts. A keepalive reference preserves the
WASM runtime while the loop is paused. The session card shows Paused, the game
artwork or an available frame preview, and Resume. Closing the menu resumes after
the transition; reopening it cancels a pending resume. Held gameplay keyboard
keys are released before the menu takes focus. Resume is immediate with reduced
motion, and menu interactions cannot automatically restart paused audio.

Multiplayer sessions stay running and display **Multiplayer · live** to preserve
the connection. A core without paired pause/resume and keepalive controls also
stays running and is labelled accordingly. Suspension keeps the session in the
current tab; it is not a save state and does not survive reloading or closing it.

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
| Native PPSSPP menu | PS / Guide, short press | Escape during gameplay |
| Open dashboard | Hold PS / Guide for 650 ms | — |
| Open / close dashboard | L3 + R3 together | F1 |
| Fullscreen | Y / Triangle in a menu | F10 |
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

On standard-mapped controllers, PS / Guide (button 16) is reserved: a short
press sends the native menu shortcut on release; holding it for 650 ms opens
the web dashboard once, without also opening the native menu. Opening the web
menu suspends local sessions as described above. A short press from the web
menu first resumes the session, then opens the native menu. Guide never reaches
SDL directly, while all other gameplay controls retain their normal mappings.
Some operating systems or browsers reserve PS / Guide and never expose it to
the Gamepad API. Use L3 + R3 or F1 for the web menu in that case; generic pads
can map a dashboard button in System. PS / Guide cannot be reassigned by the
standard-controller configuration wizard.

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
grouping, state/preview pairing and exporting current live bytes. Session tests
cover keepalive ownership, interrupted resume transitions, multiplayer exclusion,
paused audio, release of held keys and fullscreen fallback. `npm run build` checks the Angular template and production bundle.
