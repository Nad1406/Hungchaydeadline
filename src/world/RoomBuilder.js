import * as THREE from 'three';
import { createRoomTextures } from '../textures/ProceduralPixelTextures.js';
import { HungCharacter } from '../entities/HungCharacter.js';

function loadCrispTex(url) {
  const tex = new THREE.TextureLoader().load(url);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class RoomBuilder {
  constructor(scene, terminalTexture) {
    this.scene = scene;
    this.terminalTexture = terminalTexture;
    this.tex = createRoomTextures();
    this.interactables = [];
    this.colliders = []; // AABB boxes { minX, maxX, minZ, maxZ }

    // Dynamic animated references
    this.refs = {};

    this._buildLighting();
    this._buildRoomShell();
    this._buildMirrorDimension();
    this._buildExteriorNightWindow();
    this._buildExteriorCorridor();
    this._buildDeskArea();
    this._buildWardrobe();
    this._buildBookshelfAndRouter();
    this._buildBedAndNightstand();
    this._buildDoorAndSwitch();
    this._buildColdWindParticles();
  }

  _registerInteractable(mesh, interactId, getPromptFn, priority = 1, maxHorizDist = 0.92) {
    mesh.userData.interactId = interactId;
    mesh.userData.getPrompt = getPromptFn;
    mesh.userData.priority = priority;
    mesh.userData.maxHorizDist = maxHorizDist;
    this.interactables.push(mesh);
    return mesh;
  }

  _addCollider(minX, maxX, minZ, maxZ) {
    this.colliders.push({ minX, maxX, minZ, maxZ });
  }

  _buildLighting() {
    // Deep eerie midnight fog & moody ambient so monitor & cold window dominate while keeping room readable!
    this.scene.background = new THREE.Color(0x050811);
    this.scene.fog = new THREE.FogExp2(0x070b16, 0.072);

    this.ambientLight = new THREE.AmbientLight(0x283652, 0.62);
    this.scene.add(this.ambientLight);

    // 1. PRIMARY LIGHT: Glowing PC Monitor Cyan-Blue Light (illuminates desk & front of room)
    this.monitorLight = new THREE.PointLight(0x5eb8ff, 1.65, 4.6, 1.5);
    this.monitorLight.position.set(0, 1.15, -2.35);
    this.scene.add(this.monitorLight);

    this.monitorSpot = new THREE.SpotLight(0x7cc8ff, 2.2, 6.0, Math.PI * 0.42, 0.65, 1.4);
    this.monitorSpot.position.set(0, 1.12, -2.62);
    this.monitorSpot.target.position.set(0, 0.65, -0.6);
    this.scene.add(this.monitorSpot);
    this.scene.add(this.monitorSpot.target);

    // 2. PRIMARY LIGHT: Stark Cold White Moonlight through East Window ("ánh trắng cửa sổ với cơn gió lạnh")
    this.moonSpot = new THREE.SpotLight(0xdcecff, 2.8, 9.5, Math.PI * 0.32, 0.55, 1.2);
    this.moonSpot.position.set(4.6, 2.45, -0.55);
    this.moonSpot.target.position.set(-0.6, 0.0, -0.35);
    this.scene.add(this.moonSpot);
    this.scene.add(this.moonSpot.target);

    this.windowBounce = new THREE.PointLight(0xbcd8ff, 0.55, 4.2, 1.6);
    this.windowBounce.position.set(2.35, 1.45, -0.55);
    this.scene.add(this.windowBounce);

    // 3. CENTRAL HANGING WARM-YELLOW PENDANT LAMP (Đèn treo ánh sáng vàng chính giữa phòng tích hợp công tắc đèn!)
    this.pendantGroup = new THREE.Group();
    this.pendantGroup.position.set(0, 2.95, 0.0);

    const canopy = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.075, 0.03, 8),
      new THREE.MeshLambertMaterial({ color: 0x1e2024 })
    );
    canopy.position.set(0, -0.015, 0);

    const cord = new THREE.Mesh(
      new THREE.CylinderGeometry(0.011, 0.011, 0.38, 6),
      new THREE.MeshBasicMaterial({ color: 0x141518 })
    );
    cord.position.set(0, -0.19, 0);

    const shadeOuter = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.24, 0.14, 10, 1, true),
      new THREE.MeshLambertMaterial({ color: 0x26322c, side: THREE.FrontSide })
    );
    shadeOuter.position.set(0, -0.41, 0);

    this.shadeInnerMat = new THREE.MeshBasicMaterial({ color: 0xffe49e, side: THREE.BackSide });
    const shadeInner = new THREE.Mesh(
      new THREE.CylinderGeometry(0.053, 0.236, 0.138, 10, 1, true),
      this.shadeInnerMat
    );
    shadeInner.position.set(0, -0.41, 0);

    this.bulbMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.068, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffe07d })
    );
    this.bulbMesh.position.set(0, -0.47, 0);

    this.lampHaloMesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.26, 0.22, 10, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffe082,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    this.lampHaloMesh.position.set(0, -0.49, 0);

    this.pendantGroup.add(canopy, cord, shadeOuter, shadeInner, this.bulbMesh, this.lampHaloMesh);
    this.scene.add(this.pendantGroup);

    this.roomBulbLight = new THREE.PointLight(0xffc258, 3.6, 14.0, 1.02);
    this.roomBulbLight.position.set(0, 2.42, 0.0);
    this.scene.add(this.roomBulbLight);

    this.roomPendantSpot = new THREE.SpotLight(0xffd47e, 3.1, 11.5, Math.PI * 0.56, 0.68, 1.0);
    this.roomPendantSpot.position.set(0, 2.48, 0.0);
    this.roomPendantSpot.target.position.set(0, 0, 0.0);
    this.scene.add(this.roomPendantSpot);
    this.scene.add(this.roomPendantSpot.target);

    this.warmHemiLight = new THREE.HemisphereLight(0xffe09c, 0x524231, 0.78);
    this.scene.add(this.warmHemiLight);

    // Lightning flash directional/point light
    this.lightningLight = new THREE.PointLight(0xeef6ff, 0, 14, 1.0);
    this.lightningLight.position.set(3.4, 2.2, -0.55);
    this.scene.add(this.lightningLight);
  }

  _buildRoomShell() {
    const wallMat = new THREE.MeshLambertMaterial({ map: this.tex.wall });
    const floorMat = new THREE.MeshLambertMaterial({ map: this.tex.floor });
    const ceilMat = new THREE.MeshLambertMaterial({ map: this.tex.ceiling });
    const baseboardMat = new THREE.MeshLambertMaterial({ color: 0x1d2026 });

    // Floor (5.6 x 6.2)
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 6.2), floorMat);
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    // Ceiling
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 6.2), ceilMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 2.95;
    this.scene.add(ceiling);

    // North Wall (z = -3.1, solid behind desk)
    const northWall = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2.95), wallMat);
    northWall.position.set(0, 1.475, -3.1);
    this.scene.add(northWall);

    // East Wall (x = +2.8) with cutout for Window (z in [-1.30, +0.20], y in [0.90, 2.15])
    this._buildWallWithOpening({
      axis: 'x',
      fixedCoord: 2.8,
      rotY: -Math.PI / 2,
      spanMin: -3.1,
      spanMax: 3.1,
      height: 2.95,
      openMin: -1.30,
      openMax: 0.20,
      openBottom: 0.90,
      openTop: 2.15,
      mat: wallMat
    });

    // West Wall (x = -2.8) with cutout for Mirror (z in [-1.78, -0.92], y in [0.65, 2.10])
    this._buildWallWithOpening({
      axis: 'x',
      fixedCoord: -2.8,
      rotY: Math.PI / 2,
      spanMin: -3.1,
      spanMax: 3.1,
      height: 2.95,
      openMin: -1.78,
      openMax: -0.92,
      openBottom: 0.65,
      openTop: 2.10,
      mat: wallMat
    });

    // South Wall (z = +3.1) with cutout for Main Door Window Pane (x in [-1.65, -1.25], y in [1.32, 1.80])
    // Let's cut out the whole door frame (x in [-1.90, -1.00], y in [0, 2.12]) and place the 3D Door with Glass Window inside!
    this._buildWallWithOpening({
      axis: 'z',
      fixedCoord: 3.1,
      rotY: Math.PI,
      spanMin: -2.8,
      spanMax: 2.8,
      height: 2.95,
      openMin: -1.90,
      openMax: -1.00,
      openBottom: 0.0,
      openTop: 2.12,
      mat: wallMat
    });

    // Dark baseboards along North wall
    const bbN = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.09, 0.03), baseboardMat);
    bbN.position.set(0, 0.045, -3.085);
    this.scene.add(bbN);
  }

  _buildWallWithOpening({
    axis, fixedCoord, rotY, spanMin, spanMax, height,
    openMin, openMax, openBottom, openTop, mat
  }) {
    const addPatch = (s0, s1, y0, y1) => {
      const w = s1 - s0;
      const h = y1 - y0;
      if (w <= 0.001 || h <= 0.001) return;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      m.rotation.y = rotY;
      const sMid = (s0 + s1) * 0.5;
      const yMid = (y0 + y1) * 0.5;
      if (axis === 'x') {
        m.position.set(fixedCoord, yMid, sMid);
      } else {
        m.position.set(sMid, yMid, fixedCoord);
      }
      this.scene.add(m);
    };

    // Left segment, Right segment, Bottom sill, Top header
    addPatch(spanMin, openMin, 0, height);
    addPatch(openMax, spanMax, 0, height);
    addPatch(openMin, openMax, 0, openBottom);
    addPatch(openMin, openMax, openTop, height);
  }

  // =========================================================================
  // REAL-TIME VIRTUAL MIRROR CHAMBER (Gương soi phản chiếu khuôn mặt Hưng 3D!)
  // =========================================================================
  _buildMirrorDimension() {
    // Wooden Mirror Frame on West Wall (x = -2.79, z = -1.35, y = 0.65..2.10)
    const frameMat = new THREE.MeshLambertMaterial({ map: this.tex.darkWood });
    const frameGroup = new THREE.Group();
    frameGroup.position.set(-2.78, 1.375, -1.35);

    const topB = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.96), frameMat);
    topB.position.y = 0.74;
    const botB = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.96), frameMat);
    botB.position.y = -0.74;
    const leftB = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.54, 0.07), frameMat);
    leftB.position.z = -0.45;
    const rightB = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.54, 0.07), frameMat);
    rightB.position.z = 0.45;
    frameGroup.add(topB, botB, leftB, rightB);
    this.scene.add(frameGroup);

    // Semi-transparent Mirror Glass Pane (clickable when cursed!)
    const glassMat = new THREE.MeshBasicMaterial({
      color: 0x9ab8d4,
      transparent: true,
      opacity: 0.14
    });
    const mirrorGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 1.45), glassMat);
    mirrorGlass.rotation.y = Math.PI / 2;
    mirrorGlass.position.set(-2.79, 1.375, -1.35);
    this.scene.add(mirrorGlass);

    // Curse / Foggy blood writing overlay plane on mirror!
    this.refs.mirrorCurseMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.84, 1.42),
      new THREE.MeshBasicMaterial({
        map: this.tex.mirrorCurse,
        transparent: true,
        opacity: 0.92
      })
    );
    this.refs.mirrorCurseMesh.rotation.y = Math.PI / 2;
    this.refs.mirrorCurseMesh.position.set(-2.775, 1.375, -1.35);
    this.refs.mirrorCurseMesh.visible = false;
    this.scene.add(this.refs.mirrorCurseMesh);

    this._registerInteractable(mirrorGlass, 'mirror', (state) => {
      if (state.mirrorCursed) return '[E] Lau vết máu mờ & định thần trước gương';
      return '[E] Nhìn vào gương (Nguyễn Tuấn Hưng)';
    });

    // Virtual Mirrored Box behind x = -2.8 so looking into mirror shows room + 3D Hung!
    const mBoxMat = new THREE.MeshLambertMaterial({ color: 0x161b26, side: THREE.BackSide });
    const mChamber = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.95, 4.4), mBoxMat);
    mChamber.position.set(-4.91, 1.475, -1.35);
    this.scene.add(mChamber);

    // Mirrored Floor inside mirror chamber
    const mFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(4.2, 4.4),
      new THREE.MeshLambertMaterial({ map: this.tex.floor })
    );
    mFloor.rotation.x = -Math.PI / 2;
    mFloor.position.set(-4.91, 0.01, -1.35);
    this.scene.add(mFloor);

    // Soft light right at mirror glass plane (-2.82) so Hung's pixel face, glasses & chain are always lit from the front!
    this.refs.mirrorLight = new THREE.PointLight(0xa8ccf0, 1.55, 4.8, 1.3);
    this.refs.mirrorLight.position.set(-2.83, 1.58, -1.35);
    this.scene.add(this.refs.mirrorLight);

    // 3D Hung Reflection Character inside Mirror!
    this.refs.mirrorHung = new HungCharacter({ isDoppelganger: false });
    this.refs.mirrorHung.group.position.set(-3.8, 0, -1.35);
    this.scene.add(this.refs.mirrorHung.group);
  }

  // =========================================================================
  // EAST NIGHT WINDOW (Ánh trăng trắng lạnh lẽo, khung sắt phòng trọ, rèm bay & bóng người!)
  // =========================================================================
  _buildExteriorNightWindow() {
    // Exterior night chamber outside x = +2.8
    const skyMat = new THREE.MeshBasicMaterial({ color: 0x070d1a, side: THREE.BackSide });
    const skyBox = new THREE.Mesh(new THREE.BoxGeometry(4.0, 4.2, 4.6), skyMat);
    skyBox.position.set(4.82, 1.6, -0.55);
    this.scene.add(skyBox);

    // Glowing Cold White Full Moon disc outside window!
    const moon = new THREE.Mesh(
      new THREE.CircleGeometry(0.36, 12),
      new THREE.MeshBasicMaterial({ color: 0xf2f8ff })
    );
    moon.rotation.y = -Math.PI / 2;
    moon.position.set(6.6, 2.35, -0.95);
    this.scene.add(moon);

    // Neighboring dark concrete rooftop/balcony across the alley
    const ledge = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 1.4, 2.8),
      new THREE.MeshLambertMaterial({ color: 0x121824 })
    );
    ledge.position.set(5.1, 0.5, -0.55);
    this.scene.add(ledge);

    // Creepy Exterior Window Watcher Entity (stands on rooftop staring in when window blows open!)
    this.refs.windowEntity = new HungCharacter({ isShadowEntity: true });
    this.refs.windowEntity.group.position.set(4.55, 1.15, -0.55);
    this.refs.windowEntity.group.rotation.y = -Math.PI / 2;
    this.refs.windowEntity.group.visible = false;
    this.scene.add(this.refs.windowEntity.group);

    // Wooden Window Frame + Iconic Vietnamese Student Room Iron Security Bars!
    const frameMat = new THREE.MeshLambertMaterial({ map: this.tex.darkWood });
    const barMat = new THREE.MeshLambertMaterial({ color: 0x28323c });

    const sill = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 1.62), frameMat);
    sill.position.set(2.78, 0.88, -0.55);
    const header = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 1.62), frameMat);
    header.position.set(2.78, 2.17, -0.55);
    this.scene.add(sill, header);

    // Iron vertical security bars
    for (let z = -1.18; z <= 0.08; z += 0.18) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.26, 6), barMat);
      bar.position.set(2.83, 1.52, z);
      this.scene.add(bar);
    }

    // Two Hinged Glass Window Sashes (Swing open inward into room when wind blows!)
    const sashGlassMat = new THREE.MeshBasicMaterial({
      color: 0xa8c8e8,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide
    });

    const buildSash = (pivotZ, dir) => {
      const pivot = new THREE.Group();
      pivot.position.set(2.76, 1.52, pivotZ);

      const border = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.22, 0.72), frameMat);
      // Hollow look with glass center: put thin frame strips + glass
      border.visible = false;
      const topS = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.74), frameMat);
      topS.position.set(0, 0.59, dir * 0.37);
      const botS = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.74), frameMat);
      botS.position.set(0, -0.59, dir * 0.37);
      const sideA = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.24, 0.06), frameMat);
      sideA.position.set(0, 0, dir * 0.03);
      const sideB = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.24, 0.06), frameMat);
      sideB.position.set(0, 0, dir * 0.71);
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 1.12), sashGlassMat);
      glass.rotation.y = Math.PI / 2;
      glass.position.set(0, 0, dir * 0.37);

      pivot.add(topS, botS, sideA, sideB, glass);
      this.scene.add(pivot);
      return { pivot, glass };
    };

    this.refs.winLeft = buildSash(-1.29, +1);
    this.refs.winRight = buildSash(0.19, -1);

    // Interactive hitbox over the whole window
    const winHitbox = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 1.35, 1.55),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    winHitbox.position.set(2.68, 1.52, -0.55);
    this.scene.add(winHitbox);
    this._registerInteractable(winHitbox, 'window', (state) =>
      state.windowOpen
        ? '[E] Đóng chặt cửa sổ & cài chốt chặn gió lạnh!'
        : '[E] Nhìn ra ngoài cửa sổ đêm khuya'
    );

    // Billowing Semi-Transparent Curtains on both sides of window
    const curtainMat = new THREE.MeshLambertMaterial({
      color: 0xc2d0e0,
      transparent: true,
      opacity: 0.62,
      side: THREE.DoubleSide
    });
    const cGeoL = new THREE.PlaneGeometry(0.46, 1.55, 4, 8);
    const cGeoR = new THREE.PlaneGeometry(0.46, 1.55, 4, 8);
    this.refs.curtainL = new THREE.Mesh(cGeoL, curtainMat);
    this.refs.curtainR = new THREE.Mesh(cGeoR, curtainMat);
    this.refs.curtainL.rotation.y = -Math.PI / 2;
    this.refs.curtainR.rotation.y = -Math.PI / 2;
    this.refs.curtainL.position.set(2.66, 1.46, -1.16);
    this.refs.curtainR.position.set(2.66, 1.46, 0.06);
    this.refs.curtainBaseL = Float32Array.from(cGeoL.attributes.position.array);
    this.refs.curtainBaseR = Float32Array.from(cGeoR.attributes.position.array);
    this.scene.add(this.refs.curtainL, this.refs.curtainR);
  }

  // =========================================================================
  // EXTERIOR CORRIDOR BEYOND MAIN DOOR GLASS (Hành lang khu trọ ngoài ô kính cửa!)
  // =========================================================================
  _buildExteriorCorridor() {
    const corrMat = new THREE.MeshLambertMaterial({ color: 0x1d2228, side: THREE.BackSide });
    const corridor = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.8, 3.2), corrMat);
    corridor.position.set(-1.45, 1.4, 4.72);
    this.scene.add(corridor);

    // Flickering sickly greenish-yellow corridor tube light outside
    this.refs.corridorLight = new THREE.PointLight(0x9fb89e, 0.65, 4.8, 1.5);
    this.refs.corridorLight.position.set(-1.45, 2.45, 4.5);
    this.scene.add(this.refs.corridorLight);

    // Opposite apartment door in corridor for depth realism
    const oppDoor = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 2.0),
      new THREE.MeshLambertMaterial({ map: this.tex.frontDoor })
    );
    oppDoor.rotation.y = Math.PI;
    oppDoor.position.set(-1.45, 1.0, 6.28);
    this.scene.add(oppDoor);

    // THE ENTITY AT THE DOOR GLASS!
    this.refs.doorEntity = new HungCharacter({ isShadowEntity: true });
    this.refs.doorEntity.group.position.set(-1.45, 0.0, 3.65);
    this.refs.doorEntity.group.rotation.y = Math.PI; // Facing into Hung's door glass!
    this.refs.doorEntity.group.visible = false;
    this.scene.add(this.refs.doorEntity.group);
  }

  // =========================================================================
  // NORTH WALL: STUDY DESK, PC MONITOR, KEYBOARD, VN-UK ID CARD, PAPERS & POSTER
  // =========================================================================
  _buildDeskArea() {
    const woodMat = new THREE.MeshLambertMaterial({ map: this.tex.darkWood });
    const darkMetal = new THREE.MeshLambertMaterial({ color: 0x181b22 });

    // Desk tabletop (x: -0.85..+0.85, z: -2.96..-2.18, y: 0.75)
    const deskTop = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.05, 0.78), woodMat);
    deskTop.position.set(0, 0.75, -2.57);
    this.scene.add(deskTop);

    // Desk legs
    [[-0.80, -2.90], [0.80, -2.90], [-0.80, -2.24], [0.80, -2.24]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.75, 0.06), darkMetal);
      leg.position.set(lx, 0.375, lz);
      this.scene.add(leg);
    });
    this._addCollider(-0.92, 0.92, -3.1, -2.10);

    // PC Tower under/beside desk
    const pcCase = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.44, 0.44), darkMetal);
    pcCase.position.set(0.64, 0.22, -2.55);
    const pcLed = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.02, 0.01),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    pcLed.position.set(0.64, 0.38, -2.325);
    this.scene.add(pcCase, pcLed);

    // Monitor Stand & Bezel
    const standBase = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.02, 0.18), darkMetal);
    standBase.position.set(0, 0.785, -2.72);
    const standNeck = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.05), darkMetal);
    standNeck.position.set(0, 0.89, -2.74);
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.50, 0.045), darkMetal);
    bezel.position.set(0, 1.12, -2.70);
    this.scene.add(standBase, standNeck, bezel);

    // Live Terminal Screen Mesh!
    const screenMat = new THREE.MeshBasicMaterial({ map: this.terminalTexture });
    this.refs.monitorScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.71, 0.45), screenMat);
    this.refs.monitorScreen.position.set(0, 1.12, -2.675);
    this.scene.add(this.refs.monitorScreen);

    this._registerInteractable(
      bezel,
      'seat_pc',
      (state) => (state.isSeated ? '' : '[E] Ngồi vào bàn máy tính chạy Deadline VN-UK'),
      1,
      1.08
    );

    // Mechanical Keyboard & Mouse
    const kbMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.40, 0.022, 0.15),
      new THREE.MeshLambertMaterial({ map: this.tex.keyboard })
    );
    kbMesh.position.set(-0.04, 0.786, -2.38);
    const mouseMesh = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.025, 0.105), darkMetal);
    mouseMesh.position.set(0.26, 0.786, -2.38);
    this.scene.add(kbMesh, mouseMesh);
    this.refs.keyboardMesh = kbMesh;

    // 1st-Person Seated Hands hovering over Mechanical Keyboard (VN-UK Navy Sleeve + Crimson Trim!)
    const fpHandsGroup = new THREE.Group();
    const fpSkinMat = new THREE.MeshLambertMaterial({ color: 0xc2957a });
    const fpSleeveMat = new THREE.MeshLambertMaterial({ color: 0x18223e });
    const fpCrimsonMat = new THREE.MeshLambertMaterial({ color: 0xa2252b });

    const makeTypingArm = (sideDir) => {
      const armPivot = new THREE.Group();
      armPivot.position.set(-0.04 + sideDir * 0.12, 0.835, -2.14);

      const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.065, 0.115), fpSleeveMat);
      cuff.position.set(sideDir * 0.015, 0.015, 0.05);

      const redTrim = new THREE.Mesh(new THREE.BoxGeometry(0.092, 0.068, 0.024), fpCrimsonMat);
      redTrim.position.set(sideDir * 0.015, 0.015, -0.012);

      const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.048, 0.18), fpSkinMat);
      forearm.position.set(0, 0.0, -0.09);

      const palm = new THREE.Mesh(new THREE.BoxGeometry(0.076, 0.028, 0.085), fpSkinMat);
      palm.position.set(-sideDir * 0.01, -0.012, -0.20);

      armPivot.add(cuff, redTrim, forearm, palm);
      armPivot.rotation.y = sideDir * 0.14;
      return armPivot;
    };

    this.refs.fpHandLeft = makeTypingArm(-1);  // Triggered by [A]
    this.refs.fpHandRight = makeTypingArm(+1); // Triggered by [D]
    fpHandsGroup.add(this.refs.fpHandLeft, this.refs.fpHandRight);
    fpHandsGroup.visible = false;
    this.scene.add(fpHandsGroup);
    this.refs.fpHandsGroup = fpHandsGroup;

    // VN-UK Student ID Card on right side of desk!
    const cardTex = loadCrispTex('./assets/vnuk_student_card.png');
    const idCard = new THREE.Mesh(
      new THREE.PlaneGeometry(0.21, 0.13),
      new THREE.MeshLambertMaterial({ map: cardTex })
    );
    idCard.rotation.x = -Math.PI / 2;
    idCard.rotation.z = -0.18;
    idCard.position.set(0.54, 0.778, -2.36);
    this.scene.add(idCard);
    this._registerInteractable(
      idCard,
      'inspect_card',
      () => '[E] Xem Thẻ Sinh Viên VN-UK (Nguyễn Tuấn Hưng • 24SE1)',
      2,
      1.02
    );

    // Coffee Mug & Instant Noodle Cup (Đạo cụ thức đêm chạy đồ án!)
    const mug = new THREE.Mesh(
      new THREE.CylinderGeometry(0.042, 0.038, 0.10, 8),
      new THREE.MeshLambertMaterial({ color: 0x8b0e2a })
    );
    mug.position.set(-0.68, 0.825, -2.56);
    const noodleCup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.058, 0.042, 0.115, 8),
      new THREE.MeshLambertMaterial({ color: 0xd9480f })
    );
    noodleCup.position.set(-0.66, 0.832, -2.74);
    this.scene.add(mug, noodleCup);

    // Report Paper Stack on Left Side of Desk (Interactive tray!)
    const stackGroup = new THREE.Group();
    stackGroup.position.set(-0.46, 0.778, -2.38);
    for (let i = 0; i < 4; i++) {
      const sheet = new THREE.Mesh(
        new THREE.BoxGeometry(0.21, 0.008, 0.29),
        new THREE.MeshLambertMaterial({ map: this.tex.reportPaper })
      );
      sheet.position.y = i * 0.009;
      sheet.rotation.y = (i - 1.5) * 0.04;
      stackGroup.add(sheet);
    }
    this.scene.add(stackGroup);
    this.refs.deskPaperStack = stackGroup;

    // Tray hitbox for placing collected papers back!
    const trayHit = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.12, 0.34),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    trayHit.position.set(-0.46, 0.82, -2.38);
    this.scene.add(trayHit);
    this._registerInteractable(
      trayHit,
      'paper_tray',
      (state) => {
        if (!state.papersScattered) return '[E] Xấp bản thảo Báo cáo Đồ án VN-UK';
        if (state.papersHeld < state.papersTotal) {
          return `[Cần nhặt đủ giấy trên sàn trước: ${state.papersHeld}/${state.papersTotal}]`;
        }
        return '[E] Đặt và sắp xếp lại xấp báo cáo lên bàn!';
      },
      2,
      1.02
    );

    // Pre-create 4 Scattered Floor Paper Meshes (hidden until Paper Anomaly!)
    const floorSpots = [
      { x: -0.78, z: -1.22, rot: 0.42, cursed: false },
      { x: 0.92, z: -0.95, rot: -0.65, cursed: true }, // Cursed blood-ink sheet!
      { x: -0.22, z: 0.28, rot: 1.15, cursed: false },
      { x: 1.18, z: 0.48, rot: -0.28, cursed: false }
    ];
    this.refs.scatteredPapers = floorSpots.map((sp, idx) => {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.24, 0.32),
        new THREE.MeshLambertMaterial({
          map: sp.cursed ? this.tex.cursedPaper : this.tex.reportPaper
        })
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = sp.rot;
      mesh.position.set(sp.x, 0.014, sp.z);
      mesh.visible = false;
      mesh.userData.paperIndex = idx;
      mesh.userData.isCursedSheet = sp.cursed;
      this.scene.add(mesh);

      // Generous invisible pickup box synced to mesh visibility so sprinting players grab papers effortlessly!
      const hitBox = new THREE.Mesh(
        new THREE.BoxGeometry(0.44, 0.14, 0.48),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hitBox.position.set(sp.x, 0.07, sp.z);
      hitBox.userData.linkedPaperMesh = mesh;
      this.scene.add(hitBox);

      this._registerInteractable(
        hitBox,
        `pickup_paper_${idx}`,
        (state) => `[E] Nhặt tờ bản thảo báo cáo (${state.papersHeld + 1}/${state.papersTotal})`,
        4,
        0.88
      );
      return mesh;
    });

    // Desk Swivel Chair (at z = -1.78)
    const chairGroup = new THREE.Group();
    chairGroup.position.set(0, 0, -1.78);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.06, 0.46), darkMetal);
    seat.position.y = 0.46;
    const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.52, 0.06), darkMetal);
    backrest.position.set(0, 0.74, 0.21);
    const chairPole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.44, 6), darkMetal);
    chairPole.position.y = 0.22;
    const chairBase = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.03, 6), darkMetal);
    chairBase.position.y = 0.02;
    chairGroup.add(seat, backrest, chairPole, chairBase);
    this.scene.add(chairGroup);
    this.refs.chairGroup = chairGroup;

    const chairHit = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 0.95, 0.58),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    chairHit.position.set(0, 0.5, -1.78);
    this.scene.add(chairHit);
    this._registerInteractable(chairHit, 'seat_pc', (state) =>
      state.isSeated ? '' : '[E] Ngồi vào ghế tiếp tục chạy Deadline'
    );

    // 3D Hung Character Seated at Desk (Visible during Title Screen & Ending Cutscene, hidden in 1st-person!)
    this.refs.seatedHung = new HungCharacter({ isDoppelganger: false });
    this.refs.seatedHung.group.position.set(0, 0, -1.82);
    this.refs.seatedHung.group.rotation.y = Math.PI; // Facing monitor (-Z)
    this.scene.add(this.refs.seatedHung.group);

    // Framed VN-UK Capstone Poster on North Wall (x = 1.52, y = 1.62, z = -3.06)
    const posterTex = loadCrispTex('./assets/vnuk_wall_poster.png');
    this.refs.vnukPoster = new THREE.Mesh(
      new THREE.BoxGeometry(0.56, 0.70, 0.03),
      new THREE.MeshLambertMaterial({ map: posterTex })
    );
    this.refs.vnukPoster.position.set(1.52, 1.62, -3.07);
    this.scene.add(this.refs.vnukPoster);
    this._registerInteractable(this.refs.vnukPoster, 'vnuk_poster', (state) =>
      state.posterInverted
        ? '[E] Chỉnh lại khung chứng nhận VN-UK bị lộn ngược!'
        : '[E] Xem khung Đồ Án Tốt Nghiệp VN-UK'
    );

    // Wall Calendar on North Wall left of desk (x = -1.55, y = 1.60, z = -3.08)
    const cal = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, 0.52),
      new THREE.MeshLambertMaterial({ map: this.tex.calendar })
    );
    cal.position.set(-1.55, 1.60, -3.08);
    this.scene.add(cal);
  }

  // =========================================================================
  // WEST WALL: CREAKING WOODEN WARDROBE (Tủ quần áo gỗ có mắt nhìn lén!)
  // =========================================================================
  _buildWardrobe() {
    const woodMat = new THREE.MeshLambertMaterial({ map: this.tex.darkWood });
    const doorMat = new THREE.MeshLambertMaterial({ map: this.tex.wardrobeDoor });
    const darkInside = new THREE.MeshBasicMaterial({ color: 0x050609 });

    const wGroup = new THREE.Group();
    wGroup.position.set(-2.38, 0, 0.92);

    // Outer shell (hollow front facing +X)
    const backP = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.12, 1.18), woodMat);
    backP.position.set(-0.34, 1.06, 0);
    const topP = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.06, 1.20), woodMat);
    topP.position.set(0, 2.09, 0);
    const botP = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.08, 1.20), woodMat);
    botP.position.set(0, 0.04, 0);
    const sideN = new THREE.Mesh(new THREE.BoxGeometry(0.72, 2.12, 0.05), woodMat);
    sideN.position.set(0, 1.06, -0.575);
    const sideS = new THREE.Mesh(new THREE.BoxGeometry(0.72, 2.12, 0.05), woodMat);
    sideS.position.set(0, 1.06, 0.575);
    const darkBack = new THREE.Mesh(new THREE.PlaneGeometry(1.10, 2.0), darkInside);
    darkBack.rotation.y = Math.PI / 2;
    darkBack.position.set(-0.30, 1.06, 0);

    wGroup.add(backP, topP, botP, sideN, sideS, darkBack);

    // Hanging VN-UK Navy Polo Shirts with Red Collars inside wardrobe
    for (let sz = -0.35; sz <= -0.15; sz += 0.1) {
      const shirt = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, 0.56, 0.05),
        new THREE.MeshLambertMaterial({ color: 0x18223e })
      );
      shirt.position.set(-0.08, 1.36, sz);
      const collar = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.055, 0.055),
        new THREE.MeshLambertMaterial({ color: 0xa2252b })
      );
      collar.position.set(-0.08, 1.65, sz);
      wGroup.add(shirt, collar);
    }

    // Glowing Red/White Eyes peeking out from inside darkness when Wardrobe Anomaly is active!
    const eyesGroup = new THREE.Group();
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff3b3b });
    const e1 = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.022, 0.022), eyeMat);
    e1.position.set(0.12, 1.44, 0.08);
    const e2 = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.022, 0.022), eyeMat);
    e2.position.set(0.12, 1.44, 0.16);
    eyesGroup.add(e1, e2);
    eyesGroup.visible = false;
    wGroup.add(eyesGroup);
    this.refs.wardrobeEyes = eyesGroup;

    // Left & Right Hinged Doors (facing +X)
    const doorPivotL = new THREE.Group();
    doorPivotL.position.set(0.34, 1.06, -0.55);
    const doorMeshL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.98, 0.54), doorMat);
    doorMeshL.position.set(0, 0, 0.27);
    doorPivotL.add(doorMeshL);

    const doorPivotR = new THREE.Group();
    doorPivotR.position.set(0.34, 1.06, 0.55);
    const doorMeshR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.98, 0.54), doorMat);
    doorMeshR.position.set(0, 0, -0.27);
    doorPivotR.add(doorMeshR);

    wGroup.add(doorPivotL, doorPivotR);
    this.scene.add(wGroup);

    this.refs.wardrobeDoorL = doorPivotL;
    this.refs.wardrobeDoorR = doorPivotR;

    const wHit = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 2.1, 1.22),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    wHit.position.set(-2.32, 1.06, 0.92);
    this.scene.add(wHit);
    this._registerInteractable(wHit, 'wardrobe', (state) =>
      state.wardrobeOpen
        ? '[E] Đẩy đóng chặt cánh tủ quần áo ngay!'
        : '[E] Kiểm tra tủ quần áo'
    );

    this._addCollider(-2.8, -1.92, 0.26, 1.58);
  }

  // =========================================================================
  // EAST WALL: BOOKSHELF & HAUNTED WI-FI ROUTER
  // =========================================================================
  _buildBookshelfAndRouter() {
    const woodMat = new THREE.MeshLambertMaterial({ map: this.tex.darkWood });
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.46, 1.42, 0.92), woodMat);
    shelf.position.set(2.54, 0.71, 1.32);
    this.scene.add(shelf);
    this._addCollider(2.22, 2.8, 0.82, 1.82);

    // Books on shelf
    const colors = [0x8b0e2a, 0x1c1b4b, 0x2b593f, 0x6b4c35];
    for (let i = 0; i < 6; i++) {
      const book = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.26, 0.05),
        new THREE.MeshLambertMaterial({ color: colors[i % colors.length] })
      );
      book.position.set(2.44, 1.55, 1.02 + i * 0.07);
      this.scene.add(book);
    }

    // Wi-Fi Router on top of Bookshelf!
    const routerBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.045, 0.16),
      new THREE.MeshLambertMaterial({ color: 0x14171f })
    );
    routerBody.position.set(2.48, 1.445, 1.52);
    const ant1 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.22, 5),
      new THREE.MeshBasicMaterial({ color: 0x111111 })
    );
    ant1.position.set(2.54, 1.55, 1.46);
    const ant2 = ant1.clone();
    ant2.position.set(2.54, 1.55, 1.58);

    this.refs.routerLedMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    const routerLed = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.018, 0.10), this.refs.routerLedMat);
    routerLed.position.set(2.365, 1.448, 1.52);

    this.refs.routerLight = new THREE.PointLight(0x22c55e, 0.35, 1.6, 1.8);
    this.refs.routerLight.position.set(2.30, 1.48, 1.52);

    this.scene.add(routerBody, ant1, ant2, routerLed, this.refs.routerLight);

    const rHit = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.42, 0.44),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    rHit.position.set(2.44, 1.52, 1.52);
    this.scene.add(rHit);
    this._registerInteractable(
      rHit,
      'router',
      (state) =>
        state.routerDown
          ? '[E] Nhấn nút Reset cục phát Wi-Fi (Đang lỗi đỏ!)'
          : '[E] Cục phát Wi-Fi phòng 404 (Đang hoạt động)',
      3
    );
  }

  // =========================================================================
  // SOUTH-EAST: STUDENT BED & NIGHTSTAND WITH CURSED SMARTPHONE
  // =========================================================================
  _buildBedAndNightstand() {
    const woodMat = new THREE.MeshLambertMaterial({ map: this.tex.darkWood });
    const mattressMat = new THREE.MeshLambertMaterial({ map: this.tex.blanket });

    // Bed Frame & Mattress (x: 0.95..2.75, z: 1.85..3.05) -> Wait: bookshelf ends at z=2.18, let's place bed along South wall x: 0.75..2.65, z: 2.15..3.05!
    // Adjust bookshelf slightly north so zero overlap: let's keep bed at x: 0.85..2.72, z: 2.22..3.06!
    const bedFrame = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.28, 0.86), woodMat);
    bedFrame.position.set(1.78, 0.14, 2.63);
    const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.80, 0.16, 0.80), mattressMat);
    mattress.position.set(1.78, 0.34, 2.63);
    const pillow = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.10, 0.56),
      new THREE.MeshLambertMaterial({ color: 0xd8dee9 })
    );
    pillow.position.set(2.42, 0.45, 2.63);
    this.scene.add(bedFrame, mattress, pillow);
    this._addCollider(0.82, 2.8, 2.16, 3.1);

    // Nightstand at (0.42, 0, 2.74)
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.54, 0.44), woodMat);
    stand.position.set(0.42, 0.27, 2.78);
    this.scene.add(stand);
    this._addCollider(0.16, 0.70, 2.52, 3.1);

    // Smartphone on Nightstand!
    this.refs.phoneScreenMat = new THREE.MeshBasicMaterial({ color: 0x0b101b });
    const phone = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.015, 0.17), this.refs.phoneScreenMat);
    phone.position.set(0.42, 0.55, 2.76);
    phone.rotation.y = 0.25;
    this.scene.add(phone);
    this.refs.phoneMesh = phone;

    this.refs.phoneLight = new THREE.PointLight(0xff2e43, 0, 2.2, 1.5);
    this.refs.phoneLight.position.set(0.42, 0.68, 2.76);
    this.scene.add(this.refs.phoneLight);

    const pHit = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.28, 0.32),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    pHit.position.set(0.42, 0.60, 2.76);
    this.scene.add(pHit);
    this._registerInteractable(pHit, 'phone', (state) =>
      state.phoneRinging
        ? '[E] Tắt cuộc gọi ma quái ("NGUYỄN TUẤN HƯNG ĐANG GỌI...")!'
        : '[E] Kiểm tra tin nhắn điện thoại'
    );
  }

  // =========================================================================
  // SOUTH WALL: MAIN DOOR WITH FROSTED GLASS WINDOW, DEADBOLT & LIGHT SWITCH
  // =========================================================================
  _buildDoorAndSwitch() {
    const doorMat = new THREE.MeshLambertMaterial({ map: this.tex.frontDoor });
    const frameMat = new THREE.MeshLambertMaterial({ color: 0x1a2024 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0xb8c0cc, roughness: 0.35, metalness: 0.8 });

    // Door Frame around x in [-1.90, -1.00], y in [0, 2.12], z = 3.10
    // Build Door Slab with Upper Inspection Glass Cutout (x in [-1.64, -1.26], y in [1.36, 1.82])
    const doorGroup = new THREE.Group();
    doorGroup.position.set(-1.45, 0, 3.08);

    const lowerSlab = new THREE.Mesh(new THREE.BoxGeometry(0.90, 1.36, 0.05), doorMat);
    lowerSlab.position.set(0, 0.68, 0);
    const topSlab = new THREE.Mesh(new THREE.BoxGeometry(0.90, 0.30, 0.05), doorMat);
    topSlab.position.set(0, 1.97, 0);
    const leftStile = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.46, 0.05), doorMat);
    leftStile.position.set(-0.32, 1.59, 0);
    const rightStile = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.46, 0.05), doorMat);
    rightStile.position.set(0.32, 1.59, 0);

    // Heavy Frosted Privacy Glass Window (OPAQUE from afar — player MUST lean in with [E] to see outside!)
    const doorGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(0.38, 0.46),
      new THREE.MeshLambertMaterial({
        map: this.tex.frostedDoorGlass,
        transparent: true,
        opacity: 0.97,
        side: THREE.DoubleSide
      })
    );
    doorGlass.position.set(0, 1.59, 0);
    this.refs.doorGlass = doorGlass;

    // Authentic Vietnamese boarding-house twin vertical iron bars across the door glass (leaves center view clear!)
    const gBar1 = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.46, 0.02), frameMat);
    gBar1.position.set(-0.10, 1.59, -0.02);
    const gBar2 = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.46, 0.02), frameMat);
    gBar2.position.set(0.10, 1.59, -0.02);

    // Door Handle & Deadbolt Lock
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.028, 0.06), metalMat);
    handle.position.set(0.32, 1.02, -0.045);

    this.refs.deadboltSlide = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.035, 0.04),
      new THREE.MeshLambertMaterial({ color: 0xd97706 })
    );
    this.refs.deadboltSlide.position.set(0.32, 1.16, -0.04);

    doorGroup.add(lowerSlab, topSlab, leftStile, rightStile, doorGlass, gBar1, gBar2, handle, this.refs.deadboltSlide);
    this.scene.add(doorGroup);
    this.refs.doorGroup = doorGroup;

    // 1. Interactable: Peer through Door Glass Window!
    const glassHit = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.56, 0.16),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    glassHit.position.set(-1.45, 1.59, 3.02);
    this.scene.add(glassHit);
    this._registerInteractable(
      glassHit,
      'door_glass',
      (state) =>
        state.peeringDoor
          ? '[E / Q] Rời mắt khỏi ô kính cửa'
          : '[E] Nhìn qua ô kính cửa chính kiểm tra bên ngoài',
      3
    );

    // 2. Interactable: Deadbolt Lock (generous hitbox over handle & bolt area!)
    const lockHit = new THREE.Mesh(
      new THREE.BoxGeometry(0.54, 0.44, 0.18),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    lockHit.position.set(-1.22, 1.12, 3.02);
    this.scene.add(lockHit);
    this._registerInteractable(
      lockHit,
      'door_lock',
      (state) =>
        state.doorLocked
          ? '[E] Chốt an toàn đang KHOÁ'
          : '[E] Gạt KHOÁ CHỐT AN TOÀN cửa chính!',
      4
    );

    // 3. Wall Light Switch right beside the Main Door! (x = -0.68, y = 1.34, z = 3.07)
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(0.10, 0.15, 0.025),
      new THREE.MeshLambertMaterial({ color: 0xdcdad2 })
    );
    plate.position.set(-0.68, 1.34, 3.08);

    this.refs.switchRocker = new THREE.Mesh(
      new THREE.BoxGeometry(0.038, 0.065, 0.025),
      new THREE.MeshLambertMaterial({ color: 0xf4f4f0 })
    );
    this.refs.switchRocker.position.set(-0.68, 1.34, 3.065);

    // Tiny locator LED on light switch so player can spot it in pitch dark!
    const locatorLed = new THREE.Mesh(
      new THREE.BoxGeometry(0.018, 0.012, 0.01),
      new THREE.MeshBasicMaterial({ color: 0xff6b00 })
    );
    locatorLed.position.set(-0.68, 1.395, 3.062);

    this.scene.add(plate, this.refs.switchRocker, locatorLed);

    const swHit = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.32, 0.16),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    swHit.position.set(-0.68, 1.34, 3.02);
    this.scene.add(swHit);
    this._registerInteractable(
      swHit,
      'light_switch',
      (state) => (state.lightsOn ? '[E] Tắt công tắc đèn phòng' : '[E] Bật lại công tắc đèn phòng!'),
      3
    );
  }

  // =========================================================================
  // COLD NIGHT WIND MIST / DUST PARTICLES STREAMING FROM WINDOW
  // =========================================================================
  _buildColdWindParticles() {
    const count = 65;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = 2.75 - Math.random() * 2.1;
      positions[i * 3 + 1] = 0.75 + Math.random() * 1.45;
      positions[i * 3 + 2] = -1.35 + Math.random() * 1.6;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xd8ecff,
      size: 2.0,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.45
    });
    this.refs.windParticles = new THREE.Points(geo, mat);
    this.scene.add(this.refs.windParticles);
  }

  // =========================================================================
  // PER-FRAME WORLD ANIMATION (Curtains, Mirror Reflection, Lights, Particles)
  // =========================================================================
  update(dt, time, state, playerPos, playerYaw, isMoving) {
    // 1. PC Monitor dynamic light pulse (turns eerie crimson when >=2 anomalies!)
    const screenFlicker = 0.94 + Math.sin(time * 23.0) * 0.03 + Math.cos(time * 7.3) * 0.03;
    if (state.activeCount >= 2 || state.papersScattered || state.routerDown) {
      this.monitorLight.color.setHex(0xff3d52);
      this.monitorSpot.color.setHex(0xff5263);
    } else {
      this.monitorLight.color.setHex(0x5eb8ff);
      this.monitorSpot.color.setHex(0x7cc8ff);
    }
    this.monitorLight.intensity = 1.55 * screenFlicker;

    // 2. Central Hanging Warm-Yellow Pendant Lamp state (Integrated with Wall Switch!)
    const swayAmt = state.windowOpen ? 0.075 : 0.012;
    this.pendantGroup.rotation.z = Math.sin(time * 1.55) * swayAmt;
    this.pendantGroup.rotation.x = Math.cos(time * 1.15) * swayAmt * 0.5;

    if (state.lightsOn) {
      const dip = state.tension > 0.58 && Math.sin(time * 37.0) > 0.88 ? 0.25 : 1.0;
      this.roomBulbLight.intensity = 3.6 * dip;
      this.roomPendantSpot.intensity = 3.1 * dip;
      this.warmHemiLight.intensity = 0.78 * dip;
      this.bulbMesh.material.color.setHex(dip < 0.5 ? 0x99733a : 0xffe07d);
      this.shadeInnerMat.color.setHex(dip < 0.5 ? 0x775a30 : 0xffe49e);
      this.lampHaloMesh.visible = true;
      this.lampHaloMesh.material.opacity = 0.22 * dip;
      this.scene.fog.density = 0.028;
      this.refs.switchRocker.rotation.x = -0.24;
    } else {
      this.roomBulbLight.intensity = 0.0;
      this.roomPendantSpot.intensity = 0.0;
      this.warmHemiLight.intensity = 0.0;
      this.bulbMesh.material.color.setHex(0x1b1d24);
      this.shadeInnerMat.color.setHex(0x22242a);
      this.lampHaloMesh.visible = false;
      this.scene.fog.density = 0.056;
      this.refs.switchRocker.rotation.x = 0.24;
    }

    // 3. Window Sashes, Cold Wind Curtains & Drifting Mist Particles
    const targetSashAngle = state.windowOpen ? 1.08 : 0.0;
    this.refs.winLeft.pivot.rotation.y += (targetSashAngle - this.refs.winLeft.pivot.rotation.y) * Math.min(1, dt * 5);
    this.refs.winRight.pivot.rotation.y += (-targetSashAngle - this.refs.winRight.pivot.rotation.y) * Math.min(1, dt * 5);
    this.refs.windowEntity.group.visible = state.windowOpen && state.windowEntityPresent;
    if (this.refs.windowEntity.group.visible) {
      this.refs.windowEntity.headPivot.rotation.z = Math.sin(time * 3.5) * 0.18;
    }

    const windAmp = state.windowOpen ? 0.22 : 0.035;
    const windSpeed = state.windowOpen ? 6.8 : 2.1;
    const animateCurtain = (mesh, baseArr) => {
      const posAttr = mesh.geometry.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        const bx = baseArr[i * 3 + 0];
        const by = baseArr[i * 3 + 1];
        const bz = baseArr[i * 3 + 2];
        // Top edge (by ~ +0.775) stays pinned to rod; lower hem billows inward (-Z in local -> -X in world)
        const hangFactor = Math.max(0, (0.78 - by) / 1.55);
        const wave = Math.sin(time * windSpeed + bx * 5.0 + by * 2.5) * windAmp * hangFactor;
        posAttr.setXYZ(i, bx, by, bz + wave + (state.windowOpen ? hangFactor * 0.18 : 0));
      }
      posAttr.needsUpdate = true;
    };
    animateCurtain(this.refs.curtainL, this.refs.curtainBaseL);
    animateCurtain(this.refs.curtainR, this.refs.curtainBaseR);

    // Cold wind particles drifting from East window (+2.7) into the dark room (-X)
    const pAttr = this.refs.windParticles.geometry.attributes.position;
    const driftSpeed = state.windowOpen ? 2.1 : 0.35;
    this.refs.windParticles.material.opacity = state.windowOpen ? 0.62 : 0.24;
    for (let i = 0; i < pAttr.count; i++) {
      let px = pAttr.getX(i) - dt * driftSpeed;
      let py = pAttr.getY(i) + Math.sin(time * 2.0 + i) * dt * 0.15;
      let pz = pAttr.getZ(i) + Math.cos(time * 1.5 + i) * dt * 0.12;
      if (px < 0.55) {
        px = 2.75;
        py = 0.85 + Math.random() * 1.3;
        pz = -1.25 + Math.random() * 1.4;
      }
      pAttr.setXYZ(i, px, py, pz);
    }
    pAttr.needsUpdate = true;

    // 4. Mirror Reflection Sync (OR Uncanny Psychological Horror Doppelgänger!)
    const mHung = this.refs.mirrorHung;
    this.refs.mirrorCurseMesh.visible = state.mirrorCursed;
    if (state.mirrorCursed) {
      // CREEPY: Reflection stops obeying player movement, stands right behind glass staring at Hung!
      mHung.setDoppelgangerMode(true);
      mHung.group.position.set(-3.28, 0, -1.35);
      mHung.group.rotation.y = Math.PI / 2;
      mHung.headPivot.rotation.z = 0.34 + Math.sin(time * 4.0) * 0.05;
      mHung.setStandingPose(dt, false, time);
      this.refs.mirrorLight.color.setHex(0xff4a5a);
    } else {
      mHung.setDoppelgangerMode(false);
      mHung.headPivot.rotation.z = 0;
      this.refs.mirrorLight.color.setHex(0x8cb8e8);
      // Mirror across plane x = -2.8 -> reflectedX = -5.6 - playerPos.x
      if (state.isSeated) {
        mHung.group.position.set(-5.6 - 0, 0, -1.82);
        mHung.group.rotation.y = Math.PI;
        mHung.setSeatedTypingPose(time);
      } else {
        mHung.group.position.set(-5.6 - playerPos.x, 0, playerPos.z);
        // Mirror yaw across X-normal plane (x = -2.8) so reflection faces player when looking West!
        mHung.group.rotation.y = Math.PI - playerYaw;
        mHung.setStandingPose(dt, isMoving, time);
      }
    }

    // 5. Wardrobe Doors & Peeking Eyes
    const targetWardrobe = state.wardrobeOpen ? 0.62 : 0.0;
    this.refs.wardrobeDoorL.rotation.y += (-targetWardrobe - this.refs.wardrobeDoorL.rotation.y) * Math.min(1, dt * 4);
    this.refs.wardrobeDoorR.rotation.y += (targetWardrobe - this.refs.wardrobeDoorR.rotation.y) * Math.min(1, dt * 4);
    this.refs.wardrobeEyes.visible = state.wardrobeOpen;

    // 6. VN-UK Wall Poster Upside-Down Anomaly
    const targetPosterRot = state.posterInverted ? Math.PI : 0;
    this.refs.vnukPoster.rotation.z += (targetPosterRot - this.refs.vnukPoster.rotation.z) * Math.min(1, dt * 6);

    // 7. Router LEDs
    if (state.routerDown) {
      const blink = Math.floor(time * 8) % 2 === 0;
      this.refs.routerLedMat.color.setHex(blink ? 0xff1e2d : 0x3b070b);
      this.refs.routerLight.color.setHex(0xff1e2d);
      this.refs.routerLight.intensity = blink ? 0.75 : 0.1;
    } else {
      this.refs.routerLedMat.color.setHex(0x22c55e);
      this.refs.routerLight.color.setHex(0x22c55e);
      this.refs.routerLight.intensity = 0.3;
    }

    // 8. Nightstand Smartphone Ringing Glow & Vibration
    if (state.phoneRinging) {
      const pulse = Math.floor(time * 10) % 2 === 0;
      this.refs.phoneScreenMat.color.setHex(pulse ? 0xff2e43 : 0x3b82f6);
      this.refs.phoneLight.intensity = pulse ? 1.2 : 0.35;
      this.refs.phoneMesh.position.x = 0.42 + Math.sin(time * 55) * 0.008;
    } else {
      this.refs.phoneScreenMat.color.setHex(0x0c1322);
      this.refs.phoneLight.intensity = 0;
      this.refs.phoneMesh.position.x = 0.42;
    }

    // 9. Door Deadbolt, Frosted Privacy Glass & Strict Stranger Visibility (ONLY visible when peering through glass!)
    const targetBoltX = state.doorLocked ? 0.39 : 0.30;
    this.refs.deadboltSlide.position.x += (targetBoltX - this.refs.deadboltSlide.position.x) * Math.min(1, dt * 10);
    this.refs.corridorLight.intensity = Math.sin(time * 19.0) > 0.92 ? 0.15 : 0.65;

    if (this.refs.doorGlass) {
      // When pressing eyes right against the glass (peeringDoor), glass turns semi-clear so corridor & stranger are visible;
      // from inside the room (!peeringDoor), frosted glass blocks outside view completely!
      this.refs.doorGlass.material.opacity = state.peeringDoor ? 0.20 : 0.97;
    }
    this.refs.doorEntity.group.visible = Boolean(state.peeringDoor && state.doorKnocking && state.doorHasEntity);

    // 10. Seated Hung 3D model (shown on Title Screen & Ending Cutscene!) + 1st-Person Typing Hands!
    if (this.refs.seatedHung.group.visible) {
      this.refs.seatedHung.setSeatedTypingPose(time);
      this.refs.seatedHung.headPivot.rotation.y = Math.sin(time * 0.65) > 0.75
        ? Math.sin(time * 1.3) * 0.65
        : Math.sin(time * 1.1) * 0.08;
    }

    if (this.refs.fpHandsGroup) {
      this.refs.fpHandsGroup.visible = Boolean(state.showSeatedHands);
      if (state.showSeatedHands) {
        const lTap = state.leftHandTap || 0;
        const rTap = state.rightHandTap || 0;
        this.refs.fpHandLeft.rotation.x = -lTap * 0.22 + Math.sin(time * 2.5) * 0.015;
        this.refs.fpHandLeft.position.y = 0.835 - lTap * 0.022;
        this.refs.fpHandRight.rotation.x = -rTap * 0.22 + Math.cos(time * 2.5) * 0.015;
        this.refs.fpHandRight.position.y = 0.835 - rTap * 0.022;
      }
    }
  }
}
