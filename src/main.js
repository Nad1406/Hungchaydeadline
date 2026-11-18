import * as THREE from 'three';
import { createPSXPostMaterial } from './shaders/PSXPostShader.js';
import { HorrorAudioEngine } from './audio/HorrorAudioEngine.js';
import { ComputerTerminal } from './systems/ComputerTerminal.js';
import { RoomBuilder } from './world/RoomBuilder.js';
import { DialogueSystem } from './ui/DialogueSystem.js';
import { AnomalyManager, DIFFICULTY_CONFIGS } from './systems/AnomalyManager.js';
import { HungCharacter } from './entities/HungCharacter.js';

// Progressive enhancement fallback for <dialog closedby="any">
if (typeof HTMLDialogElement !== 'undefined' && !('closedBy' in HTMLDialogElement.prototype)) {
  const outside = (e, dialog) => {
    const r = dialog.getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  };
  for (const dialog of document.querySelectorAll('dialog[closedby="any"]')) {
    let pressedOutside = false;
    dialog.addEventListener('pointerdown', (e) => {
      pressedOutside = outside(e, dialog);
    });
    dialog.addEventListener('pointerup', (e) => {
      if (pressedOutside && outside(e, dialog)) dialog.close();
    });
  }
}

const QUALITY_PRESETS = {
  smooth: { w: 360, h: 202, colorSteps: 24.0, dither: 0.90 },
  balanced: { w: 480, h: 270, colorSteps: 32.0, dither: 0.80 },
  sharp: { w: 640, h: 360, colorSteps: 48.0, dither: 0.65 },
  ultrasharp: { w: 960, h: 540, colorSteps: 64.0, dither: 0.42 }
};

class HungDeadlineGame {
  constructor() {
    this.container = document.getElementById('canvas-container');

    // UI Elements
    this.titleScreenEl = document.getElementById('title-screen');
    this.diffBtns = Array.from(document.querySelectorAll('.diff-btn'));
    this.selectDiffSettingsEl = document.getElementById('select-diff-settings');
    this.radioFullscreenEl = document.getElementById('radio-display-fullscreen');
    this.radioWindowedEl = document.getElementById('radio-display-windowed');
    this.btnSettingsMainMenu = document.getElementById('btn-settings-mainmenu');
    this.btnCloseSettings = document.getElementById('btn-close-settings');
    this.checkMuteEl = document.getElementById('check-mute');

    this.preferFullscreen = true;
    this._intentionalUnlock = false;
    this._lastSettingsOpenTime = 0;

    this.hudTopEl = document.getElementById('hud-top');
    this.hudCenterEl = document.getElementById('hud-center');
    this.hudClockEl = document.getElementById('hud-clock');
    this.hudDiffBadgeEl = document.getElementById('hud-diff-badge');
    this.hudProgressLabelEl = document.getElementById('hud-progress-label');
    this.hudProgressTrackEl = document.getElementById('hud-progress-track');
    this.anomalyHintsEl = document.getElementById('anomaly-hints');
    this.reticleEl = document.getElementById('reticle');
    this.interactPromptEl = document.getElementById('interact-prompt');
    this.seatedBarEl = document.getElementById('seated-bar');
    this.keycapAEl = document.getElementById('keycap-a');
    this.keycapDEl = document.getElementById('keycap-d');
    this.standingBarEl = document.getElementById('standing-bar');
    this.doorVignetteEl = document.getElementById('door-vignette');

    // Modal Dialogs
    this.dialogStory = document.getElementById('dialog-story');
    this.dialogSettings = document.getElementById('dialog-settings');
    this.dialogCard = document.getElementById('dialog-card');
    this.dialogGameOver = document.getElementById('dialog-gameover');
    this.dialogEnding = document.getElementById('dialog-ending');

    // Subsystems
    this.audio = new HorrorAudioEngine();
    this.dialogue = new DialogueSystem(this.audio);
    this.terminal = new ComputerTerminal();

    // Three.js Scene & Camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(66, window.innerWidth / window.innerHeight, 0.08, 30);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    // Player Phone Flashlight ([F])
    this.phoneFlashlight = new THREE.SpotLight(0xd8ecff, 0, 8.0, Math.PI * 0.28, 0.55, 1.25);
    this.phoneFlashlight.position.set(0.12, -0.08, 0);
    this.phoneFlashlight.target.position.set(0, -0.05, -2.0);
    this.camera.add(this.phoneFlashlight);
    this.camera.add(this.phoneFlashlight.target);
    this.flashlightOn = false;

    // 3D Jumpscare Entity attached right in front of Camera
    this.jumpscareEntity = new HungCharacter({ isShadowEntity: true });
    this.jumpscareEntity.group.position.set(0, -1.60, -0.52);
    this.jumpscareEntity.group.visible = false;
    this.jumpscareLight = new THREE.PointLight(0xff1e2d, 0, 2.5, 1.0);
    this.jumpscareLight.position.set(0, 0.1, -0.35);
    this.camera.add(this.jumpscareEntity.group);
    this.camera.add(this.jumpscareLight);

    // Build 3D Room World & Anomaly Director
    this.room = new RoomBuilder(this.scene, this.terminal.texture);
    this.anomalies = new AnomalyManager(this.room, this.audio, this.dialogue, this.terminal);

    // Split-second Hallucination Apparition
    this.apparitionEntity = new HungCharacter({ isShadowEntity: true });
    this.apparitionEntity.group.position.set(0.0, 0, 0.15);
    this.apparitionEntity.group.visible = false;
    this.scene.add(this.apparitionEntity.group);
    this.apparitionTimer = 0;

    // WebGL Renderer + Graphics Quality RenderTarget Pipeline (Default: 'balanced' 480x270)
    const initPreset = QUALITY_PRESETS.balanced;
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    this.renderTarget = new THREE.WebGLRenderTarget(initPreset.w, initPreset.h, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      generateMipmaps: false
    });
    this.postScene = new THREE.Scene();
    this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.postMat = createPSXPostMaterial(this.renderTarget.texture);
    this._applyQualityPreset('balanced');
    this.postQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMat);
    this.postScene.add(this.postQuad);

    // Game State: 'title' | 'playing' | 'jumpscare_gameover' | 'gameover' | 'ending'
    this.mode = 'title';
    this.difficulty = 'normal';
    this.isSeated = true;
    this.peeringDoor = false;
    this.cursorUnlocked = false; // False during active gameplay (cursor hidden); Middle-Click toggles!
    this.pendingFailureReason = '';

    // Player Transform & Input
    this.playerPos = new THREE.Vector3(0, 1.56, -1.28);
    this.yaw = 0;
    this.pitch = 0;
    this.mouseSens = 0.0022;
    this.keys = new Set();
    this.lastClientX = null;
    this.lastClientY = null;
    this.footstepTimer = 0;
    this.headBobTimer = 0;

    // [A] / [D] Spam & 1st-Person Hand Tap State
    this.lastTypedHand = null;
    this.leftHandTap = 0;
    this.rightHandTap = 0;
    this.keyPressAnimTimer = 0;

    // Scare & Shake Timers
    this.screenShake = 0;
    this.jumpscareTimer = 0;

    // Raycaster for 1st-person interaction (Realistic close-range physical reach!)
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 1.72;
    this.hoveredInteractable = null;

    this.clock = new THREE.Clock();
    this.elapsedTime = 0;

    this._bindEvents();
    this._syncDifficultyUI('normal');
    this._animate = this._animate.bind(this);
    requestAnimationFrame(this._animate);
  }

  // =========================================================================
  // GRAPHICS QUALITY & DIFFICULTY HELPERS
  // =========================================================================
  _applyQualityPreset(presetKey) {
    const p = QUALITY_PRESETS[presetKey] || QUALITY_PRESETS.balanced;
    this.renderTarget.setSize(p.w, p.h);
    this.postMat.uniforms.uResolution.value.set(p.w, p.h);
    this.postMat.uniforms.uColorSteps.value = p.colorSteps;
    this.postMat.uniforms.uDitherStrength.value = p.dither;
  }

  _syncDifficultyUI(diffId) {
    if (!DIFFICULTY_CONFIGS[diffId]) return;
    this.difficulty = diffId;
    this.anomalies.setDifficulty(diffId);
    const cfg = DIFFICULTY_CONFIGS[diffId];

    this.diffBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.diff === diffId);
    });
    if (this.selectDiffSettingsEl && this.selectDiffSettingsEl.value !== diffId) {
      this.selectDiffSettingsEl.value = diffId;
    }
    if (this.hudDiffBadgeEl) {
      this.hudDiffBadgeEl.textContent = `ĐỘ KHÓ: ${cfg.label}`;
    }
  }

  // =========================================================================
  // CURSOR VISIBILITY & FULLSCREEN / WINDOWED MANAGEMENT
  // =========================================================================
  _requestFullscreenSafe() {
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        const p = document.documentElement.requestFullscreen();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      }
    } catch {
      // Ignore in restricted environments
    }
  }

  _exitFullscreenSafe() {
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        this._intentionalUnlock = true;
        const p = document.exitFullscreen();
        if (p && typeof p.catch === 'function') p.catch(() => {});
        setTimeout(() => {
          this._intentionalUnlock = false;
        }, 180);
      }
    } catch {
      // Ignore in restricted environments
    }
  }

  _syncDisplayModeUI() {
    if (this.radioFullscreenEl) {
      this.radioFullscreenEl.checked = this.preferFullscreen;
    }
    if (this.radioWindowedEl) {
      this.radioWindowedEl.checked = !this.preferFullscreen;
    }
  }

  _applyDisplayMode() {
    if (this.preferFullscreen) {
      this._requestFullscreenSafe();
    } else {
      this._exitFullscreenSafe();
    }
  }

  _setDisplayMode(fullscreen) {
    this.preferFullscreen = Boolean(fullscreen);
    this._syncDisplayModeUI();
    this._applyDisplayMode();
  }

  _safeRequestPointerLock(el) {
    try {
      if (document.pointerLockElement !== el) {
        const p = el.requestPointerLock?.();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      }
    } catch {
      // Fallback mousemove look still works
    }
  }

  _safeExitPointerLock() {
    if (document.pointerLockElement) {
      this._intentionalUnlock = true;
      document.exitPointerLock();
      setTimeout(() => {
        this._intentionalUnlock = false;
      }, 150);
    }
  }

  _setGameplayCursorHidden(hidden) {
    this.cursorUnlocked = !hidden;
    if (hidden && this.mode === 'playing' && !this._anyDialogOpen()) {
      document.body.classList.add('cursor-hidden');
      this.lastClientX = null;
      this.lastClientY = null;
      this._safeRequestPointerLock(this.renderer.domElement);
    } else {
      document.body.classList.remove('cursor-hidden');
      this._safeExitPointerLock();
    }
  }

  _openSettingsModal() {
    this._lastSettingsOpenTime = performance.now();
    this._syncDisplayModeUI();
    if (this.btnSettingsMainMenu) {
      this.btnSettingsMainMenu.hidden = this.mode !== 'playing';
    }
    if (this.btnCloseSettings) {
      this.btnCloseSettings.textContent =
        this.mode === 'playing' ? 'LƯU & TIẾP TỤC' : 'LƯU & ĐÓNG';
    }
    this._openModal(this.dialogSettings);
  }

  // =========================================================================
  // INPUT & UI EVENTS
  // =========================================================================
  _bindEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Difficulty Picker on Title Screen
    this.diffBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.audio.init();
        this.audio.playKeyClick(false);
        this._syncDifficultyUI(btn.dataset.diff);
      });
    });

    // Title Screen Buttons (Normal Mouse Click!)
    document.getElementById('btn-start-game').addEventListener('click', () => {
      this.audio.init();
      this._applyDisplayMode();
      this.startNewNight();
    });

    document.getElementById('btn-open-story').addEventListener('click', () => {
      this.audio.init();
      this._openModal(this.dialogStory);
    });

    document.getElementById('btn-open-settings').addEventListener('click', () => {
      this.audio.init();
      this._openSettingsModal();
    });

    // Dialog Close & Action Buttons
    document.getElementById('btn-close-story').addEventListener('click', () => {
      this.dialogStory.close();
    });
    this.btnCloseSettings.addEventListener('click', () => {
      this.dialogSettings.close();
      if (this.mode === 'playing') {
        this._applyDisplayMode();
      }
    });
    this.btnSettingsMainMenu.addEventListener('click', () => {
      this._closingToMainMenu = true;
      this.dialogSettings.close();
      this._closingToMainMenu = false;
      this.returnToTitleMenu();
    });
    document.getElementById('btn-close-card').addEventListener('click', () => {
      this.dialogCard.close();
    });

    // Prevent double-Esc (pointerlockchange + dialog cancel) from closing Settings in the same instant it opens
    this.dialogSettings.addEventListener('cancel', (e) => {
      if (performance.now() - this._lastSettingsOpenTime < 220) {
        e.preventDefault();
      }
    });

    // Restore gameplay cursor state automatically whenever any modal closes (unless returning to main menu)
    [this.dialogStory, this.dialogSettings, this.dialogCard].forEach((dlg) => {
      dlg.addEventListener('close', () => {
        if (this.mode === 'playing' && !this._closingToMainMenu) {
          this._setGameplayCursorHidden(true);
        }
      });
    });

    // Detect browser Esc unlocking Pointer Lock during gameplay -> open [ESC] Settings immediately!
    document.addEventListener('pointerlockchange', () => {
      if (
        !document.pointerLockElement &&
        this.mode === 'playing' &&
        !this._intentionalUnlock &&
        !this._anyDialogOpen()
      ) {
        this._openSettingsModal();
      }
    });

    // Prevent Escape from accidentally dismissing Game Over or Victory modals where closedby="none" is unsupported
    [this.dialogGameOver, this.dialogEnding].forEach((dlg) => {
      dlg.addEventListener('cancel', (e) => e.preventDefault());
    });

    // Clear held movement/typing keys if window loses focus (e.g. opening GitHub signature link!)
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.keycapAEl?.classList.remove('pressed');
      this.keycapDEl?.classList.remove('pressed');
    });

    // Game Over & Victory Buttons
    document.getElementById('btn-gameover-retry').addEventListener('click', () => {
      this.dialogGameOver.close();
      this._applyDisplayMode();
      this.startNewNight();
    });

    document.getElementById('btn-gameover-menu').addEventListener('click', () => {
      this.dialogGameOver.close();
      this.returnToTitleMenu();
    });

    document.getElementById('btn-play-again').addEventListener('click', () => {
      this.dialogEnding.close();
      this._applyDisplayMode();
      this.startNewNight();
    });

    document.getElementById('btn-ending-menu').addEventListener('click', () => {
      this.dialogEnding.close();
      this.returnToTitleMenu();
    });

    // Settings Controls (Display Mode Fullscreen/Windowed, Graphics Quality, Difficulty, Volume, Mute, Sensitivity, CRT)
    this.radioFullscreenEl?.addEventListener('change', () => {
      if (this.radioFullscreenEl.checked) {
        this._setDisplayMode(true);
      }
    });
    this.radioFullscreenEl?.addEventListener('click', () => {
      if (this.radioFullscreenEl.checked && !document.fullscreenElement) {
        this._requestFullscreenSafe();
      }
    });

    this.radioWindowedEl?.addEventListener('change', () => {
      if (this.radioWindowedEl.checked) {
        this._setDisplayMode(false);
      }
    });
    this.radioWindowedEl?.addEventListener('click', () => {
      if (this.radioWindowedEl.checked && document.fullscreenElement) {
        this._exitFullscreenSafe();
      }
    });

    for (const box of document.querySelectorAll('.radio-option')) {
      box.addEventListener('click', (e) => {
        if (e.target === box) {
          box.querySelector('input[type="radio"]')?.click();
        }
      });
    }

    document.getElementById('select-quality').addEventListener('change', (e) => {
      this._applyQualityPreset(e.target.value);
    });

    this.selectDiffSettingsEl.addEventListener('change', (e) => {
      this._syncDifficultyUI(e.target.value);
    });

    document.getElementById('input-volume').addEventListener('input', (e) => {
      this.audio.init();
      this.audio.setVolume(Number(e.target.value) / 100);
    });

    this.checkMuteEl.addEventListener('change', (e) => {
      this.audio.init();
      if (this.audio.muted !== e.target.checked) {
        this.audio.toggleMute();
      }
    });

    document.getElementById('input-sens').addEventListener('input', (e) => {
      this.mouseSens = (Number(e.target.value) / 100) * 0.0022;
    });

    document.getElementById('check-crt').addEventListener('change', (e) => {
      this.postMat.uniforms.uCrtEnabled.value = e.target.checked ? 1.0 : 0.0;
    });

    // Middle Mouse Button (e.button === 1) toggles cursor ON/OFF during gameplay!
    window.addEventListener('auxclick', (e) => {
      if (e.button === 1) e.preventDefault();
    });

    window.addEventListener('mousedown', (e) => {
      if (e.button === 1) {
        e.preventDefault();
        if (this.mode === 'playing' && !this._anyDialogOpen()) {
          this.audio.init();
          this._setGameplayCursorHidden(this.cursorUnlocked); // Toggle!
        }
        return;
      }

      // Left-clicking 3D canvas while cursor is hidden re-ensures pointer lock & interacts if standing!
      if (
        e.button === 0 &&
        this.mode === 'playing' &&
        !this._anyDialogOpen() &&
        !this.cursorUnlocked &&
        e.target === this.renderer.domElement
      ) {
        this.audio.init();
        this._safeRequestPointerLock(this.renderer.domElement);
        if (this.peeringDoor) {
          this._exitDoorPeer();
        } else if (!this.isSeated && this.hoveredInteractable) {
          this._triggerCurrentInteractable();
        }
      }
    });

    window.addEventListener('contextmenu', (e) => {
      if (this.mode === 'playing') e.preventDefault();
    });

    // Mouse-Look (Active ONLY when playing & cursor is hidden!)
    window.addEventListener('mousemove', (e) => {
      if (this.mode !== 'playing' || this._anyDialogOpen() || this.cursorUnlocked) {
        this.lastClientX = e.clientX;
        this.lastClientY = e.clientY;
        return;
      }

      let dx = e.movementX;
      let dy = e.movementY;
      if (document.pointerLockElement !== this.renderer.domElement) {
        if (this.lastClientX !== null && this.lastClientY !== null) {
          dx = e.clientX - this.lastClientX;
          dy = e.clientY - this.lastClientY;
        } else {
          dx = 0;
          dy = 0;
        }
      }
      this.lastClientX = e.clientX;
      this.lastClientY = e.clientY;

      if (!dx && !dy) return;

      if (this.isSeated) {
        this.yaw = Math.max(-1.08, Math.min(1.08, this.yaw - dx * this.mouseSens * 0.72));
        this.pitch = Math.max(-0.52, Math.min(0.45, this.pitch - dy * this.mouseSens * 0.72));
      } else if (this.peeringDoor) {
        this.yaw = Math.max(Math.PI - 0.35, Math.min(Math.PI + 0.35, this.yaw - dx * this.mouseSens * 0.45));
        this.pitch = Math.max(-0.3, Math.min(0.3, this.pitch - dy * this.mouseSens * 0.45));
      } else {
        this.yaw -= dx * this.mouseSens;
        this.pitch = Math.max(-1.38, Math.min(1.38, this.pitch - dy * this.mouseSens));
      }
    });

    // Keyboard Input
    window.addEventListener('keydown', (e) => {
      const code = e.code;
      this.keys.add(code);

      if (code === 'F11') {
        e.preventDefault();
        this._setDisplayMode(!document.fullscreenElement);
        return;
      }

      // [ESC]: Toggle Settings / Pause Menu (with Return to Main Menu option!)
      if ((code === 'Escape' || e.key === 'Escape') && !e.repeat) {
        if (this.dialogSettings.open) {
          if (performance.now() - this._lastSettingsOpenTime >= 220) {
            e.preventDefault();
            this.dialogSettings.close();
          } else {
            e.preventDefault();
          }
          return;
        }
        if (this.mode === 'playing' && !this._anyDialogOpen()) {
          e.preventDefault();
          this.audio.init();
          this._openSettingsModal();
          return;
        }
      }

      if (this._anyDialogOpen() || this.mode !== 'playing') return;
      this.audio.init();

      // Optional [M] quick mute key
      if (code === 'KeyM' && !e.repeat) {
        e.preventDefault();
        const isMuted = this.audio.toggleMute();
        if (this.checkMuteEl) this.checkMuteEl.checked = isMuted;
        return;
      }

      // [Q]: Leave chair (still facing computer!) / Exit door peephole / Sit back down near chair
      if (code === 'KeyQ' && !e.repeat) {
        e.preventDefault();
        if (this.peeringDoor) {
          this._exitDoorPeer();
        } else if (this.isSeated) {
          this._standUpFromDesk();
        } else if (this.playerPos.distanceTo(new THREE.Vector3(0, this.playerPos.y, -1.55)) < 1.05) {
          this._sitAtDesk();
        }
        return;
      }

      // Seated at PC: Spamming [A] and [D] types on mechanical keyboard!
      if (this.isSeated) {
        if ((code === 'KeyA' || code === 'KeyD') && !e.repeat) {
          e.preventDefault();
          this._performADSpamKeystroke(code === 'KeyA' ? 'A' : 'D');
        } else if (code === 'Enter' && !e.repeat && this.terminal.progress >= 100) {
          e.preventDefault();
          this._performADSpamKeystroke('D', true);
        }
        return;
      }

      // Standing 1st-Person Room Exploration
      if (code === 'KeyE' && !e.repeat) {
        e.preventDefault();
        if (this.peeringDoor) {
          this._exitDoorPeer();
        } else if (this.hoveredInteractable) {
          this._triggerCurrentInteractable();
        }
      } else if (code === 'KeyF' && !e.repeat) {
        e.preventDefault();
        this.flashlightOn = !this.flashlightOn;
        this.phoneFlashlight.intensity = this.flashlightOn ? 2.2 : 0;
        this.audio.playLightSwitch(this.flashlightOn, false, this.playerPos);
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'KeyA') this.keycapAEl?.classList.remove('pressed');
      if (e.code === 'KeyD') this.keycapDEl?.classList.remove('pressed');
    });
  }

  _openModal(dialogEl) {
    this.keys.clear();
    this.keycapAEl?.classList.remove('pressed');
    this.keycapDEl?.classList.remove('pressed');
    document.body.classList.remove('cursor-hidden');
    this._safeExitPointerLock();
    if (!dialogEl.open) {
      dialogEl.showModal();
    }
  }

  _anyDialogOpen() {
    return (
      this.dialogStory.open ||
      this.dialogSettings.open ||
      this.dialogCard.open ||
      this.dialogGameOver.open ||
      this.dialogEnding.open
    );
  }

  // =========================================================================
  // GAME FLOW: START NIGHT, RETURN MENU, SIT/STAND, [A]/[D] SPAM, GAME OVER
  // =========================================================================
  startNewNight() {
    if (this._endingModalTimeout) {
      clearTimeout(this._endingModalTimeout);
      this._endingModalTimeout = null;
    }
    this.keys.clear();
    this.mode = 'playing';
    this.titleScreenEl.hidden = true;
    this.hudTopEl.hidden = false;
    this.hudCenterEl.hidden = false;

    this.terminal.progress = 0;
    this.terminal.uploadProgress = 0;
    this.terminal.isUploading = false;
    this.terminal.isSubmitted = false;
    this.terminal.totalCharsTyped = 0;
    this.lastTypedHand = null;
    this.anomalies.reset(this.difficulty);
    this.dialogue.clear();
    this.anomalyHintsEl.innerHTML = '';
    this._lastHintsSig = '';

    const cfg = this.anomalies.getConfig();
    this.hudDiffBadgeEl.textContent = `ĐỘ KHÓ: ${cfg.label}`;

    // Restore night lighting with central warm-yellow pendant lamp ON
    this.scene.background.setHex(0x090c14);
    this.scene.fog.color.setHex(0x10121a);
    this.room.moonSpot.color.setHex(0xdcecff);
    this.room.moonSpot.intensity = 2.9;
    this.room.ambientLight.intensity = 0.72;

    this.room.refs.seatedHung.group.visible = false;
    this.flashlightOn = false;
    this.phoneFlashlight.intensity = 0;

    this._sitAtDesk(true);
    this._setGameplayCursorHidden(true);

    this.dialogue.say(
      `01:00 sáng (Độ khó ${cfg.label})... Spam [A] / [D] chạy đồ án CNPM (24SE1 • VN-UK)! Chú ý đồng hồ đếm ngược từng nhiệm vụ góc phải — hết giờ là mất mạng!`,
      { mood: 'normal', hold: 4.5 }
    );
  }

  returnToTitleMenu() {
    if (this._endingModalTimeout) {
      clearTimeout(this._endingModalTimeout);
      this._endingModalTimeout = null;
    }
    this.keys.clear();
    this.mode = 'title';
    this._setGameplayCursorHidden(false);
    this.hudTopEl.hidden = true;
    this.hudCenterEl.hidden = true;
    this.seatedBarEl.hidden = true;
    this.standingBarEl.hidden = true;
    this.doorVignetteEl.hidden = true;
    this.anomalyHintsEl.innerHTML = '';
    this._lastHintsSig = '';
    this.dialogue.clear();

    this.anomalies.reset(this.difficulty);
    this.scene.background.setHex(0x090c14);
    this.scene.fog.color.setHex(0x10121a);
    this.room.moonSpot.color.setHex(0xdcecff);
    this.room.moonSpot.intensity = 2.9;
    this.room.ambientLight.intensity = 0.72;
    this.room.refs.seatedHung.group.visible = true;

    this.titleScreenEl.hidden = false;
  }

  _sitAtDesk(initial = false) {
    // If player sits down while already holding all 4 collected report papers, automatically stack & resolve them!
    if (
      !initial &&
      this.anomalies.state.papersScattered &&
      this.anomalies.state.papersHeld >= this.anomalies.state.papersTotal
    ) {
      this.anomalies.handleInteract('paper_tray', {});
    }
    this.isSeated = true;
    this.peeringDoor = false;
    this.yaw = 0;
    this.pitch = -0.08;
    this.seatedBarEl.hidden = false;
    this.standingBarEl.hidden = true;
    this.doorVignetteEl.hidden = true;
    this.interactPromptEl.hidden = true;
    this.reticleEl.hidden = true;
    if (!initial) {
      this.audio.playHungSigh();
    }
  }

  /**
   * Requirement 1: Leaving the chair ([Q]) keeps facing FORWARD toward the computer!
   */
  _standUpFromDesk() {
    this.isSeated = false;
    this.peeringDoor = false;
    this.playerPos.set(0, 1.56, -1.28);
    // Keep facing forward toward the computer monitor (North, yaw ~ 0) instead of turning 180° behind!
    this.yaw = Math.max(-0.55, Math.min(0.55, this.yaw));
    this.pitch = -0.18;
    this.seatedBarEl.hidden = true;
    this.standingBarEl.hidden = false;
    this.reticleEl.hidden = false;
    if (!this.cursorUnlocked) {
      this._safeRequestPointerLock(this.renderer.domElement);
    }
  }

  _performADSpamKeystroke(hand, isEnterSubmit = false) {
    this.audio.playKeyClick(isEnterSubmit);
    this.keyPressAnimTimer = 0.08;

    if (hand === 'A') {
      this.leftHandTap = 1.0;
      this.keycapAEl?.classList.add('pressed');
    } else {
      this.rightHandTap = 1.0;
      this.keycapDEl?.classList.add('pressed');
    }

    const alternatedHand = this.lastTypedHand !== null && this.lastTypedHand !== hand;
    this.lastTypedHand = hand;
    const cfg = this.anomalies.getConfig();

    const res = this.terminal.handleKeyStroke({
      ...this.anomalies.state,
      alternatedHand,
      typeGain: cfg.typeGain
    });

    if (!res.advanced && res.blockedReason) {
      this.screenShake = 0.16;
      this.dialogue.say(res.blockedReason, { mood: 'scared', interrupt: true, hold: 3.0 });
    }
  }

  _enterDoorPeer() {
    this.peeringDoor = true;
    this.anomalies.state.peeringDoor = true;
    this.doorVignetteEl.hidden = false;
    this.standingBarEl.hidden = true;
    this.yaw = Math.PI;
    this.pitch = -0.02;

    this.anomalies.onDoorPeered({
      onScreenShake: (amt) => {
        this.screenShake = Math.max(this.screenShake, amt);
        this.postMat.uniforms.uGlitchBurst.value = 0.65;
      }
    });
  }

  _exitDoorPeer() {
    this.peeringDoor = false;
    this.anomalies.state.peeringDoor = false;
    this.doorVignetteEl.hidden = true;
    this.standingBarEl.hidden = false;
    this.playerPos.set(-1.45, 1.56, 2.46);
    // If an entity just rattled open the lock, aim directly at the deadbolt (-1.22, 1.12, 3.02) so [E] Lock is immediate!
    if (this.anomalies.state.doorKnocking && this.anomalies.state.doorHasEntity && !this.anomalies.state.doorLocked) {
      this.yaw = Math.PI + 0.39;
      this.pitch = -0.60;
    } else {
      this.yaw = Math.PI;
      this.pitch = -0.05;
    }
  }

  _triggerCurrentInteractable() {
    if (!this.hoveredInteractable) return;
    const id = this.hoveredInteractable.userData.interactId;

    if (id === 'seat_pc') {
      this._sitAtDesk();
      return;
    }

    this.anomalies.handleInteract(id, {
      onToggleDoorPeer: () => {
        if (this.peeringDoor) this._exitDoorPeer();
        else this._enterDoorPeer();
      },
      onSpawnApparition: () => this._spawnRoomApparition(),
      onOpenCardModal: () => {
        this._openModal(this.dialogCard);
      }
    });
  }

  _spawnRoomApparition() {
    this.apparitionEntity.group.position.set(0.0, 0, 0.2);
    this.apparitionEntity.group.lookAt(this.playerPos.x, 0, this.playerPos.z);
    this.apparitionEntity.group.visible = true;
    this.apparitionTimer = 0.44;
    this.audio.playHorrorStinger(0.85);
    this.postMat.uniforms.uGlitchBurst.value = 0.75;
    this.screenShake = 0.35;
  }

  /**
   * Requirement 4: Failing to finish a task before its timer runs out -> Jumpscare + Game Over!
   */
  _triggerTaskFailedGameOver(failedType, reasonText) {
    if (this.mode !== 'playing') return;
    this.mode = 'jumpscare_gameover';
    this.pendingFailureReason = reasonText;

    this.peeringDoor = false;
    this.anomalies.state.peeringDoor = false;
    this.doorVignetteEl.hidden = true;
    this.seatedBarEl.hidden = true;
    this.standingBarEl.hidden = true;
    this.interactPromptEl.hidden = true;
    this.dialogue.clear();

    this.jumpscareEntity.group.visible = true;
    this.jumpscareTimer = 1.25;
    this.screenShake = 1.0;
    this.postMat.uniforms.uGlitchBurst.value = 1.0;
    this.postMat.uniforms.uRedFlash.value = 0.9;
    this.audio.playJumpscareScream();
  }

  _showGameOverModal() {
    this.mode = 'gameover';
    this.jumpscareEntity.group.visible = false;
    this.jumpscareLight.intensity = 0;
    this.hudTopEl.hidden = true;
    this.hudCenterEl.hidden = true;

    // Restore normal mouse cursor so player can click Retry / Menu!
    this._setGameplayCursorHidden(false);

    const cfg = this.anomalies.getConfig();
    document.getElementById('gameover-reason').textContent = this.pendingFailureReason;
    document.getElementById('go-stat-diff').textContent = cfg.label;
    document.getElementById('go-stat-progress').textContent = `${Math.floor(this.terminal.progress)}%`;
    document.getElementById('go-stat-resolved').textContent = String(this.anomalies.resolvedCount);

    this.dialogGameOver.showModal();
  }

  _triggerDawnEnding() {
    this.mode = 'ending';
    this._setGameplayCursorHidden(false);

    this.anomalies.active.clear();
    this.anomalies.state.tension = 0;
    this.anomalies.state.lightsOn = true;
    this.anomalies.state.windowOpen = false;
    this.anomalies.state.mirrorCursed = false;
    this.anomalies.state.wardrobeOpen = false;
    this.anomalies.state.routerDown = false;
    this.anomalies.state.phoneRinging = false;
    this.room.refs.doorEntity.group.visible = false;
    this.room.refs.windowEntity.group.visible = false;

    this.scene.background.setHex(0x18263e);
    this.scene.fog.color.setHex(0x1f2e4a);
    this.room.moonSpot.color.setHex(0xffd8a8);
    this.room.moonSpot.intensity = 4.2;
    this.room.ambientLight.intensity = 0.9;

    this.room.refs.seatedHung.group.visible = true;
    this.hudTopEl.hidden = true;
    this.hudCenterEl.hidden = true;
    this.seatedBarEl.hidden = true;
    this.standingBarEl.hidden = true;
    this.dialogue.clear();

    this.audio.playSubmitSuccess();

    const cfg = this.anomalies.getConfig();
    document.getElementById('stat-diff').textContent = cfg.label;
    document.getElementById('stat-resolved').textContent = String(this.anomalies.resolvedCount);
    document.getElementById('stat-typed').textContent = String(this.terminal.totalCharsTyped);

    this._endingModalTimeout = setTimeout(() => {
      if (this.mode === 'ending') {
        this.dialogEnding.showModal();
      }
    }, 1800);
  }

  // =========================================================================
  // MOVEMENT, COLLISION & RAYCASTING
  // =========================================================================
  _updatePlayerMovement(dt) {
    if (this.keys.has('KeyJ')) this.yaw += dt * 1.95;
    if (this.keys.has('KeyL')) this.yaw -= dt * 1.95;

    if (this.isSeated) {
      const targetPos = new THREE.Vector3(0, 1.15, -1.91);
      this.camera.position.lerp(targetPos, Math.min(1, dt * 10));
      const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
      this.camera.quaternion.setFromEuler(euler);
      return false;
    }

    if (this.peeringDoor) {
      const peerPos = new THREE.Vector3(-1.45, 1.59, 2.94);
      this.camera.position.lerp(peerPos, Math.min(1, dt * 14));
      const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
      this.camera.quaternion.setFromEuler(euler);
      return false;
    }

    let moveForward = 0;
    let moveRight = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) moveForward += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) moveForward -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) moveRight += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) moveRight -= 1;

    const isMoving = moveForward !== 0 || moveRight !== 0;
    if (isMoving) {
      const len = Math.hypot(moveForward, moveRight);
      moveForward /= len;
      moveRight /= len;

      const speed = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 2.8 : 2.1;
      const sinY = Math.sin(this.yaw);
      const cosY = Math.cos(this.yaw);

      const dx = (-sinY * moveForward + cosY * moveRight) * speed * dt;
      const dz = (-cosY * moveForward - sinY * moveRight) * speed * dt;

      const tryX = this.playerPos.x + dx;
      if (!this._collides(tryX, this.playerPos.z)) {
        this.playerPos.x = tryX;
      }
      const tryZ = this.playerPos.z + dz;
      if (!this._collides(this.playerPos.x, tryZ)) {
        this.playerPos.z = tryZ;
      }

      this.headBobTimer += dt * (speed * 4.4);
      this.footstepTimer -= dt;
      if (this.footstepTimer <= 0) {
        this.footstepTimer = speed > 2.4 ? 0.36 : 0.48;
        this.audio.playFootstep();
      }
    }

    const bobY = isMoving ? Math.sin(this.headBobTimer) * 0.032 : 0;
    this.camera.position.set(this.playerPos.x, this.playerPos.y + bobY, this.playerPos.z);
    const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(euler);
    return isMoving;
  }

  _collides(x, z) {
    const r = 0.28;
    if (x < -2.8 + r || x > 2.8 - r || z < -3.1 + r || z > 3.1 - r) {
      return true;
    }
    for (const box of this.room.colliders) {
      if (x + r > box.minX && x - r < box.maxX && z + r > box.minZ && z - r < box.maxZ) {
        return true;
      }
    }
    return false;
  }

  _updateInteractionRaycast() {
    if (this.isSeated || this.peeringDoor || this.mode !== 'playing') {
      this.hoveredInteractable = null;
      this.reticleEl.classList.remove('active');
      this.interactPromptEl.hidden = true;
      return;
    }

    this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
    const visibleTargets = this.room.interactables.filter((m) => {
      if (m.userData.interactId?.startsWith('pickup_paper_')) {
        return m.userData.linkedPaperMesh ? m.userData.linkedPaperMesh.visible : m.visible;
      }
      return true;
    });

    const hits = this.raycaster.intersectObjects(visibleTargets, false).filter((h) => {
      const horizDist = Math.hypot(h.point.x - this.playerPos.x, h.point.z - this.playerPos.z);
      const maxH = h.object.userData.maxHorizDist ?? 0.92;
      return horizDist <= maxH;
    });
    if (hits.length > 0) {
      const promptState = {
        ...this.anomalies.state,
        isSeated: this.isSeated,
        peeringDoor: this.peeringDoor
      };
      const minDist = hits[0].distance;
      // Filter valid non-empty prompt hits and prefer higher-priority targets near the closest hit
      const validHits = hits
        .map((h) => ({
          hit: h,
          label: h.object.userData.getPrompt ? h.object.userData.getPrompt(promptState) : '',
          prio: h.object.userData.priority || 1
        }))
        .filter((item) => Boolean(item.label));

      if (validHits.length > 0) {
        validHits.sort((a, b) => {
          const nearA = a.hit.distance <= minDist + 0.48 ? 1 : 0;
          const nearB = b.hit.distance <= minDist + 0.48 ? 1 : 0;
          if (nearA !== nearB) return nearB - nearA;
          if (b.prio !== a.prio) return b.prio - a.prio;
          return a.hit.distance - b.hit.distance;
        });

        const best = validHits[0];
        this.hoveredInteractable = best.hit.object;
        this.reticleEl.classList.add('active');
        this.interactPromptEl.textContent = best.label;
        this.interactPromptEl.hidden = false;
        return;
      }
    }

    this.hoveredInteractable = null;
    this.reticleEl.classList.remove('active');
    this.interactPromptEl.hidden = true;
  }

  // =========================================================================
  // MAIN ANIMATION LOOP
  // =========================================================================
  _animate() {
    requestAnimationFrame(this._animate);

    const rawDt = this.clock.getDelta();
    const dt = document.hidden ? 0 : Math.min(0.05, rawDt);
    this.elapsedTime += dt;

    let isMoving = false;

    if (this.mode === 'title' || this.mode === 'gameover') {
      this.room.refs.seatedHung.group.visible = true;
      const swayX = Math.sin(this.elapsedTime * 0.45) * 0.12;
      const swayZ = Math.cos(this.elapsedTime * 0.35) * 0.08;
      this.camera.position.set(0.68 + swayX, 1.32, -2.46 + swayZ);
      this.camera.lookAt(-0.52, 1.16, -1.78);
    } else if (this.mode === 'ending') {
      const sway = Math.sin(this.elapsedTime * 0.3) * 0.14;
      this.camera.position.set(1.05 + sway, 1.34, -2.32);
      this.camera.lookAt(-0.15, 1.15, -1.92);
    } else if (this.mode === 'jumpscare_gameover') {
      this.jumpscareTimer -= dt;
      this.jumpscareLight.intensity = Math.floor(this.elapsedTime * 28) % 2 === 0 ? 4.8 : 0.6;
      this.jumpscareEntity.group.position.set(
        (Math.random() - 0.5) * 0.05,
        -1.60 + (Math.random() - 0.5) * 0.04,
        -0.44 + Math.sin(this.elapsedTime * 45) * 0.03
      );
      this.jumpscareEntity.headPivot.rotation.z = (Math.random() - 0.5) * 0.55;

      if (this.jumpscareTimer <= 0) {
        this._showGameOverModal();
      }
    } else if (this.mode === 'playing') {
      // Pause task countdowns while player is reading Story or adjusting Settings modal!
      const effectiveDt = this._anyDialogOpen() ? 0 : dt;

      isMoving = this._updatePlayerMovement(effectiveDt);
      this._updateInteractionRaycast();

      if (effectiveDt > 0) {
        this.anomalies.update(
          effectiveDt,
          this.terminal.progress,
          this.terminal.isUploading,
          (failedType, reason) => this._triggerTaskFailedGameOver(failedType, reason)
        );
      }

      if (this.terminal.isSubmitted) {
        this._triggerDawnEnding();
      }
    }

    // Decay [A]/[D] 1st-person hand tap & 3D keyboard bounce
    this.leftHandTap = Math.max(0, this.leftHandTap - dt * 11.0);
    this.rightHandTap = Math.max(0, this.rightHandTap - dt * 11.0);
    if (this.keyPressAnimTimer > 0) {
      this.keyPressAnimTimer = Math.max(0, this.keyPressAnimTimer - dt);
      this.room.refs.keyboardMesh.position.y = 0.783;
    } else {
      this.room.refs.keyboardMesh.position.y = 0.786;
    }

    if (this.apparitionTimer > 0) {
      this.apparitionTimer -= dt;
      if (this.apparitionTimer <= 0) {
        this.apparitionEntity.group.visible = false;
      }
    }

    if (this.screenShake > 0) {
      this.camera.rotation.z = (Math.random() - 0.5) * 0.09 * this.screenShake;
      this.screenShake = Math.max(0, this.screenShake - dt * 1.8);
      if (this.screenShake <= 0 && this.mode === 'playing') {
        this.camera.rotation.z = 0;
      }
    }

    this.postMat.uniforms.uTime.value = this.elapsedTime;
    this.postMat.uniforms.uHorrorIntensity.value = this.anomalies.state.tension;
    this.postMat.uniforms.uGlitchBurst.value = Math.max(
      0,
      this.postMat.uniforms.uGlitchBurst.value - dt * 1.8
    );
    this.postMat.uniforms.uRedFlash.value = Math.max(
      0,
      this.postMat.uniforms.uRedFlash.value - dt * 1.5
    );

    const cfg = this.anomalies.getConfig();
    const clockText = this.anomalies.getClockText(this.terminal.progress);
    const fullState = {
      ...this.anomalies.state,
      isSeated: this.isSeated || this.mode === 'title' || this.mode === 'ending' || this.mode === 'gameover',
      showSeatedHands: this.mode === 'playing' && this.isSeated,
      leftHandTap: this.leftHandTap,
      rightHandTap: this.rightHandTap,
      uploadRate: cfg.uploadRate,
      clockText
    };

    this.terminal.update(this._anyDialogOpen() ? 0 : dt, fullState);
    this.room.update(dt, this.elapsedTime, fullState, this.playerPos, this.yaw, isMoving);
    this.dialogue.update(dt);
    this.audio.updateListener(this.camera);
    this.audio.updateAtmosphere(dt, this.anomalies.state.tension, this.anomalies.state.windowOpen);

    if (this.mode === 'playing') {
      this._syncHUD(clockText);
    }

    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCamera);
  }

  _syncHUD(clockText) {
    this.hudClockEl.textContent = `REC • ${clockText}`;
    const pct = this.terminal.isUploading
      ? Math.floor(this.terminal.uploadProgress)
      : Math.floor(this.terminal.progress);

    this.hudProgressLabelEl.textContent =
      this.terminal.progress >= 100
        ? `ĐANG NỘP LÊN CỔNG VN-UK: ${pct}%`
        : `TIẾN ĐỘ ĐỒ ÁN & BÁO CÁO: ${pct}%`;

    this.hudProgressTrackEl.style.setProperty('--progress-pct', `${pct}%`);

    // Render Timed Supernatural Tasks!
    const items = this.anomalies.getActiveHints();
    const typesSig = items.map((it) => `${it.type}:${it.text}:${it.urgent ? 1 : 0}`).join('|');

    if (this._lastHintsSig !== typesSig) {
      this._lastHintsSig = typesSig;
      this.anomalyHintsEl.innerHTML = '';
      for (const it of items) {
        const li = document.createElement('li');
        li.dataset.taskType = it.type;
        if (it.urgent) li.classList.add('urgent');

        const topRow = document.createElement('div');
        topRow.className = 'task-row-top';
        const nameSpan = document.createElement('span');
        nameSpan.textContent = it.text;
        const timerSpan = document.createElement('span');
        timerSpan.className = 'task-timer-text';
        timerSpan.textContent = `⏱ ${it.remaining.toFixed(1)}s`;
        topRow.append(nameSpan, timerSpan);

        const track = document.createElement('div');
        track.className = 'task-timer-track';
        const fill = document.createElement('div');
        fill.className = 'task-timer-fill';
        track.appendChild(fill);

        li.append(topRow, track);
        this.anomalyHintsEl.appendChild(li);
      }
    }

    // Smoothly update countdown numbers & timer bars every frame without recreating DOM nodes!
    const liNodes = this.anomalyHintsEl.children;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const li = liNodes[i];
      if (!li) continue;
      const timerEl = li.querySelector('.task-timer-text');
      const fillEl = li.querySelector('.task-timer-fill');
      if (timerEl) timerEl.textContent = `⏱ ${it.remaining.toFixed(1)}s`;
      if (fillEl) {
        const ratioPct = Math.max(0, Math.min(100, (it.remaining / it.duration) * 100));
        fillEl.style.setProperty('--task-pct', `${ratioPct.toFixed(1)}%`);
      }
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.__hungGame = new HungDeadlineGame();
});
