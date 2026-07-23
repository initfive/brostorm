// ---------------------------------------------------------------------------
// BROSTORM - destructible tile terrain
// ---------------------------------------------------------------------------

const EMPTY = 0, DIRT = 1, STONE = 2, WOOD = 3, BEDROCK = 4, LAVA = 5, METAL = 6;

const TILE_HP = [0, 3, 10, 2, 255, 0, 14];
const TILE_SOLID = [false, true, true, true, true, false, true];

// Palettes live in the active theme; this resolves one for a tile type.
function tilePalette(type) {
  return THEME.tile[type] || THEME.tile[1];
}

class Terrain {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.tiles = new Uint8Array(w * h);
    this.hp = new Uint8Array(w * h);
    this.bg = new Uint8Array(w * h);
    this.time = 0;
  }

  // Marks currently-solid rock as "interior", so once it is blasted away the
  // hole shows a dark backdrop rather than open sky. Call this on the raw
  // ground before any structures are carved; rooms inside buildings are
  // flagged separately via markInterior(). Anything never marked - the air
  // under a floating platform, say - correctly stays see-through.
  computeBackground() {
    for (let i = 0; i < this.tiles.length; i++) {
      if (TILE_SOLID[this.tiles[i]]) this.bg[i] = 1;
    }
  }

  markInterior(x, y, w, h) {
    for (let j = y; j < y + h; j++)
      for (let i = x; i < x + w; i++)
        if (this.inBounds(i, j)) this.bg[j * this.w + i] = 1;
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
          ctx.fillStyle = THEME.bgDark[n < 0.5 ? 0 : 1];
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
          ctx.fillStyle = wob > 0.6 ? THEME.liquid.hot : THEME.liquid.cool;
          ctx.fillRect(sx, sy, T, T);
          if (!TILE_SOLID[this.get(tx, ty - 1)] && this.get(tx, ty - 1) !== LAVA) {
            ctx.fillStyle = THEME.liquid.rim;
            ctx.fillRect(sx, sy + Math.round(wob), T, 2);
          }
          continue;
        }

        const pal = tilePalette(type);
        const n = hash2(tx, ty);
        ctx.fillStyle = pal[n < 0.45 ? 0 : n < 0.8 ? 1 : 2];
        ctx.fillRect(sx, sy, T, T);

        const openUp = !TILE_SOLID[this.get(tx, ty - 1)];
        const openL = !TILE_SOLID[this.get(tx - 1, ty)];
        const openR = !TILE_SOLID[this.get(tx + 1, ty)];
        const openDn = !TILE_SOLID[this.get(tx, ty + 1)];

        // Depth shading: dirt bleaches toward the surface and darkens with
        // every tile of rock above it, which gives the ground real thickness.
        if (type === DIRT || type === STONE) {
          let depth = 0;
          while (depth < 7 && TILE_SOLID[this.get(tx, ty - 1 - depth)]) depth++;
          if (depth === 0) {
            ctx.fillStyle = 'rgba(255,226,180,0.10)';
            ctx.fillRect(sx, sy, T, T);
          } else if (depth > 2) {
            ctx.fillStyle = 'rgba(0,0,0,' + Math.min(0.30, (depth - 2) * 0.06).toFixed(2) + ')';
            ctx.fillRect(sx, sy, T, T);
          }
        }

        // Lit rim wherever a tile is exposed to open air above.
        if (openUp) {
          if (type === DIRT) {
            ctx.fillStyle = THEME.crustMid;
            ctx.fillRect(sx, sy, T, THEME.crustH + 1);
            ctx.fillStyle = THEME.crustTop;
            ctx.fillRect(sx, sy, T, 2);
            // crust overhanging the edge, and the odd root dangling below
            ctx.fillStyle = THEME.crustMid;
            if (openL) ctx.fillRect(sx - 1, sy + 1, 1, 3);
            if (openR) ctx.fillRect(sx + T, sy + 1, 1, 3);
            if (THEME.blades) {
              const blade = Math.floor(n * 4);
              for (let b = 0; b <= blade; b++) {
                const bx = sx + ((Math.floor(n * 977) + b * 5) % (T - 2));
                ctx.fillRect(bx, sy - 1, 1, 2);
              }
            }
            if (THEME.roots && n > 0.72) {
              ctx.fillStyle = '#4a3320';
              ctx.fillRect(sx + Math.floor(n * 11) % (T - 2), sy + 4, 1, 3);
            }
          } else {
            ctx.fillStyle = type === WOOD ? '#a8763f'
              : type === METAL ? '#98a1ad' : '#727b88';
            ctx.fillRect(sx, sy, T, 2);
          }
        }

        // Corner and edge shaping: bevel the lit sides, shade the buried ones.
        if (type !== WOOD) {
          if (openL) { ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(sx, sy, 2, T); }
          if (openR) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(sx + T - 2, sy, 2, T); }
          if (openDn) { ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(sx, sy + T - 2, T, 2); }
        } else if (type === METAL) {
          ctx.fillStyle = 'rgba(0,0,0,0.26)';
          ctx.fillRect(sx, sy + T - 2, T, 2);
          ctx.fillRect(sx + T - 1, sy, 1, T);
          ctx.fillStyle = 'rgba(255,255,255,0.16)';   // rivets
          ctx.fillRect(sx + 2, sy + 2, 2, 2);
          ctx.fillRect(sx + T - 5, sy + 2, 2, 2);
        } else {
          // planks
          ctx.fillStyle = 'rgba(0,0,0,0.20)';
          ctx.fillRect(sx, sy + 5, T, 1);
          ctx.fillRect(sx, sy + 11, T, 1);
        }

        // Embedded pebbles and grit, so a field of one material is not flat.
        if (n > 0.86) {
          ctx.fillStyle = 'rgba(0,0,0,0.22)';
          ctx.fillRect(sx + Math.floor(n * 9) % 11, sy + Math.floor(n * 53) % 11, 3, 3);
        } else if (n > 0.78 && type === DIRT) {
          ctx.fillStyle = THEME.grit;
          ctx.fillRect(sx + Math.floor(n * 71) % 12, sy + Math.floor(n * 31) % 12, 2, 2);
        }

        // Three damage states: intact, cracked, collapsing.
        const maxHp = TILE_HP[type];
        if (maxHp && maxHp !== 255 && this.hp[i] < maxHp) {
          const f = 1 - this.hp[i] / maxHp;
          if (f < 0.5) {
            // cracked - a couple of hairlines
            ctx.fillStyle = 'rgba(0,0,0,0.42)';
            ctx.fillRect(sx + 3, sy + 4, 5, 1);
            ctx.fillRect(sx + 7, sy + 5, 1, 4);
          } else {
            // collapsing - crumbling voids chewed out of the block
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(sx + 2, sy + 3, 7, 2);
            ctx.fillRect(sx + 8, sy + 5, 2, 5);
            ctx.fillRect(sx + 4, sy + 9, 5, 2);
            ctx.fillStyle = 'rgba(0,0,0,0.30)';
            ctx.fillRect(sx + 1, sy + 12, 4, 2);
            ctx.fillRect(sx + 11, sy + 1, 3, 3);
          }
        }
      }
    }
  }
}
