// ---------------------------------------------------------------------------
// BROSTORM - modular rectangle sprite system
//
// Every character is assembled at draw time from a "look" recipe: a handful of
// rectangles plus a head style, a weapon silhouette and one accent colour.
// No sprite sheets, no external assets. Proportions are deliberately pushed -
// big head, broad shoulders, short legs - so a character is identifiable from
// its silhouette alone.
// ---------------------------------------------------------------------------

const ANIM_FPS = 10;

// Body metrics in sprite pixels, measured up from the feet line.
// ~25% larger than the original 16px build.
const BUILD = {
  headW: 9, headH: 8,
  torsoW: 11, torsoH: 7,
  legW: 4, legH: 6,
  armW: 3
};

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(((n >> 16) & 255) + amt, 0, 255);
  const g = clamp(((n >> 8) & 255) + amt, 0, 255);
  const b = clamp((n & 255) + amt, 0, 255);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

// --- animation state ------------------------------------------------------

class Anim {
  constructor() {
    this.state = 'idle';
    this.t = 0;
    this.squash = 0;    // 1 = just landed hard
    this.recoil = 0;    // 1 = just fired
    this.hurt = 0;      // 1 = just took a hit (white flash)
    this.dieT = 0;
  }
  set(state) {
    if (state === this.state) return;
    this.state = state;
    this.t = 0;
  }
  update(dt) {
    this.t += dt;
    this.squash = Math.max(0, this.squash - dt * 5);
    this.recoil = Math.max(0, this.recoil - dt * 7);
    this.hurt = Math.max(0, this.hurt - dt * 9);
  }
  get frame() { return Math.floor(this.t * ANIM_FPS) & 3; }
}

// Four-frame cycles. Index by Anim.frame.
const RUN_LEG_F = [4, 1, -4, -1];    // front leg offset
const RUN_LEG_B = [-4, -1, 4, 1];    // back leg offset
const RUN_BOB = [0, -2, 0, -1];
const IDLE_BOB = [0, 0, -1, 0];
const CLIMB_LEG = [2, 0, -2, 0];

// --- weapons --------------------------------------------------------------

// Drawn in weapon-local space: +x points along the aim vector, y is across.
function drawWeaponShape(ctx, type, accent, muzzle) {
  const dark = '#2b2e35', mid = '#43474f', metal = '#6a707c';
  switch (type) {
    case 'rifle':
      ctx.fillStyle = dark; ctx.fillRect(-2, -1, 13, 3);      // barrel + body
      ctx.fillStyle = mid; ctx.fillRect(-3, -2, 5, 4);        // receiver
      ctx.fillStyle = dark; ctx.fillRect(1, 2, 2, 3);         // magazine
      ctx.fillStyle = accent; ctx.fillRect(8, -2, 2, 1);      // front sight
      break;
    case 'shotgun':
      ctx.fillStyle = dark; ctx.fillRect(-3, -2, 13, 4);      // fat twin barrel
      ctx.fillStyle = metal; ctx.fillRect(2, -2, 8, 1);
      ctx.fillStyle = '#7a4a24'; ctx.fillRect(-5, -1, 3, 3);  // wooden stock
      ctx.fillStyle = accent; ctx.fillRect(-1, 1, 4, 2);      // pump
      break;
    case 'stapler':
      ctx.fillStyle = '#c8ccd2'; ctx.fillRect(-3, -3, 10, 5); // chunky boxy body
      ctx.fillStyle = accent; ctx.fillRect(-3, -3, 10, 2);    // coloured lid
      ctx.fillStyle = dark; ctx.fillRect(7, -1, 3, 2);        // nose
      ctx.fillStyle = '#8f959e'; ctx.fillRect(-1, 2, 5, 2);   // hinge
      break;
    case 'launcher':
      ctx.fillStyle = mid; ctx.fillRect(-4, -3, 15, 6);       // enormous tube
      ctx.fillStyle = dark; ctx.fillRect(10, -4, 3, 8);       // muzzle bell
      ctx.fillStyle = accent; ctx.fillRect(-1, 3, 6, 3);      // drum magazine
      ctx.fillStyle = metal; ctx.fillRect(-4, -3, 15, 1);
      break;
    case 'sniper':
      ctx.fillStyle = dark; ctx.fillRect(-4, -1, 20, 2);       // long barrel
      ctx.fillStyle = '#3d4a30'; ctx.fillRect(-6, -2, 8, 5);   // stock
      ctx.fillStyle = mid; ctx.fillRect(-1, -2, 6, 4);         // action
      ctx.fillStyle = '#20242a'; ctx.fillRect(0, -5, 7, 3);    // scope
      ctx.fillStyle = accent; ctx.fillRect(6, -5, 2, 2);       // lens
      ctx.fillStyle = dark; ctx.fillRect(12, 1, 2, 4);         // bipod
      ctx.fillRect(14, 1, 2, 4);
      break;
    case 'blower':
      ctx.fillStyle = '#2f6b34'; ctx.fillRect(-6, -4, 9, 8);   // engine housing
      ctx.fillStyle = '#3f8a44'; ctx.fillRect(-6, -4, 9, 3);
      ctx.fillStyle = '#43474f'; ctx.fillRect(3, -2, 8, 4);    // tube
      ctx.fillStyle = '#5a6069'; ctx.fillRect(10, -4, 4, 8);   // flared nozzle
      ctx.fillStyle = accent; ctx.fillRect(-4, 4, 4, 2);       // pull cord
      ctx.fillStyle = '#20242a'; ctx.fillRect(-1, -6, 3, 2);   // exhaust
      break;
    case 'none':
    default:
      return;
  }
  if (muzzle && type !== 'blower') {
    const tip = type === 'launcher' ? 14 : type === 'stapler' ? 11 : 12;
    ctx.fillStyle = '#fff3c4';
    ctx.fillRect(tip, -3, 6, 6);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(tip + 5, -2, 4, 4);
    ctx.fillRect(tip + 2, -5, 2, 10);
  }
}

// --- head styles ----------------------------------------------------------

function drawHead(ctx, look, hx, hy, w, h, facing) {
  const skin = look.skin;
  ctx.fillStyle = skin;
  ctx.fillRect(hx, hy, w, h);
  ctx.fillStyle = shade(skin, -28);
  ctx.fillRect(hx + (facing > 0 ? w - 2 : 0), hy + 2, 2, h - 2);   // cheek shade

  const eyeX = hx + (facing > 0 ? w - 4 : 2);
  ctx.fillStyle = '#181410';
  ctx.fillRect(eyeX, hy + 4, 2, 2);

  if (look.moustache) {
    ctx.fillStyle = look.hair;
    ctx.fillRect(hx + 1, hy + 6, w - 2, 2);
    ctx.fillRect(hx + (facing > 0 ? w - 2 : 0), hy + 5, 2, 2);
  }

  switch (look.head) {
    case 'band':                                  // headband + short hair
      ctx.fillStyle = look.hair; ctx.fillRect(hx, hy - 1, w, 3);
      ctx.fillStyle = look.accent; ctx.fillRect(hx - 1, hy + 1, w + 2, 2);
      ctx.fillRect(hx + (facing > 0 ? -3 : w + 1), hy + 2, 3, 5);  // trailing tail
      break;
    case 'helmet':                                // dome + brim
      ctx.fillStyle = look.accent; ctx.fillRect(hx - 1, hy - 3, w + 2, 5);
      ctx.fillStyle = shade(look.accent, -35); ctx.fillRect(hx - 2, hy + 1, w + 4, 2);
      ctx.fillStyle = shade(look.accent, 28); ctx.fillRect(hx + 1, hy - 3, w - 4, 2);
      break;
    case 'slick':                                 // neat side parting
      ctx.fillStyle = look.hair; ctx.fillRect(hx, hy - 2, w, 4);
      ctx.fillStyle = shade(look.hair, 30);
      ctx.fillRect(hx + (facing > 0 ? w - 4 : 1), hy - 2, 3, 2);
      break;
    case 'ghillie':                               // shaggy hood, lit eyes
      ctx.fillStyle = '#20281a';                                  // shadowed face
      ctx.fillRect(hx, hy + 2, w, h - 2);
      ctx.fillStyle = '#e8a83a';                                  // eyes
      ctx.fillRect(hx + (facing > 0 ? w - 4 : 1), hy + 4, 2, 2);
      ctx.fillRect(hx + (facing > 0 ? w - 7 : 4), hy + 4, 2, 2);
      ctx.fillStyle = look.hair;                                  // hood mass
      ctx.fillRect(hx - 2, hy - 3, w + 4, 5);
      ctx.fillStyle = shade(look.hair, 22);
      ctx.fillRect(hx - 1, hy - 4, w - 1, 3);
      // ragged fronds hanging off the hood
      ctx.fillStyle = look.shirt2;
      ctx.fillRect(hx - 4, hy - 1, 3, 5);
      ctx.fillRect(hx + w + 1, hy - 2, 3, 4);
      ctx.fillRect(hx - 3, hy + 4, 2, 4);
      ctx.fillRect(hx + w + 1, hy + 3, 2, 5);
      break;
    case 'straw':                                 // wide straw hat, low brim
      ctx.fillStyle = '#d9b463';
      ctx.fillRect(hx - 4, hy - 1, w + 8, 2);                       // brim
      ctx.fillStyle = '#c39c48';
      ctx.fillRect(hx - 4, hy + 1, w + 8, 1);
      ctx.fillStyle = '#e3c47a';
      ctx.fillRect(hx, hy - 4, w, 3);                               // crown
      ctx.fillStyle = '#8a6a2c';
      ctx.fillRect(hx, hy - 2, w, 1);                               // band
      break;
    case 'bun':                                   // grey bun + big sunglasses
      // Thin cap only - leave the lower half of the face bare, or she reads as
      // a featureless white block instead of a person.
      ctx.fillStyle = look.hair;
      ctx.fillRect(hx - 1, hy - 2, w + 2, 3);
      ctx.fillStyle = shade(look.hair, -22);                        // the bun
      ctx.fillRect(hx + (facing > 0 ? -4 : w), hy - 1, 4, 4);
      ctx.fillStyle = '#15171c';                                    // shades
      ctx.fillRect(hx, hy + 3, w, 2);
      ctx.fillStyle = '#4a5260';
      ctx.fillRect(hx + (facing > 0 ? w - 3 : 1), hy + 3, 2, 1);
      break;
  }
}

// --- the character --------------------------------------------------------

// cx = horizontal centre, feetY = the ground line the character stands on.
function drawChar(ctx, look, cx, feetY, o) {
  o = o || {};
  const facing = o.facing || 1;
  const anim = o.anim;
  const state = anim ? anim.state : (o.state || 'idle');
  const f = anim ? anim.frame : 0;
  const B = BUILD;

  cx = Math.round(cx);
  feetY = Math.round(feetY);

  // --- ground shadow, drawn untransformed so it stays flat ---
  if (o.shadowY !== undefined && state !== 'dead') {
    const drop = clamp((o.shadowY - feetY) / 70, 0, 1);
    const sw = Math.round((B.torsoW + 3) * (1 - drop * 0.45));
    ctx.globalAlpha = 0.34 * (1 - drop * 0.6);
    ctx.fillStyle = '#000';
    ctx.fillRect(cx - sw / 2, Math.round(o.shadowY) - 2, sw, 3);
    ctx.globalAlpha = 1;
  }

  // --- pose -------------------------------------------------------------
  let bob = 0, legF = 0, legB = 0, tuck = 0, lean = 0;
  let sqX = 1, sqY = 1, rot = 0;

  switch (state) {
    case 'run':
      legF = RUN_LEG_F[f]; legB = RUN_LEG_B[f];
      bob = RUN_BOB[f]; lean = facing * 1;
      break;
    case 'jump':
      tuck = 3; legF = 2; legB = -1; bob = -1; lean = facing * 1;
      break;
    case 'fall':
      tuck = 1; legF = -2; legB = 2; lean = -facing * 1;
      break;
    case 'climb':
      legF = CLIMB_LEG[f]; legB = -CLIMB_LEG[f]; lean = -facing * 2;
      break;
    case 'sleep':
      // slumped in a chair: sitting lower, legs out front, head lolling back
      bob = 5; lean = -facing * 2;
      legF = 5; legB = 3; tuck = -2;
      rot = facing * 0.12;
      break;
    case 'dead':
      rot = -facing * clamp(anim ? anim.dieT * 7 : 1.2, 0, 2.2);
      tuck = 2; legF = 3; legB = -3;
      break;
    default:                                    // idle - a slow breath
      bob = IDLE_BOB[f];
      break;
  }

  if (anim) {
    if (anim.squash > 0) { sqY = 1 - anim.squash * 0.28; sqX = 1 + anim.squash * 0.26; }
    if (anim.recoil > 0) { sqY = 1 - anim.recoil * 0.10; sqX = 1 + anim.recoil * 0.12; }
  }

  ctx.save();
  ctx.translate(cx, feetY);
  if (rot) ctx.rotate(rot);
  if (sqX !== 1 || sqY !== 1) ctx.scale(sqX, sqY);

  // recoil shoves the whole body back along the aim vector
  let rx = 0, ry = 0;
  if (anim && anim.recoil > 0) {
    rx = -(o.aimX || facing) * anim.recoil * 3;
    ry = -(o.aimY || 0) * anim.recoil * 2;
  }
  ctx.translate(rx, ry + bob);

  const torsoTop = -(B.legH + B.torsoH) - tuck;
  const headTop = torsoTop - B.headH;

  // --- legs -------------------------------------------------------------
  const legY = -B.legH - tuck;
  ctx.fillStyle = look.pants;
  ctx.fillRect(-B.legW - 1 + legB, legY, B.legW, B.legH + tuck);
  ctx.fillRect(1 + legF, legY, B.legW, B.legH + tuck);
  ctx.fillStyle = look.boots;
  ctx.fillRect(-B.legW - 1 + legB, -2, B.legW, 2);
  ctx.fillRect(1 + legF, -2, B.legW, 2);

  // --- torso ------------------------------------------------------------
  ctx.fillStyle = look.shirt;
  ctx.fillRect(-B.torsoW / 2 + lean, torsoTop, B.torsoW, B.torsoH);
  ctx.fillStyle = look.shirt2;
  ctx.fillRect(-B.torsoW / 2 + lean, torsoTop + B.torsoH - 3, B.torsoW, 3);
  ctx.fillStyle = 'rgba(0,0,0,0.20)';                    // form shadow
  ctx.fillRect((facing > 0 ? 2 : -B.torsoW / 2) + lean, torsoTop, B.torsoW / 2 - 1, B.torsoH);

  // optional chest detail - tie, sash, belt
  if (look.chest === 'tie') {
    ctx.fillStyle = look.accent;
    ctx.fillRect(lean + (facing > 0 ? 0 : -2), torsoTop + 1, 2, 6);
  } else if (look.chest === 'sash') {
    ctx.fillStyle = look.accent;
    ctx.fillRect(-B.torsoW / 2 + lean, torsoTop + 2, B.torsoW, 2);
  } else if (look.chest === 'ghillie') {
    // torn strips of netting and foliage, deliberately uneven
    ctx.fillStyle = look.shirt2;
    ctx.fillRect(-B.torsoW / 2 - 2 + lean, torsoTop + 1, 3, 8);
    ctx.fillRect(B.torsoW / 2 - 1 + lean, torsoTop + 2, 3, 7);
    ctx.fillStyle = look.accent;
    ctx.fillRect(-B.torsoW / 2 + 1 + lean, torsoTop + 2, 3, 6);
    ctx.fillRect(B.torsoW / 2 - 4 + lean, torsoTop + 4, 3, 5);
    ctx.fillRect(-1 + lean, torsoTop + 1, 3, 7);
    ctx.fillStyle = shade(look.shirt, -18);
    ctx.fillRect(-B.torsoW / 2 + lean, torsoTop + B.torsoH - 1, B.torsoW, 3);
  } else if (look.chest === 'overalls') {
    ctx.fillStyle = look.accent;
    ctx.fillRect(-B.torsoW / 2 + 1 + lean, torsoTop + 3, B.torsoW - 2, B.torsoH - 3);
    ctx.fillRect(-2 + lean, torsoTop, 2, 4);                  // bib straps
    ctx.fillRect(2 + lean, torsoTop, 2, 4);
    ctx.fillStyle = '#d9c27a';
    ctx.fillRect(-1 + lean, torsoTop + 4, 2, 2);              // brass button
  } else if (look.chest === 'apron') {
    ctx.fillStyle = look.accent;
    ctx.fillRect(-B.torsoW / 2 + 2 + lean, torsoTop + 2, B.torsoW - 4, B.torsoH - 1);
  }

  // --- head -------------------------------------------------------------
  drawHead(ctx, look, -B.headW / 2 + lean, headTop, B.headW, B.headH, facing);

  // --- arms + weapon ----------------------------------------------------
  const ax = o.aimX !== undefined ? o.aimX : facing;
  const ay = o.aimY || 0;
  const shX = lean + facing * 2;
  const shY = torsoTop + 2;
  const ang = Math.atan2(ay, ax);

  const armed = look.weapon && look.weapon !== 'none';
  ctx.save();
  ctx.translate(shX, shY);
  if (armed) {
    ctx.rotate(ang);
    ctx.fillStyle = look.skin;                           // arm extended to aim
    ctx.fillRect(0, -1, 8, BUILD.armW);
    ctx.fillStyle = shade(look.skin, -30);
    ctx.fillRect(0, 1, 8, 1);
    ctx.translate(8, 0);
    drawWeaponShape(ctx, look.weapon, look.accent, o.muzzle);
  } else {
    // Unarmed: a short arm swinging at the side. A full-length aimed arm on
    // someone holding nothing just reads as a stick poking out of the torso.
    const swing = state === 'run' ? RUN_LEG_F[f] * 0.4 : 0;
    ctx.fillStyle = look.skin;
    ctx.fillRect(facing > 0 ? -1 : -3, 0, 4, 5);
    ctx.fillRect(facing > 0 ? swing : -2 - swing, 3, 3, 3);
  }
  ctx.restore();

  // --- white hit flash --------------------------------------------------
  if (anim && anim.hurt > 0.02) {
    ctx.globalAlpha = Math.min(0.85, anim.hurt);
    ctx.fillStyle = '#fff';
    ctx.fillRect(-B.torsoW / 2 - 1, headTop - 3, B.torsoW + 2, B.headH + B.torsoH + B.legH + 4);
    ctx.globalAlpha = 1;
  }

  ctx.restore();

  // --- player tag, kept outside the transform so it never wobbles -------
  if (o.tag) {
    ctx.fillStyle = o.tag;
    ctx.fillRect(cx - 1, feetY - (B.legH + B.torsoH + B.headH) - 7, 3, 3);
  }
}

// --- 3x5 bitmap font ------------------------------------------------------
// Canvas fillText at 5px turns to mush once the frame is upscaled, so barks
// use a hand-built pixel font instead. Each glyph is 5 rows of 3 bits.

const FONT3 = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011',
  D: '110101101101110', E: '111100110100111', F: '111100110100100',
  G: '011100101101011', H: '101101111101101', I: '111010010010111',
  J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '101110111011101', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110101101',
  S: '011100010001110', T: '111010010010010', U: '101101101101011',
  V: '101101101010010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111',
  0: '111101101101111', 1: '010110010010111', 2: '110001010100111',
  3: '111001011001111', 4: '101101111001001', 5: '111100111001111',
  6: '111100111101111', 7: '111001001001001', 8: '111101111101111',
  9: '111101111001111',
  '!': '010010010000010', '?': '110001010000010', '.': '000000000000010',
  ',': '000000000010010', "'": '010010000000000', '-': '000000111000000',
  ':': '000010000010000', ' ': '000000000000000'
};

const FONT3_W = 4;   // 3px glyph + 1px tracking

function textWidth3(s) { return s.length * FONT3_W - 1; }

function drawText3(ctx, text, x, y, color) {
  ctx.fillStyle = color;
  for (let i = 0; i < text.length; i++) {
    const g = FONT3[text[i]] || FONT3[' '];
    const gx = x + i * FONT3_W;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 3; c++) {
        if (g[r * 3 + c] === '1') ctx.fillRect(gx + c, y + r, 1, 1);
      }
    }
  }
}

// Speech bubble above a character.
function drawBark(ctx, text, cx, topY, color) {
  const w = textWidth3(text);
  const x = Math.round(cx - w / 2), y = Math.round(topY) - 11;
  ctx.fillStyle = 'rgba(8,10,16,0.86)';
  ctx.fillRect(x - 3, y - 3, w + 6, 11);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(x - 3, y - 3, w + 6, 1);
  ctx.fillStyle = 'rgba(8,10,16,0.86)';
  ctx.fillRect(Math.round(cx) - 2, y + 8, 4, 2);
  ctx.fillRect(Math.round(cx) - 1, y + 10, 2, 1);
  drawText3(ctx, text, x, y, color || '#e8ecf4');
}

// --- scenery props --------------------------------------------------------
// Purely decorative structures drawn between the terrain and the entities.

function drawProp(ctx, p, camX, camY, time) {
  const x = Math.round(p.x - camX), y = Math.round(p.y - camY);

  if (p.type === 'pump') {
    // nodding-donkey pump jack
    const nod = Math.sin(time * 1.4 + p.phase);
    ctx.fillStyle = '#463f36';
    ctx.fillRect(x - 20, y - 4, 44, 5);                 // skid
    ctx.fillStyle = '#5b5347';
    ctx.fillRect(x - 2, y - 26, 5, 23);                 // A-frame post
    ctx.fillRect(x - 8, y - 6, 3, 4);
    ctx.fillRect(x + 6, y - 6, 3, 4);
    ctx.save();
    ctx.translate(x, y - 27);
    ctx.rotate(nod * 0.22);
    ctx.fillStyle = '#6d6355';                          // walking beam
    ctx.fillRect(-19, -2, 38, 4);
    ctx.fillStyle = '#3f3931';                          // horse head
    ctx.fillRect(15, -2, 7, 9);
    ctx.fillStyle = '#5b5347';                          // counterweight
    ctx.fillRect(-22, -4, 7, 9);
    ctx.restore();
    ctx.fillStyle = '#3a342c';
    ctx.fillRect(x + 16 + Math.round(nod * 3), y - 24 + Math.round(nod * 4), 2, 20);
    return;
  }

  if (p.type === 'tank') {
    // banding and a highlight over a metal tank shell, to read as a cylinder
    const w = p.w, h = p.h;
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(x + 3, y + 2, 5, h - 4);
    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    ctx.fillRect(x + w - 9, y + 2, 6, h - 4);
    ctx.fillStyle = '#565e69';
    for (let i = 1; i < 3; i++) ctx.fillRect(x, y + (h * i / 3) | 0, w, 2);
    ctx.fillStyle = '#b8452c';                          // hazard stripe
    ctx.fillRect(x + 4, y + 5, w - 8, 3);
    ctx.fillStyle = '#3f4650';                          // ladder
    for (let ly = y + 4; ly < y + h - 3; ly += 5) ctx.fillRect(x + w - 6, ly, 5, 2);
    return;
  }

  if (p.type === 'tower') {
    // lattice mast with a blinking hazard light
    ctx.strokeStyle = '#4e5560';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 7, y); ctx.lineTo(x - 2, y - p.h);
    ctx.moveTo(x + 7, y); ctx.lineTo(x + 2, y - p.h);
    ctx.stroke();
    ctx.lineWidth = 1;
    for (let i = 1; i * 9 < p.h; i++) {
      const yy = y - i * 9, k = 6 - (i * 5) / (p.h / 9);
      ctx.beginPath();
      ctx.moveTo(x - k, yy); ctx.lineTo(x + k, yy);
      ctx.stroke();
    }
    ctx.fillStyle = Math.floor(time * 2) % 2 ? '#ff4a3a' : '#5a1a14';
    ctx.fillRect(x - 1, y - p.h - 3, 3, 3);
    return;
  }

  if (p.type === 'chair') {
    // a folding chair, occupied or otherwise
    ctx.fillStyle = '#6b4a2a';
    ctx.fillRect(x - 6, y - 8, 12, 3);              // seat
    ctx.fillRect(x + (p.facing > 0 ? 4 : -6), y - 17, 2, 10);   // backrest
    ctx.fillStyle = '#4d351d';
    ctx.fillRect(x - 5, y - 5, 2, 5);               // legs
    ctx.fillRect(x + 3, y - 5, 2, 5);
    return;
  }

  if (p.type === 'flame') {
    // little fire on top of something that really should not be on fire
    const f = 4 + Math.sin(time * 11 + p.phase) * 2;
    ctx.fillStyle = 'rgba(255,140,50,0.85)';
    ctx.fillRect(x - 3, y - f, 6, f);
    ctx.fillStyle = 'rgba(255,214,120,0.9)';
    ctx.fillRect(x - 1, y - f * 0.7, 2, f * 0.7);
    ctx.fillStyle = 'rgba(255,90,40,0.5)';
    ctx.fillRect(x - 4, y - 2, 8, 2);
    return;
  }

  if (p.type === 'flare') {
    // flare stack burning off gas
    ctx.fillStyle = '#5b5347';
    ctx.fillRect(x - 3, y - p.h, 7, p.h);
    ctx.fillStyle = '#3f3931';
    ctx.fillRect(x - 5, y - p.h - 2, 11, 3);
    const f = 6 + Math.sin(time * 9 + p.phase) * 3;
    ctx.fillStyle = 'rgba(255,150,50,0.85)';
    ctx.fillRect(x - 3, y - p.h - 3 - f, 7, f);
    ctx.fillStyle = 'rgba(255,226,140,0.9)';
    ctx.fillRect(x - 1, y - p.h - 2 - f * 0.7, 3, f * 0.7);
  }
}

// Back-compat shim: older call sites (and the character-select cards) still
// use the positional drawBro signature.
function drawBro(ctx, look, x, y, facing, pose, t, aimX, aimY, flash, playerIndex) {
  drawChar(ctx, look, x, y, {
    facing: facing,
    state: pose === 'air' ? 'fall' : pose,
    aimX: aimX, aimY: aimY, muzzle: flash,
    tag: playerIndex === 0 ? '#5ec8ff' : playerIndex === 1 ? '#ff9a5e' : null
  });
}
