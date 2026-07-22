// ---------------------------------------------------------------------------
// BROSTORM - procedural sound effects (no audio files, everything is synth)
// ---------------------------------------------------------------------------

let actx = null;
let masterGain = null;
let noiseBuf = null;
let audioMuted = false;

function audioInit() {
  if (actx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  actx = new AC();
  masterGain = actx.createGain();
  masterGain.gain.value = 0.5;
  masterGain.connect(actx.destination);

  const len = Math.floor(actx.sampleRate * 1.0);
  noiseBuf = actx.createBuffer(1, len, actx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
}

function audioResume() {
  if (actx && actx.state === 'suspended') actx.resume();
}

function audioToggleMute() {
  audioMuted = !audioMuted;
  if (masterGain) masterGain.gain.value = audioMuted ? 0 : 0.5;
  return audioMuted;
}

function noiseHit(o) {
  if (!actx || audioMuted) return;
  const t = actx.currentTime;
  const src = actx.createBufferSource();
  src.buffer = noiseBuf;
  src.playbackRate.value = o.rate || 1;

  const filt = actx.createBiquadFilter();
  filt.type = o.filter || 'bandpass';
  filt.frequency.setValueAtTime(o.freq, t);
  if (o.freqTo) filt.frequency.exponentialRampToValueAtTime(Math.max(40, o.freqTo), t + o.dur);
  filt.Q.value = o.q || 1;

  const g = actx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.gain, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);

  src.connect(filt); filt.connect(g); g.connect(masterGain);
  src.start(t); src.stop(t + o.dur + 0.02);
}

function tone(o) {
  if (!actx || audioMuted) return;
  const t = actx.currentTime + (o.delay || 0);
  const osc = actx.createOscillator();
  osc.type = o.type || 'square';
  osc.frequency.setValueAtTime(o.freq, t);
  if (o.freqTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.freqTo), t + o.dur);

  const g = actx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.gain, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);

  osc.connect(g); g.connect(masterGain);
  osc.start(t); osc.stop(t + o.dur + 0.02);
}

const SFX = {
  rifle() {
    noiseHit({ freq: 1800, freqTo: 700, dur: 0.07, gain: 0.16, q: 1.2 });
    tone({ freq: 260, freqTo: 90, dur: 0.05, gain: 0.08, type: 'square' });
  },
  shotgun() {
    noiseHit({ freq: 900, freqTo: 200, dur: 0.22, gain: 0.3, q: 0.7, filter: 'lowpass' });
    tone({ freq: 150, freqTo: 45, dur: 0.18, gain: 0.16, type: 'triangle' });
  },
  enemyShot() {
    noiseHit({ freq: 1100, freqTo: 500, dur: 0.06, gain: 0.07, q: 1.5 });
  },
  explode() {
    noiseHit({ freq: 700, freqTo: 60, dur: 0.55, gain: 0.42, q: 0.5, filter: 'lowpass', rate: 0.7 });
    tone({ freq: 90, freqTo: 28, dur: 0.5, gain: 0.28, type: 'triangle' });
  },
  jump() {
    tone({ freq: 300, freqTo: 560, dur: 0.09, gain: 0.07, type: 'square' });
  },
  land() {
    noiseHit({ freq: 300, freqTo: 120, dur: 0.06, gain: 0.08, filter: 'lowpass' });
  },
  dig() {
    noiseHit({ freq: 500, freqTo: 220, dur: 0.05, gain: 0.06, filter: 'lowpass' });
  },
  hurt() {
    noiseHit({ freq: 500, freqTo: 120, dur: 0.25, gain: 0.3, filter: 'lowpass' });
    tone({ freq: 400, freqTo: 70, dur: 0.28, gain: 0.16, type: 'sawtooth' });
  },
  enemyDie() {
    noiseHit({ freq: 800, freqTo: 180, dur: 0.16, gain: 0.16, filter: 'lowpass' });
  },
  throwArc() {
    tone({ freq: 480, freqTo: 220, dur: 0.1, gain: 0.07, type: 'sine' });
  },
  plant() {
    tone({ freq: 900, dur: 0.05, gain: 0.09, type: 'square' });
    tone({ freq: 1300, dur: 0.05, gain: 0.07, type: 'square', delay: 0.07 });
  },
  beep() {
    tone({ freq: 1500, dur: 0.04, gain: 0.06, type: 'square' });
  },
  rescue() {
    [523, 659, 784, 1046].forEach((f, i) =>
      tone({ freq: f, dur: 0.12, gain: 0.11, type: 'square', delay: i * 0.06 }));
  },
  spawn() {
    tone({ freq: 200, freqTo: 700, dur: 0.2, gain: 0.1, type: 'sawtooth' });
  },
  select() {
    tone({ freq: 700, dur: 0.05, gain: 0.09, type: 'square' });
  },
  confirm() {
    tone({ freq: 600, dur: 0.07, gain: 0.1, type: 'square' });
    tone({ freq: 950, dur: 0.1, gain: 0.1, type: 'square', delay: 0.08 });
  },
  win() {
    [523, 659, 784, 1046, 1318].forEach((f, i) =>
      tone({ freq: f, dur: 0.22, gain: 0.13, type: 'square', delay: i * 0.13 }));
  },
  gameOver() {
    [440, 370, 294, 220].forEach((f, i) =>
      tone({ freq: f, dur: 0.35, gain: 0.13, type: 'sawtooth', delay: i * 0.18 }));
  },
  chopper() {
    noiseHit({ freq: 220, freqTo: 220, dur: 0.5, gain: 0.12, q: 3, rate: 0.4 });
  }
};

function sfx(name) {
  const f = SFX[name];
  if (f) f();
}
