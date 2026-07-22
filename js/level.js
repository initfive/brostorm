// ---------------------------------------------------------------------------
// BROSTORM - "OPERATION IRON GULCH", the single campaign level
//
// The map is generated from a fixed seed, so it is byte-identical every run,
// but it is authored rather than random: a ground profile plus hand placed
// set pieces, section by section.
// ---------------------------------------------------------------------------

const LEVEL_W = 252;
const LEVEL_H = 40;
const LEVEL_NAME = 'OPERATION IRON GULCH';

// Ground surface control points: [tileX, surfaceTileY]. Lower y = higher ground.
const GROUND_POINTS = [
  [0, 26], [14, 26], [22, 24], [30, 24], [34, 27], [44, 27], [48, 24],
  [62, 22], [72, 22], [78, 26], [90, 28], [98, 30], [110, 30], [116, 26],
  [126, 24], [136, 24], [142, 28], [156, 28], [162, 25], [180, 25],
  [188, 28], [200, 29], [208, 26], [220, 24], [232, 24], [252, 24]
];

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

function buildLevel(game) {
  const ter = new Terrain(LEVEL_W, LEVEL_H);
  const rng = makeRng(0x5150);
  game.terrain = ter;

  // --- base ground ---------------------------------------------------------
  for (let x = 0; x < LEVEL_W; x++) {
    const g = groundAt(x) + (rng() < 0.14 ? 1 : 0);
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
  spawn(Grunt, 64, (bTop + 9) * T);
  barrelAt(58, (bTop + 9) * T);
  barrelAt(59, (bTop + 9) * T);
  powAt(66, (bTop + 9) * T);
  spawn(Rusher, 71, surf(71));

  // -------------------------------------------------------------------------
  // SECTION 4 (x 76-100) - buried tunnels, dig or take the surface road
  // -------------------------------------------------------------------------
  cave(78, groundAt(80) + 7, 20, 2);
  powAt(88, (groundAt(88) + 8) * T);
  spawn(Rusher, 82, surf(82));
  spawn(Rusher, 86, surf(86));
  spawn(Grunt, 94, surf(94));
  barrelAt(97, surf(97));

  // -------------------------------------------------------------------------
  // SECTION 5 (x 102-122) - the watchtower, climb the walls
  // -------------------------------------------------------------------------
  const towerX = 106, towerBase = groundAt(towerX);
  ter.fillRect(towerX, towerBase - 20, 10, 20, EMPTY);
  ter.outlineRect(towerX, towerBase - 20, 10, 20, STONE);
  for (let f = 0; f < 3; f++) {
    const fy = towerBase - 5 - f * 5;
    for (let i = towerX + 1; i < towerX + 9; i++) ter.set(i, fy, WOOD);
    ter.set(towerX + (f % 2 ? 2 : 7), fy, EMPTY);   // staggered floor hatches
    ter.set(towerX + (f % 2 ? 3 : 6), fy, EMPTY);
  }
  ter.fillRect(towerX, towerBase - 1, 3, 2, EMPTY);
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

  ter.computeBackground();
  game.goal = { x: 232 * T, y: (padY - 3) * T, w: 12 * T, h: 5 * T };
  game.totalEnemies = game.enemies.filter(e => e.hittable && e.kind !== 'barrel').length;
  return ter;
}
