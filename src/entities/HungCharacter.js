import * as THREE from 'three';

function loadPixelTexture(url) {
  const loader = new THREE.TextureLoader();
  const tex = loader.load(url);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Generates a 100% procedural, PNG-free pixel texture for the front of the VN-UK Polo Uniform.
 * Matches the solid 3D navy torso & sleeves to the exact hex (#19233f) so there are zero seams or display glitches.
 */
function createVNUKPoloFrontTexture(isShadow = false) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 336;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const navy = isShadow ? '#0d101b' : '#19233f';
  const navyDark = isShadow ? '#080a12' : '#131b32';
  const navyPlacket = isShadow ? '#111626' : '#1e2a4a';
  const crimson = isShadow ? '#450d12' : '#a6242c';
  const crimsonBright = isShadow ? '#5c141b' : '#c23039';
  const crimsonDark = isShadow ? '#2b070a' : '#73151b';
  const skin = isShadow ? '#1a1c22' : '#c4967c';
  const skinShadow = isShadow ? '#121418' : '#a87b63';
  const logoWhite = isShadow ? '#6e768a' : '#f2f5fc';

  // 1. Seamless VN-UK Navy Polo Base
  ctx.fillStyle = navy;
  ctx.fillRect(0, 0, 256, 336);

  // Subtle game-model waist hem & side contour
  ctx.fillStyle = navyDark;
  ctx.fillRect(0, 324, 256, 12);

  // 2. Clean V-Neck Throat Skin Cutout
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.moveTo(92, 0);
  ctx.lineTo(164, 0);
  ctx.lineTo(128, 78);
  ctx.closePath();
  ctx.fill();

  // Subtle jaw shadow at top of V-neck so 3D neck blends seamlessly
  ctx.fillStyle = skinShadow;
  ctx.beginPath();
  ctx.moveTo(96, 0);
  ctx.lineTo(160, 0);
  ctx.lineTo(148, 20);
  ctx.lineTo(108, 20);
  ctx.closePath();
  ctx.fill();

  // Subtle pixel silver chain curve inside throat V-neck (only on normal Hung)
  if (!isShadow) {
    ctx.strokeStyle = '#d8e0ec';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(106, 34);
    ctx.quadraticCurveTo(128, 56, 150, 34);
    ctx.stroke();
  }

  // 3. Crimson Inner Placket Trim + Navy Button Placket + 2 Red Polo Buttons
  ctx.fillStyle = crimson;
  ctx.beginPath();
  ctx.moveTo(108, 50);
  ctx.lineTo(122, 74);
  ctx.lineTo(122, 162);
  ctx.lineTo(114, 162);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = navyDark;
  ctx.fillRect(116, 74, 26, 92);
  ctx.fillStyle = navyPlacket;
  ctx.fillRect(118, 74, 22, 88);

  // Two crisp Crimson Red Polo Buttons
  const drawButton = (by) => {
    ctx.fillStyle = crimsonDark;
    ctx.fillRect(124, by, 10, 10);
    ctx.fillStyle = crimsonBright;
    ctx.fillRect(125, by + 1, 8, 8);
  };
  drawButton(96);
  drawButton(130);

  // 4. Folded Crimson Red Polo Collar Wings (Left & Right)
  // Collar drop shadows on navy chest
  ctx.fillStyle = navyDark;
  ctx.beginPath();
  ctx.moveTo(54, 30);
  ctx.lineTo(80, 92);
  ctx.lineTo(120, 74);
  ctx.lineTo(92, 4);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(202, 30);
  ctx.lineTo(176, 92);
  ctx.lineTo(136, 74);
  ctx.lineTo(164, 4);
  ctx.closePath();
  ctx.fill();

  // Left Crimson Collar Wing
  ctx.fillStyle = crimson;
  ctx.beginPath();
  ctx.moveTo(64, 0);
  ctx.lineTo(95, 0);
  ctx.lineTo(118, 68);
  ctx.lineTo(78, 84);
  ctx.lineTo(54, 26);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = crimsonBright;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(93, 2);
  ctx.lineTo(116, 67);
  ctx.stroke();

  // Right Crimson Collar Wing
  ctx.fillStyle = crimson;
  ctx.beginPath();
  ctx.moveTo(161, 0);
  ctx.lineTo(192, 0);
  ctx.lineTo(202, 26);
  ctx.lineTo(178, 84);
  ctx.lineTo(138, 68);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = crimsonBright;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(163, 2);
  ctx.lineTo(140, 67);
  ctx.stroke();

  // 5. Crisp Procedural VN-UK Logo on Left Chest (x: 148..232, y: 108..166)
  const lx = 150;
  const ly = 112;

  ctx.fillStyle = logoWhite;
  ctx.font = '900 22px Arial, sans-serif';
  ctx.fillText('VN', lx, ly + 18);
  ctx.fillText('UK', lx + 44, ly + 18);

  // Iconic VN-UK dual opposing triangles between VN and UK
  ctx.fillStyle = isShadow ? '#7a1c24' : '#e02438';
  ctx.beginPath();
  ctx.moveTo(lx + 34, ly + 4);
  ctx.lineTo(lx + 41, ly + 8);
  ctx.lineTo(lx + 34, ly + 12);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = logoWhite;
  ctx.beginPath();
  ctx.moveTo(lx + 42, ly + 10);
  ctx.lineTo(lx + 35, ly + 14);
  ctx.lineTo(lx + 42, ly + 18);
  ctx.closePath();
  ctx.fill();

  // Top & bottom divider lines + stylized pixel subtitle bars ("Institute for Research & Executive Education")
  ctx.fillStyle = logoWhite;
  ctx.fillRect(lx, ly + 23, 78, 2);

  // Clean crisp pixel text lines for subtitle
  const subAlpha = isShadow ? '#5b6375' : '#dce3f2';
  ctx.fillStyle = subAlpha;
  const barsRow1 = [0, 14, 24, 38, 56];
  const lensRow1 = [11, 7, 11, 15, 22];
  for (let i = 0; i < barsRow1.length; i++) {
    ctx.fillRect(lx + barsRow1[i], ly + 29, lensRow1[i], 3);
  }
  const barsRow2 = [0, 9, 29, 44, 58];
  const lensRow2 = [6, 17, 12, 11, 20];
  for (let i = 0; i < barsRow2.length; i++) {
    ctx.fillRect(lx + barsRow2[i], ly + 35, lensRow2[i], 3);
  }

  ctx.fillStyle = logoWhite;
  ctx.fillRect(lx, ly + 42, 78, 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Generates a 100% procedural, PNG-free pixel texture for the back of the VN-UK Polo Uniform
 * (Navy body + folded Crimson Red back collar band).
 */
function createVNUKPoloBackTexture(isShadow = false) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 168;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const navy = isShadow ? '#0d101b' : '#19233f';
  const navyDark = isShadow ? '#080a12' : '#131b32';
  const crimson = isShadow ? '#450d12' : '#a6242c';
  const crimsonDark = isShadow ? '#2b070a' : '#6e141b';

  ctx.fillStyle = navy;
  ctx.fillRect(0, 0, 128, 168);

  ctx.fillStyle = navyDark;
  ctx.fillRect(0, 162, 128, 6);

  // Folded Crimson Back Collar Band at top of shirt back
  ctx.fillStyle = crimson;
  ctx.fillRect(30, 0, 68, 16);
  ctx.fillStyle = crimsonDark;
  ctx.fillRect(30, 16, 68, 3);

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * 3D PSX Character Model of Nguyễn Tuấn Hưng (2006 • Lớp 24SE1 • CN Công nghệ phần mềm • VN-UK)
 * Uses pure 3D geometry & procedural CanvasTexture for the VN-UK Navy/Crimson uniform (zero shirt PNGs!).
 */
export class HungCharacter {
  constructor({ isDoppelganger = false, isShadowEntity = false } = {}) {
    this.group = new THREE.Group();
    this.isDoppelganger = isDoppelganger;
    this.isShadowEntity = isShadowEntity;

    this.normalFaceTex = loadPixelTexture('./assets/hung_face_3d.png');
    this.doppelFaceTex = loadPixelTexture('./assets/hung_doppel_3d.png');

    // Procedural PNG-free VN-UK Polo Uniform textures
    this.shirtFrontTex = createVNUKPoloFrontTexture(isShadowEntity);
    this.shirtBackTex = createVNUKPoloBackTexture(isShadowEntity);

    const skinColor = isShadowEntity ? 0x1a1c22 : 0xc4967c;
    const earColor = isShadowEntity ? 0x15171c : 0xb4866c;
    const hairColor = 0x151318;
    const navyColor = isShadowEntity ? 0x0d101b : 0x19233f;
    const crimsonColor = isShadowEntity ? 0x450d12 : 0xa6242c;

    const baseEmissive = isShadowEntity ? 0.12 : 0.24;

    this.skinMat = new THREE.MeshLambertMaterial({
      color: skinColor,
      emissive: new THREE.Color(skinColor),
      emissiveIntensity: baseEmissive
    });
    this.earMat = new THREE.MeshLambertMaterial({
      color: earColor,
      emissive: new THREE.Color(earColor),
      emissiveIntensity: baseEmissive * 0.9
    });
    this.hairMat = new THREE.MeshLambertMaterial({ color: hairColor });
    this.navyMat = new THREE.MeshLambertMaterial({
      color: navyColor,
      emissive: new THREE.Color(navyColor),
      emissiveIntensity: baseEmissive
    });
    this.crimsonMat = new THREE.MeshLambertMaterial({
      color: crimsonColor,
      emissive: new THREE.Color(crimsonColor),
      emissiveIntensity: baseEmissive
    });
    this.pantsMat = new THREE.MeshLambertMaterial({ color: 0x161922 });
    this.shoeSoleMat = new THREE.MeshLambertMaterial({
      color: isShadowEntity ? 0x22252e : 0xe5e7eb
    });

    this.shirtFrontMat = new THREE.MeshLambertMaterial({
      map: this.shirtFrontTex,
      color: 0xffffff,
      emissive: new THREE.Color(0xffffff),
      emissiveMap: this.shirtFrontTex,
      emissiveIntensity: baseEmissive
    });

    this.shirtBackMat = new THREE.MeshLambertMaterial({
      map: this.shirtBackTex,
      color: 0xffffff,
      emissive: new THREE.Color(0xffffff),
      emissiveMap: this.shirtBackTex,
      emissiveIntensity: baseEmissive
    });

    this.faceFrontMat = new THREE.MeshLambertMaterial({
      map: isDoppelganger || isShadowEntity ? this.doppelFaceTex : this.normalFaceTex,
      emissive: isShadowEntity ? new THREE.Color(0x3a080e) : new THREE.Color(0xffffff),
      emissiveMap: isDoppelganger || isShadowEntity ? this.doppelFaceTex : this.normalFaceTex,
      emissiveIntensity: isShadowEntity ? 0.48 : 0.26
    });

    // Torso Pivot (hip height = 0.88m)
    this.torsoPivot = new THREE.Group();
    this.torsoPivot.position.set(0, 0.88, 0);
    this.group.add(this.torsoPivot);

    // 3D VN-UK Navy & Crimson Polo Torso (all 6 faces share identical #19233f navy base)
    const torsoMaterials = [
      this.navyMat,       // +X left side
      this.navyMat,       // -X right side
      this.navyMat,       // +Y shoulder top
      this.navyMat,       // -Y waist
      this.shirtFrontMat, // +Z procedural VN-UK Polo Front (collar, placket, VN-UK logo)
      this.shirtBackMat   // -Z procedural VN-UK Polo Back
    ];
    const torsoGeo = new THREE.BoxGeometry(0.40, 0.52, 0.21);
    this.torsoMesh = new THREE.Mesh(torsoGeo, torsoMaterials);
    this.torsoMesh.position.set(0, 0.26, 0);
    this.torsoPivot.add(this.torsoMesh);

    // Low-profile 3D Crimson Polo Collar Rim hugging base of neck cleanly on shoulders (never pokes into chin!)
    const collarL = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.022, 0.132), this.crimsonMat);
    collarL.position.set(-0.068, 0.528, -0.006);
    const collarR = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.022, 0.132), this.crimsonMat);
    collarR.position.set(0.068, 0.528, -0.006);
    const collarBack = new THREE.Mesh(new THREE.BoxGeometry(0.162, 0.024, 0.028), this.crimsonMat);
    collarBack.position.set(0, 0.529, -0.064);
    this.torsoPivot.add(collarL, collarR, collarBack);

    // Proportional Neck bridging torso cleanly into head
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.120, 0.076, 0.116), this.skinMat);
    neck.position.set(0, 0.542, 0);
    this.torsoPivot.add(neck);

    // Head Pivot
    this.headPivot = new THREE.Group();
    this.headPivot.position.set(0, 0.562, 0);
    this.torsoPivot.add(this.headPivot);

    // Head Block
    const headMaterials = [
      this.skinMat,
      this.skinMat,
      this.hairMat,
      this.skinMat,
      this.faceFrontMat,
      this.hairMat
    ];
    const headGeo = new THREE.BoxGeometry(0.216, 0.246, 0.214);
    this.headMesh = new THREE.Mesh(headGeo, headMaterials);
    this.headMesh.position.set(0, 0.123, 0);
    this.headPivot.add(this.headMesh);

    // 3D Ears on Left & Right
    const earL = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.054, 0.036), this.earMat);
    earL.position.set(-0.114, 0.122, -0.01);
    const earR = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.054, 0.036), this.earMat);
    earR.position.set(0.114, 0.122, -0.01);
    this.headPivot.add(earL, earR);

    // Delicate 3D Glasses Temple Arms along sides
    const templeMat = new THREE.MeshBasicMaterial({ color: 0x2a2d36 });
    const templeL = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.009, 0.13), templeMat);
    templeL.position.set(-0.111, 0.148, 0.045);
    const templeR = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.009, 0.13), templeMat);
    templeR.position.set(0.111, 0.148, 0.045);
    this.headPivot.add(templeL, templeR);

    // Natural Tapered Parted Curtain Hairstyle
    const hairCrown = new THREE.Mesh(new THREE.BoxGeometry(0.232, 0.052, 0.228), this.hairMat);
    hairCrown.position.set(0, 0.254, -0.006);
    const hairTopSoft = new THREE.Mesh(new THREE.BoxGeometry(0.192, 0.028, 0.192), this.hairMat);
    hairTopSoft.position.set(0, 0.288, -0.01);
    const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.226, 0.21, 0.048), this.hairMat);
    hairBack.position.set(0, 0.155, -0.102);
    const hairNape = new THREE.Mesh(new THREE.BoxGeometry(0.175, 0.065, 0.035), this.hairMat);
    hairNape.position.set(0, 0.035, -0.102);

    const bangL = new THREE.Mesh(new THREE.BoxGeometry(0.098, 0.048, 0.036), this.hairMat);
    bangL.position.set(-0.064, 0.238, 0.104);
    bangL.rotation.z = 0.24;
    const bangR = new THREE.Mesh(new THREE.BoxGeometry(0.104, 0.048, 0.036), this.hairMat);
    bangR.position.set(0.062, 0.240, 0.104);
    bangR.rotation.z = -0.20;

    const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.11, 0.185), this.hairMat);
    sideL.position.set(-0.113, 0.198, -0.008);
    const sideR = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.11, 0.185), this.hairMat);
    sideR.position.set(0.113, 0.198, -0.008);

    this.headPivot.add(hairCrown, hairTopSoft, hairBack, hairNape, bangL, bangR, sideL, sideR);

    // Subtle red glowing horror pinprick pupils aligned directly inside hollow eye sockets
    const eyeGlowMat = new THREE.MeshBasicMaterial({ color: 0xff2424 });
    this.scaryEyes = new THREE.Group();
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.009, 0.008), eyeGlowMat);
    eyeL.position.set(-0.042, 0.160, 0.110);
    const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.009, 0.008), eyeGlowMat);
    eyeR.position.set(0.044, 0.168, 0.110);
    this.scaryEyes.add(eyeL, eyeR);
    this.scaryEyes.visible = isDoppelganger || isShadowEntity;
    this.headPivot.add(this.scaryEyes);

    // Arms (VN-UK Navy Short Sleeves + Crimson Red Cuff Trim + Forearms + 3D Hands)
    this.leftArm = this._buildArm(-0.245, -1);
    this.rightArm = this._buildArm(0.245, +1);
    this.torsoPivot.add(this.leftArm, this.rightArm);

    // Legs & Sneakers
    this.leftLeg = this._buildLeg(-0.10);
    this.rightLeg = this._buildLeg(0.10);
    this.group.add(this.leftLeg, this.rightLeg);

    this.walkPhase = 0;
  }

  _buildArm(xOffset, sideDir) {
    const pivot = new THREE.Group();
    pivot.position.set(xOffset, 0.47, 0);

    // VN-UK Navy Short Sleeve
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.118, 0.175, 0.124), this.navyMat);
    sleeve.position.set(0, -0.075, 0);
    pivot.add(sleeve);

    // Crimson Red Cuff Trim (bo viền đỏ đô tay áo VN-UK)
    const redCuff = new THREE.Mesh(new THREE.BoxGeometry(0.122, 0.028, 0.128), this.crimsonMat);
    redCuff.position.set(0, -0.172, 0);
    pivot.add(redCuff);

    // Forearm
    const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.225, 0.082), this.skinMat);
    forearm.position.set(0, -0.29, 0);
    pivot.add(forearm);

    // 3D Hand + Thumb
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.074, 0.076, 0.044), this.skinMat);
    hand.position.set(0, -0.435, 0.005);
    const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.042, 0.024), this.skinMat);
    thumb.position.set(-sideDir * 0.042, -0.42, 0.022);
    pivot.add(hand, thumb);

    return pivot;
  }

  _buildLeg(xOffset) {
    const pivot = new THREE.Group();
    pivot.position.set(xOffset, 0.88, 0);

    const trouser = new THREE.Mesh(new THREE.BoxGeometry(0.148, 0.80, 0.155), this.pantsMat);
    trouser.position.set(0, -0.40, 0);

    // Student Sneaker (dark upper + crisp white sole)
    const shoeUpper = new THREE.Mesh(new THREE.BoxGeometry(0.150, 0.055, 0.22), this.navyMat);
    shoeUpper.position.set(0, -0.825, 0.03);
    const shoeSole = new THREE.Mesh(new THREE.BoxGeometry(0.154, 0.028, 0.228), this.shoeSoleMat);
    shoeSole.position.set(0, -0.866, 0.03);

    pivot.add(trouser, shoeUpper, shoeSole);
    return pivot;
  }

  setDoppelgangerMode(enabled) {
    this.isDoppelganger = enabled;
    const tex = enabled ? this.doppelFaceTex : this.normalFaceTex;
    this.faceFrontMat.map = tex;
    this.faceFrontMat.emissiveMap = tex;
    this.faceFrontMat.emissive.setHex(enabled ? 0xff9999 : 0xffffff);
    this.faceFrontMat.emissiveIntensity = enabled ? 0.45 : 0.26;
    this.faceFrontMat.needsUpdate = true;
    this.scaryEyes.visible = enabled;
  }

  setSeatedTypingPose(time) {
    this.torsoPivot.position.y = 0.56;
    this.torsoPivot.rotation.x = 0.12 + Math.sin(time * 1.8) * 0.018;

    this.leftLeg.position.y = 0.56;
    this.rightLeg.position.y = 0.56;
    this.leftLeg.rotation.x = -Math.PI * 0.45;
    this.rightLeg.rotation.x = -Math.PI * 0.45;

    this.leftArm.rotation.x = -1.14 + Math.sin(time * 13.0) * 0.065;
    this.rightArm.rotation.x = -1.14 + Math.cos(time * 14.5) * 0.065;
    this.leftArm.rotation.z = 0.10;
    this.rightArm.rotation.z = -0.10;
  }

  setStandingPose(dt, isMoving, time) {
    this.torsoPivot.position.y = 0.88 + Math.sin(time * 2.2) * 0.008;
    this.torsoPivot.rotation.x = 0;
    this.leftLeg.position.y = 0.88;
    this.rightLeg.position.y = 0.88;

    if (isMoving) {
      this.walkPhase += dt * 8.5;
      const swing = Math.sin(this.walkPhase) * 0.42;
      this.leftLeg.rotation.x = swing;
      this.rightLeg.rotation.x = -swing;
      this.leftArm.rotation.x = -swing * 0.7;
      this.rightArm.rotation.x = swing * 0.7;
    } else {
      this.leftLeg.rotation.x *= 0.85;
      this.rightLeg.rotation.x *= 0.85;
      this.leftArm.rotation.x = Math.sin(time * 1.5) * 0.03;
      this.rightArm.rotation.x = -Math.sin(time * 1.5) * 0.03;
    }
    this.leftArm.rotation.z = 0;
    this.rightArm.rotation.z = 0;
  }
}
