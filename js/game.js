// ---------------------------------------------------------------------------
// BROSTORM - game loop, camera, effects, UI wiring
// ---------------------------------------------------------------------------

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;

    this.state = 'title';      // title | play | paused | win | over
    this.terrain = null;
    this.players = [];
    this.enemies = [];
    this.bullets = [];
    this.projectiles = [];
    this.particles = [];
    this.props = [];
    this.toasts = [];

    this.camX = 0; this.camY = 0;
    this.shakeAmt = 0;
    this.stopT = 0;
    this.flash = 0;
    this.time = 0;
    this.slowMo = 0;
    this.slowPhase = false;
    this.chainN = 0;
    this.chainT = -99;

    this.lives = 5;
    this.rescued = 0;
    this.kills = 0;
    this.totalEnemies = 0;
    this.goal = null;
    this.endTimer = 0;
    this.chopperY = -120;

    // title screen selection state, one per player slot
    this.sel = [
      { joined: true, locked: false, char: 0 },
      { joined: false, locked: false, char: 1 }
    ];
    this.ctls = [makeControl(), makeControl()];
    this.levelIndex = 0;
    this.slowCd = 0;
  }

  // --- lifecycle ----------------------------------------------------------

  start() {
    this.enemies.length = 0;
    this.bullets.length = 0;
    this.projectiles.length = 0;
    this.particles.length = 0;
    this.props.length = 0;
    this.toasts.length = 0;
    this.players.length = 0;
    this.lives = 5;
    this.rescued = 0;
    this.kills = 0;
    this.time = 0;
    this.endTimer = 0;
    this.chopperY = -120;
    this.shakeAmt = 0;
    this.stopT = 0;
    this.slowCd = 0;

    buildLevel(this);
    this.checkpoint = { x: this.spawnX, y: this.spawnY };

    for (let i = 0; i < 2; i++) {
      const p = new Player(this, i, this.sel[i].char);
      p.ctl = this.ctls[i];
      p.joined = this.sel[i].joined;
      this.players.push(p);
      if (p.joined) p.spawnAt(this.spawnX + i * 14, this.spawnY);
      else { p.alive = false; p.respawn = 1e9; }
    }

    this.camX = clamp(this.spawnX - VIEW_W / 2, 0, LEVEL_W * T - VIEW_W);
    this.camY = clamp(this.spawnY - VIEW_H * 0.6, 0, LEVEL_H * T - VIEW_H);
    this.state = 'play';
    this.toast(LEVEL_NAME, '#ffd166');
    UI.setScreen(null);
  }

  joinedPlayers() { return this.players.filter(p => p.joined); }

  // --- effects ------------------------------------------------------------

  shake(a) { this.shakeAmt = Math.min(14, this.shakeAmt + a); }
  hitStop(t) { this.stopT = Math.max(this.stopT, t); }

  toast(text, color) {
    this.toasts.push({ text: text, color: color || '#fff', life: 2.2 });
    if (this.toasts.length > 4) this.toasts.shift();
  }

  burst(x, y, n, color, speed, life, kind) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), s = rand(speed * 0.25, speed);
      this.particles.push(new Particle(x, y, Math.cos(a) * s, Math.sin(a) * s,
        rand(life * 0.5, life), color, kind === 'spark' ? 1 : 2, kind || 'spark'));
    }
  }

  spawnDebris(x, y, type) {
    const pal = tilePalette(type);
    // Thin the shower out when a lot of tiles go at once, so a big blast stays
    // as cheap to draw as a rifle round chewing a single tile.
    const n = this.particles.length > 420 ? 2 : randInt(5, 9);
    for (let i = 0; i < n; i++) {
      const a = rand(-Math.PI, 0), s = rand(40, 210);
      this.particles.push(new Particle(x, y, Math.cos(a) * s, Math.sin(a) * s,
        rand(0.7, 1.6), pick(pal), randInt(2, 4), 'bit'));
    }
    if (this.particles.length > 900) this.particles.splice(0, 200);
  }

  // Puff of ground dust - landings, and the base of an explosion.
  dust(x, y, n) {
    for (let i = 0; i < n; i++) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      this.particles.push(new Particle(
        x + rand(-5, 5), y - 1,
        dir * rand(25, 95), rand(-42, -8),
        rand(0.28, 0.6), pick(['#9a8f80', '#b5a996', '#7d7466']),
        rand(2, 4), 'smoke'));
    }
  }

  smoke(x, y, n, life) {
    for (let i = 0; i < n; i++) {
      this.particles.push(new Particle(
        x + rand(-3, 3), y + rand(-3, 3),
        rand(-16, 16), rand(-34, -8),
        life || rand(0.5, 1.1), pick(['#6b6259', '#565049', '#847a70']),
        rand(3, 6), 'smoke'));
    }
  }

  corpse(ent, look, kx, ky) {
    this.projectiles.push(new Corpse(
      this, ent.cx, ent.cy, look,
      (kx || 0) * 0.7 + rand(-40, 40), (ky || 0) * 0.7 - rand(90, 190),
      -sgn(kx || 1) || 1));
    this.burst(ent.cx, ent.cy, 5, '#c8302a', 120, 0.3);
  }

  gib(x, y, look) {
    const colors = [look.shirt, look.pants, look.skin, '#b02a20', '#8e1f18'];
    for (let i = 0; i < 14; i++) {
      const a = rand(-Math.PI * 0.95, -0.05), s = rand(70, 260);
      this.particles.push(new Particle(x, y, Math.cos(a) * s, Math.sin(a) * s,
        rand(0.8, 1.8), pick(colors), randInt(2, 4), 'bit'));
    }
    this.burst(x, y, 6, '#c8302a', 130, 0.35, 'spark');
  }

  explode(x, y, r, dmg, owner) {
    this.terrain.damageCircle(x, y, r, dmg, this);

    const r2 = r * r;
    for (const e of this.enemies) {
      if (e.dead || !e.hittable) continue;
      if (dist2(x, y, e.cx, e.cy) < r2 * 1.2) {
        e.hurt(99, sgn(e.cx - x) * 200, -200, this);
      }
    }
    for (const p of this.players) {
      if (!p.alive) continue;
      if (dist2(x, y, p.cx, p.cy) < r2 * 0.85) p.hurt(99, 0, 0, this);
    }

    for (let i = 0; i < 22; i++) {
      const a = rand(0, Math.PI * 2), s = rand(30, r * 7);
      this.particles.push(new Particle(x, y, Math.cos(a) * s, Math.sin(a) * s,
        rand(0.35, 0.8), pick(['#ffe9a0', '#ffb347', '#ff6a2a']), rand(2, 5), 'spark'));
    }
    for (let i = 0; i < 14; i++) {
      const a = rand(0, Math.PI * 2), s = rand(10, r * 2);
      this.particles.push(new Particle(x, y, Math.cos(a) * s, Math.sin(a) * s,
        rand(0.6, 1.4), pick(['#6b6259', '#4d463f', '#8a8078']), rand(4, 9), 'smoke'));
    }
    // rising smoke column and a ring of dust kicked along the ground
    this.smoke(x, y - 6, 5, 1.5);
    this.dust(x, y + 4, 6);
    this.shake(r * 0.22);
    this.hitStop(0.06);
    this.flash = Math.min(1, this.flash + r / 90);
    sfx('explode');

    // Three or more detonations in quick succession is a chain reaction, and
    // chain reactions deserve to be watched in slow motion.
    this.chainN = (this.time - this.chainT < 0.4) ? this.chainN + 1 : 1;
    this.chainT = this.time;
    if (this.chainN >= 3 && this.slowMo <= 0 && this.slowCd <= 0) {
      this.slowMo = 0.55;
      this.slowCd = 4;
      this.chainN = 0;
      this.toast('CHAIN REACTION', '#ffb347');
    }
  }

  // --- queries ------------------------------------------------------------

  nearestPlayer(x, y, maxDist) {
    let best = null, bd = maxDist * maxDist;
    for (const p of this.players) {
      if (!p.alive) continue;
      const d = dist2(x, y, p.cx, p.cy);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  respawnPoint(p) {
    const other = this.players.find(q => q !== p && q.joined && q.alive);
    if (other) {
      return { x: clamp(other.cx + rand(-16, 16), 3 * T, (LEVEL_W - 4) * T), y: other.y - 6 };
    }
    return { x: this.checkpoint.x, y: this.checkpoint.y };
  }

  enemyKilled(e) {
    this.kills++;
    this.shake(1.6);
  }

  checkGameOver() {
    if (this.lives > 0) return;
    // every() is true for an empty list, which would declare a game over the
    // instant nobody is joined. Require at least one bro to have been in play.
    const joined = this.joinedPlayers();
    if (joined.length && joined.every(p => !p.alive)) {
      this.state = 'over';
      this.endTimer = 0;
      sfx('gameOver');
      UI.setScreen('over');
    }
  }

  inGoal(p) {
    const g = this.goal;
    return p.cx > g.x && p.cx < g.x + g.w && p.cy > g.y - 20 && p.cy < g.y + g.h + 20;
  }

  checkWin() {
    const joined = this.joinedPlayers();
    const alive = joined.filter(p => p.alive);
    const pending = joined.filter(p => !p.alive && this.lives > 0);
    if (alive.length === 0 || pending.length > 0) return;
    if (alive.every(p => this.inGoal(p))) {
      this.state = 'win';
      this.endTimer = 0;
      sfx('win');
      UI.setScreen('win');
    }
  }

  // --- simulation ---------------------------------------------------------

  update(dt) {
    for (let i = 0; i < 2; i++) pollControl(this.ctls[i], i);

    if (this.state === 'title') { UI.updateTitle(this); return; }

    if (this.state === 'win' || this.state === 'over') {
      this.endTimer += dt;
      this.updateEffectsOnly(dt);
      if ((this.ctls[0].startP || this.ctls[1].startP || keyHit.has('Enter')) && this.endTimer > 0.6) {
        this.state = 'title';
        UI.setScreen('title');
      }
      return;
    }

    if (this.state === 'paused') {
      if (keyHit.has('Escape') || keyHit.has('KeyP')) { this.state = 'play'; UI.setScreen(null); }
      return;
    }

    if (keyHit.has('Escape') || keyHit.has('KeyP')) {
      this.state = 'paused'; UI.setScreen('paused'); return;
    }

    // a second player can drop in at any time
    if (!this.players[1].joined && (this.ctls[1].fireP || this.ctls[1].jumpP || this.ctls[1].startP)) {
      const p = this.players[1];
      p.joined = true;
      this.sel[1].joined = true;
      const s = this.respawnPoint(p);
      p.spawnAt(s.x, s.y);
      this.toast('PLAYER 2 JOINED', '#ff9a5e');
    }

    if (this.stopT > 0) { this.stopT -= dt; this.updateEffectsOnly(dt * 0.25); return; }

    // Slow motion runs the simulation on alternate ticks. Skipping whole steps
    // keeps the fixed timestep intact, so physics stays identical at any speed.
    if (this.slowMo > 0) {
      this.slowMo -= dt;
      this.slowPhase = !this.slowPhase;
      if (!this.slowPhase) { this.updateEffectsOnly(dt * 0.5); return; }
    }

    this.time += dt;
    this.slowCd -= dt;
    this.terrain.time = this.time;

    for (const p of this.players) if (p.joined) p.update(dt);

    for (const e of this.enemies) if (!e.dead) e.update(dt);
    for (const b of this.bullets) if (!b.dead) b.update(dt);
    for (const pr of this.projectiles) if (!pr.dead) pr.update(dt);

    this.enemies = this.enemies.filter(e => !e.dead);
    this.bullets = this.bullets.filter(b => !b.dead);
    this.projectiles = this.projectiles.filter(p => !p.dead);

    this.updateEffectsOnly(dt);
    this.updateCamera(dt);

    // furthest safe ground becomes the solo respawn point
    for (const p of this.players) {
      if (p.alive && p.onGround && p.cx > this.checkpoint.x) {
        this.checkpoint.x = p.cx;
        this.checkpoint.y = p.y + p.h;
      }
    }

    if (this.chopperY < 0 && this.players.some(p => p.alive && p.cx > this.goal.x - 220)) {
      this.chopperY = approach(this.chopperY, 0, 40 * dt);
      if (Math.floor(this.time * 6) % 6 === 0) sfx('chopper');
    }

    this.checkWin();
    this.checkGameOver();
  }

  updateEffectsOnly(dt) {
    for (const p of this.particles) p.update(dt, this.terrain);
    this.particles = this.particles.filter(p => !p.dead);
    this.shakeAmt *= Math.pow(0.0015, dt);
    this.flash *= Math.pow(0.0008, dt);
    for (const t of this.toasts) t.life -= dt;
    this.toasts = this.toasts.filter(t => t.life > 0);
  }

  updateCamera(dt) {
    const alive = this.players.filter(p => p.alive);
    let tx, ty;
    if (alive.length) {
      tx = alive.reduce((s, p) => s + p.cx, 0) / alive.length;
      ty = alive.reduce((s, p) => s + p.cy, 0) / alive.length;
    } else {
      tx = this.checkpoint.x; ty = this.checkpoint.y;
    }
    const wantX = clamp(tx - VIEW_W / 2, 0, LEVEL_W * T - VIEW_W);
    const wantY = clamp(ty - VIEW_H * 0.55, 0, LEVEL_H * T - VIEW_H);
    const k = 1 - Math.pow(0.0009, dt);
    this.camX = lerp(this.camX, wantX, k);
    this.camY = lerp(this.camY, wantY, k);

    // Nobody leaves the shot - the screen pushes stragglers along.
    const m = 4;
    for (const p of this.players) {
      if (!p.alive) continue;
      // If a player is nowhere near the shot (fresh spawn, camera still flying
      // in) let the camera catch up instead of yanking them across the map.
      if (p.cx < this.camX - VIEW_W || p.cx > this.camX + VIEW_W * 2) continue;
      const lo = this.camX + m, hi = this.camX + VIEW_W - m - p.w;
      if (p.x < lo && !this.terrain.solidPx(lo + p.w / 2, p.cy)) { p.x = lo; if (p.vx < 0) p.vx = 0; }
      if (p.x > hi && !this.terrain.solidPx(hi + p.w / 2, p.cy)) { p.x = hi; if (p.vx > 0) p.vx = 0; }
      const top = this.camY + m;
      if (p.y < top && !this.terrain.solidPx(p.cx, top + p.h / 2)) { p.y = top; if (p.vy < 0) p.vy = 0; }
    }
  }

  // --- rendering ----------------------------------------------------------

  draw() {
    const ctx = this.ctx;
    let ox = 0, oy = 0;
    if (this.shakeAmt > 0.2) {
      ox = Math.round(rand(-this.shakeAmt, this.shakeAmt));
      oy = Math.round(rand(-this.shakeAmt, this.shakeAmt));
    }
    const camX = Math.round(this.camX) + ox;
    const camY = Math.round(this.camY) + oy;

    this.drawSky(ctx, camX, camY);

    if (this.state === 'title' || !this.terrain) { this.drawVignette(ctx); return; }

    this.drawGoal(ctx, camX, camY);
    this.terrain.draw(ctx, camX, camY);

    for (const pr of this.props) {
      if (pr.x - camX < -80 || pr.x - camX > VIEW_W + 80) continue;
      drawProp(ctx, pr, camX, camY, this.time);
    }

    for (const e of this.enemies) if (!e.dead) e.draw(ctx, camX, camY);
    for (const pr of this.projectiles) if (!pr.dead) pr.draw(ctx, camX, camY);
    for (const p of this.players) if (p.joined) p.draw(ctx, camX, camY);
    for (const b of this.bullets) if (!b.dead) b.draw(ctx, camX, camY);
    for (const p of this.particles) p.draw(ctx, camX, camY);

    this.drawHaze(ctx);
    this.drawOffscreenMarkers(ctx, camX, camY);

    if (this.flash > 0.02) {
      ctx.fillStyle = 'rgba(255,236,190,' + Math.min(0.55, this.flash * 0.5).toFixed(3) + ')';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    this.drawVignette(ctx);
  }

  drawSky(ctx, camX, camY) {
    if (!this._sky || this._skyTheme !== THEME.id) {
      const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
      for (const st of THEME.sky) g.addColorStop(st[0], st[1]);
      this._sky = g;
      this._skyTheme = THEME.id;
    }
    ctx.fillStyle = this._sky;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // low sun - one soft radial falloff, so it reads as haze rather than as a
    // flat disc pasted over the sky
    const S = THEME.sun;
    const sunX = S.x - camX * S.px, sunY = S.y - camY * S.py;
    const sun = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, S.r);
    for (const st of S.stops) sun.addColorStop(st[0], st[1]);
    ctx.fillStyle = sun;
    ctx.fillRect(sunX - S.r - 2, sunY - S.r - 2, S.r * 2 + 4, S.r * 2 + 4);

    // parallax ridges
    for (const r of THEME.ridges) {
      ctx.fillStyle = r.col;
      ctx.beginPath();
      ctx.moveTo(0, VIEW_H);
      for (let sx = 0; sx <= VIEW_W; sx += 2) {
        const wx = camX * r.p + sx;
        const y = r.base - camY * r.p * 0.6
          + Math.sin(wx * 0.0071) * r.amp
          + Math.sin(wx * 0.0193 + 2.1) * r.amp * 0.45
          + Math.sin(wx * 0.041 + 0.7) * r.amp * 0.18;
        ctx.lineTo(sx, y);
      }
      ctx.lineTo(VIEW_W, VIEW_H);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawGoal(ctx, camX, camY) {
    const g = this.goal;
    const x = Math.round(g.x - camX), y = Math.round(g.y - camY);

    // landing pad markings
    ctx.fillStyle = 'rgba(240,200,90,0.75)';
    ctx.fillRect(x, y + g.h + 4, g.w, 2);
    for (let i = 0; i < 5; i++) ctx.fillRect(x + 6 + i * 38, y + g.h + 8, 18, 2);
    ctx.fillStyle = Math.floor(this.time * 4) % 2 ? '#7ee081' : '#2f5a33';
    ctx.fillRect(x - 4, y + g.h, 3, 3);
    ctx.fillRect(x + g.w + 1, y + g.h, 3, 3);

    // extraction chopper drops in as you approach
    const cy = y - 26 + this.chopperY + Math.sin(this.time * 2) * 2;
    const cx = x + g.w / 2;
    ctx.fillStyle = '#3f4a3a';
    ctx.fillRect(cx - 20, cy, 40, 12);
    ctx.fillRect(cx + 18, cy + 2, 22, 4);
    ctx.fillStyle = '#2c3329';
    ctx.fillRect(cx + 36, cy - 6, 3, 10);
    ctx.fillStyle = '#8fd6e8';
    ctx.fillRect(cx - 18, cy + 2, 10, 6);
    ctx.fillStyle = '#2c3329';
    ctx.fillRect(cx - 2, cy - 5, 4, 5);
    const blade = Math.sin(this.time * 40) * 26;
    ctx.fillStyle = 'rgba(200,210,200,0.55)';
    ctx.fillRect(cx - Math.abs(blade), cy - 7, Math.abs(blade) * 2, 2);
    ctx.fillStyle = '#2c3329';
    ctx.fillRect(cx - 14, cy + 12, 2, 5);
    ctx.fillRect(cx + 12, cy + 12, 2, 5);
    ctx.fillRect(cx - 18, cy + 16, 36, 2);
  }

  // Arrows at the screen edge for a partner or objective you cannot see.
  drawOffscreenMarkers(ctx, camX, camY) {
    for (const p of this.players) {
      if (!p.joined || !p.alive) continue;
      const sx = p.cx - camX, sy = p.cy - camY;
      if (sx > 6 && sx < VIEW_W - 6 && sy > 6 && sy < VIEW_H - 6) continue;
      const mx = clamp(sx, 8, VIEW_W - 8), my = clamp(sy, 8, VIEW_H - 8);
      ctx.fillStyle = p.index === 0 ? '#5ec8ff' : '#ff9a5e';
      ctx.fillRect(Math.round(mx) - 3, Math.round(my) - 3, 6, 6);
    }
  }

  // Heat shimmer for the desert theme. Bands of warm haze that drift and
  // wobble - cheaper and artefact-free compared with resampling the canvas.
  drawHaze(ctx) {
    if (!THEME.haze) return;
    const top = VIEW_H * 0.42;
    for (let i = 0; i < 9; i++) {
      const f = i / 9;
      const y = top + f * (VIEW_H - top) + Math.sin(this.time * 1.7 + i * 1.9) * 3;
      const a = (0.05 + 0.05 * Math.sin(this.time * 2.3 + i)) * (0.4 + f);
      ctx.fillStyle = 'rgba(255,186,120,' + a.toFixed(3) + ')';
      ctx.fillRect(0, Math.round(y), VIEW_W, 2 + (i & 1));
    }
    ctx.fillStyle = 'rgba(255,150,80,0.05)';
    ctx.fillRect(0, Math.round(top), VIEW_W, VIEW_H - top);
  }

  drawVignette(ctx) {
    if (!this._vig) {
      const g = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.35,
        VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.85);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.4)');
      this._vig = g;
    }
    ctx.fillStyle = this._vig;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

// ---------------------------------------------------------------------------
// UI - DOM overlays so text stays crisp at any window size
// ---------------------------------------------------------------------------

const UI = {
  el: {},
  screen: 'title',

  init(game) {
    this.game = game;
    const id = s => document.getElementById(s);
    this.el = {
      screens: id('screens'),
      title: id('title'),
      paused: id('paused'),
      win: id('win'),
      over: id('over'),
      hud: id('hud'),
      lives: id('lives'),
      progressFill: id('progress-fill'),
      toasts: id('toasts'),
      winStats: id('win-stats'),
      overStats: id('over-stats'),
      panels: [id('p1-panel'), id('p2-panel')],
      cards: [id('p1-cards'), id('p2-cards')],
      startHint: id('start-hint'),
      missions: id('missions')
    };
    this.buildCards(0);
    this.buildCards(1);
    this.buildMissions();
    this.setScreen('title');
  },

  buildCards(slot) {
    const wrap = this.el.cards[slot];
    wrap.innerHTML = '';
    CHARS.forEach((ch, i) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.dataset.index = i;

      const cv = document.createElement('canvas');
      cv.width = 58; cv.height = 40; cv.className = 'portrait';
      const c = cv.getContext('2d');
      c.imageSmoothingEnabled = false;
      drawChar(c, ch, 24, 37, { facing: 1, state: 'idle', aimX: 1, aimY: 0 });

      const name = document.createElement('div');
      name.className = 'card-name';
      name.textContent = ch.name;
      const tag = document.createElement('div');
      tag.className = 'card-tag';
      tag.textContent = ch.tag;
      const blurb = document.createElement('div');
      blurb.className = 'card-blurb';
      blurb.textContent = ch.blurb;

      card.append(cv, name, tag, blurb);
      wrap.appendChild(card);
    });
  },

  buildMissions() {
    const wrap = this.el.missions;
    if (!wrap) return;
    wrap.innerHTML = '';
    LEVELS.forEach((lv, i) => {
      const card = document.createElement('div');
      card.className = 'mission';
      const key = document.createElement('span');
      key.className = 'mkey';
      key.textContent = String(i + 1);
      const name = document.createElement('b');
      name.textContent = lv.name;
      const blurb = document.createElement('span');
      blurb.className = 'mblurb';
      blurb.textContent = lv.blurb;
      card.append(key, name, blurb);
      wrap.appendChild(card);
    });
  },

  renderMissions(game) {
    const wrap = this.el.missions;
    if (!wrap) return;
    const cards = wrap.children;
    for (let i = 0; i < cards.length; i++) {
      cards[i].classList.toggle('active', i === game.levelIndex);
    }
  },

  setScreen(name) {
    this.screen = name;
    for (const k of ['title', 'paused', 'win', 'over']) {
      this.el[k].classList.toggle('hidden', name !== k);
    }
    this.el.screens.classList.toggle('hidden', name === null);
    this.el.hud.classList.toggle('hidden', name === 'title');

    if (name === 'win') {
      const g = this.game;
      this.el.winStats.innerHTML = statRows([
        ['HOSTAGES FREED', g.rescued],
        ['ENEMIES ELIMINATED', g.kills + ' / ' + g.totalEnemies],
        ['LIVES REMAINING', g.lives],
        ['TIME', formatTime(g.time)]
      ]);
    }
    if (name === 'over') {
      const g = this.game;
      this.el.overStats.innerHTML = statRows([
        ['HOSTAGES FREED', g.rescued],
        ['ENEMIES ELIMINATED', g.kills + ' / ' + g.totalEnemies],
        ['DISTANCE', Math.round(100 * clamp(g.checkpoint.x / g.goal.x, 0, 1)) + '%']
      ]);
    }
  },

  // Title screen: join, pick a character, lock in.
  updateTitle(game) {
    let anyLocked = false, allLocked = true, joinedCount = 0;

    for (let i = 0; i < LEVELS.length && i < 9; i++) {
      if (keyHit.has('Digit' + (i + 1)) || keyHit.has('Numpad' + (i + 1))) {
        game.levelIndex = i;
        sfx('select');
      }
    }
    this.renderMissions(game);

    for (let i = 0; i < 2; i++) {
      const c = game.ctls[i], s = game.sel[i];
      if (!s.joined) {
        if (c.fireP || c.jumpP || c.startP) { s.joined = true; sfx('select'); }
      } else {
        joinedCount++;
        if (!s.locked) {
          if (c.leftP) { s.char = (s.char + CHARS.length - 1) % CHARS.length; sfx('select'); }
          if (c.rightP) { s.char = (s.char + 1) % CHARS.length; sfx('select'); }
          if (c.fireP || c.jumpP) { s.locked = true; sfx('confirm'); }
          allLocked = false;
        } else {
          anyLocked = true;
          if (c.specialP) { s.locked = false; sfx('select'); }
        }
      }
      this.renderSlot(i, s);
    }

    const ready = joinedCount > 0 && allLocked && anyLocked;
    this.el.startHint.textContent = ready
      ? 'PRESS ENTER OR FIRE TO DEPLOY  ·  ' + LEVELS[game.levelIndex].name
      : 'PICK YOUR BRO  ·  LEFT/RIGHT TO BROWSE  ·  FIRE TO LOCK IN';
    this.el.startHint.classList.toggle('ready', ready);

    if (ready && (keyHit.has('Enter') || game.ctls[0].startP || game.ctls[1].startP ||
      game.ctls[0].fireP || game.ctls[1].fireP)) {
      audioResume();
      sfx('confirm');
      game.start();
    }
  },

  renderSlot(i, s) {
    const panel = this.el.panels[i];
    panel.classList.toggle('joined', s.joined);
    panel.classList.toggle('locked', s.locked);
    const cards = this.el.cards[i].children;
    for (let k = 0; k < cards.length; k++) {
      cards[k].classList.toggle('active', s.joined && s.char === k);
    }
    panel.querySelector('.slot-status').textContent =
      !s.joined ? 'PRESS FIRE TO JOIN' : s.locked ? 'READY' : 'CHOOSING…';
  },

  // Per-frame in-game HUD.
  updateHud(game) {
    if (game.state === 'title') return;
    this.el.lives.textContent = game.lives;

    for (let i = 0; i < 2; i++) {
      const p = game.players[i];
      const panel = document.getElementById('hud-p' + (i + 1));
      if (!p || !p.joined) { panel.classList.add('inactive'); continue; }
      panel.classList.remove('inactive');
      panel.querySelector('.hud-name').textContent = p.char.name;
      panel.querySelector('.hud-weapon').textContent =
        p.char.weapon === 'rifle' ? 'RIFLE' : 'SHOTGUN';
      const ammo = panel.querySelector('.hud-ammo');
      let pips = '';
      for (let k = 0; k < p.char.specialMax; k++) {
        pips += '<i class="' + (k < p.special ? 'on' : 'off') + '"></i>';
      }
      ammo.innerHTML = pips;
      panel.classList.toggle('dead', !p.alive);
    }

    const prog = clamp((game.checkpoint.x - game.spawnX) / (game.goal.x - game.spawnX), 0, 1);
    this.el.progressFill.style.width = (prog * 100).toFixed(1) + '%';

    let html = '';
    for (const t of game.toasts) {
      const a = clamp(t.life / 0.6, 0, 1);
      html += '<div class="toast" style="color:' + t.color + ';opacity:' + a.toFixed(2) + '">'
        + t.text + '</div>';
    }
    this.el.toasts.innerHTML = html;
  }
};

function statRows(rows) {
  return rows.map(r => '<div class="stat"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>').join('');
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  return m + ':' + String(Math.floor(s % 60)).padStart(2, '0');
}

// ---------------------------------------------------------------------------
// boot
// ---------------------------------------------------------------------------

let game;

function fitCanvas() {
  const stage = document.getElementById('stage');
  const scale = Math.max(1, Math.min(
    Math.floor(window.innerWidth / VIEW_W * 100) / 100,
    Math.floor(window.innerHeight / VIEW_H * 100) / 100
  ));
  stage.style.width = (VIEW_W * scale) + 'px';
  stage.style.height = (VIEW_H * scale) + 'px';
}

function boot() {
  const canvas = document.getElementById('game');
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  game = new Game(canvas);
  UI.init(game);
  fitCanvas();
  window.addEventListener('resize', fitCanvas);

  const unlock = () => { audioInit(); audioResume(); };
  window.addEventListener('keydown', unlock, { once: true });
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', e => {
    if (e.code === 'KeyM') {
      const muted = audioToggleMute();
      document.getElementById('mute-flag').textContent = muted ? 'SOUND OFF (M)' : 'SOUND ON (M)';
    }
    if (e.code === 'KeyR' && game.state !== 'title') {
      if (e.shiftKey) { game.state = 'title'; UI.setScreen('title'); }
      else game.start();
    }
  });

  let last = performance.now(), acc = 0;
  function frame(now) {
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    acc += dt;
    // Only consume edge-presses on frames that actually simulate. Clearing
    // unconditionally drops taps whenever rAF outruns the fixed timestep,
    // which happens constantly on 120Hz displays.
    let guard = 0;
    while (acc >= STEP && guard++ < 5) {
      game.update(STEP);
      keyHit.clear();
      acc -= STEP;
    }
    game.draw();
    UI.updateHud(game);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

window.addEventListener('DOMContentLoaded', boot);
