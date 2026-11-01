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
