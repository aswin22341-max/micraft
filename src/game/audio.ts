class SoundEngine {
  private ctx: AudioContext | null = null;
  private volume = 0.7;

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
  }

  private ensureContext(): AudioContext | null {
    if (this.volume <= 0.01) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playTone(
    freqStart: number,
    freqEnd: number,
    duration: number,
    type: OscillatorType,
    gainScale = 0.2
  ) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + duration);

    gain.gain.setValueAtTime(this.volume * gainScale, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  private playNoise(duration: number, filterFreq: number, gainScale = 0.15) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = 1.2;

    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(this.volume * gainScale, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + duration);
  }

  playStep(material: 'grass' | 'stone' | 'wood' | 'sand' | 'glass') {
    const freq =
      material === 'stone' ? 950 : material === 'wood' ? 520 : material === 'sand' ? 1400 : 720;
    this.playNoise(0.055, freq, 0.08);
  }

  playBreak(material: 'grass' | 'stone' | 'wood' | 'sand' | 'glass') {
    if (material === 'glass') {
      this.playTone(1800, 750, 0.14, 'triangle', 0.18);
      this.playNoise(0.12, 3200, 0.14);
      return;
    }
    const base = material === 'stone' ? 170 : material === 'wood' ? 230 : 140;
    this.playTone(base, base * 0.55, 0.11, 'square', 0.12);
    this.playNoise(0.11, material === 'stone' ? 1100 : 700, 0.18);
  }

  playPlace(material: 'grass' | 'stone' | 'wood' | 'sand' | 'glass') {
    const base = material === 'stone' ? 240 : material === 'wood' ? 290 : 190;
    this.playTone(base, base * 0.7, 0.08, 'triangle', 0.18);
  }

  playPickup() {
    this.playTone(540, 960, 0.09, 'sine', 0.14);
  }

  playEat() {
    this.playNoise(0.08, 1200, 0.12);
    setTimeout(() => this.playNoise(0.07, 900, 0.1), 85);
  }

  playHurt() {
    this.playTone(220, 80, 0.2, 'sawtooth', 0.24);
  }

  playHit() {
    this.playTone(300, 120, 0.12, 'square', 0.16);
  }

  playSplash() {
    this.playNoise(0.22, 600, 0.16);
  }

  playClick() {
    this.playTone(620, 780, 0.045, 'sine', 0.09);
  }
}

export const soundEngine = new SoundEngine();
