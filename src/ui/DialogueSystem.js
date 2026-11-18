const PORTRAIT_MAP = {
  normal: './assets/hung_portrait_normal.png',
  tired: './assets/hung_portrait_tired.png',
  scared: './assets/hung_portrait_scared.png',
  doppel: './assets/hung_portrait_doppel.png'
};

export class DialogueSystem {
  constructor(audio) {
    this.audio = audio;
    this.boxEl = document.getElementById('dialogue-box');
    this.portraitEl = document.getElementById('dialogue-portrait');
    this.speakerEl = document.getElementById('dialogue-speaker');
    this.textEl = document.getElementById('dialogue-text');

    this.queue = [];
    this.activeItem = null;
    this.fullText = '';
    this.charIndex = 0;
    this.charTimer = 0;
    this.holdTimer = 0;
    this.blipCounter = 0;
  }

  say(text, { mood = 'normal', speaker = 'NGUYỄN TUẤN HƯNG (24SE1 • VN-UK)', interrupt = false, hold = 3.2 } = {}) {
    if (interrupt) {
      this.queue = [];
      this.activeItem = null;
    }
    this.queue.push({ text, mood, speaker, hold });
    if (!this.activeItem) {
      this._startNext();
    }
  }

  clear() {
    this.queue = [];
    this.activeItem = null;
    if (this.boxEl) {
      this.boxEl.hidden = true;
      this.boxEl.dataset.mood = 'normal';
    }
  }

  _startNext() {
    if (this.queue.length === 0) {
      this.activeItem = null;
      if (this.boxEl) this.boxEl.hidden = true;
      return;
    }

    this.activeItem = this.queue.shift();
    this.fullText = this.activeItem.text;
    this.charIndex = 0;
    this.charTimer = 0;
    this.holdTimer = this.activeItem.hold;
    this.blipCounter = 0;

    if (this.boxEl) {
      this.boxEl.hidden = false;
      this.boxEl.dataset.mood = this.activeItem.mood;
    }
    if (this.portraitEl) {
      this.portraitEl.src = PORTRAIT_MAP[this.activeItem.mood] || PORTRAIT_MAP.normal;
    }
    if (this.speakerEl) {
      this.speakerEl.textContent = this.activeItem.speaker;
    }
    if (this.textEl) {
      this.textEl.textContent = '';
    }
  }

  update(dt) {
    if (!this.activeItem) return;

    if (this.charIndex < this.fullText.length) {
      this.charTimer += dt;
      const charsPerSec = 42;
      while (this.charTimer >= 1 / charsPerSec && this.charIndex < this.fullText.length) {
        this.charTimer -= 1 / charsPerSec;
        this.charIndex++;
        const currentChar = this.fullText[this.charIndex - 1];
        if (this.textEl) {
          this.textEl.textContent = this.fullText.slice(0, this.charIndex);
        }
        if (currentChar && currentChar.trim() !== '') {
          this.blipCounter++;
          if (this.blipCounter % 2 === 1) {
            this.audio.playHungVoiceBlip(this.activeItem.mood);
          }
        }
      }
    } else {
      this.holdTimer -= dt;
      if (this.holdTimer <= 0) {
        this._startNext();
      }
    }
  }
}
