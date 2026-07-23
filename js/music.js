// ---------------------------------------------------------------------------
// BROSTORM - chiptune engine
//
// A tiny tracker in the NES tradition: two pulse voices, a triangle bass and a
// noise channel for percussion. Nothing is sampled and no files are loaded -
// every note is an oscillator built on the fly, same as the sound effects.
//
// Scheduling uses the standard Web Audio lookahead: a coarse timer wakes up
// often enough to queue the next fraction of a second of notes against the
// audio clock, so timing never depends on requestAnimationFrame.
// ---------------------------------------------------------------------------

const LOOKAHEAD = 0.22;      // seconds of music queued in advance
const TICK_MS = 25;          // how often the scheduler wakes

let musicGain = null;
let musicTimer = null;
let musicTrack = null;
let musicStep = 0;
let musicNextTime = 0;
let musicId = null;
let musicOn = true;
let musicVolume = 0.7;

// MIDI note -> Hz. 69 is A4.
function noteHz(n) { return 440 * Math.pow(2, (n - 69) / 12); }

// Note names so the patterns below stay readable.
const NOTE_BASE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function noteNum(name) {
  if (name === null || name === '-') return -1;
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) return -1;
  return NOTE_BASE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (+m[3] + 1) * 12;
}
function seq(s) { return s.trim().split(/\s+/).map(noteNum); }

// --- voices ---------------------------------------------------------------

function pulse(freq, t, dur, gain, duty) {
  if (!actx || !musicGain) return;
  const osc = actx.createOscillator();
  // A square is a 50% pulse; 'sawtooth' stands in for a thinner duty cycle so
  // the two lead voices do not sound identical.
  osc.type = duty === 'thin' ? 'sawtooth' : 'square';
  osc.frequency.setValueAtTime(freq, t);

  const g = actx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.setValueAtTime(gain, t + dur * 0.55);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  osc.connect(g); g.connect(musicGain);
  osc.start(t); osc.stop(t + dur + 0.02);
}

function bassNote(freq, t, dur, gain) {
  if (!actx || !musicGain) return;
  const osc = actx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, t);
  const g = actx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g); g.connect(musicGain);
  osc.start(t); osc.stop(t + dur + 0.02);
}

function drumHit(kind, t, gain) {
  if (!actx || !musicGain || !noiseBuf) return;
  if (kind === 'k') {
    const osc = actx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.11);
    const g = actx.createGain();
    g.gain.setValueAtTime(gain * 1.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    osc.connect(g); g.connect(musicGain);
    osc.start(t); osc.stop(t + 0.15);
    return;
  }
  const src = actx.createBufferSource();
  src.buffer = noiseBuf;
  src.playbackRate.value = kind === 's' ? 1.0 : 1.9;
  const f = actx.createBiquadFilter();
  f.type = kind === 's' ? 'bandpass' : 'highpass';
  f.frequency.value = kind === 's' ? 1500 : 7000;
  const dur = kind === 's' ? 0.13 : 0.045;
  const g = actx.createGain();
  g.gain.setValueAtTime(gain * (kind === 's' ? 1.1 : 0.5), t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(musicGain);
  src.start(t); src.stop(t + dur + 0.02);
}

// --- the music ------------------------------------------------------------
// Each track is 32 eighth-notes of lead and harmony, 16 of bass, 32 of drums.
// All original, all deliberately simple.

const TRACKS = {

  // Title: bold, slow, a bit pleased with itself.
  menu: {
    bpm: 104, lead: 0.075, harm: 0.042, bass: 0.10, drum: 0.055,
    lead1: seq(`A4 - E4 - A4 - C5 - B4 - G4 - E4 - - -
                F4 - C5 - F4 - A4 - G4 - E4 - C4 - - -`),
    lead2: seq(`E4 - C4 - E4 - A4 - G4 - E4 - C4 - - -
                C4 - A4 - C4 - F4 - E4 - C4 - A3 - - -`),
    bass: seq(`A2 - A2 - E2 - E2 - F2 - F2 - C2 - C2 -`),
    drum: 'k-h-s-h-k-h-s-h-k-h-s-h-k-hks-h-'
  },

  // Iron Gulch: a march. Steady, minor, keeps you walking east.
  gulch: {
    bpm: 138, lead: 0.070, harm: 0.038, bass: 0.095, drum: 0.055,
    lead1: seq(`A4 A4 - E4 - A4 C5 - B4 - A4 - E4 - - -
                G4 G4 - D4 - G4 B4 - A4 - G4 - D4 - - -`),
    lead2: seq(`E4 E4 - C4 - E4 A4 - G4 - E4 - C4 - - -
                D4 D4 - B3 - D4 G4 - E4 - D4 - B3 - - -`),
    bass: seq(`A2 - A2 A2 E2 - E2 - G2 - G2 G2 D2 - D2 -`),
    drum: 'k-h-s-h-k-h-s-hk-h-s-h-k-h-s-hkh'
  },

  // Blacktap: faster, hotter, more insistent.
  refinery: {
    bpm: 152, lead: 0.066, harm: 0.036, bass: 0.095, drum: 0.058,
    lead1: seq(`D4 - D4 F4 - D4 A4 - G4 - F4 D4 - C4 - -
                D4 - D4 F4 - A4 C5 - A4 - G4 F4 - D4 - -`),
    lead2: seq(`A3 - A3 D4 - A3 F4 - D4 - C4 A3 - G3 - -
                A3 - A3 D4 - F4 A4 - F4 - D4 C4 - A3 - -`),
    bass: seq(`D2 D2 - D2 A2 - A2 - C2 C2 - C2 G2 - G2 -`),
    drum: 'k-hks-h-k-hks-h-k-hks-h-kh-ks-hk'
  },

  // Greenlight: humid and percussive, syncopated, lots of space.
  jungle: {
    bpm: 118, lead: 0.062, harm: 0.036, bass: 0.09, drum: 0.062,
    lead1: seq(`E4 - - G4 - A4 - - B4 - A4 - G4 - - -
                D4 - - F4 - G4 - - A4 - G4 - E4 - - -`),
    lead2: seq(`B3 - - E4 - E4 - - G4 - E4 - B3 - - -
                A3 - - D4 - D4 - - F4 - D4 - A3 - - -`),
    bass: seq(`E2 - E2 - B2 - E2 - D2 - D2 - A2 - D2 -`),
    drum: 'k-hhs-hkk-hhs-h-k-hhs-hkkh-s-hh-'
  },

  // Whiteout: slow, cold, wide and sparse.
  snow: {
    bpm: 96, lead: 0.068, harm: 0.040, bass: 0.085, drum: 0.045,
    lead1: seq(`C5 - - - G4 - - - A4 - - - E4 - - -
                F4 - - - C5 - - - B4 - - - G4 - - -`),
    lead2: seq(`E4 - - - C4 - - - F4 - - - C4 - - -
                A3 - - - F4 - - - G4 - - - E4 - - -`),
    bass: seq(`C2 - - - G2 - - - F2 - - - G2 - - -`),
    drum: 'k---s---k---s---k---s---k--hs--h'
  },

  // Long Night: airless. Wide intervals, almost no percussion.
  moon: {
    bpm: 88, lead: 0.062, harm: 0.038, bass: 0.085, drum: 0.030,
    lead1: seq(`A4 - - - - E4 - - C5 - - - - B4 - -
                G4 - - - - D4 - - B4 - - - - A4 - -`),
    lead2: seq(`A3 - - - - A3 - - E4 - - - - E4 - -
                D4 - - - - D4 - - G3 - - - - G3 - -`),
    bass: seq(`A1 - - - E2 - - - F2 - - - E2 - - -`),
    drum: 'k-------s-------k-------s----h--'
  }
};

// --- transport ------------------------------------------------------------

function musicInit() {
  if (!actx || musicGain) return;
  musicGain = actx.createGain();
  musicGain.gain.value = musicOn ? musicVolume : 0;
  musicGain.connect(masterGain);
}

function musicPlay(id) {
  if (!TRACKS[id]) id = 'menu';
  if (musicId === id && musicTimer) return;      // already playing this one
  audioInit();
  musicInit();
  if (!actx) return;
  musicStop();
  musicId = id;
  musicTrack = TRACKS[id];
  musicStep = 0;
  musicNextTime = actx.currentTime + 0.08;
  musicTimer = setInterval(musicSchedule, TICK_MS);
}

function musicStop() {
  if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  musicId = null;
}

function musicSetEnabled(on) {
  musicOn = on;
  if (musicGain) musicGain.gain.value = on ? musicVolume : 0;
  return musicOn;
}

function setMusicVolume(v) {
  musicVolume = clamp(v, 0, 1);
  if (musicGain) musicGain.gain.value = musicOn ? musicVolume : 0;
  return musicVolume;
}
function getMusicVolume() { return musicVolume; }

function musicSchedule() {
  if (!actx || !musicTrack) return;

  // A context that has not been resumed yet has a frozen clock, so nothing
  // past the first step would ever come due: exactly one note, then silence.
  if (actx.state !== 'running') {
    if (actx.resume) actx.resume();
    return;
  }
  // If we fell behind - suspended context, backgrounded tab - do not try to
  // catch up by dumping a hundred past-dated notes into the graph at once.
  if (musicNextTime < actx.currentTime - 0.25) {
    musicNextTime = actx.currentTime + 0.05;
  }

  const t = musicTrack;
  const stepDur = 60 / t.bpm / 2;              // eighth notes
  let guard = 0;
  while (musicNextTime < actx.currentTime + LOOKAHEAD && guard++ < 64) {
    const s = musicStep;
    const when = musicNextTime;

    const l1 = t.lead1[s % t.lead1.length];
    if (l1 > 0) pulse(noteHz(l1), when, stepDur * 1.7, t.lead);

    const l2 = t.lead2[s % t.lead2.length];
    if (l2 > 0) pulse(noteHz(l2), when, stepDur * 1.5, t.harm, 'thin');

    const b = t.bass[Math.floor(s / 2) % t.bass.length];
    if (b > 0 && s % 2 === 0) bassNote(noteHz(b), when, stepDur * 1.8, t.bass);

    const d = t.drum[s % t.drum.length];
    if (d && d !== '-') drumHit(d, when, t.drum);

    musicNextTime += stepDur;
    musicStep++;
  }
}
