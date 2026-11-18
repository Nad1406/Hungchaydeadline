import * as THREE from 'three';

function makeCanvasTex(w, h, drawFn, repeatX = 1, repeatY = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  drawFn(ctx, w, h);

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeatX > 1 || repeatY > 1) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
  }
  return tex;
}

// Deterministic pseudo-random for crisp repeatable pixel grit
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRoomTextures() {
  // 1. Vietnamese student room ceramic tile floor (Gạch men sáng vừa phải để bắt ánh đèn vàng)
  const floor = makeCanvasTex(64, 64, (ctx, w, h) => {
    const rand = mulberry32(101);
    ctx.fillStyle = '#586069';
    ctx.fillRect(0, 0, w, h);
    // Grout lines
    ctx.fillStyle = '#292e36';
    ctx.fillRect(0, 0, w, 2);
    ctx.fillRect(0, 0, 2, h);
    ctx.fillRect(31, 0, 2, h);
    ctx.fillRect(0, 31, w, 2);

    // Subtle pixel mottling & scuffs
    for (let y = 2; y < h; y++) {
      for (let x = 2; x < w; x++) {
        if (x === 31 || x === 32 || y === 31 || y === 32) continue;
        const r = rand();
        if (r < 0.18) {
          ctx.fillStyle = r < 0.08 ? '#495059' : '#666f7a';
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  }, 7, 8);

  // 2. Damp plaster student apartment wall (Tường vôi vàng kem cũ phòng trọ 128x128)
  const wall = makeCanvasTex(128, 128, (ctx, w, h) => {
    const rand = mulberry32(202);
    ctx.fillStyle = '#827e75';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y++) {
      // Damp stain gradient near bottom baseboard
      const damp = y > 98 ? (y - 98) / 30 : y < 14 ? (14 - y) / 28 : 0;
      for (let x = 0; x < w; x++) {
        const n = (rand() - 0.5) * 20 - damp * 32;
        const base = 126 + n;
        const r = Math.max(36, Math.min(168, Math.round(base + 4)));
        const g = Math.max(35, Math.min(164, Math.round(base + 1)));
        const b = Math.max(32, Math.min(156, Math.round(base - 6)));
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    // Subtle vertical crack
    let cx = 44;
    ctx.fillStyle = '#43403a';
    for (let cy = 12; cy < 64; cy++) {
      if (rand() > 0.65) cx += rand() > 0.5 ? 1 : -1;
      ctx.fillRect(cx, cy, 1, 1);
    }
  }, 3, 1);

  // 3. Ceiling acoustic grid (Trần thạch cao 64x64)
  const ceiling = makeCanvasTex(64, 64, (ctx, w, h) => {
    const rand = mulberry32(303);
    ctx.fillStyle = '#686763';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#3f3f3d';
    ctx.fillRect(0, 0, w, 2);
    ctx.fillRect(0, 0, 2, h);
    for (let i = 0; i < 220; i++) {
      ctx.fillStyle = rand() > 0.5 ? '#5c5b57' : '#74736e';
      ctx.fillRect(Math.floor(rand() * w), Math.floor(rand() * h), 2, 2);
    }
  }, 5, 5);

  // 4. Dark aged wood (Bàn học, tủ quần áo, kệ sách)
  const darkWood = makeCanvasTex(64, 64, (ctx, w, h) => {
    const rand = mulberry32(404);
    for (let y = 0; y < h; y++) {
      const grain = Math.sin(y * 0.45) * 8;
      for (let x = 0; x < w; x++) {
        const streak = (rand() - 0.5) * 10 + grain;
        const r = Math.max(20, Math.min(95, Math.round(58 + streak)));
        const g = Math.max(14, Math.min(68, Math.round(37 + streak * 0.65)));
        const b = Math.max(10, Math.min(50, Math.round(25 + streak * 0.45)));
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }, 2, 2);

  // 5. Wardrobe front panel wood with seam & keyhole
  const wardrobeDoor = makeCanvasTex(64, 128, (ctx, w, h) => {
    const rand = mulberry32(505);
    ctx.fillStyle = '#382419';
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        if (rand() < 0.25) {
          ctx.fillStyle = rand() < 0.5 ? '#2e1c13' : '#432c1f';
          ctx.fillRect(x, y, 1, 2);
        }
      }
    }
    ctx.strokeStyle = '#1e120b';
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 8, w - 12, 50);
    ctx.strokeRect(6, 66, w - 12, 52);
  });

  // 6. Main Front Door (Cửa chính phòng 404) with room number plaque
  const frontDoor = makeCanvasTex(96, 192, (ctx, w, h) => {
    const rand = mulberry32(606);
    ctx.fillStyle = '#2d3638';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (rand() < 0.2) {
          ctx.fillStyle = rand() < 0.5 ? '#242c2e' : '#364144';
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    // Recessed lower panel
    ctx.strokeStyle = '#181e20';
    ctx.lineWidth = 3;
    ctx.strokeRect(12, 102, w - 24, 74);
    // "PHÒNG 404" rusty plate
    ctx.fillStyle = '#8b1e24';
    ctx.fillRect(28, 20, 40, 16);
    ctx.strokeStyle = '#d8ccb8';
    ctx.lineWidth = 1;
    ctx.strokeRect(29, 21, 38, 14);
    ctx.fillStyle = '#f2eadc';
    ctx.font = 'bold 9px monospace';
    ctx.fillText('P.404', 34, 31);
  });

  // 7. Report Paper Normal (Bản thảo đồ án VN-UK)
  const reportPaper = makeCanvasTex(64, 88, (ctx, w, h) => {
    ctx.fillStyle = '#e7e3d8';
    ctx.fillRect(0, 0, w, h);
    // VN-UK mini header bar
    ctx.fillStyle = '#1c1b4b';
    ctx.fillRect(6, 6, 24, 4);
    ctx.fillStyle = '#8b0e2a';
    ctx.fillRect(32, 6, 24, 4);
    // Simulated lines of code/report text
    ctx.fillStyle = '#2c2f3a';
    for (let y = 16; y < 78; y += 5) {
      const len = 34 + ((y * 13) % 18);
      ctx.fillRect(8, y, len, 2);
    }
    // Diagram box
    ctx.strokeStyle = '#4a5578';
    ctx.strokeRect(8, 42, 46, 16);
  });

  // 8. Report Paper Cursed Variant (chữ đỏ ma quái trên giấy rơi!)
  const cursedPaper = makeCanvasTex(64, 88, (ctx, w, h) => {
    ctx.fillStyle = '#dcd5c9';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#333';
    for (let y = 14; y < 76; y += 6) {
      ctx.fillRect(8, y, 42, 2);
    }
    ctx.fillStyle = '#9e0b16';
    ctx.font = 'bold 9px monospace';
    ctx.fillText('KHÔNG', 10, 36);
    ctx.fillText('KỊP ĐÂU', 8, 48);
    ctx.fillText('HƯNG ƠI', 8, 60);
  });

  // 9. Bed Mattress / Blanket plaid student pattern
  const blanket = makeCanvasTex(64, 64, (ctx, w, h) => {
    ctx.fillStyle = '#253447';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1b2636';
    for (let i = 0; i < w; i += 8) {
      ctx.fillRect(i, 0, 3, h);
      ctx.fillRect(0, i, w, 3);
    }
    ctx.fillStyle = '#4c232c';
    for (let i = 4; i < w; i += 16) {
      ctx.fillRect(i, 0, 1, h);
      ctx.fillRect(0, i, w, 1);
    }
  }, 2, 3);

  // 10. Mechanical Keyboard pixel texture
  const keyboard = makeCanvasTex(96, 40, (ctx, w, h) => {
    ctx.fillStyle = '#181a20';
    ctx.fillRect(0, 0, w, h);
    // Subtle cyan/purple underglow
    ctx.fillStyle = '#1d3b4f';
    ctx.fillRect(3, 3, w - 6, h - 6);
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 14; col++) {
        if (row === 4 && col >= 4 && col <= 9) {
          // Spacebar
          ctx.fillStyle = '#d4d7de';
          ctx.fillRect(4 + 4 * 6, 4 + row * 7, 35, 5);
          continue;
        }
        ctx.fillStyle = col === 0 || col === 13 ? '#8b0e2a' : '#cfd3dc';
        ctx.fillRect(4 + col * 6, 4 + row * 7, 5, 5);
      }
    }
  });

  // 11. Mirror eerie condensation / bloody fog overlay
  const mirrorCurse = makeCanvasTex(128, 192, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const rand = mulberry32(909);
    // Cold condensation mist
    for (let i = 0; i < 2400; i++) {
      const x = Math.floor(rand() * w);
      const y = Math.floor(rand() * h);
      ctx.fillStyle = `rgba(185, 205, 220, ${0.12 + rand() * 0.22})`;
      ctx.fillRect(x, y, 2, 2);
    }
    // Finger-traced creepy message on foggy glass!
    ctx.fillStyle = 'rgba(135, 12, 22, 0.88)';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('AI ĐANG', 24, 52);
    ctx.fillText('NGỒI CODE', 18, 72);
    ctx.fillText('THẾ HƯNG?', 16, 92);
    // Drip lines
    ctx.fillRect(32, 95, 2, 28);
    ctx.fillRect(78, 95, 2, 38);
  });

  // 12. Wall Calendar (Tháng 11 - Đánh dấu đỏ ngày nộp đồ án VN-UK)
  const calendar = makeCanvasTex(64, 80, (ctx, w, h) => {
    ctx.fillStyle = '#ece8de';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#8b0e2a';
    ctx.fillRect(0, 0, w, 18);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('THÁNG 11', 8, 13);
    ctx.fillStyle = '#2b2d38';
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 6; c++) {
        const px = 6 + c * 9;
        const py = 26 + r * 12;
        if (r === 2 && c === 3) {
          ctx.strokeStyle = '#b80f1f';
          ctx.lineWidth = 2;
          ctx.strokeRect(px - 2, py - 2, 8, 8);
        }
        ctx.fillRect(px, py, 4, 4);
      }
    }
  });

  // 13. Heavy Frosted / Ribbed Door Privacy Glass (Kính mờ đục cửa chính — không thể nhìn xuyên từ xa!)
  const frostedDoorGlass = makeCanvasTex(64, 80, (ctx, w, h) => {
    const rand = mulberry32(1313);
    ctx.fillStyle = '#364246';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y++) {
      const rib = (y % 4 === 0) ? 10 : -4;
      for (let x = 0; x < w; x++) {
        const n = (rand() - 0.5) * 18 + rib;
        const r = Math.max(28, Math.min(92, Math.round(54 + n)));
        const g = Math.max(36, Math.min(104, Math.round(66 + n)));
        const b = Math.max(40, Math.min(108, Math.round(70 + n)));
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  });

  return {
    floor,
    wall,
    ceiling,
    darkWood,
    wardrobeDoor,
    frontDoor,
    frostedDoorGlass,
    reportPaper,
    cursedPaper,
    blanket,
    keyboard,
    mirrorCurse,
    calendar
  };
}
