import * as THREE from 'three';

export class HorrorAudioEngine {
  constructor() {
    this._tmpDir = new THREE.Vector3(0, 0, -1);
    this.ctx = null;
    this.masterGain = null;
    this.reverbNode = null;
    this.noiseBuffer = null;
    this.pinkNoiseBuffer = null;
    this.volume = 0.85;
    this.muted = false;
    this.initialized = false;

    // Continuous ambient nodes
    this.windGain = null;
    this.windFilter = null;
    this.windPanner = null;
    this.droneGain = null;
    this.pcHumGain = null;

    // Heartbeat & breath state
    this.tension = 0; // 0..1
    this.nextHeartbeatTime = 0;
    this.windowOpenFactor = 0.25;
  }

  init() {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioCtx();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : this.volume;
    this.masterGain.connect(this.ctx.destination);

    // Pre-build white & pink noise buffers (3 seconds)
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * 3;
    this.noiseBuffer = this.ctx.createBuffer(1, length, sampleRate);
    this.pinkNoiseBuffer = this.ctx.createBuffer(1, length, sampleRate);

    const white = this.noiseBuffer.getChannelData(0);
    const pink = this.pinkNoiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < length; i++) {
      const w = Math.random() * 2 - 1;
      white[i] = w;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520;
      b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.0168980;
      pink[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }

    // Build tiled student-room convolution reverb (1.35s decay)
    this.reverbNode = this.ctx.createConvolver();
    const irLen = Math.floor(sampleRate * 1.35);
    const irBuf = this.ctx.createBuffer(2, irLen, sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = irBuf.getChannelData(ch);
      for (let i = 0; i < irLen; i++) {
        const t = i / irLen;
        const env = Math.pow(1 - t, 2.8);
        data[i] = (Math.random() * 2 - 1) * env * 0.45;
      }
    }
    this.reverbNode.buffer = irBuf;
    const revGain = this.ctx.createGain();
    revGain.gain.value = 0.34;
    this.reverbNode.connect(revGain);
    revGain.connect(this.masterGain);

    this._startNightAmbience();
    this.initialized = true;
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(
        this.muted ? 0 : this.volume,
        this.ctx.currentTime,
        0.04
      );
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    this.setVolume(this.volume);
    return this.muted;
  }

  updateListener(camera) {
    if (!this.initialized || !this.ctx) return;
    const listener = this.ctx.listener;
    const pos = camera.position;
    const fwd = camera.getWorldDirection(this._tmpDir);
    // Three.js Vector3 compatibility
    if (listener.positionX) {
      const t = this.ctx.currentTime;
      listener.positionX.setValueAtTime(pos.x, t);
      listener.positionY.setValueAtTime(pos.y, t);
      listener.positionZ.setValueAtTime(pos.z, t);
      listener.forwardX.setValueAtTime(fwd.x, t);
      listener.forwardY.setValueAtTime(fwd.y, t);
      listener.forwardZ.setValueAtTime(fwd.z, t);
      listener.upX.setValueAtTime(0, t);
      listener.upY.setValueAtTime(1, t);
      listener.upZ.setValueAtTime(0, t);
    } else if (listener.setPosition) {
      listener.setPosition(pos.x, pos.y, pos.z);
      listener.setOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0);
    }
  }

  _createPanner(x, y, z) {
    const p = this.ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = 1.2;
    p.maxDistance = 14;
    p.rolloffFactor = 1.25;
    p.positionX.value = x;
    p.positionY.value = y;
    p.positionZ.value = z;
    p.connect(this.masterGain);
    p.connect(this.reverbNode);
    return p;
  }

  _startNightAmbience() {
    const now = this.ctx.currentTime;

    // 1. Cold Night Wind at East Window (x: 2.8, y: 1.5, z: -0.4)
    const windSrc = this.ctx.createBufferSource();
    windSrc.buffer = this.pinkNoiseBuffer;
    windSrc.loop = true;

    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 340;
    this.windFilter.Q.value = 2.6;

    // Slow gust LFO on wind frequency
    const windLfo = this.ctx.createOscillator();
    windLfo.frequency.value = 0.17;
    const windLfoGain = this.ctx.createGain();
    windLfoGain.gain.value = 170;
    windLfo.connect(windLfoGain);
    windLfoGain.connect(this.windFilter.frequency);

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.16;

    this.windPanner = this._createPanner(2.8, 1.5, -0.4);
    windSrc.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.windPanner);

    windSrc.start(now);
    windLfo.start(now);

    // 2. Subtle PC Case Fan & Room 60Hz Electrical Hum near Desk (0, 0.9, -2.6)
    const pcPanner = this._createPanner(0.1, 0.9, -2.6);
    const fanSrc = this.ctx.createBufferSource();
    fanSrc.buffer = this.pinkNoiseBuffer;
    fanSrc.loop = true;
    const fanFilter = this.ctx.createBiquadFilter();
    fanFilter.type = 'lowpass';
    fanFilter.frequency.value = 240;
    this.pcHumGain = this.ctx.createGain();
    this.pcHumGain.gain.value = 0.065;
    fanSrc.connect(fanFilter);
    fanFilter.connect(this.pcHumGain);
    this.pcHumGain.connect(pcPanner);
    fanSrc.start(now);

    // 3. Psychological Horror Sub-Drone (scales with tension!)
    const dOsc1 = this.ctx.createOscillator();
    const dOsc2 = this.ctx.createOscillator();
    dOsc1.type = 'sawtooth';
    dOsc2.type = 'triangle';
    dOsc1.frequency.value = 46.25; // F#1
    dOsc2.frequency.value = 49.0;  // G1 (creepy beating dissonance!)

    const droneFilter = this.ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 130;

    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.value = 0.035;

    dOsc1.connect(droneFilter);
    dOsc2.connect(droneFilter);
    droneFilter.connect(this.droneGain);
    this.droneGain.connect(this.masterGain);

    dOsc1.start(now);
    dOsc2.start(now);
  }

  updateAtmosphere(dt, tension, windowOpen) {
    if (!this.initialized || !this.ctx) return;
    this.tension = tension;
    this.windowOpenFactor = windowOpen ? 1.0 : 0.24;

    const now = this.ctx.currentTime;
    if (this.windGain && this.windFilter) {
      const targetWind = windowOpen ? 0.58 : 0.14 + tension * 0.08;
      this.windGain.gain.setTargetAtTime(targetWind, now, 0.25);
      this.windFilter.Q.setTargetAtTime(windowOpen ? 1.5 : 2.8, now, 0.25);
    }
    if (this.droneGain) {
      this.droneGain.gain.setTargetAtTime(0.03 + tension * 0.16, now, 0.3);
    }

    // Dynamic Heartbeat & Anxious Breath when tension > 0.28
    if (tension > 0.28 && now >= this.nextHeartbeatTime) {
      const bpm = 68 + tension * 78; // 68 -> 146 BPM
      this._playHeartbeat(tension);
      this.nextHeartbeatTime = now + 60 / bpm;
    }
  }

  _playHeartbeat(intensity) {
    const now = this.ctx.currentTime;
    const vol = Math.min(0.45, (intensity - 0.2) * 0.52);
    if (vol <= 0.01) return;

    const beat = (delay, freq, gainScale) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + delay);
      osc.frequency.exponentialRampToValueAtTime(28, now + delay + 0.14);
      g.gain.setValueAtTime(0.001, now + delay);
      g.gain.linearRampToValueAtTime(vol * gainScale, now + delay + 0.018);
      g.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.17);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(now + delay);
      osc.stop(now + delay + 0.19);
    };

    beat(0, 62, 1.0);       // LUB
    beat(0.19, 52, 0.68);   // DUB
  }

  // =========================================================================
  // MECHANICAL KEYBOARD TYPING (Tiếng gõ phím cơ chạy deadline cực chân thực!)
  // =========================================================================
  playKeyClick(isSpaceOrEnter = false) {
    if (!this.initialized) return;
    const now = this.ctx.currentTime;
    const pitchJitter = 0.9 + Math.random() * 0.24;

    // 1. Tactile switch click burst (bandpass noise)
    const clickSrc = this.ctx.createBufferSource();
    clickSrc.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = (isSpaceOrEnter ? 1900 : 3200) * pitchJitter;
    bp.Q.value = 3.2;

    const clickGain = this.ctx.createGain();
    const peak = isSpaceOrEnter ? 0.28 : 0.21;
    clickGain.gain.setValueAtTime(peak, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + (isSpaceOrEnter ? 0.048 : 0.028));

    clickSrc.connect(bp);
    bp.connect(clickGain);
    clickGain.connect(this.masterGain);
    clickSrc.start(now, Math.random() * 1.5, 0.06);

    // 2. Desk / Keycap bottom-out thock
    const thock = this.ctx.createOscillator();
    const thockGain = this.ctx.createGain();
    thock.type = 'triangle';
    const startFreq = (isSpaceOrEnter ? 175 : 265) * pitchJitter;
    thock.frequency.setValueAtTime(startFreq, now);
    thock.frequency.exponentialRampToValueAtTime(65, now + 0.045);

    thockGain.gain.setValueAtTime(isSpaceOrEnter ? 0.22 : 0.14, now);
    thockGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    thock.connect(thockGain);
    thockGain.connect(this.masterGain);
    thock.start(now);
    thock.stop(now + 0.055);
  }

  // =========================================================================
  // PROTAGONIST HƯNG SOUNDS (Bước chân, giọng nói pixel, thở dài, giật mình)
  // =========================================================================
  playFootstep() {
    if (!this.initialized) return;
    const now = this.ctx.currentTime;
    const jitter = 0.92 + Math.random() * 0.16;

    // Cold tile tap + low heel thud
    const src = this.ctx.createBufferSource();
    src.buffer = this.pinkNoiseBuffer;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'bandpass';
    lp.frequency.value = 680 * jitter;
    lp.Q.value = 1.6;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.13, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    src.connect(lp);
    lp.connect(g);
    g.connect(this.masterGain);
    g.connect(this.reverbNode);
    src.start(now, Math.random() * 1.5, 0.1);

    const heel = this.ctx.createOscillator();
    const hg = this.ctx.createGain();
    heel.type = 'sine';
    heel.frequency.setValueAtTime(115 * jitter, now);
    heel.frequency.exponentialRampToValueAtTime(42, now + 0.075);
    hg.gain.setValueAtTime(0.12, now);
    hg.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    heel.connect(hg);
    hg.connect(this.masterGain);
    heel.start(now);
    heel.stop(now + 0.085);
  }

  playHungVoiceBlip(mood = 'normal') {
    if (!this.initialized) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();

    let baseFreq = 128; // Male student baritone voice blip (Bad Parenting style!)
    if (mood === 'tired') baseFreq = 112;
    else if (mood === 'scared') baseFreq = 162;
    else if (mood === 'doppel') baseFreq = 76;

    osc.type = mood === 'doppel' ? 'sawtooth' : 'square';
    osc.frequency.setValueAtTime(baseFreq * (0.94 + Math.random() * 0.14), now);

    filter.type = 'lowpass';
    filter.frequency.value = mood === 'doppel' ? 420 : 680;

    g.gain.setValueAtTime(0.055, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.048);

    osc.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.052);
  }

  playHungSigh() {
    if (!this.initialized) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.pinkNoiseBuffer;

    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(620, now);
    f.frequency.exponentialRampToValueAtTime(310, now + 0.65);
    f.Q.value = 3.0;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.14, now + 0.12);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.68);

    src.connect(f);
    f.connect(g);
    g.connect(this.masterGain);
    src.start(now, Math.random(), 0.72);
  }

  playHungGasp() {
    if (!this.initialized) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    // Sharp vocalized inhale formant ("Hộc!")
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(480, now);
    f.frequency.linearRampToValueAtTime(1050, now + 0.16);
    f.Q.value = 4.5;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.28, now + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

    src.connect(f);
    f.connect(g);
    g.connect(this.masterGain);
    g.connect(this.reverbNode);
    src.start(now, 0.2, 0.3);
  }

  // =========================================================================
  // SUPERNATURAL ANOMALY SFX (3D Spatialized!)
  // =========================================================================
  playDoorKnock(pos = { x: -1.45, y: 1.45, z: 3.05 }, urgent = false) {
    if (!this.initialized) return;
    const now = this.ctx.currentTime;
    const panner = this._createPanner(pos.x, pos.y, pos.z);
    const count = urgent ? 4 : 3;
    const spacing = urgent ? 0.27 : 0.44;

    for (let i = 0; i < count; i++) {
      const t = now + i * spacing + (Math.random() * 0.02);
      // Hollow wood resonance
      const osc = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const g = this.ctx.createGain();

      osc.type = 'triangle';
      osc2.type = 'sine';
      osc.frequency.setValueAtTime(urgent ? 185 : 155, t);
      osc.frequency.exponentialRampToValueAtTime(58, t + 0.09);
      osc2.frequency.setValueAtTime(310, t);
      osc2.frequency.exponentialRampToValueAtTime(95, t + 0.05);

      const amp = urgent ? 0.65 : 0.48;
      g.gain.setValueAtTime(amp, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

      osc.connect(g);
      osc2.connect(g);
      g.connect(panner);
      osc.start(t);
      osc2.start(t);
      osc.stop(t + 0.13);
      osc2.stop(t + 0.13);
    }
  }

  playPaperScatter(pos = { x: -0.35, y: 0.9, z: -2.4 }) {
    if (!this.initialized) return;
    const now = this.ctx.currentTime;
    const panner = this._createPanner(pos.x, pos.y, pos.z);

    for (let i = 0; i < 5; i++) {
      const t = now + i * 0.075;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'bandpass';
      hp.frequency.value = 2400 + i * 320;
      hp.Q.value = 1.4;

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.28, t + 0.025);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

      src.connect(hp);
      hp.connect(g);
      g.connect(panner);
      src.start(t, Math.random() * 1.2, 0.22);
    }
  }

  playPaperPickup() {
    if (!this.initialized) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2800;
    bp.Q.value = 1.8;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.22, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.masterGain);
    src.start(now, Math.random(), 0.13);
  }

  playLightSwitch(turnOn = true, spark = false, pos = { x: -0.65, y: 1.35, z: 3.02 }) {
    if (!this.initialized) return;
    const now = this.ctx.currentTime;
    const panner = this._createPanner(pos.x, pos.y, pos.z);

    // Crisp plastic toggle snap
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(turnOn ? 1450 : 980, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.03);
    g.gain.setValueAtTime(0.32, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
    osc.connect(g);
    g.connect(panner);
    osc.start(now);
    osc.stop(now + 0.04);

    if (spark) {
      // Scary electrical pop & buzz when lights cut out!
      const zSrc = this.ctx.createBufferSource();
      zSrc.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1800;
      bp.Q.value = 2.5;
      const zg = this.ctx.createGain();
      zg.gain.setValueAtTime(0.45, now + 0.02);
      zg.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      zSrc.connect(bp);
      bp.connect(zg);
      zg.connect(panner);
      zSrc.start(now + 0.02, 0.3, 0.3);
    }
  }

  playWoodCreak(pos = { x: -2.55, y: 1.3, z: 0.65 }) {
    if (!this.initialized) return;
    const now = this.ctx.currentTime;
    const panner = this._createPanner(pos.x, pos.y, pos.z);

    // Stick-slip wooden door creak ("kẽo... kẹt...")
    const osc = this.ctx.createOscillator();
    const mod = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();
    const bp = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(210, now);
    osc.frequency.linearRampToValueAtTime(340, now + 0.45);
    osc.frequency.linearRampToValueAtTime(165, now + 0.95);

    mod.frequency.value = 26;
    modGain.gain.value = 35;
    mod.connect(modGain);
    modGain.connect(osc.frequency);

    bp.type = 'bandpass';
    bp.frequency.value = 520;
    bp.Q.value = 4.2;

    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.24, now + 0.15);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.98);

    osc.connect(bp);
    bp.connect(g);
    g.connect(panner);
    osc.start(now);
    mod.start(now);
    osc.stop(now + 1.0);
    mod.stop(now + 1.0);
  }

  playWindowGustOpen(pos = { x: 2.75, y: 1.5, z: -0.4 }) {
    if (!this.initialized) return;
    const now = this.ctx.currentTime;
    const panner = this._createPanner(pos.x, pos.y, pos.z);

    // Latch bang + icy wind howl burst
    this.playDoorKnock(pos, true);
    const src = this.ctx.createBufferSource();
    src.buffer = this.pinkNoiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(280, now);
    bp.frequency.linearRampToValueAtTime(760, now + 0.35);
    bp.frequency.exponentialRampToValueAtTime(320, now + 1.3);
    bp.Q.value = 2.0;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.01, now);
    g.gain.linearRampToValueAtTime(0.55, now + 0.18);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.35);

    src.connect(bp);
    bp.connect(g);
    g.connect(panner);
    src.start(now, 0, 1.4);
  }

  playMirrorTap(pos = { x: -2.75, y: 1.45, z: -1.35 }) {
    if (!this.initialized) return;
    const now = this.ctx.currentTime;
    const panner = this._createPanner(pos.x, pos.y, pos.z);

    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.22;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2150 - i * 120, t);
      osc.frequency.exponentialRampToValueAtTime(620, t + 0.045);
      g.gain.setValueAtTime(0.24, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      osc.connect(g);
      g.connect(panner);
      osc.start(t);
      osc.stop(t + 0.07);
    }
  }

  playWhisper(pos = { x: 0, y: 1.5, z: 0.5 }) {
    if (!this.initialized) return;
    const now = this.ctx.currentTime;
    const panner = this._createPanner(pos.x, pos.y, pos.z);

    // Eerie 2-syllable phantom whisper ("Hưng... ơi...")
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const f1 = this.ctx.createBiquadFilter();
    f1.type = 'bandpass';
    f1.Q.value = 6.5;
    f1.frequency.setValueAtTime(880, now);
    f1.frequency.linearRampToValueAtTime(1320, now + 0.45);
    f1.frequency.linearRampToValueAtTime(720, now + 1.15);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.24, now + 0.22);
    g.gain.linearRampToValueAtTime(0.04, now + 0.52);
    g.gain.linearRampToValueAtTime(0.22, now + 0.78);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.3);

    src.connect(f1);
    f1.connect(g);
    g.connect(panner);
    src.start(now, 0.1, 1.35);
  }

  playPhoneRingPulse(pos = { x: 0.42, y: 0.58, z: 2.76 }) {
    if (!this.initialized) return;
    const now = this.ctx.currentTime;
    const panner = this._createPanner(pos.x, pos.y, pos.z);

    // Wooden nightstand buzz + detuned creepy melody notes
    const notes = [659.25, 622.25, 493.88, 466.16]; // E5 - D#5 - B4 - A#4 creepy tritone/half-step motif!
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.14;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.11, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(g);
      g.connect(panner);
      osc.start(t);
      osc.stop(t + 0.13);
    });

    // Buzz vibration against wood
    const buzz = this.ctx.createOscillator();
    const bg = this.ctx.createGain();
    buzz.type = 'sawtooth';
    buzz.frequency.value = 92;
    bg.gain.setValueAtTime(0.16, now);
    bg.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    buzz.connect(bg);
    bg.connect(panner);
    buzz.start(now);
    buzz.stop(now + 0.58);
  }

  playThunder() {
    if (!this.initialized) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.pinkNoiseBuffer;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(190, now);
    lp.frequency.exponentialRampToValueAtTime(55, now + 2.4);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.01, now);
    g.gain.linearRampToValueAtTime(0.45, now + 0.16);
    g.gain.exponentialRampToValueAtTime(0.001, now + 2.5);

    src.connect(lp);
    lp.connect(g);
    g.connect(this.masterGain);
    src.start(now, 0, 2.6);
  }

  playHorrorStinger(intensity = 0.7) {
    if (!this.initialized) return;
    const now = this.ctx.currentTime;
    const freqs = [233.08, 246.94, 329.63, 622.25, 659.25]; // Dissonant cluster!
    freqs.forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.linearRampToValueAtTime(f * (idx % 2 === 0 ? 1.04 : 0.96), now + 0.85);
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.075 * intensity, now + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      osc.connect(g);
      g.connect(this.masterGain);
      g.connect(this.reverbNode);
      osc.start(now);
      osc.stop(now + 0.95);
    });
  }

  playJumpscareScream() {
    if (!this.initialized) return;
    const now = this.ctx.currentTime;

    // 1. Massive Sub-Bass Impact Slam
    const sub = this.ctx.createOscillator();
    const subG = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(135, now);
    sub.frequency.exponentialRampToValueAtTime(26, now + 0.75);
    subG.gain.setValueAtTime(0.85, now);
    subG.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
    sub.connect(subG);
    subG.connect(this.masterGain);
    sub.start(now);
    sub.stop(now + 0.9);

    // 2. Terrifying Formant Shriek + FM Metallic Screech
    const carrier = this.ctx.createOscillator();
    const mod = this.ctx.createOscillator();
    const modG = this.ctx.createGain();
    const shriekG = this.ctx.createGain();

    carrier.type = 'sawtooth';
    carrier.frequency.setValueAtTime(540, now);
    carrier.frequency.exponentialRampToValueAtTime(1180, now + 0.14);
    carrier.frequency.linearRampToValueAtTime(390, now + 0.95);

    mod.type = 'square';
    mod.frequency.value = 73;
    modG.gain.value = 280;
    mod.connect(modG);
    modG.connect(carrier.frequency);

    shriekG.gain.setValueAtTime(0.42, now);
    shriekG.gain.exponentialRampToValueAtTime(0.001, now + 0.98);

    carrier.connect(shriekG);
    shriekG.connect(this.masterGain);
    shriekG.connect(this.reverbNode);

    carrier.start(now);
    mod.start(now);
    carrier.stop(now + 1.0);
    mod.stop(now + 1.0);

    // 3. Roaring filtered noise burst
    const nSrc = this.ctx.createBufferSource();
    nSrc.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1450;
    bp.Q.value = 1.6;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.55, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
    nSrc.connect(bp);
    bp.connect(ng);
    ng.connect(this.masterGain);
    nSrc.start(now, 0, 0.9);

    // Followed 0.65s later by Hưng's terrified gasp!
    setTimeout(() => this.playHungGasp(), 620);
  }

  playSubmitSuccess() {
    if (!this.initialized) return;
    const now = this.ctx.currentTime;
    const chord = [261.63, 329.63, 392.00, 493.88, 523.25]; // Warm Cmaj7 dawn relief!
    chord.forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + i * 0.08);
      g.gain.setValueAtTime(0.001, now + i * 0.08);
      g.gain.linearRampToValueAtTime(0.14, now + i * 0.08 + 0.25);
      g.gain.exponentialRampToValueAtTime(0.001, now + 2.8);
      osc.connect(g);
      g.connect(this.masterGain);
      g.connect(this.reverbNode);
      osc.start(now + i * 0.08);
      osc.stop(now + 2.9);
    });
  }
}
