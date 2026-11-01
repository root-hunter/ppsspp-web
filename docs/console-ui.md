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
WASM runtime while the loop is paused. Return to session appears as a full-width
compact banner with a gameplay thumbnail, the game title/state and a distinct
Return to session button. The button is the banner's only focus target. Opening
the dashboard focuses it; Up returns to the active section tab, Down enters the
section's first control, and Up from its first row returns to the button. Left and
Right keep focus on the return action rather than jumping to distant controls.

A small 320 × 180 thumbnail is cached after rendering, at most four times per
second during gameplay, so WebGL buffer disposal cannot erase the last valid frame
when the loop pauses. Capture stops while paused, hidden or browsing the dashboard.
Missing/black frames retain the previous valid thumbnail; the game's icon is used
until a valid frame is available. Artwork loading cannot replace a captured frame.
The banner represents the current session. Closing
the menu resumes after the transition; reopening it cancels a pending resume. Held gameplay keyboard
keys are released before the menu takes focus. Resume is immediate with reduced
motion, and menu interactions cannot automatically restart paused audio.

Multiplayer sessions stay running and display **Multiplayer · live** to preserve
the connection. A core without paired pause/resume and keepalive controls also
stays running and is labelled accordingly. Suspension keeps the session in the
current tab; it is not a save state and does not survive reloading or closing it.

Library has one focusable tile per game. Select it to open the game details and
Play; startup preload, Drive upload and deletion live under Game options. Add
game imports local files, including ZIP archives. Library options contains the emulator start action,
URL download and refresh. Search filters the full collection by title/filename; sorting uses the game title
or file size. Both the library and demo catalog use twelve items per page and the
same paging controls. Reloading a collection preserves the focused tile.

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
| Open dashboard during gameplay | L3 + R3 together | F1 |
| Previous / next collection page | L3 / R3 click (on release) | Focus Previous / Next and press Enter |
| Scroll the active page or dialog | Right stick | Wheel / native scrolling |
| Fullscreen | Y / Triangle in a menu | F10 |
| Edit a dropdown | Select opens options; D-pad moves; Select applies; Back cancels | Native select keys |
| Enter text | Select a field to open the on-screen keyboard | Type normally |

Directions always move between dashboard controls, including dropdowns. Select
opens a controller-friendly options dialog at the current value, without changing
it; Back cancels. Applying a different option emits the native input/change events
and restores focus to the dropdown. Native mouse and keyboard select behavior is
preserved. Temporarily disabled action buttons retain their focus anchor while
busy. Re-enabling restores focus only if the user has not moved elsewhere; navigation
can leave a busy button immediately. Replaced controls recover by ID or by the
nearest available control in the same section, rather than jumping to Fullscreen.

The on-screen keyboard supports letters, digits, URL punctuation, Shift, Space,
Delete, Clear, Cancel and Done. Passwords remain masked. Native text editing,
mouse and touch remain available. Details, checkboxes, file labels, collection tiles and dialogs participate in
focus navigation. Closed options expose only their summary until expanded.
Back collapses open slot/options details before closing the
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
custom mappings, dropdown apply/cancel, focus during asynchronous actions,
closed-panel exclusion, stick drift/hysteresis, button edge/repeat behavior, neutral
release checks and spatial focus movement, alongside the runtime and transport
suites. Metadata tests cover SFO bounds checks, bounded PBP icon reads, save
grouping, state/preview pairing and exporting current live bytes. Session tests
cover keepalive ownership, interrupted resume transitions, multiplayer exclusion,
paused audio, release of held keys and fullscreen fallback. `npm run build` checks the Angular template and production bundle.


## Public demo library

Games → Discover PSP demos loads the 202-entry PlayDreamCreate catalog from
`https://playdreamcreate.com/data/demos.json`. The source currently returns the
full catalog even with `?search=...`; title/product-code search and region filters
run locally. The catalog shows twelve cards per page with All demos / Installed
views, title/region filters, alphabetical or smallest-first sorting, and accessible
Previous / Next controls. Filtering resets the page; switching pages preserves the corresponding card position, clamping to the final
card when the last page is shorter. Empty, loading and retry states remain explicit.
Cards use local typographic artwork and offer Install demo, a direct ZIP fallback,
and Open demo after installation. Installed games persist in OPFS and use the normal
game details, embedded artwork, preload and emulator workflows.

`server/serve.py` serves `GET /api/demos/catalog` and
`GET /api/demos/download?file=<archive.zip>`. This read-only gateway is required
for integrated downloads because `data.playdreamcreate.com` currently has no
Access-Control-Allow-Origin header. It accepts only simple ZIP filenames on that
fixed HTTPS origin, refuses redirects, applies timeouts/size limits and streams
responses without keeping a second cached ZIP. Static hosting can load the catalog
through its public CORS endpoint; download a ZIP with the card link and import it
through Add game when the gateway is unavailable. Restart the Python server after
updating; rebuild the Angular app for the updated UI.

The shared ZIP importer is used by Add game and URL/Drive ZIP imports. It handles
stored and deflate entries, checks CRC and sizes, rejects traversal, duplicate
paths, symlinks, encryption and multi-volume/ZIP64 archives, and limits extraction
to 512 MiB and 4096 entries. Deflate extraction requires browser support for
`DecompressionStream('deflate-raw')`. Other archive formats must be extracted first.
EBOOT.PBP packages retain relative companion files in OPFS metadata storage;
launch and startup preload reconstruct `/games/<id>.package/EBOOT.PBP` plus its
companions. Ordinary ISO/CSO/CHD/PBP files remain ordinary library games.
Deleting a game also removes its package files. ZIPs themselves are not kept.

Validation includes ZIP fixtures, malformed archives, catalog origin validation,
package install/mount integration tests, and gateway tests:
`python3 -m unittest discover -s server/tests -p test_demo_archive.py -v`.
A Chrome end-to-end check downloaded Ape Academy 2 (UCES00302), verified its
embedded title/artwork, reloaded to confirm persistence, and booted its EBOOT in
the existing PPSSPP WASM core. This verifies that demo; compatibility for other
titles still depends on the emulator and individual demo.


### Demo installation feedback

Download activity is a collapsed row with the demo title, current phase and actual
percentage. Its two-pixel progress track and header activity button remain visible
without opening a large notification or scrolling away from the selected game.
Select the row or header activity button to expand byte counts, speed/ETA and
Cancel / Retry / Open actions; Close details collapses it again. Download, extract
and install percentages still use actual completed bytes for the current phase.
Unknown totals stay indeterminate. Success and errors stay in the same row until
dismissed, without an additional completion toast. Stage and milestone screen-reader
announcements remain available. Catalog headings and empty states use short labels.

Additional tests cover combined filtering/sorting/pagination, measured transfer
metrics, extraction/install byte callbacks and focus across terminal states.
A throttled Chrome check exercised real download cancellation/retry, all three
installation phases, persistent success, cross-section activity navigation,
recoverable server errors and a 390px mobile viewport without horizontal overflow.

## Browser isolation recovery

The threaded core requires a secure top-level document and cross-origin isolation.
GitHub Pages supplies no COOP/COEP headers itself; the app service worker adds them
on the controlled navigation. Startup waits for actual document control, coalesces
concurrent controller-change/launch requests, and counts only reloads that will
navigate through that worker. Recovery uses a fresh navigation URL so a manual
reload cannot keep bypassing worker isolation; document requests also bypass HTTP
validation of older non-isolated HTML. Registration/control failures report their cause
without spending retry attempts. A healthy isolated page resets stale counters.

An isolation failure exposes Repair web runtime and Open in a separate tab in the
Games section. Repair updates the app's service-worker registration with HTTP-cache
bypass, resets the reload counter, and navigates to a fresh app URL. It does not
unregister other workers, clear Cache Storage, or remove OPFS games/saves. Insecure
contexts, embedded views, denied Permissions-Policy and exhausted retries have
separate messages. Do not add `unsafe-eval` to solve extension content-script CSP
errors; those errors must be investigated in the extension that produced them.

The public Pages deployment was inspected on 2026-11-01: it still served
`2026-11-01-guide-menu-v1`, and a clean Chrome profile successfully obtained
`crossOriginIsolated=true` and `SharedArrayBuffer`. Local fixes and the demo UI
require a new Pages deployment before they appear at the public URL.

A local Chrome static-hosting test verified first-load isolation, recovery after a
manual reload with an exhausted retry counter, and an explicit Permissions-Policy
block without an automatic reload loop. The public deployment was only inspected;
these changes have not been published to GitHub Pages from this workspace.

Compact UI validation: a Chrome check measured a 64px session banner and 56px closed
transfer row at 390px width, exercised expand/collapse and a real demo download,
confirmed no extra completion toast, and verified icon updates after native boot
messages and library refreshes. Unit tests cover frame/icon fallback, package/fast-mount
boot paths and stale asynchronous artwork requests.

Session action validation additionally covers directional controller transitions,
gameplay-frame capture with an icon present, retaining frames after WebGL buffer
clearing, and sampling exclusion while paused/hidden.

A Chrome check with Ape Academy 2 running in the actual WASM core verified a valid
rendered-frame thumbnail before pause, initial focus on the separate Return to
session button, simulated controller Up/Down/Left/Confirm navigation, session resume,
and the 390px mobile layout. This does not replace physical controller testing.


## Controller collection navigation

Standard-mapped controllers use L3 for the previous collection page and R3 for the
next. Clicks fire on release once, with no hold repeat; pressing both together in
the dashboard does not turn pages or close the menu. The L3+R3 dashboard shortcut
remains available during gameplay. Custom UI bindings assigned to these buttons
take precedence. Paging is scoped to the focused collection (library or demos),
or the visible collection when focus is on the header/session controls. Dialogs
and non-library sections do not turn background collection pages. Page limits do
not wrap or move focus. The controller footer reports Games / Demos and the current
page, including on mobile. Pagination buttons are above each grid.

The right stick scrolls the nearest scrollable page, form or dialog with a radial
dead zone and speed proportional to deflection. It does not change left-stick
selection directions. When a focused item leaves the viewport during scrolling,
focus follows a visible control without scrolling back. Input gates stop scrolling
and page clicks across focus loss, reconnects and dashboard transitions. Right-stick
axes are read only on standard-mapped controllers, avoiding generic trigger axes.
Gameplay input remains with SDL while the web UI is closed.

Validation includes shared pagination/filter/sort tests, visible-page-only artwork
reads, page button edges/chord/custom-binding checks and scroll dead-zone/timing
checks. A Chrome controller simulation exercised a 35-game library, incomplete
last pages, selection preservation, full-library search, right-stick scrolling,
demo paging, modal exclusion and a 390px mobile viewport.
