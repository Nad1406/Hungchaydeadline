export const DIFFICULTY_CONFIGS = {
  easy: {
    id: 'easy',
    label: 'DỄ',
    baseTaskLimit: 30,
    paperBonusTime: 8,
    doorBonusTime: 4,
    initialDelay: 8.0,
    spawnInterval: [10.0, 13.5],
    maxConcurrentEarly: 1,
    maxConcurrentMid: 2,
    maxConcurrentLate: 2,
    typeGain: 0.86,
    uploadRate: 8.2
  },
  normal: {
    id: 'normal',
    label: 'VỪA',
    baseTaskLimit: 21,
    paperBonusTime: 7,
    doorBonusTime: 3,
    initialDelay: 5.8,
    spawnInterval: [6.8, 9.6],
    maxConcurrentEarly: 2,
    maxConcurrentMid: 2,
    maxConcurrentLate: 3,
    typeGain: 0.65,
    uploadRate: 6.0
  },
  hard: {
    id: 'hard',
    label: 'KHÓ',
    baseTaskLimit: 14,
    paperBonusTime: 6,
    doorBonusTime: 3,
    initialDelay: 3.8,
    spawnInterval: [4.4, 6.6],
    maxConcurrentEarly: 2,
    maxConcurrentMid: 3,
    maxConcurrentLate: 4,
    typeGain: 0.48,
    uploadRate: 4.4
  }
};

const FAILURE_REASONS = {
  papers:
    'Bạn đã không kịp nhặt và xếp lại xấp bản thảo báo cáo. Từng trang giấy nhuốm đỏ tự bốc cháy ngay dưới chân bàn, nhấn chìm tâm trí Hưng vào bóng tối!',
  door:
    'Bạn đã không kịp kiểm tra và khoá chốt cửa chính. Cánh cửa phòng 404 bật mở toang — kẻ mang gương mặt trắng bệch ngoài hành lang đã bước thẳng vào sau lưng bạn!',
  lights:
    'Căn phòng chìm trong bóng tối quá lâu mà không được bật lại đèn. Tiếng thở lạnh buốt từ bốn bức tường ập tới nuốt chửng Nguyễn Tuấn Hưng!',
  window:
    'Bạn đã để cửa sổ mở toang quá lâu trong cơn gió lạnh. Cái bóng cao nghều ngoài lan can đối diện đã trèo qua song sắt vào trong phòng!',
  mirror:
    'Bạn đã không kịp lau gương định thần. Bản thể biến dạng của Hưng trong tấm gương đã vươn tay xuyên qua mặt kính kéo bạn vào bên trong!',
  wardrobe:
    'Cánh tủ quần áo không được đóng lại kịp thời. Thứ ẩn nấp cùng đôi mắt đỏ ngầu bên trong đã lao vọt ra khỏi tủ!',
  poster:
    'Khung chứng nhận VN-UK treo ngược rỉ ra vệt bóng đen lan khắp bức tường trước mặt, bóp nghẹt sự tỉnh táo cuối cùng của Hưng!',
  phone:
    'Cuộc gọi lúc 3 giờ sáng từ chính số "NGUYỄN TUẤN HƯNG" tự động bắt máy — tiếng thét chói tai từ loa điện thoại làm tim Hưng ngừng đập!',
  router:
    'Mất kết nối quá lâu không được khởi động lại, phiên nộp bài trên cổng VN-UK tự động khoá vĩnh viễn và thực thể trong phòng lập tức lao tới!'
};

export class AnomalyManager {
  constructor(room, audio, dialogue, terminal) {
    this.room = room;
    this.audio = audio;
    this.dialogue = dialogue;
    this.terminal = terminal;
    this.difficulty = 'normal';

    this.reset('normal');
  }

  setDifficulty(diffId) {
    if (!DIFFICULTY_CONFIGS[diffId] || this.difficulty === diffId) return;
    this.difficulty = diffId;
    // Proportionally rescale any active task timers so mid-game difficulty switching stays fair!
    if (this.active && this.active.size > 0) {
      for (const [type, timerInfo] of this.active.entries()) {
        const newDur = this._getTaskDuration(type);
        const ratio = Math.max(0.05, Math.min(1.0, timerInfo.remaining / timerInfo.duration));
        timerInfo.duration = newDur;
        timerInfo.remaining = ratio * newDur;
      }
    }
  }

  getConfig() {
    return DIFFICULTY_CONFIGS[this.difficulty] || DIFFICULTY_CONFIGS.normal;
  }

  reset(diffId = this.difficulty) {
    if (diffId && DIFFICULTY_CONFIGS[diffId]) {
      this.difficulty = diffId;
    }
    const cfg = this.getConfig();

    // Map<type, { remaining: number, duration: number }>
    this.active = new Map();

    this.state = {
      papersScattered: false,
      papersHeld: 0,
      papersTotal: 4,

      doorKnocking: false,
      doorHasEntity: false,
      doorInspected: false,
      doorLocked: true,
      peeringDoor: false,

      lightsOn: true,
      windowOpen: false,
      windowEntityPresent: false,
      mirrorCursed: false,
      wardrobeOpen: false,
      posterInverted: false,
      phoneRinging: false,
      routerDown: false,

      tension: 0, // 0..1 driven by closest-to-expiring task timer!
      activeCount: 0,
      hasBehindThreat: false
    };

    // Stats for Ending / Game Over Report
    this.resolvedCount = 0;
    this.jumpscareCount = 0;

    // Timers
    this.spawnCooldown = cfg.initialDelay;
    this.phoneRingTimer = 0;
    this.doorKnockRepeatTimer = 0;
    this.lightningTimer = 16;
    this.storyBeatsTriggered = new Set();
    this.uploadClimaxTriggered = false;

    // Reset room visual props
    this.room.refs.deskPaperStack.visible = true;
    this.room.refs.scatteredPapers.forEach((p) => {
      p.visible = false;
    });
    this.room.refs.doorEntity.group.visible = false;
    this.room.refs.windowEntity.group.visible = false;
    this.room.refs.mirrorCurseMesh.visible = false;
  }

  getClockText(progress) {
    const totalMinutes = Math.min(179, Math.floor((progress / 100) * 179));
    const hour = 1 + Math.floor(totalMinutes / 60);
    const min = totalMinutes % 60;
    return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')} SA`;
  }

  _getTaskDuration(type) {
    const cfg = this.getConfig();
    if (type === 'papers') return cfg.baseTaskLimit + cfg.paperBonusTime;
    if (type === 'door') return cfg.baseTaskLimit + cfg.doorBonusTime;
    return cfg.baseTaskLimit;
  }

  /**
   * Returns structured active task items with live countdown timers for HUD rendering!
   */
  getActiveHints() {
    const items = [];
    const pushItem = (type, text) => {
      const timerInfo = this.active.get(type);
      if (!timerInfo) return;
      items.push({
        type,
        text,
        remaining: Math.max(0, timerInfo.remaining),
        duration: timerInfo.duration,
        urgent: timerInfo.remaining <= 8.5
      });
    };

    if (this.state.papersScattered && this.active.has('papers')) {
      const label =
        this.state.papersHeld < this.state.papersTotal
          ? `📄 Nhặt bản thảo báo cáo trên sàn (${this.state.papersHeld}/${this.state.papersTotal})`
          : '📄 Đặt lại xấp báo cáo lên khay bàn học';
      pushItem('papers', label);
    }
    if (this.state.doorKnocking && this.active.has('door')) {
      const label =
        this.state.doorInspected && this.state.doorHasEntity && !this.state.doorLocked
          ? '🚪 CÓ NGƯỜI NGOÀI KÍNH! Lùi ra [Q] & KHOÁ CHỐT AN TOÀN!'
          : '🚪 Có tiếng gõ cửa! Lại gần nhìn qua ô kính kiểm tra';
      pushItem('door', label);
    }
    if (!this.state.lightsOn && this.active.has('lights')) {
      pushItem('lights', '💡 Đèn phòng bị dập tắt! Ra bật công tắc cạnh cửa');
    }
    if (this.state.windowOpen && this.active.has('window')) {
      pushItem('window', '🌬 Cửa sổ bật tung! Đóng chặt cửa sổ chắn gió lạnh');
    }
    if (this.state.mirrorCursed && this.active.has('mirror')) {
      pushItem('mirror', '🪞 Bóng trong gương biến dạng! Ra lau gương ngay');
    }
    if (this.state.wardrobeOpen && this.active.has('wardrobe')) {
      pushItem('wardrobe', '🚪 Tủ quần áo hé mở! Ra đóng chặt cánh tủ lại');
    }
    if (this.state.posterInverted && this.active.has('poster')) {
      pushItem('poster', '🖼 Khung bằng VN-UK lộn ngược! Chỉnh thẳng lại');
    }
    if (this.state.phoneRinging && this.active.has('phone')) {
      pushItem('phone', '📱 Điện thoại đầu giường reo! Ra tắt cuộc gọi lạ');
    }
    if (this.state.routerDown && this.active.has('router')) {
      pushItem('router', '📡 Router Wi-Fi mất mạng! Ra kệ sách nhấn Reset');
    }

    return items;
  }

  update(dt, progress, isUploading, onTaskFailedGameOver) {
    const cfg = this.getConfig();
    this.state.activeCount = this.active.size;
    this.state.hasBehindThreat =
      this.state.doorKnocking || this.state.wardrobeOpen || this.state.phoneRinging;

    // 1. Story Milestones & Psychological Horror Messages
    this._checkStoryMilestones(progress, isUploading);

    // 2. Distant Lightning Flash outside East Window
    this.lightningTimer -= dt;
    if (this.lightningTimer <= 0) {
      this.lightningTimer = 18 + Math.random() * 20;
      this.room.lightningLight.intensity = 5.5;
      setTimeout(() => {
        if (this.room.lightningLight) this.room.lightningLight.intensity = 2.5;
      }, 110);
      setTimeout(() => {
        this.audio.playThunder();
      }, 550);
    }
    if (this.room.lightningLight.intensity > 0) {
      this.room.lightningLight.intensity = Math.max(0, this.room.lightningLight.intensity - dt * 14);
    }

    // 3. Repeat audio cues for active anomalies
    if (this.state.phoneRinging) {
      this.phoneRingTimer -= dt;
      if (this.phoneRingTimer <= 0) {
        this.phoneRingTimer = 2.3;
        this.audio.playPhoneRingPulse();
      }
    }

    if (this.state.doorKnocking) {
      this.doorKnockRepeatTimer -= dt;
      if (this.doorKnockRepeatTimer <= 0) {
        this.doorKnockRepeatTimer = 6.0 + Math.random() * 2.5;
        this.audio.playDoorKnock({ x: -1.45, y: 1.45, z: 3.05 }, this.state.doorHasEntity);
      }
    }

    // 4. Tick Per-Task Countdown Timers -> GAME OVER if any task expires!
    if (this.active.size > 0) {
      let maxUrgency = 0;
      for (const [type, timerInfo] of this.active.entries()) {
        timerInfo.remaining -= dt;
        const elapsedRatio = 1.0 - Math.max(0, timerInfo.remaining) / timerInfo.duration;
        if (elapsedRatio > maxUrgency) maxUrgency = elapsedRatio;

        if (timerInfo.remaining <= 0) {
          this.jumpscareCount++;
          const reason =
            FAILURE_REASONS[type] ||
            'Bạn đã không kịp xử lý hiện tượng siêu nhiên đúng thời gian giới hạn!';
          if (onTaskFailedGameOver) {
            onTaskFailedGameOver(type, reason);
          }
          return;
        }
      }
      this.state.tension = Math.min(1.0, maxUrgency);
    } else {
      this.state.tension = Math.max(0, this.state.tension - dt * 0.25);
    }

    // 5. Spawn Supernatural Anomalies dynamically according to Difficulty!
    const maxConcurrent =
      progress < 30
        ? cfg.maxConcurrentEarly
        : progress < 70
          ? cfg.maxConcurrentMid
          : cfg.maxConcurrentLate;

    if (this.active.size < maxConcurrent) {
      this.spawnCooldown -= dt;
      if (this.spawnCooldown <= 0) {
        this._spawnNextAnomaly(progress);
        const [minS, maxS] = cfg.spawnInterval;
        // Slightly faster in final stretch (>75%)
        const lateScale = progress > 75 ? 0.82 : 1.0;
        this.spawnCooldown = (minS + Math.random() * (maxS - minS)) * lateScale;
      }
    }
  }

  _checkStoryMilestones(progress, isUploading) {
    if (progress >= 4 && !this.storyBeatsTriggered.has('m0')) {
      this.storyBeatsTriggered.add('m0');
      this.terminal.showMonitorPopup(
        'Minh Khoa (Lớp 24SE1 - VN-UK)',
        'Hưng ơi còn thức không? Nhớ nộp đồ án CNPM trước 4h sáng nhé, nghe đồn khu trọ mày đêm mưa hay có biến lắm...',
        false
      );
    }

    if (progress >= 25 && !this.storyBeatsTriggered.has('m25')) {
      this.storyBeatsTriggered.add('m25');
      this.dialogue.say(
        '02:00 sáng rồi... Xong 25% đồ án Công nghệ phần mềm. Phải chú ý thời gian xử lý từng hiện tượng lạ!',
        { mood: 'tired' }
      );
      this.terminal.showMonitorPopup(
        'Hệ thống LMS VN-UK (24SE1)',
        'Nhắc nhở tự động: Còn 2 tiếng trước khi cổng nộp Đồ Án chuyên ngành Công nghệ phần mềm tự động đóng.',
        false
      );
    }

    if (progress >= 55 && !this.storyBeatsTriggered.has('m55')) {
      this.storyBeatsTriggered.add('m55');
      this.terminal.triggerWebcamHorrorGlitch(0.9);
      this.audio.playWhisper({ x: 0.2, y: 1.4, z: -1.3 });
      this.terminal.showMonitorPopup(
        'NguyenTuanHung_2006 (Tài khoản của bạn)',
        'SAO MÀY VẪN CÒN NGỒI TRÊN GHẾ CỦA TAO HẢ HƯNG? NHÌN RA SAU LƯNG ĐI.',
        true
      );
      this.dialogue.say(
        'Cái gì vậy?! Ai vừa dùng chính tài khoản VN-UK của mình nhắn tin thế này?!',
        { mood: 'scared', interrupt: true }
      );
    }

    if (progress >= 85 && !this.storyBeatsTriggered.has('m85')) {
      this.storyBeatsTriggered.add('m85');
      this.terminal.triggerWebcamHorrorGlitch(1.1);
      this.dialogue.say(
        '03:35 sáng!! Sắp xong phần Kết luận báo cáo rồi... Cố trụ vững thêm chút nữa thôi Tuấn Hưng!',
        { mood: 'scared', interrupt: true }
      );
    }

    if (isUploading && !this.uploadClimaxTriggered) {
      this.uploadClimaxTriggered = true;
      this.dialogue.say(
        'ĐANG TẢI ĐỒ ÁN LÊN CỔNG VN-UK! Xử lý nhanh sự cố mạng trước khi hết giờ!!',
        { mood: 'scared', interrupt: true }
      );
      if (!this.active.has('router')) {
        this.triggerAnomaly('router');
      }
      if (this.difficulty !== 'easy' && !this.active.has('window')) {
        this.triggerAnomaly('window');
      }
    }
  }

  _spawnNextAnomaly(progress) {
    const pool = ['papers', 'door', 'lights', 'window'];
    if (progress >= 15 || this.difficulty === 'hard') pool.push('poster', 'wardrobe');
    if (progress >= 30 || this.difficulty === 'hard') pool.push('mirror', 'phone');
    if (progress >= 48) pool.push('router');

    const candidates = pool.filter((id) => !this.active.has(id));
    if (candidates.length === 0) return;

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    this.triggerAnomaly(chosen);
  }

  triggerAnomaly(type) {
    if (this.active.has(type)) return;
    const duration = this._getTaskDuration(type);
    this.active.set(type, { remaining: duration, duration });

    switch (type) {
      case 'papers': {
        this.state.papersScattered = true;
        this.state.papersHeld = 0;
        this.room.refs.deskPaperStack.visible = false;
        this.room.refs.scatteredPapers.forEach((m) => {
          m.visible = true;
        });
        this.audio.playPaperScatter();
        this.dialogue.say(
          `Xấp bản thảo báo cáo vừa bay tung toé xuống sàn! Nhanh nhặt đủ 4 tờ và xếp lại trong ${duration} giây!`,
          { mood: 'scared' }
        );
        break;
      }

      case 'door': {
        this.state.doorKnocking = true;
        this.state.doorHasEntity = Math.random() < (this.difficulty === 'hard' ? 0.72 : 0.56);
        this.state.doorInspected = false;
        this.state.doorLocked = true; // Never spoil entity presence before peering through glass!
        this.room.refs.doorEntity.group.position.set(-1.45, 0.0, 3.38);
        this.room.refs.doorEntity.group.visible = false;
        this.doorKnockRepeatTimer = 5.2;
        this.audio.playDoorKnock({ x: -1.45, y: 1.45, z: 3.05 }, this.state.doorHasEntity);
        if (this.state.peeringDoor) {
          this.onDoorPeered({});
        } else {
          this.dialogue.say(
            'Cốc... cốc... cốc! Có tiếng gõ cửa chính! Phải lại gần nhìn qua ô kính kiểm tra xem có ai bên ngoài!',
            { mood: 'scared' }
          );
        }
        break;
      }

      case 'lights': {
        this.state.lightsOn = false;
        this.audio.playLightSwitch(false, true);
        this.dialogue.say(
          'Tách! Đèn treo vàng giữa phòng bị dập tắt rồi! Mau qua công tắc cạnh cửa bật sáng lại ngay!',
          { mood: 'tired' }
        );
        break;
      }

      case 'window': {
        this.state.windowOpen = true;
        this.state.windowEntityPresent = Math.random() < 0.75;
        this.audio.playWindowGustOpen();
        this.dialogue.say(
          'Gió lạnh thổi bật tung cửa sổ sắt! Có bóng đen ngoài lan can đang dòm vào — mau đóng cửa sổ lại!',
          { mood: 'scared' }
        );
        break;
      }

      case 'mirror': {
        this.state.mirrorCursed = true;
        this.audio.playMirrorTap();
        this.dialogue.say(
          'Tiếng gõ kính từ gương soi... Bóng phản chiếu của Hưng không cử động giống bạn nữa! Ra lau gương ngay!',
          { mood: 'scared' }
        );
        break;
      }

      case 'wardrobe': {
        this.state.wardrobeOpen = true;
        this.audio.playWoodCreak();
        this.dialogue.say(
          'Kẽo... kẹt... Cánh tủ quần áo tự hé mở cùng đôi mắt đỏ bên trong! Mau chạy tới đóng chặt lại!',
          { mood: 'scared' }
        );
        break;
      }

      case 'poster': {
        this.state.posterInverted = true;
        this.audio.playDoorKnock({ x: 1.52, y: 1.62, z: -3.07 }, false);
        this.audio.playWhisper({ x: 1.52, y: 1.62, z: -2.8 });
        this.dialogue.say(
          'Khung chứng nhận Đồ Án VN-UK vừa lộn ngược 180 độ trên tường! Hãy chỉnh thẳng lại ngay!',
          { mood: 'tired' }
        );
        break;
      }

      case 'phone': {
        this.state.phoneRinging = true;
        this.phoneRingTimer = 0.1;
        this.dialogue.say(
          'Điện thoại đầu giường rung bần bật: Số gọi đến là "NGUYỄN TUẤN HƯNG"?! Ra tắt cuộc gọi ma quái ngay!',
          { mood: 'scared' }
        );
        break;
      }

      case 'router': {
        this.state.routerDown = true;
        this.audio.playLightSwitch(false, true, { x: 2.44, y: 1.48, z: 1.52 });
        this.dialogue.say(
          'Cục phát Wi-Fi trên kệ sách nhấp nháy đỏ mất kết nối rồi! Mau ra nhấn nút Reset trước khi rớt phiên nộp bài!',
          { mood: 'scared' }
        );
        break;
      }
    }
  }

  handleInteract(interactId, callbacks) {
    // 1. Picking up scattered papers (0..3)
    if (interactId.startsWith('pickup_paper_')) {
      const idx = Number(interactId.replace('pickup_paper_', ''));
      const mesh = this.room.refs.scatteredPapers[idx];
      if (mesh && mesh.visible) {
        mesh.visible = false;
        this.state.papersHeld++;
        this.audio.playPaperPickup();

        if (this.state.papersHeld === this.state.papersTotal) {
          const pTimer = this.active.get('papers');
          if (pTimer) {
            pTimer.remaining = Math.min(pTimer.duration, Math.max(pTimer.remaining + 3.5, 7.5));
          }
        }

        if (mesh.userData.isCursedSheet) {
          this.audio.playHorrorStinger(0.55);
          this.dialogue.say(
            'Hả?! Trên tờ báo cáo có dòng chữ máu: "KHÔNG KỊP ĐÂU HƯNG ƠI"... Mau nhặt nốt rồi xếp lại lên bàn!',
            { mood: 'scared', interrupt: true }
          );
        } else if (this.state.papersHeld === this.state.papersTotal) {
          this.dialogue.say(
            'Đã nhặt đủ 4 tờ bản thảo! Mau đem đặt lên khay giấy trên bàn học để hoàn thành nhiệm vụ!',
            { mood: 'normal', interrupt: true }
          );
        }
        return true;
      }
    }

    // 2. Placing papers back onto desk tray
    if (interactId === 'paper_tray') {
      if (this.state.papersScattered && this.state.papersHeld >= this.state.papersTotal) {
        this.state.papersScattered = false;
        this.state.papersHeld = 0;
        this.room.refs.deskPaperStack.visible = true;
        this.audio.playPaperPickup();
        this.audio.playHungSigh();
        this._markResolved('papers');
        this.dialogue.say(
          'Phù... Đã xếp gọn lại xấp báo cáo Đồ án VN-UK kịp giờ! Ngồi xuống tiếp tục chạy deadline thôi!',
          { mood: 'normal', interrupt: true }
        );
        return true;
      } else if (!this.state.papersScattered) {
        this.dialogue.say(
          'Bản thảo báo cáo cuối kỳ VN-UK của Nguyễn Tuấn Hưng (2006). Phải nộp trước 04:00 sáng.',
          { mood: 'normal' }
        );
        return true;
      }
    }

    // 3. Peering through Main Door Glass Window
    if (interactId === 'door_glass') {
      callbacks.onToggleDoorPeer();
      return true;
    }

    // 4. Locking Deadbolt on Main Door (Requires peering through glass first when doorKnocking!)
    if (interactId === 'door_lock') {
      if (this.state.doorKnocking && !this.state.doorInspected) {
        this.dialogue.say(
          'Chốt vẫn đang gài. Phải nhìn qua ô kính cửa chính [E] ra ngoài kiểm tra xem có ai đứng sau cửa không đã!',
          { mood: 'tired', interrupt: true }
        );
        return true;
      }

      if (!this.state.doorLocked) {
        this.state.doorLocked = true;
        this.audio.playLightSwitch(true, false, { x: -1.13, y: 1.15, z: 3.02 });
        if (this.state.doorKnocking && this.state.doorHasEntity) {
          this.audio.playDoorKnock({ x: -1.45, y: 1.45, z: 3.05 }, true);
          this.audio.playHorrorStinger(0.65);
          this.room.refs.doorEntity.group.visible = false;
          this.state.doorKnocking = false;
          this.state.doorHasEntity = false;
          this.state.doorInspected = false;
          this._markResolved('door');
          this.dialogue.say(
            'Cạch! Đã khoá chặt chốt an toàn kịp lúc! Kẻ đứng sau cánh cửa vừa lùi sâu vào bóng tối hành lang rồi...',
            { mood: 'scared', interrupt: true }
          );
        }
        return true;
      } else {
        this.dialogue.say('Chốt an toàn cửa chính đang được gài chặt.', {
          mood: 'normal'
        });
        return true;
      }
    }

    // 5. Light Switch (Integrated with Central Hanging Warm-Yellow Pendant Lamp)
    if (interactId === 'light_switch') {
      if (!this.state.lightsOn) {
        const wasAnomaly = this.active.has('lights');
        this.state.lightsOn = true;
        this.audio.playLightSwitch(true, false);
        this._markResolved('lights');

        if (wasAnomaly && Math.random() < 0.55 && callbacks.onSpawnApparition) {
          callbacks.onSpawnApparition();
          this.dialogue.say(
            'Hộc!! Vừa bật đèn vàng lên... có kẻ mặc đúng chiếc áo đồng phục VN-UK giống hệt mình vừa đứng ngay dưới bóng đèn rồi biến mất!!',
            { mood: 'scared', interrupt: true }
          );
        } else {
          this.audio.playHungSigh();
          this.dialogue.say('Tách! Đèn treo ánh vàng giữa phòng đã sáng trở lại.', {
            mood: 'normal',
            interrupt: true
          });
        }
      } else {
        this.state.lightsOn = false;
        this.audio.playLightSwitch(false, false);
        this.dialogue.say(
          'Tách! Đã tắt đèn treo giữa phòng — nhấn [E] lần nữa nếu muốn bật sáng lại.',
          { mood: 'tired', interrupt: true }
        );
      }
      return true;
    }

    // 6. Window Shut
    if (interactId === 'window') {
      if (this.state.windowOpen) {
        this.state.windowOpen = false;
        this.state.windowEntityPresent = false;
        this.room.refs.windowEntity.group.visible = false;
        this.audio.playLightSwitch(true, false, { x: 2.75, y: 1.5, z: -0.55 });
        this.audio.playHungSigh();
        this._markResolved('window');
        this.dialogue.say('Đã đóng chặt cửa sổ và cài chốt sắt! Cơn gió lạnh buốt đã dừng lại.', {
          mood: 'normal',
          interrupt: true
        });
      } else {
        this.dialogue.say('Ngoài cửa sổ chỉ có ánh trăng trắng lạnh lẽo và mưa đêm Đà Nẵng...', {
          mood: 'tired'
        });
      }
      return true;
    }

    // 7. Mirror Wipe / Inspect
    if (interactId === 'mirror') {
      if (this.state.mirrorCursed) {
        this.state.mirrorCursed = false;
        this.audio.playPaperPickup();
        this.audio.playHorrorStinger(0.5);
        this._markResolved('mirror');
        this.dialogue.say(
          'Đã lau sạch vết máu mờ trên gương kịp lúc! Khuôn mặt phản chiếu đã trở lại bình thường.',
          { mood: 'scared', interrupt: true }
        );
      } else {
        this.dialogue.say(
          'Là mình — Nguyễn Tuấn Hưng, lớp 24SE1 chuyên ngành Công nghệ phần mềm (VN-UK)... Mắt thâm quầng vì chạy deadline.',
          { mood: 'normal' }
        );
      }
      return true;
    }

    // 8. Wardrobe Close
    if (interactId === 'wardrobe') {
      if (this.state.wardrobeOpen) {
        this.state.wardrobeOpen = false;
        this.audio.playDoorKnock({ x: -2.35, y: 1.2, z: 0.92 }, false);
        this._markResolved('wardrobe');
        this.dialogue.say('Rầm! Đã đóng sập cánh tủ quần áo lại kịp thời!', {
          mood: 'scared',
          interrupt: true
        });
      } else {
        this.dialogue.say('Tủ quần áo treo sẵn đồng phục trường VN-UK. Đang đóng kín.', {
          mood: 'normal'
        });
      }
      return true;
    }

    // 9. VN-UK Poster Straighten
    if (interactId === 'vnuk_poster') {
      if (this.state.posterInverted) {
        this.state.posterInverted = false;
        this.audio.playPaperPickup();
        this._markResolved('poster');
        this.dialogue.say('Đã chỉnh thẳng lại khung chứng nhận Đồ Án VN-UK!', {
          mood: 'normal',
          interrupt: true
        });
      } else {
        this.dialogue.say(
          'Chứng nhận Đồ Án VN-UK — Nguyễn Tuấn Hưng (Lớp 24SE1 • Ngành KHMT • CN Công nghệ phần mềm).',
          { mood: 'normal' }
        );
      }
      return true;
    }

    // 10. Smartphone Cursed Call Reject
    if (interactId === 'phone') {
      if (this.state.phoneRinging) {
        this.state.phoneRinging = false;
        this.audio.playLightSwitch(true, false, { x: 0.42, y: 0.58, z: 2.76 });
        this.audio.playWhisper({ x: 0.42, y: 1.1, z: 2.5 });
        this._markResolved('phone');
        this.dialogue.say(
          'Đã dập tắt cuộc gọi lúc 3h sáng... Giọng nói bên kia giống hệt giọng của mình!',
          { mood: 'scared', interrupt: true }
        );
      } else {
        this.dialogue.say('Điện thoại còn 4% pin. Nhóm lớp 24SE1 VN-UK ai cũng đang thức chạy deadline.', {
          mood: 'tired'
        });
      }
      return true;
    }

    // 11. Wi-Fi Router Reboot
    if (interactId === 'router') {
      if (this.state.routerDown) {
        this.state.routerDown = false;
        this.audio.playLightSwitch(true, false, { x: 2.44, y: 1.48, z: 1.52 });
        this._markResolved('router');
        this.dialogue.say('Tít! Đèn Router Wi-Fi xanh trở lại rồi! Về bàn máy tính ngay!', {
          mood: 'normal',
          interrupt: true
        });
      } else {
        this.dialogue.say('Cục phát Wi-Fi vẫn đang xanh đèn ổn định.', { mood: 'normal' });
      }
      return true;
    }

    // 12. Inspect VN-UK Student ID Card on Desk
    if (interactId === 'inspect_card') {
      callbacks.onOpenCardModal();
      return true;
    }

    return false;
  }

  onDoorPeered(callbacks) {
    if (!this.state.doorKnocking) {
      this.dialogue.say('Ngoài hành lang khu trọ vắng tanh, đèn huỳnh quang chập chờn...', {
        mood: 'tired'
      });
      return;
    }

    this.state.doorInspected = true;

    if (this.state.doorHasEntity) {
      this.state.doorLocked = false; // The stranger rattles & pops open the bolt right as you peer through the glass!
      const dTimer = this.active.get('door');
      if (dTimer) {
        dTimer.remaining = Math.max(dTimer.remaining, 7.5);
      }
      this.room.refs.doorEntity.group.position.set(-1.45, 0.0, 3.38);
      this.room.refs.doorEntity.group.visible = true;
      this.audio.playLightSwitch(false, true, { x: -1.18, y: 1.15, z: 3.05 });
      this.audio.playHorrorStinger(0.95);
      this.audio.playHungGasp();
      if (callbacks.onScreenShake) callbacks.onScreenShake(0.45);
      this.dialogue.say(
        'Á!! CÓ NGƯỜI LẠ ÁP SÁT MẶT VÀO Ô KÍNH VÀ VẶN BẬT CHỐT CỬA!! Lùi ra [Q] rồi nhấn [E] KHOÁ CHỐT AN TOÀN ngay!!',
        { mood: 'scared', interrupt: true }
      );
    } else {
      this.audio.playWhisper({ x: -1.45, y: 1.55, z: 3.6 });
      this.state.doorKnocking = false;
      this.state.doorInspected = false;
      this._markResolved('door');
      this.dialogue.say(
        'Đã nhìn qua kính kiểm tra hành lang: không có ai ngoài cửa, chỉ có gió lùa cầu thang. An toàn rồi!',
        { mood: 'tired', interrupt: true }
      );
    }
  }

  _markResolved(type) {
    if (this.active.has(type)) {
      this.active.delete(type);
      this.resolvedCount++;
      this.state.tension = Math.max(0, this.state.tension - 0.4);
    }
  }
}
