// ---------------------------------------------------------------------------
// BROSTORM - "OPERATION IRON GULCH", the single campaign level
//
// The map is generated from a fixed seed, so it is byte-identical every run,
// but it is authored rather than random: a ground profile plus hand placed
// set pieces, section by section.
// ---------------------------------------------------------------------------

// Set by buildLevel() for whichever mission is loaded.
let LEVEL_W = 252;
let LEVEL_H = 40;
let LEVEL_NAME = 'OPERATION IRON GULCH';

// Ground surface control points: [tileX, surfaceTileY]. Lower y = higher ground.
const GULCH_GROUND = [
  [0, 26], [14, 26], [22, 24], [30, 24], [34, 27], [44, 27], [48, 24],
  [62, 22], [72, 22], [78, 26], [90, 28], [98, 30], [110, 30], [116, 26],
  [126, 24], [136, 24], [142, 28], [156, 28], [162, 25], [180, 25],
  [188, 28], [200, 29], [208, 26], [220, 24], [232, 24], [252, 24]
];

let GROUND_POINTS = GULCH_GROUND;

function groundAt(tx) {
  for (let i = 0; i < GROUND_POINTS.length - 1; i++) {
    const a = GROUND_POINTS[i], b = GROUND_POINTS[i + 1];
    if (tx >= a[0] && tx <= b[0]) {
      const t = b[0] === a[0] ? 0 : (tx - a[0]) / (b[0] - a[0]);
      const s = t * t * (3 - 2 * t);           // smoothstep, avoids hard creases
      return Math.round(lerp(a[1], b[1], s));
    }
  }
  return GROUND_POINTS[GROUND_POINTS.length - 1][1];
}

function buildGulch(game) {
  const ter = new Terrain(LEVEL_W, LEVEL_H);
  const rng = makeRng(0x5150);
  game.terrain = ter;

  // --- base ground ---------------------------------------------------------
  for (let x = 0; x < LEVEL_W; x++) {
    // Keep the landing zone dead flat. Elsewhere a little jitter breaks up the
    // skyline, but a step right where you spawn just blocks your first shot.
    const g = groundAt(x) + (x > 20 && rng() < 0.14 ? 1 : 0);
    for (let y = g; y < LEVEL_H; y++) {
      let t = DIRT;
      if (y > g + 5 + Math.floor(rng() * 3)) t = STONE;
      if (y >= LEVEL_H - 2) t = BEDROCK;
      ter.set(x, y, t);
    }
  }
  // sealed world border
  for (let y = 0; y < LEVEL_H; y++) { ter.set(0, y, BEDROCK); ter.set(1, y, BEDROCK); }
  for (let y = 0; y < LEVEL_H; y++) { ter.set(LEVEL_W - 1, y, BEDROCK); ter.set(LEVEL_W - 2, y, BEDROCK); }

  // scattered pockets of stone so digging is not uniformly easy
  for (let i = 0; i < 90; i++) {
    const x = Math.floor(rng() * LEVEL_W), y = groundAt(x) + 4 + Math.floor(rng() * 10);
    const r = 1 + Math.floor(rng() * 2);
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (ter.get(x + dx, y + dy) === DIRT) ter.set(x + dx, y + dy, STONE);
    }
  }

  // Backdrop mask is taken from the raw ground, before structures carve into
  // it, so excavated rock reads as enclosed and open sky stays open sky.
  ter.computeBackground();

  // World-space y of the real ground surface. Scans the built grid rather than
  // trusting groundAt(), because the base pass jitters some columns by a tile.
  function surf(tx) {
    for (let y = 0; y < LEVEL_H; y++) if (ter.solid(tx, y)) return y * T;
    return (LEVEL_H - 2) * T;
  }

  // -------------------------------------------------------------------------
  // helpers for set pieces
  // -------------------------------------------------------------------------
  function hut(tx, ty, w, h) {
    ter.markInterior(tx, ty, w, h);
    ter.fillRect(tx, ty, w, h, EMPTY);
    ter.outlineRect(tx, ty, w, h, STONE);
    for (let i = tx + 1; i < tx + w - 1; i++) ter.set(i, ty, WOOD);
  }
  function platform(tx, ty, w, t) {
    for (let i = 0; i < w; i++) { ter.set(tx + i, ty, t); ter.set(tx + i, ty + 1, t); }
  }
  function lavaPit(tx, w, depth) {
    for (let x = tx; x < tx + w; x++) {
      const g = groundAt(x);
      for (let y = g; y < g + depth; y++) ter.set(x, y, EMPTY);
      for (let y = g + depth - 3; y < g + depth; y++) ter.set(x, y, LAVA);
    }
  }
  function cave(tx, ty, len, r) {
    let x = tx, y = ty;
    for (let i = 0; i < len; i++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r + 1 && ter.get(x + dx, y + dy) !== BEDROCK)
          ter.set(x + dx, y + dy, EMPTY);
      }
      x += 1;
      y += rng() < 0.5 ? 0 : (rng() < 0.5 ? -1 : 1);
    }
  }

  const spawn = (E, tx, worldY) => game.enemies.push(new E(game, tx * T + T / 2, worldY));
  const powAt = (tx, worldY) => game.enemies.push(new Pow(game, tx * T + T / 2, worldY));
  const barrelAt = (tx, worldY) => game.enemies.push(new Barrel(game, tx * T + T / 2, worldY));

  // -------------------------------------------------------------------------
  // SECTION 1 (x 4-32) - landing zone, easy contact
  // -------------------------------------------------------------------------
  game.spawnX = 8 * T;
  game.spawnY = surf(8);
  platform(12, groundAt(12) - 6, 6, WOOD);
  spawn(Grunt, 18, surf(18));
  spawn(Grunt, 26, surf(26));
  barrelAt(23, surf(23));
  barrelAt(24, surf(24));
  // a guard warming his hands over an explosive barrel
  barrelAt(29, surf(29));
  game.props.push({ type: 'flame', x: 29 * T + 8, y: surf(29) - 14, phase: 1.1 });
  game.enemies.push(new Grunt(game, 31 * T, surf(31), 'warm'));

  // -------------------------------------------------------------------------
  // SECTION 2 (x 33-48) - first lava gap, cross it however you like
  // -------------------------------------------------------------------------
  lavaPit(34, 10, 9);
  platform(37, groundAt(37) - 4, 4, WOOD);
  spawn(Grunt, 45, surf(45));
  spawn(Rusher, 47, surf(47));

  // -------------------------------------------------------------------------
  // SECTION 3 (x 50-74) - the bunker: turret on the roof, garrison inside
  // -------------------------------------------------------------------------
  const bTop = groundAt(58) - 9;
  hut(52, bTop, 16, 10);
  ter.fillRect(56, bTop + 10, 2, 4, EMPTY);        // sunken doorway
  ter.fillRect(62, bTop + 4, 2, 2, EMPTY);         // window
  spawn(Turret, 60, bTop * T);
  spawn(Grunt, 55, (bTop + 9) * T);
  // asleep at his post inside the bunker
  game.props.push({ type: 'chair', x: 64 * T + 8, y: (bTop + 9) * T, facing: 1 });
  game.enemies.push(new Grunt(game, 64 * T, (bTop + 9) * T, 'sleep'));
  game.enemies.push(new Poster(game, 53 * T + 2, (bTop + 4) * T, 1));
  barrelAt(58, (bTop + 9) * T);
  barrelAt(59, (bTop + 9) * T);
  powAt(66, (bTop + 9) * T);
  spawn(Rusher, 71, surf(71));

  // -------------------------------------------------------------------------
  // SECTION 4 (x 76-100) - buried tunnels, dig or take the surface road
  // -------------------------------------------------------------------------
  cave(78, groundAt(80) + 7, 20, 2);
  powAt(88, (groundAt(88) + 8) * T);
  game.enemies.push(new Chicken(game, 92 * T, surf(92)));
  game.enemies.push(new Chicken(game, 95 * T, surf(95)));
  spawn(Rusher, 82, surf(82));
  spawn(Rusher, 86, surf(86));
  spawn(Grunt, 94, surf(94));
  barrelAt(97, surf(97));

  // -------------------------------------------------------------------------
  // SECTION 5 (x 102-122) - the watchtower, climb the walls
  // -------------------------------------------------------------------------
  const towerX = 106, towerBase = groundAt(towerX);
  ter.markInterior(towerX, towerBase - 20, 10, 20);
  ter.fillRect(towerX, towerBase - 20, 10, 20, EMPTY);
  ter.outlineRect(towerX, towerBase - 20, 10, 20, STONE);
  for (let f = 0; f < 3; f++) {
    const fy = towerBase - 5 - f * 5;
    for (let i = towerX + 1; i < towerX + 9; i++) ter.set(i, fy, WOOD);
    ter.set(towerX + (f % 2 ? 2 : 7), fy, EMPTY);   // staggered floor hatches
    ter.set(towerX + (f % 2 ? 3 : 6), fy, EMPTY);
  }
  ter.fillRect(towerX, towerBase - 1, 3, 2, EMPTY);
  game.enemies.push(new Poster(game, towerX + 1, (towerBase - 9) * T, 1));
  spawn(Turret, towerX + 5, (towerBase - 20) * T);
  spawn(Grunt, towerX + 3, (towerBase - 6) * T);
  spawn(Grunt, towerX + 7, (towerBase - 11) * T);
  powAt(towerX + 4, (towerBase - 16) * T);
  barrelAt(towerX + 8, (towerBase - 1) * T);
  spawn(Grunt, 120, surf(120));

  // -------------------------------------------------------------------------
  // SECTION 6 (x 124-152) - lava lake with pillars
  // -------------------------------------------------------------------------
  lavaPit(128, 20, 12);
  for (const px of [132, 138, 144]) {
    const g = groundAt(px);
    ter.fillRect(px, g - 3, 2, 12, STONE);
    spawn(Grunt, px, (g - 3) * T);
  }
  platform(148, groundAt(148) - 5, 5, WOOD);
  spawn(Rusher, 151, surf(151));

  // -------------------------------------------------------------------------
  // SECTION 7 (x 156-190) - the fortress, two floors and a lot of ordnance
  // -------------------------------------------------------------------------
  const fx = 160, fTop = groundAt(fx + 10) - 16;
  ter.markInterior(fx, fTop, 24, 17);
  ter.fillRect(fx, fTop, 24, 17, EMPTY);
  ter.outlineRect(fx, fTop, 24, 17, STONE);
  for (let i = fx + 1; i < fx + 23; i++) ter.set(i, fTop + 8, WOOD);
  ter.fillRect(fx + 4, fTop + 8, 3, 1, EMPTY);
  ter.fillRect(fx + 17, fTop + 8, 3, 1, EMPTY);
  ter.fillRect(fx, fTop + 13, 1, 4, EMPTY);        // side entrance
  ter.fillRect(fx + 23, fTop + 13, 1, 4, EMPTY);
  ter.fillRect(fx + 10, fTop, 4, 1, EMPTY);        // skylight
  spawn(Turret, fx + 4, fTop * T);
  spawn(Turret, fx + 20, fTop * T);
  spawn(Grunt, fx + 3, (fTop + 8) * T);
  spawn(Grunt, fx + 12, (fTop + 8) * T);
  spawn(Grunt, fx + 19, (fTop + 16) * T);
  spawn(Rusher, fx + 8, (fTop + 16) * T);
  spawn(Rusher, fx + 15, (fTop + 16) * T);
  barrelAt(fx + 6, (fTop + 16) * T);
  barrelAt(fx + 7, (fTop + 16) * T);
  barrelAt(fx + 17, (fTop + 8) * T);
  game.props.push({ type: 'chair', x: (fx + 2) * T + 8, y: (fTop + 16) * T, facing: 1 });
  game.enemies.push(new Grunt(game, (fx + 2) * T, (fTop + 16) * T, 'sleep'));
  game.enemies.push(new Poster(game, (fx + 1) * T, (fTop + 3) * T, 1));
  powAt(fx + 11, (fTop + 8) * T);
  powAt(fx + 21, (fTop + 16) * T);

  // -------------------------------------------------------------------------
  // SECTION 8 (x 192-218) - open ground, the last stand
  // -------------------------------------------------------------------------
  platform(196, groundAt(196) - 7, 6, WOOD);
  spawn(Grunt, 195, surf(195));
  spawn(Grunt, 199, (groundAt(196) - 7) * T);
  spawn(Rusher, 203, surf(203));
  spawn(Rusher, 206, surf(206));
  spawn(Grunt, 210, surf(210));
  spawn(Turret, 214, surf(214));
  barrelAt(208, surf(208));
  game.enemies.push(new Chicken(game, 201 * T, surf(201)));
  powAt(212, surf(212));

  // -------------------------------------------------------------------------
  // SECTION 9 (x 224-248) - extraction pad
  // -------------------------------------------------------------------------
  const padY = groundAt(232) - 4;
  ter.fillRect(226, padY, 20, 2, BEDROCK);
  for (let x = 226; x < 246; x++)
    for (let y = padY + 2; y < LEVEL_H; y++)
      if (ter.get(x, y) !== BEDROCK) ter.set(x, y, STONE);
  spawn(Grunt, 228, padY * T);
  spawn(Grunt, 243, padY * T);

  game.goal = { x: 232 * T, y: (padY - 3) * T, w: 12 * T, h: 5 * T };
  game.totalEnemies = game.enemies.filter(isScoredEnemy).length;
  return ter;
}

// ---------------------------------------------------------------------------
// "OPERATION BLACKTAP" - desert fuel refinery
//
// Sand and steel under a blistering sunset. The signature here is the
// pipelines: rupture one segment and the detonation walks the whole run,
// taking out anything standing near it.
// ---------------------------------------------------------------------------

const REFINERY_GROUND = [
  [0, 28], [16, 28], [26, 26], [40, 26], [46, 29], [58, 29], [64, 27],
  [80, 27], [88, 30], [104, 30], [112, 27], [130, 27], [138, 31], [152, 31],
  [160, 28], [178, 28], [186, 30], [200, 30], [208, 27], [228, 27],
  [236, 26], [262, 26]
];

function buildRefinery(game) {
  const ter = new Terrain(LEVEL_W, LEVEL_H);
  const rng = makeRng(0xB1A7);
  game.terrain = ter;

  // --- baked desert ground -------------------------------------------------
  for (let x = 0; x < LEVEL_W; x++) {
    const g = groundAt(x) + (x > 20 && rng() < 0.10 ? 1 : 0);
    for (let y = g; y < LEVEL_H; y++) {
      let t = DIRT;
      if (y > g + 4 + Math.floor(rng() * 3)) t = STONE;
      if (y >= LEVEL_H - 2) t = BEDROCK;
      ter.set(x, y, t);
    }
  }
  for (let y = 0; y < LEVEL_H; y++) { ter.set(0, y, BEDROCK); ter.set(1, y, BEDROCK); }
  for (let y = 0; y < LEVEL_H; y++) { ter.set(LEVEL_W - 1, y, BEDROCK); ter.set(LEVEL_W - 2, y, BEDROCK); }

  for (let i = 0; i < 70; i++) {
    const x = Math.floor(rng() * LEVEL_W), y = groundAt(x) + 3 + Math.floor(rng() * 9);
    const r = 1 + Math.floor(rng() * 2);
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (ter.get(x + dx, y + dy) === DIRT) ter.set(x + dx, y + dy, STONE);
    }
  }
  ter.computeBackground();

  function surf(tx) {
    for (let y = 0; y < LEVEL_H; y++) if (ter.solid(tx, y)) return y * T;
    return (LEVEL_H - 2) * T;
  }

  // --- refinery construction kit -------------------------------------------
  const spawn = (E, tx, worldY) => game.enemies.push(new E(game, tx * T + T / 2, worldY));
  const powAt = (tx, worldY) => game.enemies.push(new Pow(game, tx * T + T / 2, worldY));
  const barrelAt = (tx, worldY) => game.enemies.push(new Barrel(game, tx * T + T / 2, worldY));

  function catwalk(tx, ty, w) {
    for (let i = 0; i < w; i++) ter.set(tx + i, ty, METAL);
  }

  // A run of pipe. Segments are linked so a rupture propagates along the line.
  function pipeline(tx, ty, count, segTiles) {
    const line = [];
    for (let i = 0; i < count; i++) {
      const pipe = new Pipe(game, tx + i * segTiles, ty, segTiles);
      pipe.line = line;
      pipe.idx = i;
      line.push(pipe);
      game.enemies.push(pipe);
    }
    return line;
  }

  // Steel shell packed with fuel cells: breach it and the contents chain.
  function tank(tx, ty, w, h) {
    ter.markInterior(tx, ty, w, h);
    ter.fillRect(tx, ty, w, h, EMPTY);
    ter.outlineRect(tx, ty, w, h, METAL);
    game.props.push({ type: 'tank', x: tx * T, y: ty * T, w: w * T, h: h * T });
    for (let i = 2; i < w - 2; i += 2) barrelAt(tx + i, (ty + h - 1) * T);
    barrelAt(tx - 1, surf(tx - 1));                    // exposed valve outside
  }

  function pump(tx) { game.props.push({ type: 'pump', x: tx * T, y: surf(tx), phase: rng() * 6.3 }); }
  function flare(tx, h) { game.props.push({ type: 'flare', x: tx * T, y: surf(tx), h: h, phase: rng() * 6.3 }); }
  function mast(tx, h) { game.props.push({ type: 'tower', x: tx * T, y: surf(tx), h: h }); }

  // -------------------------------------------------------------------------
  // SECTION 1 (x 4-24) - perimeter
  // -------------------------------------------------------------------------
  game.spawnX = 8 * T;
  game.spawnY = surf(8);
  pump(16);
  mast(22, 40);
  spawn(Grunt, 19, surf(19));
  spawn(Grunt, 24, surf(24));
  barrelAt(13, surf(13));
  // the night shift, still asleep
  game.props.push({ type: 'chair', x: 11 * T + 8, y: surf(11), facing: 1 });
  game.enemies.push(new Grunt(game, 11 * T, surf(11), 'sleep'));
  game.enemies.push(new Chicken(game, 21 * T, surf(21)));

  // -------------------------------------------------------------------------
  // SECTION 2 (x 28-48) - the first pipeline, and a lesson in blast radius
  // -------------------------------------------------------------------------
  pipeline(28, groundAt(30) - 4, 9, 2);
  spawn(Grunt, 33, surf(33));
  // warming his hands over a drum of refined fuel
  barrelAt(36, surf(36));
  game.props.push({ type: 'flame', x: 36 * T + 8, y: surf(36) - 14, phase: 2.4 });
  game.enemies.push(new Grunt(game, 38 * T, surf(38), 'warm'));
  spawn(Rusher, 42, surf(42));
  spawn(Grunt, 44, surf(44));
  barrelAt(46, surf(46));
  flare(50, 46);

  // -------------------------------------------------------------------------
  // SECTION 3 (x 54-76) - tank farm
  // -------------------------------------------------------------------------
  tank(56, groundAt(60) - 11, 11, 11);
  tank(70, groundAt(74) - 9, 9, 9);
  spawn(Turret, 61, (groundAt(60) - 11) * T);
  spawn(Grunt, 67, surf(67));
  game.enemies.push(new Chicken(game, 69 * T, surf(69)));
  game.enemies.push(new Chicken(game, 78 * T, surf(78)));
  spawn(Rusher, 80, surf(80));
  powAt(74, (groundAt(74) - 1) * T);

  // -------------------------------------------------------------------------
  // SECTION 4 (x 84-104) - catwalk stack
  // -------------------------------------------------------------------------
  catwalk(84, groundAt(88) - 6, 12);
  catwalk(90, groundAt(94) - 12, 12);
  catwalk(84, groundAt(88) - 18, 9);
  spawn(Grunt, 88, (groundAt(88) - 6) * T);
  spawn(Grunt, 96, (groundAt(94) - 12) * T);
  spawn(Turret, 90, (groundAt(88) - 18) * T);
  powAt(86, (groundAt(88) - 18) * T);
  barrelAt(99, (groundAt(94) - 12) * T);
  pump(103);

  // -------------------------------------------------------------------------
  // SECTION 5 (x 108-130) - burning slick, crossed on a pipe bridge
  // -------------------------------------------------------------------------
  for (let x = 110; x < 128; x++) {
    const g = groundAt(x);
    for (let y = g; y < g + 11; y++) ter.set(x, y, EMPTY);
    for (let y = g + 8; y < g + 11; y++) ter.set(x, y, LAVA);
  }
  pipeline(110, groundAt(114) - 3, 9, 2);
  catwalk(118, groundAt(118) - 9, 6);
  spawn(Grunt, 120, (groundAt(118) - 9) * T);
  spawn(Grunt, 130, surf(130));

  // -------------------------------------------------------------------------
  // SECTION 6 (x 134-158) - cracking tower
  // -------------------------------------------------------------------------
  const twX = 138, twBase = groundAt(twX);
  ter.markInterior(twX, twBase - 22, 12, 22);
  ter.fillRect(twX, twBase - 22, 12, 22, EMPTY);
  ter.outlineRect(twX, twBase - 22, 12, 22, METAL);
  for (let f = 0; f < 4; f++) {
    const fy = twBase - 5 - f * 5;
    for (let i = twX + 1; i < twX + 11; i++) ter.set(i, fy, METAL);
    ter.set(twX + (f % 2 ? 2 : 9), fy, EMPTY);
    ter.set(twX + (f % 2 ? 3 : 8), fy, EMPTY);
  }
  ter.fillRect(twX, twBase - 1, 3, 2, EMPTY);
  game.enemies.push(new Poster(game, twX + 1, (twBase - 8) * T, 1));
  spawn(Turret, twX + 6, (twBase - 22) * T);
  spawn(Grunt, twX + 4, (twBase - 6) * T);
  spawn(Grunt, twX + 8, (twBase - 11) * T);
  spawn(Rusher, twX + 5, (twBase - 16) * T);
  powAt(twX + 9, (twBase - 21) * T);
  barrelAt(twX + 10, (twBase - 1) * T);
  flare(156, 54);

  // -------------------------------------------------------------------------
  // SECTION 7 (x 162-192) - pump field and the long line
  // -------------------------------------------------------------------------
  pump(166); pump(176); pump(186);
  pipeline(164, groundAt(170) - 7, 14, 2);
  spawn(Grunt, 169, surf(169));
  spawn(Rusher, 174, surf(174));
  spawn(Rusher, 181, surf(181));
  spawn(Grunt, 188, surf(188));
  spawn(Turret, 192, surf(192));
  barrelAt(178, surf(178));
  barrelAt(179, surf(179));

  // -------------------------------------------------------------------------
  // SECTION 8 (x 196-220) - control block
  // -------------------------------------------------------------------------
  const cx0 = 198, cTop = groundAt(cx0 + 8) - 12;
  ter.markInterior(cx0, cTop, 18, 13);
  ter.fillRect(cx0, cTop, 18, 13, EMPTY);
  ter.outlineRect(cx0, cTop, 18, 13, METAL);
  ter.fillRect(cx0, cTop + 9, 1, 4, EMPTY);
  ter.fillRect(cx0 + 17, cTop + 9, 1, 4, EMPTY);
  ter.fillRect(cx0 + 8, cTop, 3, 1, EMPTY);
  spawn(Turret, cx0 + 3, cTop * T);
  spawn(Grunt, cx0 + 5, (cTop + 12) * T);
  game.props.push({ type: 'chair', x: (cx0 + 13) * T + 8, y: (cTop + 12) * T, facing: -1 });
  game.enemies.push(new Grunt(game, (cx0 + 13) * T, (cTop + 12) * T, 'sleep'));
  game.enemies.push(new Poster(game, (cx0 + 1) * T, (cTop + 3) * T, 1));
  game.enemies.push(new Chicken(game, (cx0 + 9) * T, (cTop + 12) * T));
  spawn(Rusher, cx0 + 9, (cTop + 12) * T);
  powAt(cx0 + 7, (cTop + 12) * T);
  powAt(cx0 + 15, (cTop + 12) * T);
  barrelAt(cx0 + 11, (cTop + 12) * T);

  // -------------------------------------------------------------------------
  // SECTION 9 (x 224-238) - last stand at the loading rack
  // -------------------------------------------------------------------------
  tank(224, groundAt(228) - 9, 9, 9);
  pipeline(234, groundAt(236) - 5, 6, 2);
  spawn(Grunt, 232, surf(232));
  spawn(Rusher, 238, surf(238));
  spawn(Grunt, 241, surf(241));
  mast(244, 34);

  // -------------------------------------------------------------------------
  // SECTION 10 (x 246-258) - extraction pad
  // -------------------------------------------------------------------------
  const padY = groundAt(250) - 4;
  ter.fillRect(244, padY, 14, 2, BEDROCK);
  for (let x = 244; x < 258; x++)
    for (let y = padY + 2; y < LEVEL_H; y++)
      if (ter.get(x, y) !== BEDROCK) ter.set(x, y, STONE);

  game.goal = { x: 248 * T, y: (padY - 3) * T, w: 9 * T, h: 5 * T };
  game.totalEnemies = game.enemies.filter(isScoredEnemy).length;
  return ter;
}

// ---------------------------------------------------------------------------
// mission registry
// ---------------------------------------------------------------------------

const LEVELS = [
  {
    id: 'gulch', name: 'OPERATION IRON GULCH', theme: 'gulch',
    w: 252, h: 40, ground: GULCH_GROUND, build: buildGulch,
    blurb: 'Dusk over a green valley. Bunkers, a watchtower and two lava fields.'
  },
  {
    id: 'refinery', name: 'OPERATION BLACKTAP', theme: 'refinery',
    w: 262, h: 42, ground: REFINERY_GROUND, build: buildRefinery,
    blurb: 'Sand and steel. Rupture a pipeline and the blast walks the whole run.'
  }
];

function buildLevel(game) {
  const lv = LEVELS[clamp(game.levelIndex | 0, 0, LEVELS.length - 1)];
  LEVEL_W = lv.w;
  LEVEL_H = lv.h;
  LEVEL_NAME = lv.name;
  GROUND_POINTS = lv.ground;
  setTheme(lv.theme);
  return lv.build(game);
}
