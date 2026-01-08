import * as THREE from 'three';
import { SkillType, SkillConfig, triggerRandomSkill, calculateSkillSpeed, applyShockPenalty } from './skills.js';
import { updateMotion, resetMotion } from './motion.js';
import { playThunder, playFirework, playCountSound, playHoofSound, playBoostSound, playRockBreakSound, playRockLandSound } from './sound.js';
import { initEffects, updateBoostEffects, emitBoostFlame, updateDustEffects, emitRunningDust } from './effects.js';
import { MapEventType, MapEventConfig, mapEventManager } from './mapEvents.js';

let scene, camera, renderer, dirLight;
let horses = [];
let isRacing = false;

let finishLineZ = -3500;
const ORIGINAL_FINISH_Z = -3500;

let frameCount = 0;
let finishedCount = 0;
let cameraMode = 0;
let lastCameraChange = 0; // 마지막 카메라 변경 시점
const CAMERA_COOLDOWN = 120; // 카메라 변경 쿨다운 (약 2초)
let cameraTarget = new THREE.Vector3(0, 10, -100); // 카메라가 바라보는 위치 (lerp용)
let raceStartFrame = 0; // 레이스 시작 프레임
const SKILL_DELAY = 180; // 스킬 사용 가능까지 딜레이 (3초 = 180프레임)

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

// --- 번개 이펙트 ---
let lightningBolts = [];

function createLightningBolt(targetPos) {
  const boltGroup = new THREE.Group();

  // 번개 시작점 (하늘 위)
  const startY = 300;
  const endY = targetPos.y + 30;

  // 지그재그 번개 생성
  const segments = 8;
  const points = [];
  points.push(new THREE.Vector3(targetPos.x, startY, targetPos.z));

  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const y = startY - (startY - endY) * t;
    const offsetX = (Math.random() - 0.5) * 40;
    const offsetZ = (Math.random() - 0.5) * 40;
    points.push(new THREE.Vector3(targetPos.x + offsetX, y, targetPos.z + offsetZ));
  }
  points.push(new THREE.Vector3(targetPos.x, endY, targetPos.z));

  // 메인 번개
  const curve = new THREE.CatmullRomCurve3(points);
  const tubeGeo = new THREE.TubeGeometry(curve, 20, 2, 8, false);
  const tubeMat = new THREE.MeshBasicMaterial({
    color: 0xffff00,
    transparent: true,
    opacity: 1
  });
  const mainBolt = new THREE.Mesh(tubeGeo, tubeMat);
  boltGroup.add(mainBolt);

  // 글로우 효과
  const glowGeo = new THREE.TubeGeometry(curve, 20, 6, 8, false);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xaaaaff,
    transparent: true,
    opacity: 0.5
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  boltGroup.add(glow);

  // 충격파 (바닥)
  const ringGeo = new THREE.RingGeometry(5, 30, 32);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffff00,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(targetPos.x, 1, targetPos.z);
  boltGroup.add(ring);

  boltGroup.userData.life = 1.0;
  boltGroup.userData.ring = ring;

  scene.add(boltGroup);
  lightningBolts.push(boltGroup);

  // 화면 플래시
  const flash = document.getElementById('flash-overlay');
  flash.style.opacity = 0.8;
  setTimeout(() => (flash.style.opacity = 0), 100);
}

function updateLightningEffects() {
  for (let i = lightningBolts.length - 1; i >= 0; i--) {
    const bolt = lightningBolts[i];
    bolt.userData.life -= 0.05;

    // 페이드 아웃
    bolt.children.forEach(child => {
      if (child.material) {
        child.material.opacity = bolt.userData.life;
      }
    });

    // 충격파 확장
    if (bolt.userData.ring) {
      bolt.userData.ring.scale.x += 0.3;
      bolt.userData.ring.scale.y += 0.3;
    }

    if (bolt.userData.life <= 0) {
      bolt.children.forEach(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
      scene.remove(bolt);
      lightningBolts.splice(i, 1);
    }
  }
}

// 맵 이벤트: 번개
function executeLightningEvent(config) {
  const activeHorses = horses.filter(h => !h.finished);
  const targetCount = Math.min(config.targetCount || 3, activeHorses.length);
  if (targetCount === 0) return;

  // 랜덤으로 선택
  const shuffled = [...activeHorses].sort(() => Math.random() - 0.5);
  const targets = shuffled.slice(0, targetCount);

  addLog(config.message);

  targets.forEach((horse, index) => {
    setTimeout(() => {
      createLightningBolt(horse.mesh.position.clone());
      horse.applyLightningStrike();
      playThunder();
    }, index * 300);
  });
}

// 맵 이벤트: 결승선 반전
function executeReverseGoalEvent(config) {
  addLog(config.message);

  // 새 결승선 위치 설정
  finishLineZ = config.newFinishZ;

  // 기존 결승선 제거 및 새 위치에 생성
  moveFinishLine(finishLineZ);

  // 모든 말 180도 회전 (뒤로 돌기)
  horses.forEach(horse => {
    if (!horse.finished) {
      horse.reverseDirection();
    }
  });

  // 화면 효과
  const flash = document.getElementById('flash-overlay');
  flash.style.background = 'rgba(255, 200, 0, 0.8)';
  flash.style.opacity = 1;
  setTimeout(() => {
    flash.style.opacity = 0;
    setTimeout(() => {
      flash.style.background = 'rgba(255, 255, 255, 0.9)';
    }, 300);
  }, 200);
}

// --- 장애물 낙하 이벤트 ---
let fallingObstacles = [];

/**
 * 장애물 모두 정리
 */
function clearObstacles() {
  fallingObstacles.forEach(obj => {
    scene.remove(obj);
    if (obj.children) {
      obj.children.forEach(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    }
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) obj.material.dispose();
  });
  fallingObstacles = [];
}

/**
 * 장애물 메시 생성 (바위 모양)
 */
function createObstacleMesh() {
  const group = new THREE.Group();

  // 바위 본체 (불규칙한 형태를 위해 여러 구 합성)
  const rockColors = [0x8b7355, 0x6b5344, 0x7a6352, 0x5c4a3d];
  const mainColor = rockColors[Math.floor(Math.random() * rockColors.length)];

  // 메인 바위
  const mainRock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(15 + Math.random() * 5, 1),
    new THREE.MeshLambertMaterial({ color: mainColor })
  );
  mainRock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
  group.add(mainRock);

  // 작은 돌기들
  for (let i = 0; i < 4; i++) {
    const bump = new THREE.Mesh(
      new THREE.DodecahedronGeometry(5 + Math.random() * 3, 0),
      new THREE.MeshLambertMaterial({ color: mainColor })
    );
    bump.position.set(
      (Math.random() - 0.5) * 15,
      (Math.random() - 0.5) * 15,
      (Math.random() - 0.5) * 15
    );
    group.add(bump);
  }

  return group;
}

/**
 * 맵 이벤트: 장애물 낙하
 */
function executeObstacleEvent(config) {
  const activeHorses = horses.filter(h => !h.finished);
  if (activeHorses.length === 0) return;

  // (참여수 / 2) - 1 개의 장애물 생성
  const obstacleCount = Math.max(1, Math.floor(activeHorses.length / 2) - 1);

  addLog(config.message);

  // 반전 상태 확인
  const isReversed = activeHorses.some(h => h.isReversed);

  // 랜덤 말들 선택 (장애물이 떨어질 위치 기준)
  const shuffled = [...activeHorses].sort(() => Math.random() - 0.5);
  const targetHorses = shuffled.slice(0, obstacleCount);

  targetHorses.forEach((horse, index) => {
    setTimeout(() => {
      const obstacle = createObstacleMesh();

      // 말 앞쪽에 떨어짐 (반전 상태 고려)
      const distanceAhead = config.obstacleDistance + Math.random() * 100;
      const targetZ = isReversed
        ? horse.mesh.position.z + distanceAhead
        : horse.mesh.position.z - distanceAhead;

      // X 위치는 말 위치 근처 (트랙 범위 내)
      const targetX = horse.mesh.position.x + (Math.random() - 0.5) * 50;

      obstacle.position.set(targetX, config.fallHeight, targetZ);
      obstacle.userData.targetY = 15; // 착지 높이
      obstacle.userData.fallSpeed = config.fallSpeed + Math.random() * 2;
      obstacle.userData.landed = false;
      obstacle.userData.rotation = new THREE.Vector3(
        (Math.random() - 0.5) * 0.2,
        (Math.random() - 0.5) * 0.2,
        (Math.random() - 0.5) * 0.2
      );

      scene.add(obstacle);
      fallingObstacles.push(obstacle);
    }, index * 200); // 순차적으로 떨어짐
  });
}

/**
 * 장애물 부서지는 이펙트
 */
function createObstacleBreakEffect(position) {
  const rockColors = [0x8b7355, 0x6b5344, 0x7a6352, 0x5c4a3d];
  const fragmentCount = 12;

  for (let i = 0; i < fragmentCount; i++) {
    // 작은 바위 조각
    const size = 3 + Math.random() * 5;
    const geo = new THREE.DodecahedronGeometry(size, 0);
    const mat = new THREE.MeshLambertMaterial({
      color: rockColors[Math.floor(Math.random() * rockColors.length)],
      transparent: true,
      opacity: 1,
    });
    const fragment = new THREE.Mesh(geo, mat);

    fragment.position.copy(position);
    fragment.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );

    // 방사형으로 튀어나감
    const angle = Math.random() * Math.PI * 2;
    const upAngle = Math.random() * Math.PI * 0.5;
    const speed = 3 + Math.random() * 4;
    fragment.userData.velocity = new THREE.Vector3(
      Math.cos(angle) * Math.cos(upAngle) * speed,
      Math.sin(upAngle) * speed + 2,
      Math.sin(angle) * Math.cos(upAngle) * speed
    );
    fragment.userData.rotationSpeed = new THREE.Vector3(
      (Math.random() - 0.5) * 0.3,
      (Math.random() - 0.5) * 0.3,
      (Math.random() - 0.5) * 0.3
    );
    fragment.userData.life = 1.0;
    fragment.userData.decay = 0.015 + Math.random() * 0.01;
    fragment.userData.isFragment = true;

    scene.add(fragment);
    fallingObstacles.push(fragment);
  }

  // 먼지 이펙트도 함께 발생
  createObstacleDustEffect(position);
}

/**
 * 장애물 착지 시 모래먼지 이펙트
 */
function createObstacleDustEffect(position) {
  const dustColors = [0xd2b48c, 0xc4a76c, 0xdeb887, 0xbc9a5c];

  for (let i = 0; i < 15; i++) {
    const geo = new THREE.SphereGeometry(3 + Math.random() * 2, 6, 6);
    const mat = new THREE.MeshBasicMaterial({
      color: dustColors[Math.floor(Math.random() * dustColors.length)],
      transparent: true,
      opacity: 0.8,
    });
    const particle = new THREE.Mesh(geo, mat);

    particle.position.copy(position);
    particle.position.x += (Math.random() - 0.5) * 30;
    particle.position.y = 5 + Math.random() * 10;
    particle.position.z += (Math.random() - 0.5) * 30;

    // 방사형으로 퍼짐
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 2;
    particle.userData.velocity = new THREE.Vector3(
      Math.cos(angle) * speed,
      Math.random() * 2 + 1,
      Math.sin(angle) * speed
    );
    particle.userData.life = 1.0;
    particle.userData.decay = 0.02 + Math.random() * 0.01;

    scene.add(particle);
    fallingObstacles.push(particle); // 같은 배열에서 관리
    particle.userData.isDust = true;
  }
}

/**
 * 장애물 업데이트 (낙하 애니메이션 + 충돌 체크)
 */
function updateObstacles() {
  for (let i = fallingObstacles.length - 1; i >= 0; i--) {
    const obj = fallingObstacles[i];

    // 먼지 파티클 처리
    if (obj.userData.isDust) {
      obj.position.add(obj.userData.velocity);
      obj.userData.velocity.y -= 0.05; // 중력
      obj.userData.velocity.x *= 0.98;
      obj.userData.velocity.z *= 0.98;

      obj.userData.life -= obj.userData.decay;
      obj.material.opacity = obj.userData.life * 0.8;

      const scale = 1 + (1 - obj.userData.life) * 2;
      obj.scale.set(scale, scale, scale);

      if (obj.userData.life <= 0 || obj.position.y < 0) {
        scene.remove(obj);
        obj.geometry.dispose();
        obj.material.dispose();
        fallingObstacles.splice(i, 1);
      }
      continue;
    }

    // 바위 조각 파티클 처리
    if (obj.userData.isFragment) {
      obj.position.add(obj.userData.velocity);
      obj.userData.velocity.y -= 0.15; // 중력
      obj.rotation.x += obj.userData.rotationSpeed.x;
      obj.rotation.y += obj.userData.rotationSpeed.y;
      obj.rotation.z += obj.userData.rotationSpeed.z;

      obj.userData.life -= obj.userData.decay;
      obj.material.opacity = obj.userData.life;

      if (obj.userData.life <= 0 || obj.position.y < -10) {
        scene.remove(obj);
        obj.geometry.dispose();
        obj.material.dispose();
        fallingObstacles.splice(i, 1);
      }
      continue;
    }

    // 장애물 낙하
    if (!obj.userData.landed) {
      // 회전하면서 낙하
      obj.rotation.x += obj.userData.rotation.x;
      obj.rotation.y += obj.userData.rotation.y;
      obj.rotation.z += obj.userData.rotation.z;

      // 낙하 (가속도)
      obj.userData.fallSpeed += 0.3;
      obj.position.y -= obj.userData.fallSpeed;

      // 착지 체크
      if (obj.position.y <= obj.userData.targetY) {
        obj.position.y = obj.userData.targetY;
        obj.userData.landed = true;

        // 착지 먼지 이펙트
        createObstacleDustEffect(obj.position);

        // 착지 소리
        playRockLandSound();

        // 화면 흔들림 효과
        camera.position.y += 5;
      }
    }

    // 충돌 체크 (착지된 장애물만)
    if (obj.userData.landed) {
      let collided = false;

      horses.forEach(horse => {
        if (horse.finished || horse.status === SkillType.FALLEN || collided) return;

        const dx = horse.mesh.position.x - obj.position.x;
        const dz = horse.mesh.position.z - obj.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        // 충돌 범위 (약 25)
        if (dist < 25) {
          horse.applyFallen();
          addLog(`💥 ${horse.name} 장애물에 부딪혔습니다!`);
          collided = true;
        }
      });

      // 충돌 시 장애물 부서짐
      if (collided) {
        createObstacleBreakEffect(obj.position.clone());
        playRockBreakSound();

        // 장애물 제거
        obj.children.forEach(child => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
        scene.remove(obj);
        fallingObstacles.splice(i, 1);
      }
    }
  }
}

// 결승선 이동
function moveFinishLine(newZ) {
  // 기존 결승선 객체 제거
  finishLineObjects.forEach((obj) => {
    scene.remove(obj);
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) obj.material.dispose();
  });
  finishLineObjects = [];

  // 새 위치에 결승선 생성
  const finishLineGeo = new THREE.BoxGeometry(currentTrackWidth + 20, 10, 15);
  const finishLineMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 }); // 초록색으로 변경
  const finishLine = new THREE.Mesh(finishLineGeo, finishLineMat);
  finishLine.position.set(0, 5, newZ);
  scene.add(finishLine);
  finishLineObjects.push(finishLine);

  const gatePostGeo = new THREE.BoxGeometry(10, 80, 10);
  const gatePostMat = new THREE.MeshStandardMaterial({ color: 0x00ff00 });

  const gateL = new THREE.Mesh(gatePostGeo.clone(), gatePostMat.clone());
  gateL.position.set(-currentTrackWidth / 2 - 15, 40, newZ);
  gateL.castShadow = true;
  scene.add(gateL);
  finishLineObjects.push(gateL);

  const gateR = new THREE.Mesh(gatePostGeo.clone(), gatePostMat.clone());
  gateR.position.set(currentTrackWidth / 2 + 15, 40, newZ);
  gateR.castShadow = true;
  scene.add(gateR);
  finishLineObjects.push(gateR);

  const gateTopGeo = new THREE.BoxGeometry(currentTrackWidth + 50, 15, 15);
  const gateTop = new THREE.Mesh(gateTopGeo, gatePostMat.clone());
  gateTop.position.set(0, 85, newZ);
  scene.add(gateTop);
  finishLineObjects.push(gateTop);

  // REVERSE 사인
  const finishCanvas = document.createElement('canvas');
  finishCanvas.width = 512;
  finishCanvas.height = 128;
  const fctx = finishCanvas.getContext('2d');
  fctx.fillStyle = '#00ff00';
  fctx.fillRect(0, 0, 512, 128);
  fctx.fillStyle = '#000000';
  fctx.font = 'bold 70px Arial';
  fctx.textAlign = 'center';
  fctx.fillText('REVERSE!', 256, 95);

  const finishTexture = new THREE.CanvasTexture(finishCanvas);
  const finishSignMat = new THREE.MeshBasicMaterial({ map: finishTexture });
  const finishSign = new THREE.Mesh(new THREE.PlaneGeometry(100, 25), finishSignMat);
  finishSign.position.set(0, 110, newZ + 1);
  scene.add(finishSign);
  finishLineObjects.push(finishSign);
}

// 맵 이벤트 체크 및 실행 (절반 지점에서 1회만)
function checkMapEvents() {
  if (mapEventManager.checkHalfwayReached(horses, ORIGINAL_FINISH_Z)) {
    // 랜덤으로 이벤트 1개 선택하여 실행
    mapEventManager.triggerRandomEvent({
      [MapEventType.LIGHTNING]: executeLightningEvent,
      [MapEventType.REVERSE_GOAL]: executeReverseGoalEvent,
      [MapEventType.OBSTACLE]: executeObstacleEvent,
    });
  }
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
let startLineObjects = [];

function createStartLine() {
  startLineObjects.forEach((obj) => {
    scene.remove(obj);
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) obj.material.dispose();
  });
  startLineObjects = [];

  const startLineZ = 0;

  // 체크 무늬 텍스처 생성
  const checkCanvas = document.createElement('canvas');
  checkCanvas.width = 128;
  checkCanvas.height = 32;
  const ctx = checkCanvas.getContext('2d');
  const squareSize = 16;

  for (let x = 0; x < checkCanvas.width; x += squareSize) {
    for (let y = 0; y < checkCanvas.height; y += squareSize) {
      const isWhite = ((x / squareSize) + (y / squareSize)) % 2 === 0;
      ctx.fillStyle = isWhite ? '#ffffff' : '#000000';
      ctx.fillRect(x, y, squareSize, squareSize);
    }
  }

  const checkTexture = new THREE.CanvasTexture(checkCanvas);
  checkTexture.wrapS = THREE.RepeatWrapping;
  checkTexture.wrapT = THREE.RepeatWrapping;
  checkTexture.repeat.set(currentTrackWidth / 30, 1);

  // 출발선 바닥 (체크 무늬)
  const startLineGeo = new THREE.PlaneGeometry(currentTrackWidth + 20, 10);
  const startLineMat = new THREE.MeshBasicMaterial({ map: checkTexture });
  const startLine = new THREE.Mesh(startLineGeo, startLineMat);
  startLine.rotation.x = -Math.PI / 2;
  startLine.position.set(0, 1, startLineZ); // 흰색 선보다 살짝 높게
  scene.add(startLine);
  startLineObjects.push(startLine);
}

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
    this.mesh.position.y = 4; // 기본 높이
    this.mesh.position.z = 0;

    scene.add(this.mesh);

    // 말마다 고유 속도 (1.2 ~ 1.6)
    this.baseSpeed = Math.random() * 0.4 + 1.2;
    this.speed = this.baseSpeed;
    this.finished = false;
    this.status = SkillType.RUN;
    this.statusTimer = 0;
    this.wobbleOffset = Math.random() * 100;
    this.rank = 0;
    this.walkUsed = false; // WALK 스킬 사용 여부 (1회만 사용 가능)
    this.laneIndex = index; // 레인 인덱스 저장 (좌우 말 찾기용)
    this.skillCooldown = 0; // 스킬 쿨다운 (1.5초 = 90프레임)
    this.isReversed = false; // 방향 반전 여부
    this.targetRotationY = 0; // 목표 Y축 회전
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
      // 러버밴딩 중간 (1등: -8%, 꼴등: +22%)
      const rubberBand = 0.92 + rankRatio * 0.3;
      this.speed = this.baseSpeed * rubberBand;
    }

    // 지속적인 속도 변동 (말마다 다른 리듬)
    const time = Date.now() * 0.001 + this.wobbleOffset;
    const speedVariation = Math.sin(time * 0.5) * 0.1 + Math.sin(time * 1.3) * 0.05;
    this.speed = this.speed * (1 + speedVariation);

    // 스킬에 따른 속도 계산 (모듈 사용)
    let currentSpeed = calculateSkillSpeed(this.status, this.speed);

    // 부스트 중이면 불꽃 이펙트 발생
    if (this.status === SkillType.BOOST && frameCount % 2 === 0) {
      emitBoostFlame(this);
    }

    // 달리는 중이면 먼지 발생 (3프레임마다)
    if ((this.status === SkillType.RUN || this.status === SkillType.BOOST) && frameCount % 3 === 0) {
      emitRunningDust(this);
    }

    // ZIGZAG 충돌 체크
    if (this.status === SkillType.ZIGZAG) {
      checkZigzagCollision(this);
    }

    // 방향 반전 시 180도 회전 (강제 적용)
    if (this.isReversed) {
      const currentRotY = this.mesh.rotation.y;
      if (Math.abs(currentRotY - Math.PI) > 0.01) {
        this.mesh.rotation.y += (Math.PI - currentRotY) * 0.15;
      } else {
        this.mesh.rotation.y = Math.PI;
      }
    }

    // 이동 (반전 시 반대 방향)
    if (this.isReversed) {
      this.mesh.position.z += currentSpeed;
    } else {
      this.mesh.position.z -= currentSpeed;
    }

    // 스킬 쿨다운 감소 (RUN 상태일 때만)
    if (this.skillCooldown > 0 && this.status === SkillType.RUN) this.skillCooldown--;

    // 랜덤 스킬 발동 (3초 후부터 가능, 쿨다운 체크)
    const skillAvailable = frameCount - raceStartFrame >= SKILL_DELAY;
    const canUseSkill = this.status === SkillType.RUN && skillAvailable && this.skillCooldown <= 0;

    if (canUseSkill && Math.random() < 0.0015) {
      // WALK 스킬 발동 (미사용 시 10% 확률)
      if (!this.walkUsed && Math.random() < 0.1) {
        this.walkUsed = true;
        this.status = SkillType.WALK;
        this.statusTimer = SkillConfig[SkillType.WALK].duration;
        this.skillCooldown = 90; // 1.5초 쿨다운
        addLog(SkillConfig[SkillType.WALK].message(this.name));
        // 좌우 말 넘어뜨리기
        knockdownAdjacentHorses(this);
      } else {
        // 일반 스킬 발동
        const result = triggerRandomSkill(this.name, addLog);
        if (result) {
          this.status = result.skill;
          this.statusTimer = result.duration;
          this.skillCooldown = 90; // 1.5초 쿨다운
          // 부스트 스킬이면 불꽃 소리
          if (result.skill === SkillType.BOOST) {
            playBoostSound();
          }
        }
      }
    }

    // 골인 체크 (방향에 따라 다름)
    const reachedFinish = this.isReversed
      ? this.mesh.position.z >= finishLineZ
      : this.mesh.position.z <= finishLineZ;

    if (reachedFinish) {
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

  applyLightningStrike() {
    // 번개 맞음
    this.status = SkillType.SHOCK;
    this.statusTimer = SkillConfig[SkillType.SHOCK].duration;

    this.bodyMat.color.setHex(0x000000);
    this.headMat.color.setHex(0x333333);

    addLog(`⚡ ${this.name} 번개에 맞았습니다!`);
  }

  applyFallen() {
    // 넘어짐 (장애물 충돌)
    if (this.status === SkillType.FALLEN) return; // 이미 넘어진 상태면 무시
    this.status = SkillType.FALLEN;
    this.statusTimer = SkillConfig[SkillType.FALLEN].duration;
  }

  reverseDirection() {
    // 이동 방향 반전
    this.isReversed = !this.isReversed;
    // 180도 회전 (정면으로 돌아서 가기)
    this.targetRotationY = this.isReversed ? Math.PI : 0;
    // 현재 회전값도 조정 (부드러운 전환을 위해)
    if (this.isReversed) {
      this.mesh.rotation.y = 0; // 시작점 리셋
    }
  }

  resetStatus() {
    this.status = SkillType.RUN;
    this.bodyMat.color.setHex(this.originalColor);
    this.headMat.color.setHex(this.originalColor);
    this.skillCooldown = 90; // 스킬 종료 후 1.5초 쿨다운
    resetMotion(this);
  }
}

/**
 * 좌우 인접한 말들을 넘어뜨림
 * @param {Horse3D} horse - WALK 스킬을 사용한 말
 */
function knockdownAdjacentHorses(horse) {
  const laneIndex = horse.laneIndex;

  horses.forEach((h) => {
    if (h === horse || h.finished) return;

    // 좌우 레인에 있는 말인지 확인
    if (h.laneIndex === laneIndex - 1 || h.laneIndex === laneIndex + 1) {
      // 비슷한 위치에 있는지 확인 (앞뒤 50m 이내)
      const distZ = Math.abs(h.mesh.position.z - horse.mesh.position.z);
      if (distZ < 50) {
        // 넘어뜨리기
        h.status = SkillType.FALLEN;
        h.statusTimer = SkillConfig[SkillType.FALLEN].duration;
        addLog(SkillConfig[SkillType.FALLEN].message(h.name));
      }
    }
  });
}

/**
 * ZIGZAG 충돌 체크 (비틀거리다 다른 말과 충돌하면 둘 다 넘어짐)
 * @param {Horse3D} horse - ZIGZAG 상태인 말
 */
const COLLISION_FALL_DURATION = 90; // 1.5초

function checkZigzagCollision(horse) {
  if (horse.status !== SkillType.ZIGZAG) return;

  horses.forEach((h) => {
    if (h === horse || h.finished || h.status === SkillType.FALLEN) return;

    // X, Z 좌표 기반 충돌 체크
    const dx = Math.abs(h.mesh.position.x - horse.mesh.position.x);
    const dz = Math.abs(h.mesh.position.z - horse.mesh.position.z);

    // 충돌 범위 (X: 15, Z: 30)
    if (dx < 15 && dz < 30) {
      // 둘 다 넘어짐
      horse.status = SkillType.FALLEN;
      horse.statusTimer = COLLISION_FALL_DURATION;
      h.status = SkillType.FALLEN;
      h.statusTimer = COLLISION_FALL_DURATION;

      addLog(`💥 ${horse.name}와(과) ${h.name} 충돌! 둘 다 넘어졌습니다!`);
    }
  });
}

function updateSystem() {
  if (!isRacing || horses.length === 0) return;

  // 반전 상태 확인 (모든 말이 함께 반전됨)
  const isReversed = horses.some((h) => h.isReversed);

  // 반전 상태면 Z가 큰 말이 선두, 아니면 Z가 작은 말이 선두
  let sorted = [...horses].filter((h) => !h.finished).sort((a, b) =>
    isReversed ? b.mesh.position.z - a.mesh.position.z : a.mesh.position.z - b.mesh.position.z
  );

  sorted.forEach((horse, index) => {
    horse.rank = index + 1;
  });

  let leader = sorted[0];
  let second = sorted[1];

  if (!leader) return;

  let dist = Math.floor(Math.abs(finishLineZ - leader.mesh.position.z));
  // 반전 상태면 Z가 결승선보다 크면 통과, 아니면 Z가 결승선보다 작으면 통과
  if (isReversed) {
    if (leader.mesh.position.z >= finishLineZ) dist = 0;
  } else {
    if (leader.mesh.position.z <= finishLineZ) dist = 0;
  }
  document.getElementById('distLabel').innerText = `선두 남은 거리: ${dist}m`;

  if (second && !leader.finished) {
    let gap = Math.abs(second.mesh.position.z - leader.mesh.position.z);
    document.getElementById('gapLabel').innerText = `2등과의 격차: ${Math.floor(gap)}m`;
    document.getElementById('gapLabel').style.color = gap > 300 ? '#ff4757' : 'white';
  }

  // 맵 이벤트 체크
  checkMapEvents();

  dirLight.position.z = leader.mesh.position.z + 100;
  dirLight.target.position.z = leader.mesh.position.z;
  dirLight.target.updateMatrixWorld();

  const targetPos = leader.mesh.position.clone();

  // 맵 이벤트 매니저 업데이트
  mapEventManager.update();

  // 카메라 위치와 타겟 결정
  let desiredPos;
  let desiredTarget;

  // 결승선 근처 (우선순위 최고)
  if (dist <= 500 && dist > 0) {
    desiredPos = new THREE.Vector3(400, 80, finishLineZ + 50);
    desiredTarget = new THREE.Vector3(0, 20, finishLineZ);
  }
  // 맵 이벤트 발동 중 (전체 조감도)
  else if (mapEventManager.isEventCameraActive()) {
    // 모든 말의 중심점 계산
    const activeHorses = horses.filter(h => !h.finished);
    let centerZ = 0;
    activeHorses.forEach(h => centerZ += h.mesh.position.z);
    centerZ /= activeHorses.length;

    desiredPos = new THREE.Vector3(0, 350, centerZ + 250);
    desiredTarget = new THREE.Vector3(0, 0, centerZ);
  }
  // 일반 카메라 모드
  else {
    // 카메라 모드 변경 (쿨다운 적용)
    const timeSinceLastChange = frameCount - lastCameraChange;
    if (frameCount % 350 === 0 && timeSinceLastChange >= CAMERA_COOLDOWN) {
      cameraMode = (cameraMode + 1) % 6;
      lastCameraChange = frameCount;
    }

    // 반전 상태면 카메라 방향도 반전
    const dir = leader.isReversed ? -1 : 1;

    switch (cameraMode) {
      case 0:
        desiredPos = new THREE.Vector3(0, 60, targetPos.z + 150 * dir);
        desiredTarget = new THREE.Vector3(0, 10, targetPos.z - 50 * dir);
        break;
      case 1:
      case 4:
        desiredPos = new THREE.Vector3(0, 300, targetPos.z + 100 * dir);
        desiredTarget = new THREE.Vector3(0, 0, targetPos.z);
        break;
      case 2:
      case 5:
        desiredPos = new THREE.Vector3(currentTrackWidth + 100, 60, targetPos.z);
        desiredTarget = new THREE.Vector3(0, 10, targetPos.z);
        break;
      case 3:
        // 가까이 볼 때는 더 멀리서 + 안정적인 타겟
        desiredPos = new THREE.Vector3(targetPos.x + 60, 40, targetPos.z + 80 * dir);
        desiredTarget = new THREE.Vector3(targetPos.x, 15, targetPos.z);
        break;
    }
  }

  // 카메라 위치와 타겟 모두 부드럽게 전환 (낮은 lerp = 더 부드러움)
  camera.position.lerp(desiredPos, 0.02);
  cameraTarget.lerp(desiredTarget, 0.02);
  camera.lookAt(cameraTarget);
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
  updateLightningEffects();
  updateDustEffects();
  updateObstacles();

  if (isRacing) {
    horses.forEach((h) => h.update());
    updateSystem();

    // 발굽 소리 (부하 최소화: 랜덤으로 달리는 말 중 1마리만)
    if (frameCount % 8 === 0) { // 8프레임마다 체크
      const runningHorses = horses.filter(h =>
        !h.finished && (h.status === SkillType.RUN || h.status === SkillType.BOOST)
      );
      if (runningHorses.length > 0 && Math.random() < 0.5) {
        playHoofSound(0.06); // 볼륨 낮게
      }
    }
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
  createStartLine();

  names.forEach((name, i) => horses.push(new Horse3D(name, i, names.length)));

  startCountdown(() => {
    document.getElementById('broadcast').style.display = 'block';
    isRacing = true;
    raceStartFrame = frameCount; // 스킬 딜레이 계산용
    finishLineZ = ORIGINAL_FINISH_Z; // 결승선 위치 리셋
    mapEventManager.reset(); // 맵 이벤트 리셋
    clearObstacles(); // 장애물 정리
    addLog(`📢 ${names.length}명 출발! 중간 지점에서 이벤트가 발생합니다!`);
  });
});

init();
