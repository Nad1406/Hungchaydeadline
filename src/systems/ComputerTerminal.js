import * as THREE from 'three';

const CODE_SCRIPT = [
  '# ĐỒ ÁN CHUYÊN NGÀNH CNPM - NGUYỄN TUẤN HƯNG (2006)',
  '# Lớp: 24SE1 | Ngành: Khoa học máy tính (VN-UK)',
  'import torch',
  'import numpy as np',
  'from vnuk_research import AnomalyDetector',
  '',
  'class CapstoneModel(torch.nn.Module):',
  '    def __init__(self, hidden_dim=256):',
  '        super().__init__()',
  '        self.encoder = torch.nn.Linear(128, hidden_dim)',
  '        self.attn = torch.nn.MultiheadAttention(hidden_dim, 4)',
  '        # Sao trong phòng tự nhiên lạnh thế nhỉ...',
  '        self.classifier = torch.nn.Linear(hidden_dim, 2)',
  '',
  '    def forward(self, signal_stream):',
  '        latents = torch.relu(self.encoder(signal_stream))',
  '        # Tiếng ai thở ngay sau ghế vậy??',
  '        context, _ = self.attn(latents, latents, latents)',
  '        return torch.softmax(self.classifier(context), dim=-1)',
  '',
  'def evaluate_thesis_dataset(loader, model):',
  '    total_acc, loss_sum = 0.0, 0.0',
  '    for batch_x, batch_y in loader:',
  '        preds = model(batch_x)',
  '        total_acc += (preds.argmax(1) == batch_y).sum()',
  '    # Cố lên Hưng ơi, sắp xong phần thực nghiệm rồi!',
  '    return total_acc / len(loader.dataset)',
  '',
  'if __name__ == "__main__":',
  '    detector = CapstoneModel(hidden_dim=512)',
  '    print("[VN-UK] Đang xuất kết quả báo cáo cuối kỳ...")',
  '    # ĐỪNG NHÌN VÀO GƯƠNG LÚC 3 GIỜ SÁNG',
  '    export_pdf("BaoCao_NguyenTuanHung_2006_VNUK.pdf")'
];

const REPORT_SECTIONS = [
  'VIỆN NGHIÊN CỨU & ĐÀO TẠO VIỆT - ANH (VN-UK)',
  'BÁO CÁO ĐỒ ÁN CHUYÊN NGÀNH CÔNG NGHỆ PHẦN MỀM',
  'SV: Nguyễn Tuấn Hưng (2006) | Lớp: 24SE1 - KHMT',
  '--------------------------------------------',
  '1. ĐẶT VẤN ĐỀ & MỤC TIÊU NGHIÊN CỨU:',
  'Xây dựng mô hình phát hiện bất thường thời gian thực',
  'với độ trễ thấp, ứng dụng cho hệ thống giám sát thông minh.',
  '',
  '2. PHƯƠNG PHÁP ĐỀ XUẤT & KIẾN TRÚC MẠNG:',
  'Kết hợp cơ chế tự chú ý đa đầu (Multi-Head Attention)',
  'cùng bộ lọc nhiễu thích nghi trong môi trường thiếu sáng.',
  '',
  '3. KẾT QUẢ THỰC NGHIỆM TRÊN TẬP DỮ LIỆU VN-UK:',
  '- Độ chính xác (Accuracy): 97.84%',
  '- Độ nhạy F1-Score: 0.964 (vượt mục tiêu đề cương)',
  '',
  '4. KẾT LUẬN & HƯỚNG PHÁT TRIỂN:',
  'Hệ thống hoạt động ổn định, sẵn sàng đóng gói nộp bài',
  'trước hạn chót 04:00 SA trên hệ thống LMS VN-UK.'
];

export class ComputerTerminal {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 512;
    this.canvas.height = 340;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.texture.colorSpace = THREE.SRGBColorSpace;

    // Load pixel images for monitor UI (VN-UK logo + Hung webcam portraits)
    this.images = {};
    const loadImg = (key, src) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        this.images[key] = img;
      };
    };
    loadImg('logo', './assets/vnuk_logo.png');
    loadImg('normal', './assets/hung_portrait_normal.png');
    loadImg('tired', './assets/hung_portrait_tired.png');
    loadImg('scared', './assets/hung_portrait_scared.png');
    loadImg('doppel', './assets/hung_portrait_doppel.png');

    // Progress state
    this.progress = 0;          // 0 .. 100 (coding & report writing)
    this.uploadProgress = 0;    // 0 .. 100 (final VN-UK portal upload!)
    this.isUploading = false;
    this.isSubmitted = false;
    this.totalCharsTyped = 0;
    this.totalLinesTyped = 0;

    this.codeFullText = CODE_SCRIPT.join('\n');
    this.reportFullText = REPORT_SECTIONS.join('\n');

    this.webcamGlitchTimer = 0;
    this.cursorBlink = 0;
    this.errorFlash = 0;
    this.popupMessage = null;
    this.popupTimer = 0;
  }

  showMonitorPopup(sender, text, isCreepy = false) {
    this.popupMessage = { sender, text, isCreepy };
    this.popupTimer = 6.5;
  }

  triggerWebcamHorrorGlitch(duration = 0.75) {
    this.webcamGlitchTimer = duration;
  }

  /**
   * Called when seated player presses keys to write code & report!
   * Returns { advanced: boolean, blockedReason: string|null, milestoneReached: number|null }
   */
  handleKeyStroke(anomalyStatus) {
    if (this.isSubmitted) return { advanced: false, blockedReason: null };

    // Check blocking anomalies!
    if (anomalyStatus.papersScattered) {
      this.errorFlash = 1.0;
      return {
        advanced: false,
        blockedReason: 'Bản thảo báo cáo đã rơi tung toé xuống sàn! Hãy đứng dậy [Q] nhặt và xếp lại lên bàn!'
      };
    }

    if (anomalyStatus.routerDown) {
      this.errorFlash = 1.0;
      return {
        advanced: false,
        blockedReason: 'Mất kết nối mạng VN-UK LMS! Hãy ra kệ sách nhấn nút Reset Router Wi-Fi!'
      };
    }

    if (anomalyStatus.activeCount >= 2) {
      this.errorFlash = 1.0;
      return {
        advanced: false,
        blockedReason: 'Quá nhiều hiện tượng quái dị trong phòng! Hưng không thể tập trung — hãy đứng dậy [Q] kiểm tra!'
      };
    }

    // If coding is 100% done, keystroke triggers / boosts final Upload!
    if (this.progress >= 100) {
      if (!this.isUploading) {
        this.isUploading = true;
      }
      this.uploadProgress = Math.min(100, this.uploadProgress + 2.4);
      this.totalCharsTyped++;
      return { advanced: true, blockedReason: null, startedUpload: true };
    }

    // Normal coding progress via spamming [A] / [D] (scaled by chosen Difficulty!)
    const prevMilestone = Math.floor(this.progress / 25);
    const speedMult = anomalyStatus.activeCount === 1 ? 0.42 : 1.0;
    const baseGain = anomalyStatus.typeGain || 0.65;
    const altBonus = anomalyStatus.alternatedHand ? 0.14 : 0.0;
    this.progress = Math.min(100, this.progress + (baseGain + altBonus) * speedMult);
    this.totalCharsTyped++;
    if (this.totalCharsTyped % 18 === 0) this.totalLinesTyped++;

    const newMilestone = Math.floor(this.progress / 25);
    return {
      advanced: true,
      blockedReason: null,
      milestoneReached: newMilestone > prevMilestone ? newMilestone : null
    };
  }

  update(dt, state) {
    this.cursorBlink += dt;
    if (this.webcamGlitchTimer > 0) this.webcamGlitchTimer = Math.max(0, this.webcamGlitchTimer - dt);
    if (this.errorFlash > 0) this.errorFlash = Math.max(0, this.errorFlash - dt * 2.5);
    if (this.popupTimer > 0) {
      this.popupTimer -= dt;
      if (this.popupTimer <= 0) this.popupMessage = null;
    }

    // Passive upload tick once started (if router is alive!)
    if (this.isUploading && !this.isSubmitted && !state.routerDown && !state.papersScattered) {
      const baseRate = state.uploadRate || 8.5;
      const rate = state.activeCount > 0 ? baseRate * 0.42 : baseRate;
      this.uploadProgress = Math.min(100, this.uploadProgress + dt * rate);
      if (this.uploadProgress >= 100) {
        this.isSubmitted = true;
      }
    }

    this._renderScreen(state);
    this.texture.needsUpdate = true;
  }

  _renderScreen(state) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Background OS dark theme
    ctx.fillStyle = state.activeCount >= 2 ? '#1c090e' : '#0d131f';
    ctx.fillRect(0, 0, w, h);

    // Top Header Bar (VN-UK LMS + Clock + Wi-Fi)
    ctx.fillStyle = '#1b1b4b';
    ctx.fillRect(0, 0, w, 38);
    ctx.fillStyle = '#8b0e2a';
    ctx.fillRect(0, 38, w, 4);

    if (this.images.logo) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(8, 5, 48, 28);
      ctx.drawImage(this.images.logo, 10, 7, 44, 24);
    }

    ctx.fillStyle = '#f0f4ff';
    ctx.font = 'bold 12px Consolas, monospace';
    ctx.fillText('VN-UK LMS • NỘP ĐỒ ÁN CN PHẦN MỀM', 64, 17);
    ctx.fillStyle = '#b4c2e8';
    ctx.font = '10px Consolas, monospace';
    ctx.fillText('SV: Nguyễn Tuấn Hưng • Lớp 24SE1 | Hạn: 04:00 SA', 64, 31);

    // Clock & Wi-Fi right side
    ctx.fillStyle = state.routerDown ? '#ff4444' : '#57f287';
    ctx.font = 'bold 11px Consolas, monospace';
    ctx.fillText(state.routerDown ? '✖ MẤT WI-FI' : '● WI-FI OK', 342, 16);
    ctx.fillStyle = '#ffd166';
    ctx.fillText(state.clockText || '01:00 SA', 436, 16);
    ctx.fillStyle = '#ff8585';
    ctx.font = '10px Consolas, monospace';
    ctx.fillText(`Tiến độ: ${Math.floor(this.progress)}%`, 342, 31);

    // If Ready to Upload / Uploading / Submitted -> Show VN-UK Submission Portal Modal!
    if (this.progress >= 100) {
      this._drawUploadPortal(ctx, w, h, state);
    } else {
      this._drawCodingWorkspace(ctx, w, h, state);
    }

    // Live ProctorCam / Webcam Box in bottom-right of monitor ("CAM: HƯNG")
    this._drawWebcamFeed(ctx, w, h, state);

    // Chat / Creepy Message Popup Notification on PC Screen
    if (this.popupMessage) {
      const pm = this.popupMessage;
      ctx.fillStyle = pm.isCreepy ? 'rgba(65, 6, 14, 0.95)' : 'rgba(18, 26, 48, 0.95)';
      ctx.fillRect(14, h - 66, 366, 54);
      ctx.strokeStyle = pm.isCreepy ? '#ff2e43' : '#5c7cfa';
      ctx.lineWidth = 2;
      ctx.strokeRect(14, h - 66, 366, 54);

      ctx.fillStyle = pm.isCreepy ? '#ff6b7a' : '#8ce99a';
      ctx.font = 'bold 11px Consolas, monospace';
      ctx.fillText(`💬 ${pm.sender}:`, 22, h - 48);
      ctx.fillStyle = '#f1f3f5';
      ctx.font = '11px Consolas, monospace';
      ctx.fillText(pm.text.slice(0, 46), 22, h - 31);
      if (pm.text.length > 46) {
        ctx.fillText(pm.text.slice(46, 92), 22, h - 17);
      }
    }

    // Blocking Warning Banner when anomaly prevents coding
    if (state.papersScattered || state.routerDown || state.activeCount >= 2 || this.errorFlash > 0.1) {
      const alpha = 0.78 + Math.sin(this.cursorBlink * 14) * 0.18;
      ctx.fillStyle = `rgba(125, 10, 22, ${alpha})`;
      ctx.fillRect(16, 134, 364, 66);
      ctx.strokeStyle = '#ff4d5e';
      ctx.lineWidth = 2;
      ctx.strokeRect(16, 134, 364, 66);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px Consolas, monospace';
      let msg1 = '⚠ KHÔNG THỂ TẬP TRUNG CHẠY DEADLINE!';
      let msg2 = 'Có hiện tượng siêu nhiên trong phòng! Nhấn [Q] kiểm tra!';
      if (state.papersScattered) {
        msg1 = '⚠ BẢN THẢO BÁO CÁO ĐÃ BAY XUỐNG SÀN!';
        msg2 = 'Nhấn [Q] đứng dậy nhặt đủ giấy & xếp lại lên bàn!';
      } else if (state.routerDown) {
        msg1 = '⚠ MẤT KẾT NỐI CỔNG ĐỒ ÁN VN-UK!';
        msg2 = 'Nhấn [Q] ra kệ sách khởi động lại cục Router Wi-Fi!';
      }
      ctx.fillText(msg1, 26, 159);
      ctx.font = '11px Consolas, monospace';
      ctx.fillStyle = '#ffd8dc';
      ctx.fillText(msg2, 26, 181);
    }
  }

  _drawCodingWorkspace(ctx, w, h, state) {
    // Left Editor Pane: VS Code Python
    ctx.fillStyle = '#111827';
    ctx.fillRect(8, 48, 258, 246);
    ctx.strokeStyle = '#293548';
    ctx.lineWidth = 1;
    ctx.strokeRect(8, 48, 258, 246);

    ctx.fillStyle = '#1f2937';
    ctx.fillRect(8, 48, 258, 18);
    ctx.fillStyle = '#60a5fa';
    ctx.font = 'bold 10px Consolas, monospace';
    ctx.fillText('🐍 capstone_vnuk_hung2006.py', 14, 60);

    const codeChars = Math.floor((this.progress / 100) * this.codeFullText.length);
    const visibleCode = this.codeFullText.slice(0, codeChars);
    const lines = visibleCode.split('\n');
    const startLine = Math.max(0, lines.length - 14);
    const shownLines = lines.slice(startLine);

    ctx.font = '10px Consolas, monospace';
    shownLines.forEach((line, idx) => {
      const y = 80 + idx * 14;
      // Line number
      ctx.fillStyle = '#4b5563';
      ctx.fillText(String(startLine + idx + 1).padStart(2, '0'), 12, y);

      if (line.trim().startsWith('#')) {
        ctx.fillStyle = line.includes('ĐỪNG') || line.includes('thở') ? '#f87171' : '#34d399';
      } else if (line.includes('class ') || line.includes('def ') || line.includes('import ')) {
        ctx.fillStyle = '#c084fc';
      } else {
        ctx.fillStyle = '#e5e7eb';
      }
      ctx.fillText(line.slice(0, 34), 30, y);
    });

    // Blinking block cursor
    if (Math.floor(this.cursorBlink * 3) % 2 === 0) {
      const lastIdx = Math.max(0, shownLines.length - 1);
      const lastLen = (shownLines[lastIdx] || '').slice(0, 34).length;
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(30 + lastLen * 6, 71 + lastIdx * 14, 6, 11);
    }

    // Right Pane: Báo Cáo Đồ Án VN-UK (Word/PDF preview)
    ctx.fillStyle = '#e9ecef';
    ctx.fillRect(272, 48, 232, 162);
    ctx.fillStyle = '#1c1b4b';
    ctx.fillRect(272, 48, 232, 18);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px Consolas, monospace';
    ctx.fillText('📄 BaoCao_TuanHung_VNUK.docx', 278, 60);

    const repChars = Math.floor((this.progress / 100) * this.reportFullText.length);
    const repLines = this.reportFullText.slice(0, repChars).split('\n');
    const repShown = repLines.slice(Math.max(0, repLines.length - 9));
    ctx.font = '9px Consolas, monospace';
    repShown.forEach((rLine, idx) => {
      ctx.fillStyle = idx === 0 ? '#8b0e2a' : '#1f2937';
      ctx.fillText(rLine.slice(0, 36), 278, 78 + idx * 14);
    });

    // Bottom Progress Bar strip
    ctx.fillStyle = '#182235';
    ctx.fillRect(8, 300, 378, 32);
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 10px Consolas, monospace';
    ctx.fillText(
      state.isSeated
        ? '⌨ SPAM NÚT [A] / [D] ĐỂ GÕ PHÍM CHẠY ĐỒ ÁN!'
        : '🪑 Nhấn [E] vào ghế để tiếp tục chạy Deadline',
      16,
      313
    );
    // Bar track
    ctx.fillStyle = '#090d16';
    ctx.fillRect(16, 319, 360, 8);
    ctx.fillStyle = state.activeCount > 0 ? '#f59e0b' : '#38bdf8';
    ctx.fillRect(16, 319, Math.floor(3.6 * this.progress), 8);
  }

  _drawUploadPortal(ctx, w, h, state) {
    ctx.fillStyle = '#11192c';
    ctx.fillRect(16, 54, 368, 272);
    ctx.strokeStyle = this.isSubmitted ? '#4ade80' : '#38bdf8';
    ctx.lineWidth = 2;
    ctx.strokeRect(16, 54, 368, 272);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px Consolas, monospace';
    ctx.fillText('CỔNG NỘP ĐỒ ÁN CHUYÊN NGÀNH VN-UK', 36, 86);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '11px Consolas, monospace';
    ctx.fillText('Tệp đính kèm: NguyenTuanHung_24SE1_CNPM.zip', 36, 114);
    ctx.fillText('Trạng thái kiểm tra đạo văn: HỢP LỆ (100%)', 36, 134);

    if (this.isSubmitted) {
      ctx.fillStyle = '#14532d';
      ctx.fillRect(36, 158, 328, 72);
      ctx.fillStyle = '#86efac';
      ctx.font = 'bold 15px Consolas, monospace';
      ctx.fillText('✔ ĐÃ NỘP ĐỒ ÁN THÀNH CÔNG!', 66, 188);
      ctx.font = '11px Consolas, monospace';
      ctx.fillText('Cơn ác mộng đêm nay đã kết thúc...', 78, 212);
    } else if (!this.isUploading) {
      const pulse = Math.floor(this.cursorBlink * 4) % 2 === 0;
      ctx.fillStyle = pulse ? '#8b0e2a' : '#b91c1c';
      ctx.fillRect(46, 166, 308, 52);
      ctx.strokeStyle = '#fecaca';
      ctx.strokeRect(46, 166, 308, 52);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px Consolas, monospace';
      ctx.fillText('[ SPAM [A] / [D] ĐỂ TẢI & NỘP ĐỒ ÁN NGAY! ]', 48, 197);
    } else {
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 12px Consolas, monospace';
      ctx.fillText(
        `Đang tải lên máy chủ VN-UK... ${Math.floor(this.uploadProgress)}%`,
        46,
        175
      );
      ctx.fillStyle = '#090d16';
      ctx.fillRect(46, 188, 308, 22);
      ctx.fillStyle = state.routerDown ? '#ef4444' : '#22c55e';
      ctx.fillRect(46, 188, Math.floor(3.08 * this.uploadProgress), 22);

      ctx.fillStyle = '#fca5a5';
      ctx.font = '10px Consolas, monospace';
      ctx.fillText('Giữ mạng ổn định & gõ phím liên tục để tăng tốc tải lên!', 38, 232);
    }
  }

  _drawWebcamFeed(ctx, w, h, state) {
    const bx = 394;
    const by = 216;
    const bw = 110;
    const bh = 116;

    ctx.fillStyle = '#05070d';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = this.webcamGlitchTimer > 0 ? '#ef4444' : '#3b4c6b';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, bw, bh);

    // Choose Hung portrait based on state!
    let imgKey = 'normal';
    if (this.webcamGlitchTimer > 0) {
      imgKey = 'doppel';
    } else if (state.activeCount >= 2 || state.tension > 0.65) {
      imgKey = 'scared';
    } else if (this.progress > 35) {
      imgKey = 'tired';
    }

    const portrait = this.images[imgKey];
    if (portrait && state.isSeated) {
      ctx.drawImage(portrait, bx + 3, by + 16, bw - 6, bh - 20);
      // Creepy silhouette behind Hung's chair on webcam when an anomaly lurks behind him!
      if (state.hasBehindThreat && Math.floor(this.cursorBlink * 6) % 3 !== 0) {
        ctx.fillStyle = 'rgba(8, 2, 6, 0.85)';
        ctx.fillRect(bx + 76, by + 24, 24, 52);
        ctx.fillStyle = '#ff2a2a';
        ctx.fillRect(bx + 82, by + 34, 3, 3);
        ctx.fillRect(bx + 91, by + 34, 3, 3);
      }
    } else {
      // Empty chair dark feed when Hung stood up to walk around the room!
      ctx.fillStyle = '#101624';
      ctx.fillRect(bx + 3, by + 16, bw - 6, bh - 20);
      ctx.fillStyle = '#64748b';
      ctx.font = '9px Consolas, monospace';
      ctx.fillText('[GHẾ TRỐNG]', bx + 20, by + 72);
    }

    // Webcam REC header
    ctx.fillStyle = '#111827';
    ctx.fillRect(bx + 2, by + 2, bw - 4, 14);
    ctx.fillStyle = Math.floor(this.cursorBlink * 2) % 2 === 0 ? '#ef4444' : '#7f1d1d';
    ctx.fillRect(bx + 6, by + 6, 6, 6);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 9px Consolas, monospace';
    ctx.fillText('CAM: TUẤN HƯNG', bx + 16, by + 12);
  }
}
