// Sons sintetitzats amb Web Audio: vent, ocells, obturador i xipolleig.
export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  start() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(this.ctx.destination);
    this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.startWind();
    this.scheduleBird();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.1);
  }

  noiseSource(loop = false) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = loop;
    return s;
  }

  startWind() {
    const src = this.noiseSource(true);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const g = this.ctx.createGain();
    g.gain.value = 0.05;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.03;
    lfo.connect(lfoGain).connect(g.gain);
    const lfo2 = this.ctx.createOscillator();
    lfo2.frequency.value = 0.13;
    const lfo2Gain = this.ctx.createGain();
    lfo2Gain.gain.value = 180;
    lfo2.connect(lfo2Gain).connect(lp.frequency);
    src.connect(lp).connect(g).connect(this.master);
    src.start(); lfo.start(); lfo2.start();
  }

  scheduleBird() {
    const wait = 2500 + Math.random() * 6000;
    setTimeout(() => { this.chirp(); this.scheduleBird(); }, wait);
  }

  chirp() {
    if (!this.ctx || document.hidden) return;
    const t0 = this.ctx.currentTime;
    const notes = 2 + Math.floor(Math.random() * 4);
    const base = 2600 + Math.random() * 1600;
    const pan = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    if (pan) { pan.pan.value = Math.random() * 1.6 - 0.8; pan.connect(this.master); }
    for (let i = 0; i < notes; i++) {
      const t = t0 + i * (0.09 + Math.random() * 0.06);
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(base * (0.9 + Math.random() * 0.3), t);
      o.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * 0.4), t + 0.06);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.025, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      o.connect(g).connect(pan || this.master);
      o.start(t); o.stop(t + 0.1);
    }
  }

  click(t, freq, dur, vol) {
    const s = this.noiseSource();
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = 1.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(bp).connect(g).connect(this.master);
    s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }

  shutter() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.click(t, 3200, 0.035, 0.9);
    this.click(t + 0.075, 1800, 0.06, 0.7);
    // motor de rebobinat
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(90, t + 0.14);
    o.frequency.linearRampToValueAtTime(140, t + 0.4);
    g.gain.setValueAtTime(0, t + 0.14);
    g.gain.linearRampToValueAtTime(0.025, t + 0.18);
    g.gain.linearRampToValueAtTime(0, t + 0.42);
    const lp = this.ctx.createBiquadFilter();
    lp.frequency.value = 900;
    o.connect(lp).connect(g).connect(this.master);
    o.start(t + 0.14); o.stop(t + 0.45);
  }

  focusBeep() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const dt of [0, 0.09]) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.frequency.value = 2900;
      g.gain.setValueAtTime(0.04, t + dt);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.05);
      o.connect(g).connect(this.master);
      o.start(t + dt); o.stop(t + dt + 0.06);
    }
  }

  whoosh(vol = 0.25) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const s = this.noiseSource();
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(400, t);
    bp.frequency.exponentialRampToValueAtTime(2000, t + 0.5);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    s.connect(bp).connect(g).connect(this.master);
    s.start(t); s.stop(t + 0.8);
  }

  // Retruny de roca llunyà (quan s'esculpeix la muntanya)
  rumble() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const s = this.noiseSource(true);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 160;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.7, t + 0.6);
    g.gain.linearRampToValueAtTime(0.45, t + 2.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.8);
    s.connect(lp).connect(g).connect(this.master);
    s.start(t); s.stop(t + 4);
    for (let i = 0; i < 9; i++) this.click(t + 0.3 + Math.random() * 2.8, 900 + Math.random() * 1500, 0.05, 0.25);
  }

  splash() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const s = this.noiseSource();
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(3000, t);
    lp.frequency.exponentialRampToValueAtTime(300, t + 0.4);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    s.connect(lp).connect(g).connect(this.master);
    s.start(t); s.stop(t + 0.55);
  }
}
