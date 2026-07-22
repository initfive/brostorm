# BROSTORM

A two-player local co-op run-and-gun with fully destructible terrain, in the
spirit of Broforce. Plain HTML5 + canvas — no build step, no dependencies, no
install. Original characters, art and level.

## Play

Double-click `index.html`. That's it.

If you'd rather serve it over HTTP:

```sh
cd brostorm
python3 -m http.server 8731
# then open http://localhost:8731
```

Both players share one keyboard. Player 1 lives on the left of the board,
player 2 on the right, so you can sit side by side.

## Controls

| Action | Player 1 | Player 2 |
|---|---|---|
| Move / aim | `A` `D` | `←` `→` |
| Aim up / down | `W` `S` | `↑` `↓` |
| Jump | `W` | `↑` |
| Fire | `F` *(or `J`)* | `.` *(or numpad `0`, right `Shift`)* |
| Special | `G` *(or `H`)* | `/` *(or numpad `1`, right `Ctrl`)* |

Global: `Esc` or `P` pause · `R` restart level · `Shift+R` quit to title ·
`M` mute · `Enter` confirm.

**Gamepads work too** — pad 1 is P1, pad 2 is P2. Left stick / d-pad to move,
`A` jump, `X`/triggers fire, `B`/bumpers special. Plug one in and it takes over
that player's slot automatically; you can mix keyboard and pad.

Player 2 can drop in at any time mid-mission — just press their fire key.

## Changing the controls

All key bindings live in one place: the `KEYMAPS` array at the top of
`js/core.js`. Each entry is a list of [`KeyboardEvent.code`][codes] strings, so
a player can have several keys bound to the same action.

```js
const KEYMAPS = [
  {
    left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'],
    jump: ['KeyW'], fire: ['KeyF', 'KeyJ'], special: ['KeyG', 'KeyH'],
    ...
  },
  ...
];
```

Want P1 to jump on space and fire on left-shift? Change that entry to
`jump: ['Space'], fire: ['ShiftLeft']`. Save, reload the page. Note `up` and
`jump` are separate actions — `up` aims upward, `jump` jumps — they just happen
to share a key by default on the keyboard.

Codes are physical key positions, not characters: `KeyA`, `Digit1`, `Space`,
`ArrowLeft`, `Numpad0`, `ShiftRight`, `Semicolon`. If you're unsure of a key's
code, open the browser console and run
`addEventListener('keydown', e => console.log(e.code))`, then press it.

If you add a key that the browser normally acts on (like `Tab` or `/`), also
add its code to the `PREVENT` set just above `KEYMAPS` so the page swallows it.

## The two bros

| | CPL. RAZOR | SGT. RUBBLE |
|---|---|---|
| Primary | Assault rifle — fast, accurate, unlimited | Combat shotgun — 7-pellet spread, huge knockback |
| Special | 4 × frag grenade (bounces, 1.25s fuse) | 3 × remote C4 |
| Movement | Quicker, jumps higher | Slower and heavier |
| Digging | Chews narrow tunnels | Blows wide holes through walls |

Both players may pick the same character.

**C4 works in two presses**: the first throw plants a charge, the next press of
the special key detonates everything you've planted. It never goes off on its
own — you decide when.

The shotgun's recoil is strong enough to rocket-jump with. Fire downward in
mid-air to gain height.

## Rules

- **One hit kills.** Yours, theirs, and your own explosives — grenades and C4
  will kill you and your partner. Mind the blast radius.
- **Lives are a shared pool** (start with 5). Dying spends one and you respawn
  next to your partner, or at your furthest checkpoint if they're down too.
- **Free the hostages** — touching one adds a life to the pool. There are six.
- **Everything except the world border is destructible.** Dirt is soft, wood is
  softer, stone takes real ordnance. Bedrock never breaks.
- **Barrels chain-react.** Shoot one near a bunker and watch the floor go.
- **Press into a wall in mid-air to cling**, hold up to climb, jump to kick off.
  This is the main way to handle vertical terrain.
- The camera is shared and will push a straggler along, so stay together.
- Mission ends when both surviving bros reach the extraction chopper at the far
  east end of the valley.

## Level

One campaign map, `OPERATION IRON GULCH` — 252 × 40 tiles, about nine sections:
landing zone, lava crossing, garrisoned bunker, buried tunnels, watchtower,
lava lake, a two-storey fortress, an open last stand, and the extraction pad.
50 entities placed by hand.

The map is generated from a fixed seed in `js/level.js`, so it's identical every
run but easy to edit — see the numbered section comments. `GROUND_POINTS` at the
top is the terrain skyline as `[tileX, surfaceTileY]` control points.

## Tuning

| What | Where |
|---|---|
| Key bindings | `KEYMAPS` in `js/core.js` |
| Gravity, jump feel, view size | top of `js/core.js` |
| Weapon stats (rate, spread, damage, carve radius) | `WEAPONS` in `js/entities.js` |
| Character stats, colours, loadouts | `CHARS` in `js/entities.js` |
| Enemy behaviour | `Grunt` / `Rusher` / `Turret` / `Barrel` classes, `js/entities.js` |
| Starting lives | `this.lives = 5` in `Game.start()`, `js/game.js` |
| Blast radii | `explode()` calls in `js/entities.js` |
| Level layout & enemy placement | `js/level.js` |

## Files

```
index.html          markup + overlay screens
css/style.css       shell, HUD, title and results screens
js/core.js          constants, math, keyboard + gamepad input
js/audio.js         procedural sound effects (Web Audio, no asset files)
js/terrain.js       destructible tile grid and its renderer
js/entities.js      physics, characters, weapons, enemies, projectiles, particles
js/level.js         the campaign map
js/game.js          game loop, camera, effects, UI wiring
```

Everything renders into a 480×270 canvas that's upscaled with nearest-neighbour
for a crisp pixel look; all text is DOM so it stays sharp at any window size.

[codes]: https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_code_values
