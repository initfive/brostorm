// ---------------------------------------------------------------------------
// BROSTORM - destructible tile terrain
// ---------------------------------------------------------------------------

const EMPTY = 0, DIRT = 1, STONE = 2, WOOD = 3, BEDROCK = 4, LAVA = 5;

const TILE_HP = [0, 3, 10, 2, 255, 0];
const TILE_SOLID = [false, true, true, true, true, false];

const TILE_COLOR = {
  [DIRT]: ['#6d4a2c', '#7a5433', '#5e3f26'],
  [STONE]: ['#565d69', '#616975', '#4b515c'],
  [WOOD]: ['#8a5a2f', '#96653a', '#7a4d27'],
  [BEDROCK]: ['#2b2f38', '#31353f', '#252932']
};

class Terrain {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.tiles = new Uint8Array(w * h);
    this.hp = new Uint8Array(w * h);
    this.bg = new Uint8Array(w * h);
    this.time = 0;
  }

  // Marks every tile that sits under the skyline as "interior". Empty interior
  // tiles get a dark backdrop instead of open sky, so tunnels you dig and the
  // insides of buildings read as enclosed space rather than holes in the world.
  computeBackground() {
    for (let x = 0; x < this.w; x++) {
      let y = 0;
      while (y < this.h && !TILE_SOLID[this.tiles[y * this.w + x]]) y++;
      for (; y < this.h; y++) this.bg[y * this.w + x] = 1;
    }
  }

  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }

  // Off the sides and bottom the world is solid rock; above it is open sky.
  get(x, y) {
    if (x < 0 || x >= this.w || y >= this.h) return BEDROCK;
    if (y < 0) return EMPTY;
    return this.tiles[y * this.w + x];
  }

  set(x, y, t) {
    if (!this.inBounds(x, y)) return;
    const i = y * this.w + x;
    this.tiles[i] = t;
    this.hp[i] = TILE_HP[t];
  }

  solid(x, y) { return TILE_SOLID[this.get(x, y)]; }
  solidPx(px, py) { return this.solid(Math.floor(px / T), Math.floor(py / T)); }
  atPx(px, py) { return this.get(Math.floor(px / T), Math.floor(py / T)); }

  // Line-of-sight / bullet pre-check between two world points.
  clearLine(x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0;
    const steps = Math.ceil(Math.hypot(dx, dy) / 5);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.solidPx(x0 + dx * t, y0 + dy * t)) return false;
    }
    return true;
  }

  fillRect(x, y, w, h, t) {
    for (let j = y; j < y + h; j++)
      for (let i = x; i < x + w; i++) this.set(i, j, t);
  }

  outlineRect(x, y, w, h, t) {
    for (let i = x; i < x + w; i++) { this.set(i, y, t); this.set(i, y + h - 1, t); }
    for (let j = y; j < y + h; j++) { this.set(x, j, t); this.set(x + w - 1, j, t); }
  }

  // Blast / bullet impact. Returns true if at least one tile was destroyed.
  damageCircle(cx, cy, r, dmg, game) {
    const tx0 = Math.floor((cx - r) / T), tx1 = Math.floor((cx + r) / T);
    const ty0 = Math.floor((cy - r) / T), ty1 = Math.floor((cy + r) / T);
    const r2 = r * r;
    let broke = false;
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        if (!this.inBounds(tx, ty)) continue;
        const i = ty * this.w + tx;
        const type = this.tiles[i];
        if (type === EMPTY || type === BEDROCK || type === LAVA) continue;
        // Distance from blast centre to the nearest point of the tile.
        const px = clamp(cx, tx * T, tx * T + T);
        const py = clamp(cy, ty * T, ty * T + T);
        if (dist2(cx, cy, px, py) > r2) continue;
        if (this.hp[i] > dmg) {
          this.hp[i] -= dmg;
        } else {
          this.tiles[i] = EMPTY;
          this.hp[i] = 0;
          broke = true;
          if (game) game.spawnDebris(tx * T + T / 2, ty * T + T / 2, type);
        }
      }
    }
    return broke;
  }

  draw(ctx, camX, camY) {
    const tx0 = Math.max(0, Math.floor(camX / T));
    const ty0 = Math.max(0, Math.floor(camY / T));
    const tx1 = Math.min(this.w - 1, Math.floor((camX + VIEW_W) / T));
    const ty1 = Math.min(this.h - 1, Math.floor((camY + VIEW_H) / T));

    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const i = ty * this.w + tx;
        const type = this.tiles[i];
        const sx = Math.round(tx * T - camX);
        const sy = Math.round(ty * T - camY);

        if (type === EMPTY) {
          if (!this.bg[i]) continue;
          const n = hash2(tx, ty);
          ctx.fillStyle = n < 0.5 ? '#1c1e26' : '#20222b';
          ctx.fillRect(sx, sy, T, T);
          // faint lip under a solid ceiling, so overhangs have some depth
          if (TILE_SOLID[this.get(tx, ty - 1)]) {
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.fillRect(sx, sy, T, 3);
          }
          continue;
        }

        if (type === LAVA) {
          const wob = Math.sin(this.time * 3 + tx * 0.7) * 0.5 + 0.5;
          ctx.fillStyle = wob > 0.6 ? '#ff9a2e' : '#e8511a';
          ctx.fillRect(sx, sy, T, T);
          if (!TILE_SOLID[this.get(tx, ty - 1)] && this.get(tx, ty - 1) !== LAVA) {
            ctx.fillStyle = '#ffd36b';
            ctx.fillRect(sx, sy + Math.round(wob), T, 2);
          }
          continue;
        }

        const pal = TILE_COLOR[type];
        const n = hash2(tx, ty);
        ctx.fillStyle = pal[n < 0.45 ? 0 : n < 0.8 ? 1 : 2];
        ctx.fillRect(sx, sy, T, T);

        // Lit rim wherever a tile is exposed to open air above.
        if (!TILE_SOLID[this.get(tx, ty - 1)]) {
          ctx.fillStyle = type === DIRT ? '#4f8f3c'
            : type === WOOD ? '#a8763f' : '#727b88';
          ctx.fillRect(sx, sy, T, type === DIRT ? 4 : 2);
          if (type === DIRT) {
            ctx.fillStyle = '#63a94a';
            ctx.fillRect(sx, sy, T, 2);
          }
        }

        // Speckle so large fields of one material do not read as flat.
        if (n > 0.86) {
          ctx.fillStyle = 'rgba(0,0,0,0.22)';
          ctx.fillRect(sx + Math.floor(n * 9) % 11, sy + Math.floor(n * 53) % 11, 3, 3);
        }

        // Cracks on damaged tiles.
        const maxHp = TILE_HP[type];
        if (maxHp && maxHp !== 255 && this.hp[i] < maxHp) {
          const f = 1 - this.hp[i] / maxHp;
          ctx.fillStyle = 'rgba(0,0,0,' + (0.15 + f * 0.4).toFixed(2) + ')';
          ctx.fillRect(sx + 2, sy + 5, Math.ceil(f * 10), 2);
          ctx.fillRect(sx + 7, sy + 9, Math.ceil(f * 6), 2);
        }
      }
    }
  }
}
