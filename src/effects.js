import * as THREE from 'three';

/**
 * 불꽃 파티클 관리
 */
let boostParticles = [];
let scene = null;

/**
 * 씬 초기화
 * @param {THREE.Scene} sceneRef - Three.js 씬
 */
export function initEffects(sceneRef) {
  scene = sceneRef;
}

/**
 * 불꽃 파티클 생성
 * @param {THREE.Vector3} position - 생성 위치
 */
export function createBoostFlame(position) {
  if (!scene) return;

  const flameColors = [0xff4500, 0xff6600, 0xff8c00, 0xffaa00, 0xffcc00, 0xffff00];

  // 파티클 여러 개 생성
  for (let i = 0; i < 3; i++) {
    const geo = new THREE.SphereGeometry(1.5 + Math.random(), 6, 6);
    const mat = new THREE.MeshBasicMaterial({
      color: flameColors[Math.floor(Math.random() * flameColors.length)],
      transparent: true,
      opacity: 1,
    });
    const particle = new THREE.Mesh(geo, mat);

    // 말 뒤쪽에서 생성 (꼬리 부근)
    particle.position.copy(position);
    particle.position.x += (Math.random() - 0.5) * 8;
    particle.position.y += 5 + Math.random() * 5;
    particle.position.z += 15 + Math.random() * 5; // 뒤쪽으로

    // 뒤쪽으로 퍼지는 속도
    particle.userData.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 0.5,
      Math.random() * 0.5 + 0.3,
      Math.random() * 1.5 + 0.5 // 뒤로 밀려남
    );
    particle.userData.life = 1.0;
    particle.userData.decay = 0.03 + Math.random() * 0.02;
    particle.userData.initialScale = particle.scale.x;

    scene.add(particle);
    boostParticles.push(particle);
  }
}

/**
 * 불꽃 파티클 업데이트
 */
export function updateBoostEffects() {
  for (let i = boostParticles.length - 1; i >= 0; i--) {
    const p = boostParticles[i];

    // 위치 업데이트
    p.position.add(p.userData.velocity);

    // 위로 올라가면서 작아짐
    p.userData.velocity.y += 0.02; // 위로 가속

    // 수명 감소
    p.userData.life -= p.userData.decay;
    p.material.opacity = p.userData.life;

    // 크기 줄어듦
    const scale = p.userData.initialScale * p.userData.life;
    p.scale.set(scale, scale, scale);

    // 색상 변화 (노란색 -> 빨간색 -> 투명)
    if (p.userData.life < 0.5) {
      p.material.color.setHex(0xff2200);
    }
    if (p.userData.life < 0.3) {
      p.material.color.setHex(0x880000);
    }

    // 수명 다하면 제거
    if (p.userData.life <= 0) {
      scene.remove(p);
      p.geometry.dispose();
      p.material.dispose();
      boostParticles.splice(i, 1);
    }
  }
}

/**
 * 부스트 이펙트 생성 (말 객체용)
 * @param {Object} horse - 말 객체
 */
export function emitBoostFlame(horse) {
  if (!horse || !horse.mesh) return;
  createBoostFlame(horse.mesh.position);
}

/**
 * 모든 이펙트 정리
 */
export function clearAllEffects() {
  boostParticles.forEach((p) => {
    scene.remove(p);
    p.geometry.dispose();
    p.material.dispose();
  });
  boostParticles = [];
}
