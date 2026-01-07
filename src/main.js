import * as THREE from 'three';
import { SkillType, triggerRandomSkill, calculateSkillSpeed, applyShockPenalty } from './skills.js';
import { updateMotion, resetMotion } from './motion.js';
import { playThunder, playFirework, playCountSound } from './sound.js';
import { initEffects, updateBoostEffects, emitBoostFlame } from './effects.js';

let scene, camera, renderer, dirLight;
let horses = [];
let isRacing = false;

const finishLineZ = -3500;
const PENALTY_THRESHOLD = 400;

let frameCount = 0;
let finishedCount = 0;
let cameraMode = 0;
let lastCameraChange = 0; // 마지막 카메라 변경 시점
const CAMERA_COOLDOWN = 120; // 카메라 변경 쿨다운 (약 2초)

const colors = [0xff6b6b, 0x4caf50, 0x5d5dff, 0xffa040, 0x8e5b4b, 0xcccccc, 0x00bcd4, 0x9c27b0];

// --- 폭죽 파티클 ---
let fireworkParticles = [];

function createFirework(position) {
  const particleCount = 100;
  const fireworkColors = [0xff0000, 0xffff00, 0x00ff00, 0x00ffff, 0xff00ff, 0xffa500, 0xffffff];

  for (let i = 0; i < particleCount; i++) {
    const geo = new THREE.SphereGeometry(1, 4, 4);
    const mat = new THREE.MeshBasicMaterial({
      color: fireworkColors[Math.floor(Math.random() * fireworkColors.length)],
      transparent: true,
      opacity: 1,
    });
    const particle = new THREE.Mesh(geo, mat);

    particle.position.copy(position);
    particle.position.y += 50;

    const angle = Math.random() * Math.PI * 2;
    const angle2 = Math.random() * Math.PI;
    const speed = 2 + Math.random() * 3;
    particle.userData.velocity = new THREE.Vector3(
      Math.sin(angle2) * Math.cos(angle) * speed,
      Math.cos(angle2) * speed + 2,
      Math.sin(angle2) * Math.sin(angle) * speed
    );
    particle.userData.life = 1.0;
    particle.userData.decay = 0.01 + Math.random() * 0.01;

    scene.add(particle);
    fireworkParticles.push(particle);
  }

  playFirework();
}

function updateFireworks() {
  for (let i = fireworkParticles.length - 1; i >= 0; i--) {
    const p = fireworkParticles[i];

    p.position.add(p.userData.velocity);
    p.userData.velocity.y -= 0.08;
    p.userData.velocity.multiplyScalar(0.98);

    p.userData.life -= p.userData.decay;
    p.material.opacity = p.userData.life;

    if (p.userData.life <= 0) {
      scene.remove(p);
      p.geometry.dispose();
      p.material.dispose();
      fireworkParticles.splice(i, 1);
    }
  }
}

function celebrateWinner(position) {
  createFirework(position);
  setTimeout(() => createFirework(new THREE.Vector3(position.x - 50, 0, position.z)), 300);
  setTimeout(() => createFirework(new THREE.Vector3(position.x + 50, 0, position.z)), 500);
  setTimeout(() => createFirework(new THREE.Vector3(position.x, 0, position.z - 30)), 700);
  setTimeout(() => createFirework(new THREE.Vector3(position.x + 30, 0, position.z + 30)), 900);
}

// --- 구름 배열 ---
let clouds = [];

function createSky() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, '#1e3c72');
  gradient.addColorStop(0.3, '#2a5298');
  gradient.addColorStop(0.6, '#87ceeb');
  gradient.addColorStop(1, '#b0e0e6');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);

  const skyTexture = new THREE.CanvasTexture(canvas);
  scene.background = skyTexture;
}

function createClouds() {
  const cloudGroup = new THREE.Group();

  for (let i = 0; i < 30; i++) {
    const cloud = new THREE.Group();
    const puffCount = 3 + Math.floor(Math.random() * 4);

    for (let j = 0; j < puffCount; j++) {
      const puffGeo = new THREE.SphereGeometry(20 + Math.random() * 30, 8, 6);
      const puffMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.85,
      });
      const puff = new THREE.Mesh(puffGeo, puffMat);
      puff.position.set(j * 25 - puffCount * 12, Math.random() * 10 - 5, Math.random() * 15 - 7);
      puff.scale.y = 0.6;
      cloud.add(puff);
    }

    cloud.position.set(Math.random() * 2000 - 1000, 150 + Math.random() * 200, Math.random() * -4500);
    cloud.userData.speed = 0.1 + Math.random() * 0.2;

    cloudGroup.add(cloud);
    clouds.push(cloud);
  }

  scene.add(cloudGroup);
}

function updateClouds() {
  clouds.forEach((cloud) => {
    cloud.position.x += cloud.userData.speed;
    if (cloud.position.x > 1200) {
      cloud.position.x = -1200;
    }
  });
}

// --- 트랙 설정 ---
const LANE_WIDTH = 30;
const MIN_LANES = 8;
const MAX_LANES = 20;
let currentTrackWidth = LANE_WIDTH * MIN_LANES;
let trackObjects = [];

function createGround() {
  const grassGeo = new THREE.PlaneGeometry(2000, 10000);
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x228b22 });
  const grass = new THREE.Mesh(grassGeo, grassMat);
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(0, -0.5, -2000);
  grass.receiveShadow = true;
  scene.add(grass);
}

function createTrack(laneCount) {
  trackObjects.forEach((obj) => {
    scene.remove(obj);
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) obj.material.dispose();
  });
  trackObjects = [];

  const lanes = Math.max(MIN_LANES, Math.min(MAX_LANES, laneCount));
  currentTrackWidth = LANE_WIDTH * lanes;

  const trackGeo = new THREE.PlaneGeometry(currentTrackWidth, 10000);
  const trackMat = new THREE.MeshStandardMaterial({ color: 0xc2956e });
  const track = new THREE.Mesh(trackGeo, trackMat);
  track.rotation.x = -Math.PI / 2;
  track.position.set(0, 0, -2000);
  track.receiveShadow = true;
  scene.add(track);
  trackObjects.push(track);

  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const lineGeo = new THREE.PlaneGeometry(2, 10000);

  for (let i = 1; i < lanes; i++) {
    const line = new THREE.Mesh(lineGeo.clone(), lineMat.clone());
    line.rotation.x = -Math.PI / 2;
    line.position.set(-currentTrackWidth / 2 + i * LANE_WIDTH, 0.5, -2000);
    scene.add(line);
    trackObjects.push(line);
  }

  const borderGeo = new THREE.PlaneGeometry(5, 10000);
  const borderMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });

  const leftBorder = new THREE.Mesh(borderGeo.clone(), borderMat.clone());
  leftBorder.rotation.x = -Math.PI / 2;
  leftBorder.position.set(-currentTrackWidth / 2, 0.5, -2000);
  scene.add(leftBorder);
  trackObjects.push(leftBorder);

  const rightBorder = new THREE.Mesh(borderGeo.clone(), borderMat.clone());
  rightBorder.rotation.x = -Math.PI / 2;
  rightBorder.position.set(currentTrackWidth / 2, 0.5, -2000);
  scene.add(rightBorder);
  trackObjects.push(rightBorder);

  const fencePostGeo = new THREE.BoxGeometry(3, 20, 3);
  const fencePostMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
  const fenceRailGeo = new THREE.BoxGeometry(2, 3, 100);
  const fenceRailMat = new THREE.MeshStandardMaterial({ color: 0xffffff });

  for (let z = 0; z > -4500; z -= 100) {
    const postL = new THREE.Mesh(fencePostGeo.clone(), fencePostMat.clone());
    postL.position.set(-currentTrackWidth / 2 - 30, 10, z);
    postL.castShadow = true;
    scene.add(postL);
    trackObjects.push(postL);

    const postR = new THREE.Mesh(fencePostGeo.clone(), fencePostMat.clone());
    postR.position.set(currentTrackWidth / 2 + 30, 10, z);
    postR.castShadow = true;
    scene.add(postR);
    trackObjects.push(postR);

    if (z > -4400) {
      const railL = new THREE.Mesh(fenceRailGeo.clone(), fenceRailMat.clone());
      railL.position.set(-currentTrackWidth / 2 - 30, 15, z - 50);
      scene.add(railL);
      trackObjects.push(railL);

      const railR = new THREE.Mesh(fenceRailGeo.clone(), fenceRailMat.clone());
      railR.position.set(currentTrackWidth / 2 + 30, 15, z - 50);
      scene.add(railR);
      trackObjects.push(railR);
    }
  }

  for (let dist = 500; dist <= 3500; dist += 500) {
    const markerCanvas = document.createElement('canvas');
    markerCanvas.width = 128;
    markerCanvas.height = 64;
    const mctx = markerCanvas.getContext('2d');
    mctx.fillStyle = '#ffffff';
    mctx.fillRect(0, 0, 128, 64);
    mctx.fillStyle = '#000000';
    mctx.font = 'bold 40px Arial';
    mctx.textAlign = 'center';
    mctx.fillText(`${dist}m`, 64, 48);

    const markerTexture = new THREE.CanvasTexture(markerCanvas);
    const markerMat = new THREE.MeshBasicMaterial({ map: markerTexture });
    const markerGeo = new THREE.PlaneGeometry(20, 10);

    const markerL = new THREE.Mesh(markerGeo.clone(), markerMat.clone());
    markerL.position.set(-currentTrackWidth / 2 - 50, 30, -dist);
    markerL.rotation.y = Math.PI / 4;
    scene.add(markerL);
    trackObjects.push(markerL);

    const markerR = new THREE.Mesh(markerGeo.clone(), markerMat.clone());
    markerR.position.set(currentTrackWidth / 2 + 50, 30, -dist);
    markerR.rotation.y = -Math.PI / 4;
    scene.add(markerR);
    trackObjects.push(markerR);
  }
}

let finishLineObjects = [];

function createFinishLine() {
  finishLineObjects.forEach((obj) => {
    scene.remove(obj);
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) obj.material.dispose();
  });
  finishLineObjects = [];

  const finishLineGeo = new THREE.BoxGeometry(currentTrackWidth + 20, 10, 15);
  const finishLineMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const finishLine = new THREE.Mesh(finishLineGeo, finishLineMat);
  finishLine.position.set(0, 5, finishLineZ);
  scene.add(finishLine);
  finishLineObjects.push(finishLine);

  const gatePostGeo = new THREE.BoxGeometry(10, 80, 10);
  const gatePostMat = new THREE.MeshStandardMaterial({ color: 0xffffff });

  const gateL = new THREE.Mesh(gatePostGeo.clone(), gatePostMat.clone());
  gateL.position.set(-currentTrackWidth / 2 - 15, 40, finishLineZ);
  gateL.castShadow = true;
  scene.add(gateL);
  finishLineObjects.push(gateL);

  const gateR = new THREE.Mesh(gatePostGeo.clone(), gatePostMat.clone());
  gateR.position.set(currentTrackWidth / 2 + 15, 40, finishLineZ);
  gateR.castShadow = true;
  scene.add(gateR);
  finishLineObjects.push(gateR);

  const gateTopGeo = new THREE.BoxGeometry(currentTrackWidth + 50, 15, 15);
  const gateTop = new THREE.Mesh(gateTopGeo, gatePostMat.clone());
  gateTop.position.set(0, 85, finishLineZ);
  scene.add(gateTop);
  finishLineObjects.push(gateTop);

  const finishCanvas = document.createElement('canvas');
  finishCanvas.width = 512;
  finishCanvas.height = 128;
  const fctx = finishCanvas.getContext('2d');
  fctx.fillStyle = '#ff0000';
  fctx.fillRect(0, 0, 512, 128);
  fctx.fillStyle = '#ffffff';
  fctx.font = 'bold 80px Arial';
  fctx.textAlign = 'center';
  fctx.fillText('FINISH', 256, 95);

  const finishTexture = new THREE.CanvasTexture(finishCanvas);
  const finishSignMat = new THREE.MeshBasicMaterial({ map: finishTexture });
  const finishSign = new THREE.Mesh(new THREE.PlaneGeometry(100, 25), finishSignMat);
  finishSign.position.set(0, 110, finishLineZ + 1);
  scene.add(finishSign);
  finishLineObjects.push(finishSign);
}

function init() {
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x87ceeb, 800, 4000);

  // 이펙트 시스템 초기화
  initEffects(scene);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 5000);
  camera.position.set(0, 50, 100);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  createSky();
  createClouds();
  createGround();
  createTrack(MIN_LANES);
  createFinishLine();

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  dirLight = new THREE.DirectionalLight(0xfffacd, 1.2);
  dirLight.position.set(100, 200, 100);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.left = -300;
  dirLight.shadow.camera.right = 300;
  dirLight.shadow.camera.top = 300;
  dirLight.shadow.camera.bottom = -300;
  scene.add(dirLight);

  const sunGeo = new THREE.SphereGeometry(50, 16, 16);
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
  const sun = new THREE.Mesh(sunGeo, sunMat);
  sun.position.set(500, 400, -2000);
  scene.add(sun);

  window.addEventListener('resize', onWindowResize);
  animate();
}

// --- 말 클래스 ---
class Horse3D {
  constructor(name, index, total) {
    this.name = name;
    this.mesh = new THREE.Group();
    this.originalColor = colors[index % colors.length];

    this.bodyMat = new THREE.MeshStandardMaterial({ color: this.originalColor });
    this.headMat = new THREE.MeshStandardMaterial({ color: this.originalColor });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const hoofMat = new THREE.MeshStandardMaterial({ color: 0x333333 });

    // 몸통
    const bodyGeo = new THREE.CapsuleGeometry(6, 18, 8, 16);
    this.body = new THREE.Mesh(bodyGeo, this.bodyMat);
    this.body.rotation.x = Math.PI / 2;
    this.body.position.set(0, 15, 0);
    this.body.castShadow = true;
    this.mesh.add(this.body);

    // 목+머리 그룹
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 18, -12);

    const neckGeo = new THREE.CylinderGeometry(3, 4, 14, 8);
    this.neck = new THREE.Mesh(neckGeo, this.bodyMat);
    this.neck.position.set(0, 5, -3);
    this.neck.rotation.x = -0.6;
    this.neck.castShadow = true;
    this.headGroup.add(this.neck);

    const headGeo = new THREE.BoxGeometry(5, 6, 14);
    this.head = new THREE.Mesh(headGeo, this.headMat);
    this.head.position.set(0, 12, -10);
    this.head.rotation.x = -0.3;
    this.head.castShadow = true;
    this.headGroup.add(this.head);

    const snoutGeo = new THREE.BoxGeometry(4, 4, 5);
    const snout = new THREE.Mesh(snoutGeo, this.headMat);
    snout.position.set(0, -1, -8);
    this.head.add(snout);

    const nostrilGeo = new THREE.SphereGeometry(0.5, 6, 6);
    const nostrilL = new THREE.Mesh(nostrilGeo, blackMat);
    nostrilL.position.set(-1, -1, -2.5);
    snout.add(nostrilL);
    const nostrilR = new THREE.Mesh(nostrilGeo, blackMat);
    nostrilR.position.set(1, -1, -2.5);
    snout.add(nostrilR);

    const eyeGeo = new THREE.SphereGeometry(1, 8, 8);
    const eyeL = new THREE.Mesh(eyeGeo, whiteMat);
    eyeL.position.set(-2.5, 1, -2);
    this.head.add(eyeL);
    const eyeR = new THREE.Mesh(eyeGeo, whiteMat);
    eyeR.position.set(2.5, 1, -2);
    this.head.add(eyeR);

    const pupilGeo = new THREE.SphereGeometry(0.5, 6, 6);
    const pupilL = new THREE.Mesh(pupilGeo, blackMat);
    pupilL.position.set(-0.3, 0, -0.7);
    eyeL.add(pupilL);
    const pupilR = new THREE.Mesh(pupilGeo, blackMat);
    pupilR.position.set(0.3, 0, -0.7);
    eyeR.add(pupilR);

    const earGeo = new THREE.ConeGeometry(1.5, 5, 4);
    this.earL = new THREE.Mesh(earGeo, this.bodyMat);
    this.earL.position.set(-2, 5, 0);
    this.earL.rotation.z = -0.3;
    this.earL.rotation.x = -0.2;
    this.head.add(this.earL);

    this.earR = new THREE.Mesh(earGeo, this.bodyMat);
    this.earR.position.set(2, 5, 0);
    this.earR.rotation.z = 0.3;
    this.earR.rotation.x = -0.2;
    this.head.add(this.earR);

    const maneGeo = new THREE.BoxGeometry(1, 4, 2);
    for (let i = 0; i < 5; i++) {
      const mane = new THREE.Mesh(maneGeo, blackMat);
      mane.position.set(0, 8 + i * 0.5, -2 - i * 2);
      mane.rotation.x = -0.5 - i * 0.1;
      this.headGroup.add(mane);
    }

    this.mesh.add(this.headGroup);

    // 꼬리
    const tailGeo = new THREE.CylinderGeometry(0.5, 1.5, 12, 6);
    this.tail = new THREE.Mesh(tailGeo, blackMat);
    this.tail.position.set(0, 16, 14);
    this.tail.rotation.x = 0.8;
    this.tail.castShadow = true;
    this.mesh.add(this.tail);

    // 다리
    this.legs = [];
    const legPositions = [
      { x: -4, z: 7 },
      { x: 4, z: 7 },
      { x: -4, z: -7 },
      { x: 4, z: -7 },
    ];

    legPositions.forEach((pos) => {
      const legGroup = new THREE.Group();
      legGroup.position.set(pos.x, 10, pos.z);

      const thighGeo = new THREE.CylinderGeometry(2, 1.5, 8, 6);
      const thigh = new THREE.Mesh(thighGeo, this.bodyMat);
      thigh.position.y = -2;
      thigh.castShadow = true;
      legGroup.add(thigh);

      const calfGeo = new THREE.CylinderGeometry(1.5, 1, 7, 6);
      const calf = new THREE.Mesh(calfGeo, this.bodyMat);
      calf.position.y = -9;
      calf.castShadow = true;
      legGroup.add(calf);

      const hoofGeo = new THREE.CylinderGeometry(1.2, 1.5, 2, 6);
      const hoof = new THREE.Mesh(hoofGeo, hoofMat);
      hoof.position.y = -13.5;
      hoof.castShadow = true;
      legGroup.add(hoof);

      this.mesh.add(legGroup);
      this.legs.push(legGroup);
    });

    // 이름표
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.beginPath();
    ctx.roundRect(0, 0, 256, 64, 10);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = 'white';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(name, 128, 43);
    this.label = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true })
    );
    this.label.scale.set(28, 7, 1);
    scene.add(this.label);

    // 배치
    const laneWidth = currentTrackWidth / total;
    this.mesh.position.x = index * laneWidth - currentTrackWidth / 2 + laneWidth / 2;
    this.mesh.position.z = 0;

    scene.add(this.mesh);

    this.baseSpeed = Math.random() * 0.15 + 0.75;
    this.speed = this.baseSpeed;
    this.finished = false;
    this.status = SkillType.RUN;
    this.statusTimer = 0;
    this.wobbleOffset = Math.random() * 100;
    this.rank = 0;
  }

  update() {
    this.label.position.set(this.mesh.position.x, this.mesh.position.y + 40, this.mesh.position.z);

    if (this.finished) return;

    // 모션 업데이트 (모듈 사용)
    updateMotion(this, this.status, this.wobbleOffset);

    // 상태이상 해제
    if (this.statusTimer > 0) {
      this.statusTimer--;
      if (this.statusTimer <= 0) this.resetStatus();
    }

    // 러버밴딩
    const totalHorses = horses.filter((h) => !h.finished).length;
    if (totalHorses > 1 && this.rank > 0) {
      const rankRatio = (this.rank - 1) / (totalHorses - 1);
      const rubberBand = 0.9 + rankRatio * 0.4;
      this.speed = this.baseSpeed * rubberBand;
    }

    if (Math.random() < 0.02) {
      this.speed = this.baseSpeed * (0.8 + Math.random() * 0.5);
    }

    // 스킬에 따른 속도 계산 (모듈 사용)
    let currentSpeed = calculateSkillSpeed(this.status, this.speed);

    // 부스트 중이면 불꽃 이펙트 발생
    if (this.status === SkillType.BOOST && frameCount % 2 === 0) {
      emitBoostFlame(this);
    }

    this.mesh.position.z -= currentSpeed;

    // 랜덤 스킬 발동 (모듈 사용)
    if (this.status === SkillType.RUN && Math.random() < 0.0015) {
      const result = triggerRandomSkill(this.name, addLog);
      if (result) {
        this.status = result.skill;
        this.statusTimer = result.duration;
      }
    }

    if (this.mesh.position.z <= finishLineZ) {
      this.finished = true;
      finishedCount++;
      addLog(`🏁 ${this.name} 골인!!!`);
      addToRank(this.name);

      if (finishedCount === 1) {
        celebrateWinner(this.mesh.position.clone());
        addLog(`🎉🎉🎉 ${this.name} 우승!!! 🎉🎉🎉`);
      }

      if (finishedCount >= 2) {
        isRacing = false;
        setTimeout(() => {
          addLog('🏆 경기 종료! 1, 2등이 결정되었습니다!');
          document.getElementById('rank-board').style.display = 'block';
        }, 1500);
      }
    }
  }

  applyPenalty() {
    // 패널티 적용 (모듈 사용)
    const result = applyShockPenalty(this.name, addLog);
    this.status = result.skill;
    this.statusTimer = result.duration;

    this.bodyMat.color.setHex(0x000000);
    this.headMat.color.setHex(0x333333);

    const flash = document.getElementById('flash-overlay');
    flash.style.opacity = 1;
    setTimeout(() => (flash.style.opacity = 0), 100);

    playThunder();
  }

  resetStatus() {
    this.status = SkillType.RUN;
    this.bodyMat.color.setHex(this.originalColor);
    this.headMat.color.setHex(this.originalColor);
    resetMotion(this);
  }
}

function updateSystem() {
  if (!isRacing || horses.length === 0) return;

  let sorted = [...horses].filter((h) => !h.finished).sort((a, b) => a.mesh.position.z - b.mesh.position.z);

  sorted.forEach((horse, index) => {
    horse.rank = index + 1;
  });

  let leader = sorted[0];
  let second = sorted[1];

  if (!leader) return;

  let dist = Math.floor(Math.abs(finishLineZ - leader.mesh.position.z));
  if (leader.mesh.position.z <= finishLineZ) dist = 0;
  document.getElementById('distLabel').innerText = `선두 남은 거리: ${dist}m`;

  if (second && !leader.finished) {
    let gap = Math.abs(second.mesh.position.z - leader.mesh.position.z);
    document.getElementById('gapLabel').innerText = `2등과의 격차: ${Math.floor(gap)}m`;
    document.getElementById('gapLabel').style.color = gap > 300 ? '#ff4757' : 'white';

    if (gap > PENALTY_THRESHOLD && leader.status === SkillType.RUN) {
      leader.applyPenalty();
    }
  }

  dirLight.position.z = leader.mesh.position.z + 100;
  dirLight.target.position.z = leader.mesh.position.z;
  dirLight.target.updateMatrixWorld();

  const targetPos = leader.mesh.position.clone();

  if (dist <= 500 && dist > 0) {
    const desiredPos = new THREE.Vector3(400, 80, finishLineZ + 50);
    camera.position.lerp(desiredPos, 0.03);
    camera.lookAt(new THREE.Vector3(0, 20, finishLineZ));
    return;
  }

  // 카메라 모드 변경 (쿨다운 적용)
  const timeSinceLastChange = frameCount - lastCameraChange;
  if (frameCount % 350 === 0 && timeSinceLastChange >= CAMERA_COOLDOWN) {
    cameraMode = (cameraMode + 1) % 6;
    lastCameraChange = frameCount;
  }

  // 기본 카메라 위치 (현재 모드에 따라)
  let desiredPos;
  switch (cameraMode) {
    case 0:
      desiredPos = new THREE.Vector3(0, 60, targetPos.z + 150);
      camera.lookAt(new THREE.Vector3(0, 10, targetPos.z - 50));
      break;
    case 1:
    case 4:
      desiredPos = new THREE.Vector3(0, 300, targetPos.z + 100);
      camera.lookAt(new THREE.Vector3(0, 0, targetPos.z));
      break;
    case 2:
    case 5:
      desiredPos = new THREE.Vector3(currentTrackWidth + 100, 60, targetPos.z);
      camera.lookAt(new THREE.Vector3(0, 10, targetPos.z));
      break;
    case 3:
      desiredPos = new THREE.Vector3(targetPos.x + 40, 30, targetPos.z + 60);
      camera.lookAt(targetPos);
      break;
  }

  // 벼락 맞으면 가까이서 보여주기 (쿨다운 적용)
  if (leader.status === SkillType.SHOCK && timeSinceLastChange >= CAMERA_COOLDOWN) {
    desiredPos = new THREE.Vector3(targetPos.x + 30, 20, targetPos.z + 40);
    camera.lookAt(targetPos);
    lastCameraChange = frameCount;
  }

  camera.position.lerp(desiredPos, 0.04);
}

function addLog(msg) {
  const el = document.getElementById('broadcast-text');
  el.innerText = msg;
  el.style.transform = 'scale(1.1)';
  setTimeout(() => (el.style.transform = 'scale(1)'), 150);
}

function addToRank(name) {
  const list = document.getElementById('rank-list');
  const li = document.createElement('li');
  li.innerText = `${finishedCount}위 : ${name}`;
  if (finishedCount === 1) li.classList.add('winner');
  list.appendChild(li);
}

function animate() {
  requestAnimationFrame(animate);
  frameCount++;

  updateClouds();
  updateFireworks();
  updateBoostEffects();

  if (isRacing) {
    horses.forEach((h) => h.update());
    updateSystem();
  }
  renderer.render(scene, camera);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function startCountdown(callback) {
  const countdownEl = document.getElementById('countdown');
  const counts = ['3', '2', '1', 'GO!'];
  let index = 0;

  countdownEl.style.display = 'block';

  function showNext() {
    if (index < counts.length) {
      countdownEl.textContent = counts[index];
      countdownEl.style.animation = 'none';
      countdownEl.offsetHeight;
      countdownEl.style.animation = 'countPulse 0.5s ease-out';

      // 사운드 모듈 사용
      playCountSound(index >= 3);

      index++;
      setTimeout(showNext, 800);
    } else {
      countdownEl.style.display = 'none';
      callback();
    }
  }

  showNext();
}

document.getElementById('startBtn').addEventListener('click', () => {
  const input = document.getElementById('names').value;
  let names = input
    .split('\n')
    .map((n) => n.trim())
    .filter((n) => n);

  if (names.length < 2) {
    alert('최소 2명 필요');
    return;
  }
  if (names.length > MAX_LANES) {
    alert(`최대 ${MAX_LANES}명까지 참가 가능합니다. 처음 ${MAX_LANES}명만 참가합니다.`);
    names = names.slice(0, MAX_LANES);
  }

  document.getElementById('setup-box').style.display = 'none';

  createTrack(names.length);
  createFinishLine();

  names.forEach((name, i) => horses.push(new Horse3D(name, i, names.length)));

  startCountdown(() => {
    document.getElementById('broadcast').style.display = 'block';
    isRacing = true;
    addLog(`📢 ${names.length}명 출발! 독주하면 위험합니다!`);
  });
});

init();
