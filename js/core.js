// ---------------------------------------------------------------------------
// BROSTORM - constants, math helpers, input
// ---------------------------------------------------------------------------

const T = 16;            // tile size, world pixels
const VIEW_W = 480;      // internal render resolution (upscaled to fit window)
const VIEW_H = 270;
const STEP = 1 / 60;     // fixed simulation timestep

const GRAVITY = 900;
const TERMINAL_VY = 640;

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function sgn(v) { return v < 0 ? -1 : v > 0 ? 1 : 0; }
function rand(a, b) { return a + Math.random() * (b - a); }
function randInt(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function dist2(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; }
function approach(v, target, amount) {
  return v < target ? Math.min(v + amount, target) : Math.max(v - amount, target);
}

// Deterministic PRNG (xorshift32) so the level looks identical every run.
function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return function () {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

// Stable per-tile noise, used for terrain texture variation.
function hash2(x, y) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// --- keyboard -------------------------------------------------------------

const PREVENT = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Slash',
  'Numpad0', 'Numpad1', 'Numpad2', 'Tab'
]);

const keyDown = new Set();
const keyHit = new Set();   // edge-triggered, cleared at the end of each frame

window.addEventListener('keydown', function (e) {
  if (!e.repeat) keyHit.add(e.code);
  keyDown.add(e.code);
  if (PREVENT.has(e.code)) e.preventDefault();
});
window.addEventListener('keyup', function (e) { keyDown.delete(e.code); });
window.addEventListener('blur', function () { keyDown.clear(); });

// A key counts as down if it is still held, or if it was tapped since the last
// poll. Without the keyHit half, a press-and-release shorter than one 16ms
// frame would fall between two samples and be dropped entirely.
function anyOf(codes) {
  for (let i = 0; i < codes.length; i++) {
    if (keyDown.has(codes[i]) || keyHit.has(codes[i])) return true;
  }
  return false;
}

// Keyboard layouts. Player 1 lives on the left of the board, player 2 on the
// right, so two people can share one keyboard without elbowing each other.
const KEYMAPS = [
  {
    left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'],
    jump: ['KeyW'], fire: ['KeyF', 'KeyJ'], special: ['KeyG', 'KeyH'],
    hint: 'WASD  ·  F fire  ·  G special'
  },
  {
    left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
    jump: ['ArrowUp'], fire: ['Period', 'Numpad0', 'ShiftRight'],
    special: ['Slash', 'Numpad1', 'ControlRight'],
    hint: 'Arrows  ·  .  fire  ·  /  special'
  }
];

// --- gamepads -------------------------------------------------------------

function padRaw(index) {
  const pads = navigator.getGamepads ? navigator.getGamepads() : null;
  if (!pads) return null;
  const gp = pads[index];
  if (!gp || !gp.connected) return null;
  const b = gp.buttons;
  const on = i => !!(b[i] && b[i].pressed);
  const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
  return {
    left: ax < -0.35 || on(14),
    right: ax > 0.35 || on(15),
    up: ay < -0.45 || on(12),
    down: ay > 0.45 || on(13),
    jump: on(0),
    fire: on(2) || on(5) || on(7),
    special: on(1) || on(4) || on(6),
    start: on(9)
  };
}

// Per-player control state with edge detection, merged keyboard + gamepad.
const CTL_KEYS = ['left', 'right', 'up', 'down', 'jump', 'fire', 'special', 'start'];

function makeControl() {
  const c = { usingPad: false };
  for (const k of CTL_KEYS) { c[k] = false; c[k + 'P'] = false; }
  return c;
}

function pollControl(ctl, playerIndex) {
  const km = KEYMAPS[playerIndex];
  const pad = padRaw(playerIndex);
  const raw = {
    left: anyOf(km.left), right: anyOf(km.right),
    up: anyOf(km.up), down: anyOf(km.down),
    jump: anyOf(km.jump), fire: anyOf(km.fire),
    special: anyOf(km.special), start: keyDown.has('Enter')
  };
  if (pad) {
    let padActive = false;
    for (const k of CTL_KEYS) {
      if (pad[k]) { raw[k] = true; padActive = true; }
    }
    if (padActive) ctl.usingPad = true;
  }
  for (const k of CTL_KEYS) {
    ctl[k + 'P'] = raw[k] && !ctl[k];
    ctl[k] = raw[k];
  }
  return ctl;
}
