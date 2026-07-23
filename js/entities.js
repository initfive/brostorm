// ---------------------------------------------------------------------------
// BROSTORM - physics, characters, weapons, enemies, projectiles, particles
// ---------------------------------------------------------------------------

// --- playable characters --------------------------------------------------

const CHARS = [
  {
    id: 'razor',
    name: 'CPL. RAZOR',
    tag: 'ASSAULT RIFLE  /  FRAG GRENADE',
    blurb: 'Fast, accurate, endless bullets. Grenades bounce.',
    weapon: 'rifle', special: 'grenade', specialMax: 4,
    speed: 172, jump: 330,
    head: 'band', chest: null, accent: '#cc3b32',
    skin: '#e8b489', hair: '#2a1f18', shirt: '#4f7a3a', shirt2: '#3d6130',
    pants: '#33502a', boots: '#2a221b'
  },
  {
    id: 'rubble',
    name: 'SGT. RUBBLE',
    tag: 'COMBAT SHOTGUN  /  REMOTE C4',
    blurb: 'Slower, but blows holes through walls and everything behind them.',
    weapon: 'shotgun', special: 'c4', specialMax: 3,
    speed: 150, jump: 322,
    head: 'helmet', chest: 'sash', accent: '#e0b040',
    skin: '#c68a5e', hair: '#161310', shirt: '#8c3a2a', shirt2: '#6f2c20',
    pants: '#3c3730', boots: '#241f1a'
  },
  {
    id: 'office',
    name: 'THE OFFICE COMMANDO',
    tag: 'BURST STAPLER  /  EXPLODING BRIEFCASE',
    blurb: 'Three-round bursts and rolled-up sleeves. Deadline is now.',
    weapon: 'stapler', special: 'briefcase', specialMax: 4,
    speed: 178, jump: 336,
    head: 'slick', chest: 'tie', accent: '#d02b2b',
    skin: '#e6b189', hair: '#241c14', shirt: '#eceff4', shirt2: '#cfd5de',
    pants: '#2f3746', boots: '#191d24'
  },
  {
    id: 'grandma',
    name: 'GRANDMA GRENADIER',
    tag: 'GRENADE LAUNCHER  /  CLUSTER SHELL',
    blurb: 'Slow as treacle, twice as devastating. Do not ask about her hip.',
    weapon: 'launcher', special: 'cluster', specialMax: 2,
    speed: 116, jump: 300,
    head: 'bun', chest: 'apron', accent: '#b06fc0',
    skin: '#e3bb9c', hair: '#d6d9de', shirt: '#7a5f95', shirt2: '#5f4a74',
    pants: '#4a3f58', boots: '#2b2530'
  }
];

const WEAPONS = {
  rifle: {
    rate: 0.075, pellets: 1, spread: 0.045, speed: 560, life: 0.95,
    carveR: 3.0, carveDmg: 3, kick: 34, size: 3, color: '#ffe58a', sfx: 'rifle'
  },
  shotgun: {
    rate: 0.5, pellets: 7, spread: 0.20, speed: 470, life: 0.34,
    carveR: 4.2, carveDmg: 5, kick: 175, size: 2, color: '#ffd166', sfx: 'shotgun'
  },
  // Fires in three-round bursts: burstGap between rounds, rate between bursts.
  stapler: {
    rate: 0.42, burst: 3, burstGap: 0.06, pellets: 1, spread: 0.06,
    speed: 520, life: 0.8, carveR: 2.8, carveDmg: 2, kick: 30,
    size: 3, color: '#cfd8e6', sfx: 'rifle'
  },
  // Lobs an arcing shell instead of firing a bullet.
  launcher: {
    rate: 0.95, lob: true, speed: 300, kick: 120, blastR: 34, blastDmg: 32,
    size: 3, color: '#ffb347', sfx: 'shotgun'
  }
};

// --- tile collision -------------------------------------------------------

function resolveX(e, ter) {
  const y0 = Math.floor(e.y / T), y1 = Math.floor((e.y + e.h - 0.01) / T);
  const x0 = Math.floor(e.x / T), x1 = Math.floor((e.x + e.w - 0.01) / T);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (!ter.solid(tx, ty)) continue;
      if (e.vx > 0) { e.x = tx * T - e.w - 0.01; e.wallDir = 1; }
      else if (e.vx < 0) { e.x = (tx + 1) * T + 0.01; e.wallDir = -1; }
      else continue;
      e.hitWall = true;
      e.vx = 0;
      return;
    }
  }
}

function resolveY(e, ter) {
  const y0 = Math.floor(e.y / T), y1 = Math.floor((e.y + e.h - 0.01) / T);
  const x0 = Math.floor(e.x / T), x1 = Math.floor((e.x + e.w - 0.01) / T);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (!ter.solid(tx, ty)) continue;
      if (e.vy > 0) { e.y = ty * T - e.h - 0.01; e.onGround = true; }
      else if (e.vy < 0) { e.y = (ty + 1) * T + 0.01; }
      else continue;
      e.vy = 0;
      return;
    }
  }
}

// If terrain gets rebuilt (or an entity spawns) inside solid rock, nudge it out.
function unstick(e, ter) {
  for (let i = 0; i < 24; i++) {
    const cx = Math.floor((e.x + e.w / 2) / T);
    const cy = Math.floor((e.y + e.h / 2) / T);
    if (!ter.solid(cx, cy)) return;
    e.y -= T * 0.5;
  }
}

class Ent {
  constructor(x, y, w, h) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.vx = 0; this.vy = 0;
    this.onGround = false; this.wallDir = 0; this.hitWall = false;
    this.dead = false; this.facing = 1;
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }

  move(ter, dt) {
    this.wallDir = 0; this.hitWall = false; this.onGround = false;
    this.x += this.vx * dt;
    resolveX(this, ter);
    this.y += this.vy * dt;
    resolveY(this, ter);
  }

  gravity(dt, scale) {
    this.vy = Math.min(this.vy + GRAVITY * (scale === undefined ? 1 : scale) * dt, TERMINAL_VY);
  }

  overlaps(o) {
    return this.x < o.x + o.w && this.x + this.w > o.x &&
      this.y < o.y + o.h && this.y + this.h > o.y;
  }

  touchingLava(ter) {
    return ter.atPx(this.cx, this.cy) === LAVA ||
      ter.atPx(this.cx, this.y + this.h - 2) === LAVA;
  }
}

// --- particles ------------------------------------------------------------

class Particle {
  constructor(x, y, vx, vy, life, color, size, kind) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.life = life; this.maxLife = life;
    this.color = color; this.size = size;
    this.kind = kind || 'bit';
    this.dead = false;
  }

  update(dt, ter) {
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }

    if (this.kind === 'smoke') {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.vx *= 0.94; this.vy = this.vy * 0.94 - 12 * dt;
      return;
    }
    if (this.kind === 'spark') {
      this.x += this.vx * dt; this.y += this.vy * dt;
      this.vy += GRAVITY * 0.35 * dt;
      this.vx *= 0.97;
      return;
    }
    // 'bit' - debris and gibs, they collide with the world and bounce.
    this.vy = Math.min(this.vy + GRAVITY * dt, TERMINAL_VY);
    const nx = this.x + this.vx * dt;
    if (ter.solidPx(nx, this.y)) { this.vx *= -0.4; } else { this.x = nx; }
    const ny = this.y + this.vy * dt;
    if (ter.solidPx(this.x, ny)) {
      if (this.vy > 0) this.vy = -this.vy * 0.32; else this.vy = 0;
      this.vx *= 0.7;
      if (Math.abs(this.vy) < 24) { this.vy = 0; this.vx *= 0.5; }
    } else {
      this.y = ny;
    }
  }

  draw(ctx, camX, camY) {
    const a = this.kind === 'bit'
      ? (this.life < 0.4 ? this.life / 0.4 : 1)
      : this.life / this.maxLife;
    ctx.globalAlpha = clamp(a, 0, 1);
    ctx.fillStyle = this.color;
    let s = this.size;
    if (this.kind === 'smoke') s = this.size * (2 - a);
    ctx.fillRect(Math.round(this.x - camX - s / 2), Math.round(this.y - camY - s / 2),
      Math.ceil(s), Math.ceil(s));
    ctx.globalAlpha = 1;
  }
}

// --- projectiles ----------------------------------------------------------

class Bullet {
  constructor(g, x, y, dx, dy, cfg, team, owner) {
    this.g = g;
    this.x = x; this.y = y;
    this.vx = dx * cfg.speed; this.vy = dy * cfg.speed;
    this.life = cfg.life;
    this.cfg = cfg;
    this.team = team;         // 0 = players, 1 = enemies
    this.owner = owner || null;
    this.dead = false;
    this.px = x; this.py = y;
  }

  update(dt) {
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }

    const g = this.g;
    const dist = Math.hypot(this.vx, this.vy) * dt;
    const steps = Math.max(1, Math.ceil(dist / 4));
    const sx = this.vx * dt / steps, sy = this.vy * dt / steps;
    this.px = this.x; this.py = this.y;

    for (let i = 0; i < steps; i++) {
      this.x += sx; this.y += sy;

      const targets = this.team === 0 ? g.enemies : g.players;
      for (const t of targets) {
        if (t.dead || !t.hittable) continue;
        if (this.x > t.x && this.x < t.x + t.w && this.y > t.y && this.y < t.y + t.h) {
          t.hurt(1, sgn(this.vx) * 90, -40, g);
          g.burst(this.x, this.y, 5, '#d8382f', 90, 0.3);
          this.dead = true;
          return;
        }
      }

      if (g.terrain.solidPx(this.x, this.y)) {
        g.terrain.damageCircle(this.x, this.y, this.cfg.carveR, this.cfg.carveDmg, g);
        g.burst(this.x - sx, this.y - sy, 4, '#ffd98a', 110, 0.2, 'spark');
        this.dead = true;
        return;
      }
    }
  }

  draw(ctx, camX, camY) {
    ctx.strokeStyle = this.cfg.color;
    ctx.lineWidth = this.cfg.size;
    ctx.beginPath();
    const tx = this.x - this.vx * 0.012, ty = this.y - this.vy * 0.012;
    ctx.moveTo(Math.round(tx - camX), Math.round(ty - camY));
    ctx.lineTo(Math.round(this.x - camX), Math.round(this.y - camY));
    ctx.stroke();
  }
}

class Grenade extends Ent {
  constructor(g, x, y, vx, vy, owner) {
    super(x - 3, y - 3, 6, 6);
    this.g = g; this.vx = vx; this.vy = vy;
    this.fuse = 1.25; this.owner = owner; this.spin = 0;
    this.kind = 'frag';
    this.blastR = 36; this.blastDmg = 30;
    this.splits = 0;
    this.smokeT = 0;
  }
  update(dt) {
    this.fuse -= dt;
    this.spin += (Math.abs(this.vx) + Math.abs(this.vy)) * dt * 0.05;
    this.gravity(dt);
    const bounceX = this.vx, bounceY = this.vy;
    this.move(this.g.terrain, dt);
    if (this.hitWall) this.vx = -bounceX * 0.45;
    if (this.onGround) { this.vy = -bounceY * 0.35; this.vx *= 0.72; }

    // trailing smoke so thrown ordnance is easy to track in a firefight
    this.smokeT -= dt;
    if (this.smokeT <= 0) {
      this.smokeT = 0.05;
      this.g.smoke(this.cx, this.cy, 1, 0.35);
    }

    if (this.fuse <= 0) {
      this.dead = true;
      if (this.splits > 0) {
        // cluster shell: fan out bomblets instead of detonating
        for (let i = 0; i < this.splits; i++) {
          const a = -Math.PI / 2 + (i - (this.splits - 1) / 2) * 0.42;
          const b = new Grenade(this.g, this.cx, this.cy,
            Math.cos(a) * 150 + this.vx * 0.4, Math.sin(a) * 150, this.owner);
          b.fuse = rand(0.55, 0.95);
          b.blastR = this.blastR; b.blastDmg = this.blastDmg;
          this.g.projectiles.push(b);
        }
        this.g.burst(this.cx, this.cy, 10, '#ffd9a0', 140, 0.3, 'spark');
        sfx('throwArc');
        return;
      }
      this.g.explode(this.cx, this.cy, this.blastR, this.blastDmg, this.owner);
    }
  }
  draw(ctx, camX, camY) {
    const x = Math.round(this.cx - camX), y = Math.round(this.cy - camY);
    const hot = this.fuse < 0.4 && Math.floor(this.fuse * 20) % 2;
    if (this.kind === 'briefcase') {
      ctx.fillStyle = hot ? '#ffd9a0' : '#6b4423';
      ctx.fillRect(x - 5, y - 4, 10, 8);
      ctx.fillStyle = '#3c2716';
      ctx.fillRect(x - 5, y - 1, 10, 1);
      ctx.fillStyle = '#c8a24a';
      ctx.fillRect(x - 1, y - 6, 3, 2);          // handle
      return;
    }
    ctx.fillStyle = hot ? '#ff5b3a' : (this.splits > 0 ? '#7a4a86' : '#3f5a32');
    ctx.fillRect(x - 3, y - 3, 6, 6);
    ctx.fillStyle = '#9aa48c';
    ctx.fillRect(x - 1, y - 5, 2, 2);
  }
}

class C4 extends Ent {
  constructor(g, x, y, vx, vy, owner) {
    super(x - 3, y - 2, 6, 4);
    this.g = g; this.vx = vx; this.vy = vy;
    this.owner = owner; this.armed = false; this.t = 0;
  }
  update(dt) {
    this.t += dt;
    if (!this.armed) {
      this.gravity(dt);
      const bx = this.vx;
      this.move(this.g.terrain, dt);
      if (this.hitWall) this.vx = -bx * 0.2;
      if (this.onGround) { this.vx *= 0.6; if (Math.abs(this.vx) < 12) { this.vx = 0; this.armed = true; sfx('plant'); } }
    } else {
      // Stays put unless the ground under it gets blown away.
      if (!this.g.terrain.solidPx(this.cx, this.y + this.h + 2)) { this.armed = false; this.vy = 10; }
    }
  }
  detonate() {
    this.dead = true;
    this.g.explode(this.cx, this.cy, 48, 40, this.owner);
  }
  draw(ctx, camX, camY) {
    const x = Math.round(this.cx - camX), y = Math.round(this.cy - camY);
    ctx.fillStyle = '#d8cfae';
    ctx.fillRect(x - 3, y - 2, 6, 4);
    ctx.fillStyle = Math.floor(this.t * 6) % 2 ? '#ff3b2f' : '#5c1a14';
    ctx.fillRect(x + 1, y - 4, 2, 2);
  }
}

// --- player ---------------------------------------------------------------

class Player extends Ent {
  constructor(g, index, charIndex) {
    super(0, 0, 12, 16);
    this.g = g;
    this.anim = new Anim();
    this.burstLeft = 0;
    this.burstCd = 0;
    this.index = index;
    this.char = CHARS[charIndex];
    this.charIndex = charIndex;
    this.ctl = makeControl();
    this.alive = false;
    this.hittable = false;
    this.respawn = 0.4;
    this.invuln = 0;
    this.fireCd = 0;
    this.special = this.char.specialMax;
    this.liveC4 = [];
    this.animT = 0;
    this.climbing = false;
    this.coyote = 0;
    this.jumpBuf = 0;
    this.wasGround = false;
    this.aimX = 1; this.aimY = 0;
    this.muzzle = 0;
    this.joined = true;
    this.reachedGoal = false;
    this.deaths = 0;
    this.kills = 0;
  }

  spawnAt(x, y) {
    this.x = x - this.w / 2;
    this.y = y - this.h;
    this.vx = 0; this.vy = 0;
    this.alive = true;
    this.hittable = true;
    this.invuln = 1.6;
    this.climbing = false;
    this.reachedGoal = false;
    unstick(this, this.g.terrain);
    this.g.burst(this.cx, this.cy, 16, '#ffffff', 150, 0.35, 'spark');
    sfx('spawn');
  }

  aim() {
    let ax = 0, ay = 0;
    if (this.ctl.up) ay = -1;
    else if (this.ctl.down) ay = 1;
    if (this.ctl.left) ax = -1;
    else if (this.ctl.right) ax = 1;
    if (ax === 0 && ay === 0) ax = this.facing;
    if (ay > 0 && this.onGround) { ay = 0; if (ax === 0) ax = this.facing; }
    const l = Math.hypot(ax, ay) || 1;
    this.aimX = ax / l; this.aimY = ay / l;
  }

  update(dt) {
    const g = this.g, c = this.ctl, ch = this.char;
    this.animT += dt;

    if (!this.alive) {
      this.respawn -= dt;
      if (this.respawn <= 0 && g.lives > 0) {
        g.lives--;
        const p = g.respawnPoint(this);
        this.spawnAt(p.x, p.y);
      }
      return;
    }

    if (this.invuln > 0) this.invuln -= dt;

    // horizontal movement
    const want = (c.right ? 1 : 0) - (c.left ? 1 : 0);
    const accel = this.onGround ? 1500 : 900;
    if (want !== 0) {
      this.vx = approach(this.vx, want * ch.speed, accel * dt);
      this.facing = want;
    } else {
      this.vx = approach(this.vx, 0, (this.onGround ? 1700 : 500) * dt);
    }

    // wall cling: press into a wall while airborne to stick and climb
    const pressingWall = this.wallDir !== 0 && want === this.wallDir;
    if (!this.onGround && pressingWall && this.vy > -40) {
      this.climbing = true;
      this.vy = c.up ? -108 : (c.down ? 220 : 46);
    } else {
      this.climbing = false;
      this.gravity(dt);
      if (this.vy < 0 && !c.jump) this.vy += GRAVITY * 1.1 * dt; // variable jump height
    }

    // jump, with coyote time and input buffering so it never feels sticky
    if (this.onGround) this.coyote = 0.1; else this.coyote -= dt;
    if (c.jumpP) this.jumpBuf = 0.12; else this.jumpBuf -= dt;
    if (this.jumpBuf > 0) {
      if (this.coyote > 0) {
        this.vy = -ch.jump; this.jumpBuf = 0; this.coyote = 0; sfx('jump');
      } else if (this.climbing) {
        this.vy = -ch.jump * 0.95;
        this.vx = -this.wallDir * 210;
        this.facing = -this.wallDir;
        this.jumpBuf = 0; this.climbing = false;
        sfx('jump');
      }
    }

    this.aim();

    // primary fire
    this.fireCd -= dt;
    this.burstCd -= dt;
    if (this.muzzle > 0) this.muzzle -= dt;
    const wcfg = WEAPONS[ch.weapon];
    if (wcfg.burst) {
      // burst weapons: a trigger pull commits to N rounds
      if (c.fire && this.fireCd <= 0 && this.burstLeft <= 0) {
        this.burstLeft = wcfg.burst;
        this.fireCd = wcfg.rate;
      }
      if (this.burstLeft > 0 && this.burstCd <= 0) {
        this.burstLeft--;
        this.burstCd = wcfg.burstGap;
        this.shoot(wcfg, true);
      }
    } else if (c.fire && this.fireCd <= 0) {
      this.shoot(wcfg);
    }

    // special weapon
    if (c.specialP) this.useSpecial();

    const fallVy = this.vy;
    this.move(g.terrain, dt);
    if (this.onGround && !this.wasGround && fallVy > 60) {
      // land: squash the sprite and kick up dust proportional to the impact
      this.anim.squash = clamp(fallVy / 520, 0.25, 1);
      g.dust(this.cx, this.y + this.h, clamp(Math.round(fallVy / 90), 2, 7));
      sfx('land');
    }
    this.wasGround = this.onGround;

    // drive the animation state machine
    this.anim.update(dt);
    this.anim.set(
      this.climbing ? 'climb'
        : !this.onGround ? (this.vy < -20 ? 'jump' : 'fall')
          : Math.abs(this.vx) > 14 ? 'run' : 'idle'
    );

    if (this.touchingLava(g.terrain)) this.hurt(99, 0, -200, g);
    if (this.y > g.terrain.h * T + 40) this.hurt(99, 0, 0, g);
  }

  shoot(w, inBurst) {
    const g = this.g;
    if (!inBurst) this.fireCd = w.rate;
    this.muzzle = 0.05;
    this.anim.recoil = w.pellets > 1 || w.lob ? 1 : 0.55;
    const mx = this.cx + this.aimX * 11;
    const my = this.cy - 2 + this.aimY * 11;

    // grenade launcher lobs an arcing shell rather than firing bullets
    if (w.lob) {
      const shell = new Grenade(g, mx, my,
        this.aimX * w.speed + this.vx * 0.3, this.aimY * w.speed - 130, this);
      shell.fuse = 1.5;
      shell.blastR = w.blastR;
      shell.blastDmg = w.blastDmg;
      g.projectiles.push(shell);
      this.vx -= this.aimX * w.kick;
      g.burst(mx, my, 8, '#ffcc7a', 150, 0.22, 'spark');
      g.smoke(mx, my, 4);
      g.shake(3.4);
      sfx(w.sfx);
      return;
    }

    for (let i = 0; i < w.pellets; i++) {
      const a = Math.atan2(this.aimY, this.aimX) + rand(-w.spread, w.spread);
      g.bullets.push(new Bullet(g, mx, my, Math.cos(a), Math.sin(a), w, 0, this));
    }
    this.vx -= this.aimX * w.kick;
    if (!this.onGround) this.vy -= this.aimY * w.kick * 0.35;
    g.burst(mx, my, w.pellets > 1 ? 8 : 3, '#ffe9a8', 140, 0.16, 'spark');
    g.shake(w.pellets > 1 ? 3.2 : 0.8);
    sfx(w.sfx);
  }

  useSpecial() {
    const g = this.g, ch = this.char;
    if (ch.special === 'grenade' || ch.special === 'briefcase' || ch.special === 'cluster') {
      if (this.special <= 0) { sfx('beep'); return; }
      this.special--;
      this.anim.recoil = 0.7;
      const vx = this.aimX * 250 + this.vx * 0.4;
      const vy = this.aimY * 250 - 130;
      const nade = new Grenade(g, this.cx + this.aimX * 8, this.cy - 2, vx, vy, this);
      if (ch.special === 'briefcase') {
        nade.kind = 'briefcase';
        nade.blastR = 44; nade.blastDmg = 36;
      } else if (ch.special === 'cluster') {
        // splits into a fan of bomblets at the top of its arc
        nade.kind = 'cluster';
        nade.fuse = 0.85;
        nade.blastR = 30; nade.blastDmg = 28;
        nade.splits = 5;
      }
      g.projectiles.push(nade);
      sfx('throwArc');
    } else {
      // C4: first press throws a charge, next press detonates everything live.
      this.liveC4 = this.liveC4.filter(c => !c.dead);
      if (this.liveC4.length > 0) {
        for (const c of this.liveC4) c.detonate();
        this.liveC4.length = 0;
        return;
      }
      if (this.special <= 0) { sfx('beep'); return; }
      this.special--;
      const c4 = new C4(g, this.cx + this.aimX * 8, this.cy - 2,
        this.aimX * 190 + this.vx * 0.4, this.aimY * 160 - 120, this);
      g.projectiles.push(c4);
      this.liveC4.push(c4);
      sfx('throwArc');
    }
  }

  hurt(dmg, kx, ky, g) {
    if (!this.alive || this.invuln > 0) return;
    this.alive = false;
    this.hittable = false;
    this.respawn = 1.5;
    this.deaths++;
    g.corpse(this, this.char, kx || rand(-120, 120), ky || -60);
    g.shake(7);
    g.hitStop(0.09);
    sfx('hurt');
    if (g.lives <= 0) g.checkGameOver();
  }

  draw(ctx, camX, camY) {
    if (!this.alive) return;
    if (this.invuln > 0 && Math.floor(this.invuln * 18) % 2) return;
    drawChar(ctx, this.char, this.cx - camX, this.y + this.h - camY, {
      facing: this.facing,
      anim: this.anim,
      aimX: this.aimX, aimY: this.aimY,
      muzzle: this.muzzle > 0,
      shadowY: groundBelow(this.g.terrain, this.cx, this.y + this.h) - camY,
      tag: this.index === 0 ? '#5ec8ff' : '#ff9a5e'
    });
  }
}

// World y of the first solid surface beneath a point, for drop shadows.
function groundBelow(ter, px, py) {
  const tx = Math.floor(px / T);
  let ty = Math.floor(py / T);
  for (let i = 0; i < 14; i++, ty++) if (ter.solid(tx, ty)) return ty * T;
  return py + 224;
}

// Draws a small pixel soldier. x is the horizontal centre, y is the feet line.
function drawBro(ctx, ch, x, y, facing, pose, t, aimX, aimY, flash, playerIndex) {
  x = Math.round(x); y = Math.round(y);
  const bob = pose === 'run' ? Math.round(Math.sin(t * 18) * 0.5 + 0.5) : 0;
  const top = y - 16 + bob;

  // legs
  ctx.fillStyle = ch.pants;
  if (pose === 'run') {
    const s = Math.sin(t * 18);
    ctx.fillRect(x - 4 + Math.round(s * 2), top + 11, 3, 5);
    ctx.fillRect(x + 1 - Math.round(s * 2), top + 11, 3, 5);
  } else if (pose === 'air') {
    ctx.fillRect(x - 4, top + 11, 3, 4);
    ctx.fillRect(x + 1, top + 12, 3, 4);
  } else if (pose === 'climb') {
    ctx.fillRect(x - 3, top + 11, 3, 4);
    ctx.fillRect(x + 1, top + 11, 3, 5);
  } else {
    ctx.fillRect(x - 4, top + 11, 3, 5);
    ctx.fillRect(x + 1, top + 11, 3, 5);
  }
  ctx.fillStyle = ch.boots;
  ctx.fillRect(x - 4, top + 15, 3, 1);
  ctx.fillRect(x + 1, top + 15, 3, 1);

  // torso
  ctx.fillStyle = ch.shirt;
  ctx.fillRect(x - 4, top + 5, 8, 7);
  ctx.fillStyle = ch.shirt2;
  ctx.fillRect(x - 4, top + 9, 8, 3);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x + (facing > 0 ? 2 : -4), top + 5, 2, 7);

  // head
  ctx.fillStyle = ch.skin;
  ctx.fillRect(x - 3, top, 6, 6);
  ctx.fillStyle = ch.hair;
  ctx.fillRect(x - 3, top, 6, 2);
  ctx.fillStyle = ch.band;
  ctx.fillRect(x - 4, top + 1, 8, 2);
  ctx.fillStyle = '#1a1410';
  ctx.fillRect(x + (facing > 0 ? 1 : -2), top + 3, 1, 2);

  // arms + weapon along the aim vector
  const ax = aimX, ay = aimY;
  const sx0 = x + facing, sy0 = top + 7;
  const len = ch.weapon === 'shotgun' ? 11 : 12;
  ctx.strokeStyle = ch.skin;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sx0, sy0);
  ctx.lineTo(sx0 + ax * 5, sy0 + ay * 5);
  ctx.stroke();

  ctx.strokeStyle = '#2f3238';
  ctx.lineWidth = ch.weapon === 'shotgun' ? 3 : 2;
  ctx.beginPath();
  ctx.moveTo(sx0 + ax * 3, sy0 + ay * 3);
  ctx.lineTo(sx0 + ax * len, sy0 + ay * len);
  ctx.stroke();

  if (flash) {
    ctx.fillStyle = '#fff2b0';
    const fx = Math.round(sx0 + ax * (len + 2)), fy = Math.round(sy0 + ay * (len + 2));
    ctx.fillRect(fx - 2, fy - 2, 5, 5);
  }

  // player number tag so you can tell the two apart at a glance
  ctx.fillStyle = playerIndex === 0 ? '#5ec8ff' : '#ff9a5e';
  ctx.fillRect(x - 1, top - 4, 2, 2);
}

// --- enemies --------------------------------------------------------------

class Grunt extends Ent {
  constructor(g, x, y) {
    super(x - 6, y - 16, 12, 16);
    this.g = g;
    this.hittable = true;
    this.hp = 1;
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.shootCd = rand(0.4, 1.4);
    this.alert = 0;
    this.animT = rand(0, 5);
    this.anim = new Anim();
    this.anim.t = rand(0, 2);
    this.kind = 'grunt';
  }

  update(dt) {
    const g = this.g;
    this.animT += dt;
    this.anim.update(dt);
    this.gravity(dt);

    const target = g.nearestPlayer(this.cx, this.cy, 200);
    if (target && g.terrain.clearLine(this.cx, this.cy, target.cx, target.cy)) {
      this.alert = 1.2;
      this.facing = sgn(target.cx - this.cx) || this.facing;
      this.dir = this.facing;
      this.vx = approach(this.vx, 0, 700 * dt);
      this.shootCd -= dt;
      if (this.shootCd <= 0) {
        this.shootCd = rand(0.85, 1.35);
        const a = Math.atan2(target.cy - this.cy, target.cx - this.cx) + rand(-0.09, 0.09);
        g.bullets.push(new Bullet(g, this.cx + Math.cos(a) * 9, this.cy + Math.sin(a) * 9,
          Math.cos(a), Math.sin(a), ENEMY_SHOT, 1, this));
        g.burst(this.cx + Math.cos(a) * 9, this.cy + Math.sin(a) * 9, 3, '#ffb27a', 90, 0.14, 'spark');
        this.anim.recoil = 0.8;
        this.muzzleT = 0.06;
        sfx('enemyShot');
      }
    } else {
      this.alert -= dt;
      this.vx = approach(this.vx, this.dir * 46, 500 * dt);
      this.facing = this.dir;
      // turn at walls and at the edge of a drop
      const ahead = this.cx + this.dir * 8;
      if (this.hitWall) this.dir = -this.dir;
      else if (this.onGround && !g.terrain.solidPx(ahead, this.y + this.h + 3)) this.dir = -this.dir;
    }

    this.move(g.terrain, dt);
    if (this.touchingLava(g.terrain)) this.hurt(99, 0, 0, g);
  }

  hurt(dmg, kx, ky, g) {
    if (this.dead) return;
    this.anim.hurt = 1;
    this.hp -= dmg;
    if (this.hp <= 0) {
      this.dead = true;
      g.enemyKilled(this);
      g.corpse(this, ENEMY_LOOK, kx, ky);
      sfx('enemyDie');
    }
  }

  draw(ctx, camX, camY) {
    if (this.muzzleT > 0) this.muzzleT -= 1 / 60;
    this.anim.set(!this.onGround ? 'fall' : Math.abs(this.vx) > 8 ? 'run' : 'idle');
    drawChar(ctx, ENEMY_LOOK, this.cx - camX, this.y + this.h - camY, {
      facing: this.facing, anim: this.anim,
      aimX: this.facing, aimY: 0, muzzle: this.muzzleT > 0,
      shadowY: groundBelow(this.g.terrain, this.cx, this.y + this.h) - camY
    });
    if (this.alert > 0.9) {
      ctx.fillStyle = '#ff4a3a';
      ctx.fillRect(Math.round(this.cx - camX) - 1, Math.round(this.y - camY) - 9, 2, 5);
    }
  }
}

class Rusher extends Ent {
  constructor(g, x, y) {
    super(x - 6, y - 15, 12, 15);
    this.g = g;
    this.hittable = true;
    this.hp = 1;
    this.dir = 1;
    this.animT = rand(0, 5);
    this.anim = new Anim();
    this.anim.t = rand(0, 2);
    this.charging = 0;
    this.kind = 'rusher';
  }

  update(dt) {
    const g = this.g;
    this.animT += dt;
    this.anim.update(dt);
    this.gravity(dt);

    const target = g.nearestPlayer(this.cx, this.cy, 260);
    if (target && g.terrain.clearLine(this.cx, this.cy, target.cx, target.cy)) {
      this.charging = 1.4;
      this.dir = sgn(target.cx - this.cx) || this.dir;
    } else {
      this.charging -= dt;
    }
    const speed = this.charging > 0 ? 132 : 52;
    this.vx = approach(this.vx, this.dir * speed, 900 * dt);
    this.facing = this.dir;

    const ahead = this.cx + this.dir * 8;
    if (this.hitWall) {
      // hop over low obstacles instead of getting stuck on them
      if (this.onGround && !g.terrain.solidPx(ahead, this.y - 6)) this.vy = -280;
      else this.dir = -this.dir;
    } else if (this.onGround && this.charging <= 0 &&
      !g.terrain.solidPx(ahead, this.y + this.h + 3)) {
      this.dir = -this.dir;
    }

    this.move(g.terrain, dt);
    if (this.touchingLava(g.terrain)) this.hurt(99, 0, 0, g);

    for (const p of g.players) {
      if (p.alive && this.overlaps(p)) p.hurt(1, sgn(p.cx - this.cx) * 140, -160, g);
    }
  }

  hurt(dmg, kx, ky, g) {
    if (this.dead) return;
    this.anim.hurt = 1;
    this.hp -= dmg;
    if (this.hp <= 0) {
      this.dead = true;
      g.enemyKilled(this);
      g.corpse(this, RUSHER_LOOK, kx, ky);
      sfx('enemyDie');
    }
  }

  draw(ctx, camX, camY) {
    // charging rushers animate faster - reads as panic from across the screen
    if (this.charging > 0) this.anim.t += 1 / 90;
    this.anim.set(!this.onGround ? 'fall' : 'run');
    drawChar(ctx, RUSHER_LOOK, this.cx - camX, this.y + this.h - camY, {
      facing: this.facing, anim: this.anim, aimX: this.facing, aimY: 0,
      shadowY: groundBelow(this.g.terrain, this.cx, this.y + this.h) - camY
    });
  }
}

class Turret extends Ent {
  constructor(g, x, y) {
    super(x - 7, y - 12, 14, 12);
    this.g = g;
    this.hittable = true;
    this.hp = 4;
    this.cd = rand(0.5, 1.5);
    this.burst = 0;
    this.angle = Math.PI;
    this.kind = 'turret';
  }

  update(dt) {
    const g = this.g;
    // Turrets are bolted down; blow out the floor and they fall.
    if (!g.terrain.solidPx(this.cx, this.y + this.h + 2)) {
      this.gravity(dt);
      this.move(g.terrain, dt);
    }

    const target = g.nearestPlayer(this.cx, this.cy, 250);
    if (target && g.terrain.clearLine(this.cx, this.cy - 4, target.cx, target.cy)) {
      const want = Math.atan2(target.cy - (this.cy - 4), target.cx - this.cx);
      let d = want - this.angle;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.angle += clamp(d, -2.4 * dt, 2.4 * dt);
      this.cd -= dt;
      if (this.cd <= 0) {
        if (this.burst <= 0) this.burst = 3;
        this.burst--;
        this.cd = this.burst > 0 ? 0.11 : rand(1.1, 1.6);
        const a = this.angle + rand(-0.05, 0.05);
        g.bullets.push(new Bullet(g, this.cx + Math.cos(a) * 11, this.cy - 4 + Math.sin(a) * 11,
          Math.cos(a), Math.sin(a), ENEMY_SHOT, 1, this));
        sfx('enemyShot');
      }
    }
  }

  hurt(dmg, kx, ky, g) {
    if (this.dead) return;
    this.hp -= dmg;
    this.flash = 0.12;
    // metal: bright ricochet sparks rather than a puff of debris
    g.burst(this.cx, this.cy - 4, 6, '#dfe6f2', 130, 0.24, 'spark');
    g.burst(this.cx, this.cy - 4, 3, '#ffd166', 100, 0.2, 'spark');
    if (this.hp <= 0) {
      this.dead = true;
      g.enemyKilled(this);
      g.explode(this.cx, this.cy - 3, 26, 18, null);
    }
  }

  draw(ctx, camX, camY) {
    const x = Math.round(this.cx - camX), y = Math.round(this.y - camY);
    ctx.strokeStyle = '#3a3f49';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, y + 8);
    ctx.lineTo(x + Math.cos(this.angle) * 12, y + 8 + Math.sin(this.angle) * 12);
    ctx.stroke();
    ctx.fillStyle = '#4d5462';
    ctx.fillRect(x - 7, y + 4, 14, 8);
    ctx.fillStyle = '#5e6675';
    ctx.fillRect(x - 5, y + 1, 10, 5);
    ctx.fillStyle = '#ff4a3a';
    ctx.fillRect(x - 1, y + 2, 2, 2);
    if (this.flash > 0) {
      this.flash -= 1 / 60;
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = '#fff';
      ctx.fillRect(x - 7, y, 14, 12);
      ctx.globalAlpha = 1;
    }
  }
}

// A body flung backwards by whatever killed it, tumbling until it comes apart.
class Corpse extends Ent {
  constructor(g, x, y, look, vx, vy, facing) {
    super(x - 6, y - 8, 12, 16);
    this.g = g;
    this.look = look;
    this.vx = vx; this.vy = vy;
    this.facing = facing || 1;
    this.anim = new Anim();
    this.anim.set('dead');
    this.life = rand(0.45, 0.7);
    this.hittable = false;
    this.kind = 'corpse';
  }
  update(dt) {
    this.life -= dt;
    this.anim.dieT += dt;
    this.anim.update(dt);
    this.gravity(dt, 0.85);
    const bx = this.vx;
    this.move(this.g.terrain, dt);
    if (this.hitWall) this.vx = -bx * 0.3;
    if (this.onGround) this.vx *= 0.86;
    if (this.life <= 0) {
      this.dead = true;
      this.g.gib(this.cx, this.cy, this.look);
    }
  }
  draw(ctx, camX, camY) {
    drawChar(ctx, this.look, this.cx - camX, this.y + this.h - camY, {
      facing: this.facing, anim: this.anim, aimX: this.facing, aimY: 0
    });
  }
}

class Barrel extends Ent {
  constructor(g, x, y) {
    super(x - 6, y - 14, 12, 14);
    this.g = g;
    this.hittable = true;
    this.hp = 1;
    this.fuse = -1;
    this.kind = 'barrel';
  }
  update(dt) {
    this.gravity(dt);
    this.vx = approach(this.vx, 0, 400 * dt);
    this.move(this.g.terrain, dt);
    if (this.fuse > 0) {
      this.fuse -= dt;
      if (this.fuse <= 0) { this.dead = true; this.g.explode(this.cx, this.cy, 46, 38, null); }
    }
    if (this.touchingLava(this.g.terrain) && this.fuse < 0) this.fuse = 0.05;
  }
  hurt(dmg, kx, ky, g) {
    if (this.dead || this.fuse > 0) return;
    this.fuse = 0.12;   // brief delay so chains pop in sequence, not all at once
    this.vx += kx * 0.4;
    this.vy -= 60;
  }
  draw(ctx, camX, camY) {
    const x = Math.round(this.x - camX), y = Math.round(this.y - camY);
    const hot = this.fuse > 0 && Math.floor(this.fuse * 40) % 2;
    ctx.fillStyle = hot ? '#ffd9a0' : '#b8452c';
    ctx.fillRect(x, y, 12, 14);
    ctx.fillStyle = hot ? '#fff2cc' : '#8e3120';
    ctx.fillRect(x, y + 3, 12, 2);
    ctx.fillRect(x, y + 9, 12, 2);
    ctx.fillStyle = '#f2c14e';
    ctx.fillRect(x + 4, y + 6, 4, 3);
  }
}

class Pow extends Ent {
  constructor(g, x, y) {
    super(x - 6, y - 16, 12, 16);
    this.g = g;
    this.hittable = false;
    this.animT = rand(0, 5);
    this.anim = new Anim();
    this.anim.t = rand(0, 2);
    this.freed = 0;
    this.kind = 'pow';
  }
  update(dt) {
    this.animT += dt;
    this.anim.update(dt);
    this.gravity(dt);
    if (this.freed > 0) {
      this.freed -= dt;
      this.vx = approach(this.vx, this.facing * 150, 600 * dt);
      if (this.freed <= 0) this.dead = true;
    } else {
      this.vx = approach(this.vx, 0, 700 * dt);
      for (const p of this.g.players) {
        if (p.alive && this.overlaps(p)) this.rescue(p);
      }
    }
    this.move(this.g.terrain, dt);
    if (this.touchingLava(this.g.terrain)) this.dead = true;
  }
  rescue(p) {
    this.freed = 1.4;
    this.facing = sgn(this.cx - p.cx) || 1;
    this.g.lives++;
    this.g.rescued++;
    this.g.toast('+1 LIFE  ·  HOSTAGE FREED', '#7ee081');
    this.g.burst(this.cx, this.cy, 14, '#ffe36b', 130, 0.5, 'spark');
    sfx('rescue');
  }
  draw(ctx, camX, camY) {
    if (this.freed > 0) this.anim.t += 1 / 90;
    this.anim.set(this.freed > 0 ? 'run' : 'idle');
    drawChar(ctx, POW_LOOK, this.cx - camX, this.y + this.h - camY, {
      facing: this.facing, anim: this.anim, aimX: this.facing, aimY: 0,
      shadowY: groundBelow(this.g.terrain, this.cx, this.y + this.h) - camY
    });
    if (this.freed <= 0) {
      ctx.fillStyle = Math.floor(this.animT * 3) % 2 ? '#ffe36b' : '#c9a63c';
      ctx.fillRect(Math.round(this.cx - camX) - 1, Math.round(this.y - camY) - 8, 2, 5);
      ctx.fillRect(Math.round(this.cx - camX) - 1, Math.round(this.y - camY) - 2, 2, 1);
    }
  }
}

const ENEMY_SHOT = {
  speed: 230, life: 2.2, carveR: 2.4, carveDmg: 1,
  size: 3, color: '#ff8a4a', sfx: 'enemyShot'
};

const ENEMY_LOOK = {
  weapon: 'rifle', head: 'helmet', chest: null, accent: '#8b1e18',
  skin: '#b5895f', hair: '#20242c', shirt: '#3b4250', shirt2: '#2e3441',
  pants: '#282d38', boots: '#1a1d24'
};

const RUSHER_LOOK = {
  weapon: 'none', head: 'band', chest: 'sash', accent: '#d24a9a',
  skin: '#a8735a', hair: '#1a1a1a', shirt: '#6b2f6b', shirt2: '#552455',
  pants: '#2f2438', boots: '#1a1520'
};

const POW_LOOK = {
  weapon: 'none', head: 'slick', chest: null, accent: '#d9d2c2',
  skin: '#e0b48c', hair: '#5a4030', shirt: '#d9d2c2', shirt2: '#bdb6a6',
  pants: '#8a8375', boots: '#4a463e'
};
