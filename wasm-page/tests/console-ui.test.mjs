import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const context = vm.createContext({ window: {} });
vm.runInContext(readFileSync(new URL('../public/console-ui.js', import.meta.url), 'utf8'), context);
const { readActions, sampleActions, spatialTarget, neutral } = context.window.PPSSPPConsoleNavigation;
function pad(buttons = [], axes = [0, 0]) {
  return { buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: buttons.includes(i), value: buttons.includes(i) ? 1 : 0 })), axes };
}
test('standard controls, generic custom buttons and menu chord are independent', () => {
  assert.deepEqual([...readActions(pad([12, 0]))], ['up', 'confirm']);
  assert.deepEqual([...readActions(pad([10]))], []);
  assert.deepEqual([...readActions(pad([10, 11]))], ['menu']);
  assert.deepEqual([...readActions(pad([3, 8]), { confirm: 3, menu: 8 })], ['confirm', 'menu']);
});
test('left stick has a dead zone and hysteresis, including short/missing axis arrays', () => {
  assert.deepEqual([...readActions(pad([], [0.5, -0.5]))], []);
  const held = readActions(pad([], [0.8, -0.8]));
  assert.deepEqual([...held], ['right', 'up']);
  assert.deepEqual([...readActions(pad([], [0.4, -0.4]), undefined, held)], ['right', 'up']);
  assert.deepEqual([...readActions(pad([], [0.3, -0.3]), undefined, held)], []);
  assert.deepEqual([...readActions(pad([], []))], []);
});
test('holding confirm/back/menu never repeats; direction repeats after an initial delay', () => {
  const state = { held: new Set(), repeat: new Map() };
  const input = () => new Set(['confirm', 'back', 'menu', 'right']);
  assert.deepEqual([...sampleActions(state, input(), 0)], ['confirm', 'back', 'menu', 'right']);
  assert.deepEqual([...sampleActions(state, input(), 379)], []);
  assert.deepEqual([...sampleActions(state, input(), 380)], ['right']);
  assert.deepEqual([...sampleActions(state, input(), 489)], []);
  assert.deepEqual([...sampleActions(state, input(), 490)], ['right']);
  sampleActions(state, new Set(), 500);
  assert.deepEqual([...sampleActions(state, new Set(['confirm']), 510)], ['confirm']);
});
test('release gate requires all buttons and axes to return to neutral', () => {
  assert.equal(neutral(pad([0])), false);
  assert.equal(neutral(pad([], [0.8, 0])), false);
  assert.equal(neutral(pad([], [0.1, 0.1])), true);
});
test('generic trigger and hat axes at rest do not prevent UI activation', () => {
  assert.equal(neutral(pad([], [0, 0, -1, -1])), true);
  assert.equal(neutral({ ...pad([], [0, 0, 0.8, 0]), mapping: 'standard' }), false);
});

test('spatial movement follows rows and columns without jumping diagonally or wrapping', () => {
  const rect = (left, top, width = 100, height = 44) => ({ left, top, width, height });
  const candidates = [
    { element: 'diagonal', rect: rect(120, 60) },
    { element: 'same-row', rect: rect(240, 0) },
    { element: 'below', rect: rect(0, 130) },
    { element: 'behind', rect: rect(-120, 0) },
  ];
  assert.equal(spatialTarget(rect(0, 0), candidates, 'right'), 'same-row');
  assert.equal(spatialTarget(rect(0, 0), candidates, 'down'), 'below');
  assert.equal(spatialTarget(rect(0, 0), candidates, 'left'), 'behind');
  assert.equal(spatialTarget(rect(0, 0), candidates, 'up'), null);
});

test('fullscreen is a separate edge action and does not conflict with a custom face-button mapping', () => {
  assert.deepEqual([...readActions(pad([3]))], ['fullscreen']);
  assert.deepEqual([...readActions(pad([3]), { confirm: 3, back: 2 })], ['confirm']);
  assert.deepEqual([...readActions(pad([3]), { confirm: 0, back: 1 })], ['fullscreen']);
  const state = { held: new Set(), repeat: new Map() };
  assert.deepEqual([...sampleActions(state, new Set(['fullscreen']), 0)], ['fullscreen']);
  assert.deepEqual([...sampleActions(state, new Set(['fullscreen']), 1000)], []);
});

test('Guide tap waits for release and long press opens only the web menu once', () => {
  const { sampleGuideButton: sample } = context.window.PPSSPPConsoleNavigation;
  const state = {};
  assert.equal(sample(state, true, 0), null);
  assert.equal(sample(state, true, 400), null);
  assert.equal(sample(state, false, 401), 'native-menu');
  assert.equal(sample(state, false, 500), null);
  assert.equal(sample(state, true, 600), null);
  assert.equal(sample(state, true, 1249), null);
  assert.equal(sample(state, true, 1250), 'web-menu');
  assert.equal(sample(state, true, 2000), null);
  assert.equal(sample(state, false, 2100), null);
  assert.equal(sample(state, true, 2200), null);
  assert.equal(sample(state, false, 2300), 'native-menu');
});
test('Guide hold still works across a dropped frame and cannot be remapped to another UI action', () => {
  const { sampleGuideButton: sample } = context.window.PPSSPPConsoleNavigation;
  const state = {};
  sample(state, true, 100);
  assert.equal(sample(state, false, 800), 'web-menu');
  assert.equal(sample(state, false, 900), null);
  assert.deepEqual([...readActions({ ...pad([16]), mapping: 'standard' }, { confirm: 16 })], []);
  assert.deepEqual([...readActions(pad([16]), { confirm: 16 })], ['confirm']);
});

// Exercise the actual DOM-navigation functions with controlled focus and layout.
async function navigationFunctions(names, globals) {
  const { default: ts } = await import('typescript');
  const source = ts.createSourceFile('console-ui.js', readFileSync(new URL('../public/console-ui.js', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const functions = [];
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && names.includes(node.name?.text)) functions.push(node.getText(source));
    ts.forEachChild(node, visit);
  }
  visit(source);
  const ctx = vm.createContext(globals);
  vm.runInContext(functions.join('\n'), ctx);
  return ctx;
}
function control(id, left = 0, top = 0) {
  const attrs = new Map();
  return { id, disabled: false, isConnected: true, attrs,
    getBoundingClientRect: () => ({ left, top, width: 100, height: 44 }),
    setAttribute: (key, value) => attrs.set(key, value), removeAttribute: key => attrs.delete(key),
  };
}
test('all four controller directions can leave a dropdown without changing its value', async () => {
  for (const [direction, left, top] of [['left', -120, 0], ['right', 120, 0], ['up', 0, -60], ['down', 0, 60]]) {
    const select = { ...control('sort'), tagName: 'SELECT', value: 'title' };
    const neighbor = control('neighbor', left, top);
    let focused;
    const ctx = await navigationFunctions(['navigate'], {
      controls: () => [select, neighbor], document: { activeElement: select }, spatialTarget,
      focus: el => { focused = el; }, recoverFocus: () => assert.fail('Valid focus should be retained'),
    });
    ctx.navigate(direction);
    assert.equal(focused, neighbor); assert.equal(select.value, 'title');
  }
});
test('controller confirmation opens dropdown options without advancing the current value', async () => {
  const select = { ...control('sort'), tagName: 'SELECT', value: 'title' };
  let opened;
  const ctx = await navigationFunctions(['activate'], {
    document: { activeElement: select }, controls: () => [select], selectOptions: el => { opened = el; },
  });
  ctx.activate(); assert.equal(opened, select); assert.equal(select.value, 'title');
});
async function focusFixture() {
  const container = {}, region = { contains: el => el !== fullscreen };
  const fullscreen = control('fullscreenBtn', 300, -200), busy = control('networkTestBtn'), neighbor = control('networkSaveBtn', 120);
  const document = { activeElement: busy };
  let available = [fullscreen, busy, neighbor];
  const memory = new WeakMap();
  memory.set(container, { element: busy, id: busy.id, region, rect: busy.getBoundingClientRect() });
  const focused = [];
  const ctx = await navigationFunctions(['recoverFocus', 'navigate'], {
    document, root: () => container, byId: () => null, controls: () => available, focusMemory: memory, spatialTarget,
    visible: el => !!el?.isConnected || el === region,
    focus: el => { focused.push(el); document.activeElement = el; },
  });
  return { ctx, busy, neighbor, fullscreen, focused, document, memory, container, setAvailable: list => { available = list; } };
}
test('a temporarily disabled action retains its focus anchor and restores it when ready', async () => {
  const f = await focusFixture();
  f.busy.disabled = true; f.document.activeElement = null; f.setAvailable([f.fullscreen, f.neighbor]);
  assert.equal(f.ctx.recoverFocus(), f.busy); assert.deepEqual(f.focused, []);
  assert.equal(f.busy.attrs.get('data-console-focus-pending'), 'true');
  f.busy.disabled = false; f.setAvailable([f.fullscreen, f.busy, f.neighbor]);
  assert.equal(f.ctx.recoverFocus(), f.busy); assert.deepEqual(f.focused, [f.busy]);
  assert.equal(f.busy.attrs.has('data-console-focus-pending'), false);
});
test('navigation can leave a busy button and completion never steals valid focus', async () => {
  const f = await focusFixture();
  f.busy.disabled = true; f.document.activeElement = null; f.setAvailable([f.fullscreen, f.neighbor]);
  f.ctx.navigate('right'); assert.equal(f.document.activeElement, f.neighbor);
  f.busy.disabled = false; f.setAvailable([f.fullscreen, f.busy, f.neighbor]);
  assert.equal(f.ctx.recoverFocus(), f.neighbor); assert.deepEqual(f.focused, [f.neighbor]);
});
test('replaced controls recover by ID and removed controls recover within the same section', async () => {
  const f = await focusFixture();
  f.busy.isConnected = false; f.document.activeElement = null;
  const replacement = control('networkTestBtn'); f.setAvailable([f.fullscreen, replacement, f.neighbor]);
  assert.equal(f.ctx.recoverFocus(), replacement);
  f.document.activeElement = null; f.setAvailable([f.fullscreen, f.neighbor]);
  assert.equal(f.ctx.recoverFocus(), f.neighbor);
});

async function dropdownFixture() {
  const node = () => ({ children: [], append(el) { this.children.push(el); }, get firstElementChild() { return this.children[0]; } });
  const card = node(), choices = [], events = [];
  const option = (label, index, extra = {}) => ({ label, index, selected: index === 0, value: 'shared-value', closest: () => null, ...extra });
  const target = { selectedIndex: 0, getAttribute: () => null,
    labels: [{ cloneNode: () => ({ textContent: 'Mode', querySelectorAll: () => [] }) }],
    options: [option('First', 0), option('Second, same value', 1), option('Disabled', 2, { disabled: true }), option('Disabled group', 3, { closest: () => ({ disabled: true }) })],
    dispatchEvent: event => events.push(event.type),
  };
  let focused, closed = 0;
  const ctx = await navigationFunctions(['selectOptions'], {
    Event, document: { createElement: node },
    createDialog: title => { assert.equal(title, 'Mode'); return card; },
    button: (parent, text, action) => { const choice = { ...control(text), text, action }; parent.append(choice); choices.push(choice); return choice; },
    focus: el => { focused = el; }, closeDialog: () => { closed++; },
  });
  ctx.selectOptions(target);
  return { target, choices, events, focused, closed: () => closed };
}
test('dropdown editor skips disabled options, starts at the selection, and Cancel preserves it', async () => {
  const f = await dropdownFixture();
  assert.deepEqual(f.choices.map(c => c.text), ['First', 'Second, same value', 'Cancel']);
  assert.equal(f.focused, f.choices[0]); assert.deepEqual(f.events, []);
  f.choices[2].action(); assert.equal(f.target.selectedIndex, 0); assert.deepEqual(f.events, []); assert.equal(f.closed(), 1);
});
test('dropdown editor applies the selected index even when values match, emitting events only for a change', async () => {
  const f = await dropdownFixture();
  f.choices[0].action(); assert.deepEqual(f.events, []);
  f.choices[1].action(); assert.equal(f.target.selectedIndex, 1); assert.deepEqual(f.events, ['input', 'change']);
});

test('closed details exclude their contents even when the browser reports layout rectangles', async () => {
  const summary = { tagName: 'SUMMARY', contains: el => el === summary };
  const details = { tagName: 'DETAILS', open: false, children: [summary], parentElement: null };
  const element = { isConnected: true, closest: () => null, getClientRects: () => [{}], parentElement: details };
  Object.assign(summary, { ...element, tagName: 'SUMMARY' });
  const ctx = await navigationFunctions(['visible'], { getComputedStyle: () => ({ visibility: 'visible' }) });
  assert.equal(ctx.visible(element), false); assert.equal(ctx.visible(summary), true);
  details.open = true; assert.equal(ctx.visible(element), true);
  const outerSummary = { tagName: 'SUMMARY', contains: () => false };
  details.parentElement = { tagName: 'DETAILS', open: false, children: [outerSummary] };
  assert.equal(ctx.visible(summary), false); assert.equal(ctx.visible(element), false);
});
