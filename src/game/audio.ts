// ---------------------------------------------------------------------------
// Procedural audio: every sound is synthesised with the WebAudio API.
// ---------------------------------------------------------------------------

type SfxName =
  | 'shoot' | 'shootBig' | 'enemyShoot' | 'hit' | 'kill' | 'explode'
  | 'bigExplode' | 'ui' | 'buy' | 'deny' | 'sector' | 'alarm' | 'boost'
  | 'spawn' | 'hurt' | 'gameover';

class AudioEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  sfxBus: GainNode | null = null;
  musicBus: GainNode | null = null;
  noise: AudioBuffer | null = null;
  sfxOn = true;
  musicOn = true;
  private musicTimer: number | null = null;
  private nextNote = 0;
  private step = 0;
  private intensity = 0;

  ensure() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    const ctx: AudioContext = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(ctx.destination);

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 22;
    comp.ratio.value = 8;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    comp.connect(this.master);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.sfxOn ? 0.9 : 0;
    this.sfxBus.connect(comp);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.musicOn ? 0.3 : 0;
    this.musicBus.connect(comp);

    // pre-render noise buffer
    const len = ctx.sampleRate * 1.2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    return ctx;
  }

  resume() {
    const ctx = this.ensure();
    if (ctx && ctx.state === 'suspended') void ctx.resume();
  }

  setSfx(on: boolean) {
    this.sfxOn = on;
    if (this.sfxBus && this.ctx) {
      this.sfxBus.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.05);
    }
  }

  setMusic(on: boolean) {
    this.musicOn = on;
    if (this.musicBus && this.ctx) {
      this.musicBus.gain.setTargetAtTime(on ? 0.3 : 0, this.ctx.currentTime, 0.1);
    }
    if (on) this.startMusic();
  }

  private env(dur: number, peak = 1, attack = 0.004) {
    const ctx = this.ensure()!;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    return g;
  }

  private noiseSrc(dur: number, filter: BiquadFilterType, freq: number, q = 1) {
    const ctx = this.ensure()!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise!;
    src.playbackRate.value = 1;
    const bq = ctx.createBiquadFilter();
    bq.type = filter;
    bq.frequency.value = freq;
    bq.Q.value = q;
    src.connect(bq);
    src.start(ctx.currentTime, Math.random() * 0.2, dur);
    return { src, bq };
  }

  private tone(
    type: OscillatorType, f0: number, f1: number, dur: number, peak: number,
    dest: AudioNode, detune = 0,
  ) {
    const ctx = this.ensure()!;
    const o = ctx.createOscillator();
    o.type = type;
    o.detune.value = detune;
    const t = ctx.currentTime;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = this.env(dur, peak);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private lastPlay: Partial<Record<SfxName, number>> = {};
  private static THROTTLE: Partial<Record<SfxName, number>> = {
    hit: 0.04, shoot: 0.03, enemyShoot: 0.05, explode: 0.04, hurt: 0.06,
  };

  play(name: SfxName, vol = 1) {
    if (!this.sfxOn) return;
    const ctx = this.ensure();
    if (!ctx || !this.sfxBus) return;
    const th = AudioEngine.THROTTLE[name] ?? 0;
    if (th > 0) {
      const last = this.lastPlay[name] ?? -1;
      if (last >= 0 && last + th > ctx.currentTime) return;
      this.lastPlay[name] = ctx.currentTime;
    }
    const bus = this.sfxBus;
    switch (name) {
      case 'shoot': {
        const { bq } = this.noiseSrc(0.12, 'bandpass', 1400, 0.8);
        const g = this.env(0.13, 0.5 * vol);
        bq.connect(g); g.connect(bus);
        this.tone('square', 320, 90, 0.1, 0.22 * vol, bus);
        break;
      }
      case 'shootBig': {
        const { bq } = this.noiseSrc(0.22, 'lowpass', 900, 1);
        const g = this.env(0.22, 0.6 * vol);
        bq.connect(g); g.connect(bus);
        this.tone('sawtooth', 220, 60, 0.18, 0.3 * vol, bus);
        break;
      }
      case 'enemyShoot': {
        const { bq } = this.noiseSrc(0.1, 'bandpass', 800, 1.2);
        const g = this.env(0.1, 0.28 * vol);
        bq.connect(g); g.connect(bus);
        this.tone('triangle', 240, 110, 0.09, 0.14 * vol, bus);
        break;
      }
      case 'hit': {
        const { bq } = this.noiseSrc(0.06, 'highpass', 2600, 0.7);
        const g = this.env(0.07, 0.32 * vol);
        bq.connect(g); g.connect(bus);
        break;
      }
      case 'hurt': {
        const { bq } = this.noiseSrc(0.18, 'lowpass', 500, 1);
        const g = this.env(0.2, 0.5 * vol);
        bq.connect(g); g.connect(bus);
        this.tone('sawtooth', 160, 50, 0.2, 0.2 * vol, bus);
        break;
      }
      case 'kill':
      case 'explode': {
        const { bq } = this.noiseSrc(0.5, 'lowpass', 700, 0.6);
        const g = this.env(0.5, 0.7 * vol, 0.006);
        bq.frequency.setValueAtTime(1400, ctx.currentTime);
        bq.frequency.exponentialRampToValueAtTime(160, ctx.currentTime + 0.4);
        bq.connect(g); g.connect(bus);
        this.tone('triangle', 130, 34, 0.35, 0.35 * vol, bus);
        break;
      }
      case 'bigExplode': {
        const { bq } = this.noiseSrc(1.1, 'lowpass', 400, 0.5);
        const g = this.env(1.1, 0.95 * vol, 0.01);
        bq.frequency.setValueAtTime(1800, ctx.currentTime);
        bq.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.9);
        bq.connect(g); g.connect(bus);
        this.tone('sine', 110, 26, 0.9, 0.5 * vol, bus);
        this.tone('sawtooth', 70, 20, 1.0, 0.25 * vol, bus);
        break;
      }
      case 'ui':
        this.tone('square', 660, 880, 0.06, 0.1 * vol, bus);
        break;
      case 'buy': {
        this.tone('square', 520, 780, 0.09, 0.13 * vol, bus);
        this.tone('square', 780, 1180, 0.12, 0.1 * vol, bus);
        break;
      }
      case 'deny':
        this.tone('square', 200, 130, 0.12, 0.14 * vol, bus);
        break;
      case 'sector': {
        const notes = [523, 659, 784, 1047];
        notes.forEach((f, i) => {
          setTimeout(() => this.tone('triangle', f, f, 0.28, 0.16 * vol, bus), i * 90);
        });
        break;
      }
      case 'alarm': {
        this.tone('sawtooth', 440, 300, 0.35, 0.12 * vol, bus);
        break;
      }
      case 'boost': {
        const { bq } = this.noiseSrc(0.3, 'bandpass', 900, 0.9);
        bq.frequency.setValueAtTime(400, ctx.currentTime);
        bq.frequency.exponentialRampToValueAtTime(2400, ctx.currentTime + 0.25);
        const g = this.env(0.3, 0.32 * vol);
        bq.connect(g); g.connect(bus);
        break;
      }
      case 'spawn':
        this.tone('sine', 180, 420, 0.18, 0.1 * vol, bus);
        break;
      case 'gameover': {
        const notes = [440, 349, 262, 196];
        notes.forEach((f, i) => {
          setTimeout(() => this.tone('sawtooth', f, f * 0.98, 0.5, 0.15 * vol, bus), i * 200);
        });
        break;
      }
    }
  }

  setIntensity(v: number) {
    this.intensity = Math.max(0, Math.min(1, v));
  }

  // ---- simple looping combat groove -------------------------------------
  startMusic() {
    if (!this.musicOn) return;
    const ctx = this.ensure();
    if (!ctx || this.musicTimer !== null) return;
    this.nextNote = ctx.currentTime + 0.1;
    const bass = [55, 55, 62, 55, 49, 49, 58, 55];
    const lead = [0, 0, 740, 0, 620, 0, 880, 740];
    const tick = () => {
      const c = this.ctx!;
      const lookahead = 0.25;
      while (this.nextNote < c.currentTime + lookahead) {
        const t = this.nextNote;
        const s = this.step % 8;
        const bus = this.musicBus!;
        // bass pulse
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = bass[s];
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.22, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
        const lp = c.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 320 + this.intensity * 700;
        o.connect(lp); lp.connect(g); g.connect(bus);
        o.start(t); o.stop(t + 0.3);
        // hat
        if (s % 2 === 1) {
          const src = c.createBufferSource();
          src.buffer = this.noise!;
          const hp = c.createBiquadFilter();
          hp.type = 'highpass';
          hp.frequency.value = 7000;
          const hg = c.createGain();
          hg.gain.setValueAtTime(0.05 + this.intensity * 0.05, t);
          hg.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
          src.connect(hp); hp.connect(hg); hg.connect(bus);
          src.start(t, Math.random() * 0.4, 0.06);
        }
        // sparse lead when intense
        if (this.intensity > 0.25 && lead[s] > 0) {
          const lo = c.createOscillator();
          lo.type = 'triangle';
          lo.frequency.value = lead[s];
          const lg = c.createGain();
          lg.gain.setValueAtTime(0.0001, t);
          lg.gain.linearRampToValueAtTime(0.06 * this.intensity, t + 0.02);
          lg.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
          lo.connect(lg); lg.connect(bus);
          lo.start(t); lo.stop(t + 0.55);
        }
        this.nextNote += 0.26;
        this.step++;
      }
    };
    tick();
    this.musicTimer = window.setInterval(tick, 90);
  }

  stopMusic() {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}

export const audio = new AudioEngine();
