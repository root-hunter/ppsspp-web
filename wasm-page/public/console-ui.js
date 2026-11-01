/* Console navigation is independent of Angular and of SDL's filtered input stream. */
(() => {
  const defaults = { up: 12, down: 13, left: 14, right: 15, confirm: 0, back: 1, previous: 4, next: 5, fullscreen: 3 };
  const directions = ['up', 'down', 'left', 'right'];
  const pressed = (pad, index) => !!pad.buttons[index]?.pressed || pad.buttons[index]?.value > 0.5;
  function readActions(pad, mapping = defaults, previous = new Set(), dashboard = false) {
    const result = new Set();
    for (const [action, index] of Object.entries(mapping)) if (!['pagePrevious', 'pageNext'].includes(action) && !(pad.mapping === 'standard' && index === 16) && pressed(pad, index)) result.add(action);
    // A little hysteresis prevents drift around the activation threshold.
    for (const [action, axis, sign] of [['left', 0, -1], ['right', 0, 1], ['up', 1, -1], ['down', 1, 1]]) {
      if ((pad.axes[axis] || 0) * sign > (previous.has(action) ? 0.35 : 0.55)) result.add(action);
    }
    if (mapping.fullscreen === undefined && !Object.values(mapping).includes(3) && pressed(pad, 3)) result.add('fullscreen');
    if (!dashboard && mapping.menu === undefined && pressed(pad, 10) && pressed(pad, 11)) result.add('menu');
    return result;
  }
  function samplePageButtons(state, pad, mapping = defaults, dashboard = false, now = Date.now()) {
    if (!dashboard) { delete state.pageClicks; return []; }
    const assigned = Object.entries(mapping).filter(([action]) => !['pagePrevious', 'pageNext'].includes(action)).map(([, index]) => index);
    const indexFor = (action, fallback) => Number.isInteger(mapping[action]) ? mapping[action] : assigned.includes(fallback) ? null : fallback;
    const previousIndex = indexFor('pagePrevious', 10), nextIndex = indexFor('pageNext', 11);
    const left = previousIndex !== null && pressed(pad, previousIndex);
    const right = nextIndex !== null && pressed(pad, nextIndex);
    const prior = state.pageClicks || { left: false, right: false, chord: false, fired: false };
    const chord = prior.chord || (left && right);
    const started = (left && !prior.left) || (right && !prior.right) ? now : prior.started;
    let fired = prior.fired;
    if ((left || right) && !prior.left && !prior.right) fired = false;
    const events = [];
    // Give a simultaneous L3+R3 chord a short arbitration window, then fire once
    // while held. Short clicks still fire on release without waiting for a frame.
    if (!chord && !fired) {
      if (left && !right && now - started >= 75) { events.push('page-previous'); fired = true; }
      else if (right && !left && now - started >= 75) { events.push('page-next'); fired = true; }
      else if (prior.left && !left && !right) { events.push('page-previous'); fired = true; }
      else if (prior.right && !right && !left) { events.push('page-next'); fired = true; }
    }
    state.pageClicks = { left, right, chord: (left || right) && chord, fired, started };
    return events;
  }
  function rightStickScroll(pad, elapsedMs) {
    if (pad.mapping !== 'standard') return { x: 0, y: 0 };
    const x = Number.isFinite(pad.axes[2]) ? pad.axes[2] : 0;
    const y = Number.isFinite(pad.axes[3]) ? pad.axes[3] : 0;
    const magnitude = Math.hypot(x, y);
    if (magnitude <= .3) return { x: 0, y: 0 };
    const distance = Math.pow((Math.min(1, magnitude) - .3) / .7, 1.5) * 1100 * Math.min(50, Math.max(0, elapsedMs)) / 1000;
    return { x: x / magnitude * distance, y: y / magnitude * distance };
  }
  function samplePageInput(state, pad, mapping, dashboard, now) {
    // Stick drift and other connected pads must not suppress digital page clicks.
    // On opening/reconnecting, only wait for this pad's buttons to be released.
    if (!state.pageReady) {
      state.pageReady = !pad.buttons.some(button => button.pressed || button.value > .5);
      delete state.pageClicks;
      return [];
    }
    return samplePageButtons(state, pad, mapping, dashboard, now);
  }
  function neutral(pad) {
    return !pad.buttons.some(b => b.pressed || b.value > 0.5) && !pad.axes.slice(0, pad.mapping === 'standard' ? 4 : 2).some(a => Math.abs(a) > 0.35);
  }
  function sampleActions(state, actions, now) {
    const events = [];
    for (const action of actions) {
      if (!state.held.has(action)) { events.push(action); state.repeat.set(action, now + 380); }
      else if (directions.includes(action) && now >= state.repeat.get(action)) {
        events.push(action); state.repeat.set(action, now + 110);
      }
    }
    for (const action of state.held) if (!actions.has(action)) state.repeat.delete(action);
    state.held = actions;
    return events;
  }
  // Guide/PS is reserved on standard pads. Decide a tap only on release.
  function sampleGuideButton(state, down, now, holdMs = 650) {
    if (down) {
      if (state.guideStart === undefined) { state.guideStart = now; state.guideFired = false; }
      if (!state.guideFired && now - state.guideStart >= holdMs) {
        state.guideFired = true; return 'web-menu';
      }
    } else if (state.guideStart !== undefined) {
      const event = state.guideFired ? null : now - state.guideStart >= holdMs ? 'web-menu' : 'native-menu';
      delete state.guideStart; state.guideFired = false; return event;
    }
    return null;
  }
  function spatialTarget(origin, candidates, direction) {
    const horizontal = direction === 'left' || direction === 'right';
    const sign = direction === 'left' || direction === 'up' ? -1 : 1;
    const cx = origin.left + origin.width / 2, cy = origin.top + origin.height / 2;
    let best = null, score = Infinity;
    for (const candidate of candidates) {
      const r = candidate.rect;
      const dx = r.left + r.width / 2 - cx, dy = r.top + r.height / 2 - cy;
      const main = (horizontal ? dx : dy) * sign;
      if (main <= 2) continue;
      const cross = Math.abs(horizontal ? dy : dx);
      const aligned = horizontal
        ? r.top < origin.top + origin.height && r.top + r.height > origin.top
        : r.left < origin.left + origin.width && r.left + r.width > origin.left;
      const rank = main + cross * 2.5 + (aligned ? 0 : 10000);
      if (rank < score) { score = rank; best = candidate.element; }
    }
    return best;
  }
  // Also exposed for deterministic regression tests without starting a browser.
  window.PPSSPPConsoleNavigation = { readActions, sampleActions, sampleGuideButton, samplePageButtons, samplePageInput, rightStickScroll, spatialTarget, neutral, defaults };
  if (!window.PPSSPPConsole) return;
  const bridge = window.PPSSPPConsole;
  const byId = id => document.getElementById(id);
  const body = document.body;
  const storageKey = 'ppsspp_console_mappings_v1';
  let mappings = {};
  try { mappings = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch (_) {}
  let dialog = null, restoreFocus = null, editTarget = null, draft = '', caps = false, resolveConfirmation = null;
  let mappingStep = null, releaseGate = true;
  const states = new Map();
  const inputDebug = window.__ppssppControllerDiagnostics = { revision: 'paging-v8', lastButtons: [], lastPage: null };
  function updateInputDiagnostics(pads) {
    inputDebug.focused = document.hasFocus();
    inputDebug.selectedIndex = window.__ppssppActiveGamepadIndex;
    inputDebug.releaseGate = releaseGate;
    inputDebug.controllers = pads.map(pad => ({
      id: pad.id, index: pad.index, mapping: pad.mapping,
      buttons: Array.from(pad.buttons, (button, index) => pressed(pad, index) ? index : -1).filter(index => index >= 0),
      axes: Array.from(pad.axes, axis => Math.round(axis * 100) / 100),
      bindings: mappings[pad.id] || defaults,
    }));
    const active = inputDebug.controllers.find(pad => pad.buttons.length);
    if (active) inputDebug.lastButtons = active.buttons;
    const label = byId('controllerInputDiagnostic');
    const text = 'Input test · paging-v8 · ' + (pads.length ? pads.map(pad => pad.id).join(' / ') +
      ' · last buttons: ' + (inputDebug.lastButtons.join(', ') || 'none') : 'No controller detected. Press a button.') +
      (inputDebug.lastPage ? ' · ' + inputDebug.lastPage : '');
    if (label && label.textContent !== text) label.textContent = text;
  }
  const fullscreenMenuOpen = () => byId('fsMenuToggle')?.getAttribute('aria-expanded') === 'true';
  const recoveryOpen = () => byId('runtimeRecovery')?.hidden === false;
  const uiOpen = () => body.classList.contains('panel-open') || byId('gameInfoModal')?.classList.contains('visible') || byId('saveInfoModal')?.classList.contains('visible') || !!dialog || fullscreenMenuOpen() || recoveryOpen();
  const controlsSelector = 'button, label.btn, summary, input:not([type="file"]), select, textarea, a[href], [tabindex="0"]';
  function root() {
    if (dialog) return dialog;
    if (byId('gameInfoModal')?.classList.contains('visible')) return byId('gameInfoModal');
    if (byId('saveInfoModal')?.classList.contains('visible')) return byId('saveInfoModal');
    if (body.classList.contains('panel-open')) return byId('sidePanel');
    return byId(fullscreenMenuOpen() ? 'fsMenuActions' : recoveryOpen() ? 'runtimeRecovery' : 'sidePanel');
  }
  function visible(el) {
    if (!el?.isConnected || el.closest('[inert], [hidden], .disabled') || !el.getClientRects().length || getComputedStyle(el).visibility === 'hidden') return false;
    // Closed details can still report rectangles for their unrendered contents.
    for (let parent = el.parentElement; parent; parent = parent.parentElement) {
      if (parent.tagName !== 'DETAILS' || parent.open) continue;
      const summary = [...parent.children].find(child => child.tagName === 'SUMMARY');
      if (!summary?.contains(el)) return false;
    }
    return true;
  }
  function controls(includeDisabled = false) {
    const container = root();
    const headerControls = container === byId('sidePanel') && !document.fullscreenElement && !document.webkitFullscreenElement ? [byId('demoActivityBtn'), byId('fullscreenBtn')].filter(Boolean) : [];
    const toolbarControls = container === byId('fsMenuActions') ? [byId('fsExitBtn')] : [];
    return [...headerControls, ...container.querySelectorAll(controlsSelector), ...toolbarControls].filter(el => visible(el) && (includeDisabled || !el.disabled));
  }
  const focusMemory = new WeakMap();
  function rememberFocus(el) {
    if (!uiOpen() || !controls().includes(el)) return;
    focusMemory.get(root())?.element.removeAttribute('data-console-focus-pending');
    focusMemory.set(root(), { element: el, id: el.id, rect: el.getBoundingClientRect(), region: el.closest('.tab-panel, .tabs, .session-dock') });
  }
  function focus(el) {
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    rememberFocus(document.activeElement);
  }
  document.addEventListener('focusin', event => rememberFocus(event.target));
  function recoverFocus() {
    const list = controls(), container = root();
    if (list.includes(document.activeElement)) {
      focusMemory.get(container)?.element.removeAttribute('data-console-focus-pending');
      return document.activeElement;
    }
    const saved = focusMemory.get(container);
    // A busy control still owns focus. Restore it when enabled, unless the user moves away.
    if (visible(saved?.element) && saved.element.disabled) {
      saved.element.setAttribute('data-console-focus-pending', 'true');
      return saved.element;
    }
    saved?.element.removeAttribute('data-console-focus-pending');
    let target = list.find(el => el === saved?.element || (saved?.id && el.id === saved.id));
    const neighbors = saved?.region && visible(saved.region) ? list.filter(el => saved.region.contains(el)) : [];
    if (!target && neighbors.length) {
      const center = r => [r.left + r.width / 2, r.top + r.height / 2];
      const [x, y] = center(saved.rect);
      target = neighbors.reduce((best, el) => {
        const distance = node => { const [cx, cy] = center(node.getBoundingClientRect()); return Math.hypot(cx - x, cy - y); };
        return !best || distance(el) < distance(best) ? el : best;
      }, null);
    }
    target ||= container === byId('sidePanel') ? list.find(el => el.matches('.tab.active')) || list.find(el => container.contains(el)) : list[0];
    focus(target);
    return target;
  }
  function prepareLabels() {
    document.querySelectorAll('label').forEach(el => {
      if (!el.matches('.btn') && !el.querySelector('input[type="file"]')) return;
      el.tabIndex = el.classList.contains('disabled') || el.control?.disabled ? -1 : 0;
    });
  }
  prepareLabels();
  const observer = new MutationObserver(() => {
    prepareLabels();
    if (uiOpen()) recoverFocus();
  });
  observer.observe(byId('sidePanel'), { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'hidden', 'class', 'open'] });
  for (const id of ['gameInfoModal', 'saveInfoModal']) observer.observe(byId(id), { attributes: true, attributeFilter: ['disabled', 'hidden', 'class', 'open'], childList: true, subtree: true });
  function sessionNavigationTarget(current, list, direction) {
    const resume = list.find(el => el.id === 'resumeSessionBtn');
    if (!resume) return null;
    const tab = list.find(el => el.matches?.('.tab.active'));
    const panelControls = list.filter(el => el.closest?.('.tab-panel.active'));
    if (current === resume) {
      if (direction === 'up') return tab || resume;
      if (direction === 'down') return panelControls[0] || resume;
      return resume;
    }
    if (direction === 'down' && current.closest?.('.tabs')) return resume;
    if (direction === 'up' && panelControls.includes(current)) {
      const firstRow = Math.min(...panelControls.map(el => el.getBoundingClientRect().top));
      if (current.getBoundingClientRect().top <= firstRow + 4) return resume;
    }
    return null;
  }
  function navigate(direction) {
    const list = controls(), current = list.includes(document.activeElement) ? document.activeElement : recoverFocus();
    if (!current) return;
    const target = sessionNavigationTarget(current, list, direction) || spatialTarget(current.getBoundingClientRect(), list.filter(el => el !== current).map(element => ({ element, rect: element.getBoundingClientRect() })), direction);
    if (target) focus(target);
  }
  function scrollControllerPage(pad, elapsedMs) {
    const movement = rightStickScroll(pad, elapsedMs);
    if (!movement.x && !movement.y) return;
    const container = root(), current = document.activeElement;
    const canScroll = el => {
      const style = getComputedStyle(el);
      return (movement.y && /auto|scroll/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 1)
        || (movement.x && /auto|scroll/.test(style.overflowX) && el.scrollWidth > el.clientWidth + 1);
    };
    let scroller = current;
    while (scroller && container.contains(scroller) && !canScroll(scroller)) scroller = scroller.parentElement;
    if (!scroller || !container.contains(scroller)) {
      const candidates = container === byId('sidePanel') ? [byId('logPanel'), container.querySelector('.tab-panel.active')]
        : [container.querySelector('.console-dialog-card, .game-info-dialog, .save-info-dialog'), container];
      scroller = candidates.find(el => el && visible(el) && canScroll(el));
    }
    if (!scroller) return;
    const before = scroller.scrollTop;
    scroller.scrollTop += movement.y;
    scroller.scrollLeft += movement.x;
    if (scroller.scrollTop === before || !scroller.contains(current)) return;
    const viewport = scroller.getBoundingClientRect(), rect = current.getBoundingClientRect();
    if (rect.bottom > viewport.top + 8 && rect.top < viewport.bottom - 8) return;
    const candidates = controls().filter(el => {
      if (!scroller.contains(el)) return false;
      const r = el.getBoundingClientRect();
      return r.bottom > viewport.top + 8 && r.top < viewport.bottom - 8;
    });
    const x = rect.left + rect.width / 2, y = Math.max(viewport.top + 8, Math.min(viewport.bottom - 8, rect.top + rect.height / 2));
    const distance = el => { const r = el.getBoundingClientRect(); return Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y); };
    const target = candidates.reduce((best, el) => !best || distance(el) < distance(best) ? el : best, null);
    if (target) { target.focus({ preventScroll: true }); rememberFocus(target); }
  }
  function closeDialog(commit = false) {
    if (commit && editTarget) {
      editTarget.value = draft;
      editTarget.dispatchEvent(new Event('input', { bubbles: true }));
      editTarget.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const resolve = resolveConfirmation; resolveConfirmation = null;
    dialog?.remove(); dialog = null; editTarget = null; mappingStep = null;
    releaseGate = true;
    if (resolve) resolve(commit);
    focus(restoreFocus); restoreFocus = null;
  }
  function createDialog(title) {
    restoreFocus = document.activeElement;
    dialog = document.createElement('div'); dialog.className = 'console-dialog';
    dialog.innerHTML = '<div class="console-dialog-card" role="dialog" aria-modal="true" aria-labelledby="consoleDialogTitle"><h2 id="consoleDialogTitle"></h2></div>';
    dialog.querySelector('h2').textContent = title;
    // A fullscreen descendant must own the dialog to keep it visible.
    (document.fullscreenElement || document.webkitFullscreenElement || body).append(dialog);
    return dialog.firstElementChild;
  }
  bridge.confirm = message => new Promise(resolve => {
    const card = createDialog('Confirm');
    const text = document.createElement('p'); text.textContent = message; card.append(text);
    const actions = document.createElement('div'); actions.className = 'console-dialog-actions'; card.append(actions);
    const cancel = button(actions, 'Cancel', () => closeDialog());
    button(actions, 'Confirm', () => closeDialog(true)).className = 'danger';
    resolveConfirmation = resolve; focus(cancel);
  });
  function button(parent, text, action) {
    const el = document.createElement('button'); el.type = 'button'; el.textContent = text; el.addEventListener('click', action); parent.append(el); return el;
  }
  function updateDraft() { byId('consoleKeyboardValue').textContent = editTarget.type === 'password' ? '•'.repeat(draft.length) : draft || ' '; }
  function keyboard(target) {
    const card = createDialog(target.getAttribute('aria-label') || target.labels?.[0]?.textContent.trim() || target.placeholder || 'Enter text');
    editTarget = target; draft = target.value; caps = false;
    const value = document.createElement('output'); value.id = 'consoleKeyboardValue'; value.className = 'console-keyboard-value'; card.append(value); updateDraft();
    const grid = document.createElement('div'); grid.className = 'console-keyboard'; card.append(grid);
    for (const char of '1234567890qwertyuiopasdfghjkl-zxcvbnm._/@:#?=&%+!') {
      const key = button(grid, char, () => {
        if (target.maxLength > 0 && draft.length >= target.maxLength) return;
        draft += caps ? char.toUpperCase() : char; updateDraft();
      });
      key.dataset.character = char;
    }
    const actions = document.createElement('div'); actions.className = 'console-dialog-actions'; card.append(actions);
    button(actions, 'Shift', () => { caps = !caps; grid.querySelectorAll('button').forEach(key => { key.textContent = caps ? key.dataset.character.toUpperCase() : key.dataset.character; }); });
    button(actions, 'Space', () => { if (!(target.maxLength > 0 && draft.length >= target.maxLength)) draft += ' '; updateDraft(); });
    button(actions, '⌫ Delete', () => { draft = draft.slice(0, -1); updateDraft(); });
    button(actions, 'Clear', () => { draft = ''; updateDraft(); });
    button(actions, 'Cancel', () => closeDialog());
    button(actions, 'Done', () => closeDialog(true)).className = 'primary';
    focus(grid.firstElementChild);
  }
  function selectOptions(target) {
    const label = target.labels?.[0]?.cloneNode(true);
    label?.querySelectorAll('select, input, textarea').forEach(el => el.remove());
    const card = createDialog(target.getAttribute('aria-label') || label?.textContent.trim() || 'Choose an option');
    const help = document.createElement('p'); help.textContent = 'Choose with the D-pad or stick. Select to apply, Back to cancel.'; card.append(help);
    const options = document.createElement('div'); options.className = 'console-select-options'; card.append(options);
    let selected = null;
    for (const option of target.options) {
      if (option.hidden || option.disabled || option.closest('optgroup')?.disabled || option.closest('optgroup')?.hidden) continue;
      const choice = button(options, option.label, () => {
        const changed = target.selectedIndex !== option.index;
        target.selectedIndex = option.index;
        closeDialog();
        if (changed) {
          target.dispatchEvent(new Event('input', { bubbles: true }));
          target.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      choice.setAttribute('aria-pressed', String(option.selected));
      if (option.selected) selected = choice;
    }
    const cancel = button(card, 'Cancel', () => closeDialog());
    focus(selected || options.firstElementChild || cancel);
  }
  function activate() {
    const el = document.activeElement;
    if (!controls().includes(el)) { recoverFocus(); return; }
    if (el.tagName === 'SELECT') { selectOptions(el); return; }
    if (el.matches('textarea, input:not([type="checkbox"]):not([type="radio"]):not([type="file"])')) {
      if (!el.readOnly) keyboard(el); return;
    }
    if (el.tagName === 'LABEL' && el.control?.type === 'file') {
      const input = el.control || el.querySelector('input');
      try { if (input?.showPicker) input.showPicker(); else input?.click(); }
      catch (_) { bridge.notify('Use touch, mouse or Enter to open the browser file picker.'); }
      return;
    }
    el.click();
  }
  function back() {
    if (dialog) { closeDialog(); return; }
    const openOptions = document.activeElement.closest('.collection-tools[open], .game-options[open], .save-slot[open]');
    if (openOptions) { openOptions.open = false; focus(openOptions.querySelector('summary')); return; }
    if (byId('gameInfoModal')?.classList.contains('visible')) { bridge.closeGameInfo(); return; }
    if (byId('saveInfoModal')?.classList.contains('visible')) { bridge.closeSaveInfo(); return; }
    if (fullscreenMenuOpen()) { bridge.setMenuOpen(false); return; }
    if (recoveryOpen() && !body.classList.contains('panel-open')) { bridge.switchTab('info'); return; }
    if (body.classList.contains('emulator-started')) bridge.setOpen(false);
    else { bridge.switchTab('library'); focus(document.querySelector('.tab.active')); }
  }
  function section(sign) {
    if (dialog || byId('gameInfoModal')?.classList.contains('visible') || byId('saveInfoModal')?.classList.contains('visible')) return;
    const tabs = [...document.querySelectorAll('.tab')];
    const index = tabs.findIndex(tab => tab.classList.contains('active'));
    const tab = tabs[(index + sign + tabs.length) % tabs.length];
    bridge.switchTab(tab.dataset.tab); focus(tab);
  }
  function action(name) {
    body.classList.add('console-controller');
    if (name === 'native-menu') {
      if (dialog) closeDialog();
      if (byId('gameInfoModal')?.classList.contains('visible')) bridge.closeGameInfo();
      if (byId('saveInfoModal')?.classList.contains('visible')) bridge.closeSaveInfo();
      bridge.nativeMenu(); return;
    }
    if (name === 'web-menu') {
      if (dialog) closeDialog();
      if (byId('gameInfoModal')?.classList.contains('visible')) bridge.closeGameInfo();
      if (byId('saveInfoModal')?.classList.contains('visible')) bridge.closeSaveInfo();
      bridge.setOpen(true); return;
    }
    if (name === 'fullscreen') { if (uiOpen() && !dialog) void bridge.fullscreen(); return; }
    if (name === 'menu') { if (dialog) back(); else bridge.setOpen(!body.classList.contains('panel-open')); return; }
    if (!uiOpen()) return;
    if (name === 'page-previous' || name === 'page-next') {
      if (!dialog && root() === byId('sidePanel')) {
        inputDebug.lastPage = name + ': requested';
        Promise.resolve(bridge.page?.(name === 'page-previous' ? -1 : 1)).then(changed => {
          inputDebug.lastPage = name + (changed ? ': changed' : ': no page change');
        }).catch(error => { inputDebug.lastPage = name + ': ' + error.message; });
      }
      return;
    }
    if (directions.includes(name)) navigate(name);
    else if (name === 'confirm') activate();
    else if (name === 'back') back();
    else if (name === 'previous' || name === 'next') section(name === 'previous' ? -1 : 1);
  }
  const mappingActions = [...directions, 'confirm', 'back', 'previous', 'next', 'menu'];
  function configure() {
    const pads = bridge.getGamepads().filter(Boolean);
    const pad = pads.find(p => p.index === window.__ppssppActiveGamepadIndex) || pads[0];
    if (!pad) { bridge.notify('Connect a controller and press a button first.'); return; }
    const card = createDialog('Configure UI controller');
    const help = document.createElement('p'); help.textContent = 'Use a D-pad for directions. The left stick also works. Press a different button for each action. This changes dashboard controls only.'; card.append(help);
    const prompt = document.createElement('p'); prompt.id = 'consoleMappingPrompt'; card.append(prompt);
    button(card, 'Cancel', () => closeDialog());
    mappingStep = { id: pad.id, index: pad.index, step: 0, mapping: {}, armed: false };
    prompt.textContent = 'Release all buttons, then press: UP'; focus(card.querySelector('button'));
  }
  function configurePageButtons() {
    const pads = bridge.getGamepads().filter(Boolean);
    const pad = pads.find(p => p.index === window.__ppssppActiveGamepadIndex) || pads[0];
    if (!pad) { bridge.notify('Connect a controller and press a button first.'); return; }
    const card = createDialog('Configure page buttons');
    const help = document.createElement('p');
    help.textContent = 'Press L3 for the previous page, then R3 for the next. Existing navigation bindings are preserved; choose a free button if a stick click is already assigned.';
    card.append(help);
    const prompt = document.createElement('p'); prompt.id = 'consoleMappingPrompt'; card.append(prompt);
    button(card, 'Cancel', () => closeDialog());
    const mapping = { ...defaults, ...mappings[pad.id] };
    delete mapping.pagePrevious; delete mapping.pageNext;
    mappingStep = { id: pad.id, index: pad.index, step: 0, mapping, actions: ['pagePrevious', 'pageNext'], armed: false };
    prompt.textContent = 'Release all buttons, then press L3 (previous page).';
    focus(card.querySelector('button'));
  }
  byId('configurePageButtonsBtn')?.addEventListener('click', configurePageButtons);
  byId('configureControllerBtn')?.addEventListener('click', configure);
  byId('resetControllerBtn')?.addEventListener('click', () => {
    mappings = {}; try { localStorage.removeItem(storageKey); } catch (_) {}
    byId('controllerMappingStatus').textContent = 'Standard UI layout restored.';
  });
  function capture(pad) {
    if (!pad || pad.id !== mappingStep.id || pad.index !== mappingStep.index) return;
    if (!pad.buttons.some(b => b.pressed || b.value > 0.5)) { mappingStep.armed = true; return; }
    if (!mappingStep.armed) return;
    const index = pad.buttons.findIndex(b => b.pressed || b.value > 0.5);
    if ((pad.mapping === 'standard' && index === 16) || Object.values(mappingStep.mapping).includes(index)) return;
    const actions = mappingStep.actions || mappingActions;
    mappingStep.mapping[actions[mappingStep.step++]] = index; mappingStep.armed = false;
    if (mappingStep.step === actions.length) {
      mappings[mappingStep.id] = mappingStep.mapping;
      try { localStorage.setItem(storageKey, JSON.stringify(mappings)); } catch (_) {}
      byId('controllerMappingStatus').textContent = 'Custom UI mapping saved for ' + pad.id;
      closeDialog(); releaseGate = true; return;
    }
    byId('consoleMappingPrompt').textContent = 'Release all buttons, then press: ' + (actions[mappingStep.step] === 'pageNext' ? 'R3 (next page)' : actions[mappingStep.step].toUpperCase());
  }
  document.addEventListener('consolevisibilitychange', () => { releaseGate = true; for (const state of states.values()) state.pageReady = false; window.__ppssppConsoleInputBlocked = true; });
  document.addEventListener('pointerdown', event => {
    body.classList.remove('console-controller');
    for (const detail of document.querySelectorAll('.collection-tools[open]')) if (!detail.contains(event.target)) detail.open = false;
  }, true);
  document.querySelectorAll('.collection-tools').forEach(detail => detail.addEventListener('toggle', () => {
    if (detail.open) for (const other of document.querySelectorAll('.collection-tools[open]')) if (other !== detail) other.open = false;
  }));
  // Capture before SDL's window listeners; leave browser editing/default behavior intact.
  window.addEventListener('keydown', event => {
    if (body.classList.contains('shared-playing')) return;
    if (window.__ppssppNativeMenuKey || window.__ppssppRemoteKey || document.activeElement?.id === 'sharedVideo' && !['Escape', 'Tab', 'F1', 'F10'].includes(event.key)) return;
    if (event.key === 'F10' || (event.key === 'Escape' && body.classList.contains('immersive-fullscreen') && !uiOpen())) { event.preventDefault(); event.stopImmediatePropagation(); void bridge.fullscreen(); return; }
    if (event.key === 'F1' && !dialog) { event.preventDefault(); event.stopImmediatePropagation(); bridge.setOpen(!body.classList.contains('panel-open')); return; }
    if (!uiOpen()) return;
    const el = document.activeElement;
    const editing = el?.matches('input:not([type="checkbox"]):not([type="file"]), textarea, select');
    const direction = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[event.key];
    if (direction && !editing) { event.preventDefault(); navigate(direction); }
    else if (event.key === 'Escape') { event.preventDefault(); back(); }
    else if ((event.key === 'Enter' || event.key === ' ') && el?.matches('label[tabindex="0"]')) { event.preventDefault(); el.control?.click(); }
    else if (event.key === 'Tab') {
      const list = controls(true); const anchor = list.includes(el) ? el : recoverFocus();
      const index = list.indexOf(anchor), sign = event.shiftKey ? -1 : 1;
      event.preventDefault();
      for (let offset = 1; offset <= list.length; offset++) {
        const next = list[(index + sign * offset + list.length) % list.length];
        if (!next.disabled) { focus(next); break; }
      }
    }
    if (event.defaultPrevented) event.stopImmediatePropagation();
  }, true);
  document.addEventListener('keydown', event => { if (uiOpen() && !window.__ppssppRemoteKey && !body.classList.contains('shared-playing')) event.stopPropagation(); });
  window.addEventListener('keyup', event => { if (uiOpen() && !body.classList.contains('shared-playing') && !window.__ppssppReleasingKeys && !window.__ppssppRemoteKey && document.activeElement?.id !== 'sharedVideo') event.stopImmediatePropagation(); }, true);
  document.addEventListener('visibilitychange', () => { states.clear(); releaseGate = true; });
  function poll(now) {
    requestAnimationFrame(poll);
    if (body.classList.contains('shared-playing') || document.activeElement?.id === 'sharedVideo') { states.clear(); releaseGate = true; window.__ppssppConsoleInputBlocked = true; return; }
    if (document.hidden || !document.hasFocus()) { states.clear(); releaseGate = true; inputDebug.focused = false; window.__ppssppConsoleInputBlocked = true; return; }
    const allPads = bridge.getGamepads().filter(pad => pad && pad.connected !== false);
    const selected = allPads.find(pad => pad.index === window.__ppssppActiveGamepadIndex);
    const pads = selected ? [selected] : allPads;
    updateInputDiagnostics(pads);
    if (!pads.length && byId('consoleInputStatus').textContent.includes('connected')) byId('consoleInputStatus').textContent = 'Keyboard · Mouse · Touch';
    const indexes = new Set(pads.map(pad => pad.index));
    for (const index of states.keys()) if (!indexes.has(index)) states.delete(index);
    if (releaseGate && pads.every(neutral)) releaseGate = false;
    window.__ppssppConsoleInputBlocked = !!uiOpen() || releaseGate;
    for (const pad of pads) {
      if (mappingStep) { capture(pad); continue; }
      let state = states.get(pad.index);
      const saved = mappings[pad.id];
      const mapping = saved && typeof saved === 'object' ? saved : defaults;
      if (!state) {
        // New/reconnected devices must first release controls to avoid accidental actions.
        states.set(pad.index, { id: pad.id, held: new Set(), repeat: new Map(), ready: neutral(pad), lastPoll: now }); continue;
      }
      if (state.id !== pad.id) { states.delete(pad.index); continue; }
      for (const name of samplePageInput(state, pad, mapping, uiOpen(), now)) action(name);
      if (!state.ready) { state.ready = neutral(pad); continue; }
      const elapsed = now - (state.lastPoll ?? now); state.lastPoll = now;
      const dashboard = uiOpen();
      const input = readActions(pad, mapping, state.held, dashboard);
      const guide = sampleGuideButton(state, pad.mapping === 'standard' && pressed(pad, 16), now);
      if (releaseGate) { state.held = input; state.repeat.clear(); continue; }
      const events = sampleActions(state, input, now);
      if (guide) events.push(guide);
      if (dashboard) scrollControllerPage(pad, elapsed);
      for (const name of events) {
        byId('consoleInputStatus').textContent = (pad.mapping === 'standard' ? 'Controller' : mappings[pad.id] ? 'Custom controller' : 'Generic · configure in System') + ' · connected';
        action(name);
      }
    }
  }
  window.__ppssppConsoleInputBlocked = true;
  if (!navigator.getGamepads) byId('consoleInputStatus').textContent = 'Controller API unavailable · use keyboard or touch';
  focus(document.querySelector('.tab.active'));
  requestAnimationFrame(poll);
})();
