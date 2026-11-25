// Ember & Thyme: WebAudio synth sounds — no audio files, everything synthesized.
export class KitchenAudio {
  constructor() {
    this.context = null;
    this.muted = false;
    this.musicTimer = null;
    this.musicStep = 0;
  }

  ensure() {
    if (!this.context) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.context = new AC();
      } catch (e) { this.context = null; }
    }
    if (this.context && this.context.state === 'suspended') this.context.resume();
    return this.context;
  }

  setMuted(muted) {
    this.muted = muted;
    if (muted) this.stopMusic();
    else this.startMusic();
  }

  tone(freq, duration, type, volume, when = 0, slideTo = null) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(volume || 0.12, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  noise(duration, volume, filterFreq, when = 0) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const len = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const gain = ctx.createGain();
    gain.gain.value = volume || 0.1;
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(t0);
  }

  pickup() { this.tone(520, 0.08, 'triangle', 0.10); }
  chop() { this.noise(0.07, 0.22, 900); this.tone(180, 0.06, 'square', 0.08); }
  choppedDone() { this.tone(660, 0.1, 'triangle', 0.12); this.tone(880, 0.14, 'triangle', 0.12, 0.09); }
  sizzle() { this.noise(0.25, 0.06, 4000); }
  grillDone() { this.tone(740, 0.12, 'sine', 0.12); this.tone(988, 0.16, 'sine', 0.12, 0.1); }
  burn() { this.tone(160, 0.35, 'sawtooth', 0.14, 0, 90); }
  place() { this.tone(300, 0.07, 'triangle', 0.10, 0, 240); }
  serve() {
    this.tone(523, 0.12, 'triangle', 0.14);
    this.tone(659, 0.12, 'triangle', 0.14, 0.1);
    this.tone(784, 0.2, 'triangle', 0.16, 0.2);
  }
  coin() { this.tone(1319, 0.09, 'sine', 0.1); this.tone(1760, 0.16, 'sine', 0.1, 0.07); }
  error() { this.tone(220, 0.18, 'square', 0.1, 0, 140); }
  orderIn() { this.tone(440, 0.1, 'sine', 0.1); this.tone(587, 0.14, 'sine', 0.1, 0.09); }
  walkout() { this.tone(330, 0.25, 'sawtooth', 0.09, 0, 180); }
  win() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.14, i * 0.12));
  }
  lose() {
    [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.12, i * 0.14));
  }

  // Gentle kitchen waltz: a looping bass + pluck pattern, very quiet.
  startMusic() {
    if (this.muted || this.musicTimer || !this.ensure()) return;
    const bass = [131, 98, 110, 131, 98, 110, 123, 98];
    const pluck = [523, 659, 784, 659, 587, 784, 880, 784];
    this.musicTimer = setInterval(() => {
      if (this.muted) return;
      const i = this.musicStep % 8;
      this.tone(bass[i], 0.5, 'sine', 0.045);
      this.tone(pluck[i], 0.28, 'triangle', 0.035);
      this.musicStep++;
    }, 420);
  }

  stopMusic() {
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
  }
}
