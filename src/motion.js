import { SkillType } from './skills.js';

/**
 * 모션 설정
 */
export const MotionConfig = {
  // 다리 애니메이션
  leg: {
    amplitude: 0.6, // 다리 흔들림 크기
    speed: 1, // 애니메이션 속도
  },
  // 몸통 애니메이션
  body: {
    bounceAmplitude: 2, // 위아래 움직임 크기
    bounceSpeed: 2,
  },
  // 머리 애니메이션
  head: {
    nodAmplitude: 0.15, // 고개 끄덕임 크기
    nodSpeed: 2,
  },
  // 꼬리 애니메이션
  tail: {
    swayAmplitude: 0.4, // 좌우 흔들림
    swaySpeed: 3,
    baseRotationX: 0.8,
    bobAmplitude: 0.2, // 위아래 움직임
    bobSpeed: 2,
  },
  // 귀 애니메이션
  ear: {
    flickAmplitude: 0.1, // 팔랑거림
    flickSpeed: 4,
    baseRotationL: -0.3,
    baseRotationR: 0.3,
  },
  // 충격(벼락) 애니메이션
  shock: {
    shakeAmplitudeX: 0.15,
    shakeAmplitudeZ: 0.1,
    shakeSpeedX: 8,
    shakeSpeedZ: 6,
    bounceMax: 3,
  },
};

/**
 * 달리기 모션 업데이트
 * @param {Object} horse - 말 객체
 * @param {number} time - 현재 시간
 */
export function updateRunningMotion(horse, time) {
  const { leg, body, head, tail, ear } = MotionConfig;

  // 다리 애니메이션 (뒷다리와 앞다리가 교차)
  horse.legs[0].rotation.x = Math.sin(time * leg.speed) * leg.amplitude; // 뒷다리 왼쪽
  horse.legs[1].rotation.x = Math.sin(time * leg.speed + Math.PI) * leg.amplitude; // 뒷다리 오른쪽
  horse.legs[2].rotation.x = Math.sin(time * leg.speed + Math.PI) * leg.amplitude; // 앞다리 왼쪽
  horse.legs[3].rotation.x = Math.sin(time * leg.speed) * leg.amplitude; // 앞다리 오른쪽

  // 몸 위아래 움직임
  horse.mesh.position.y = Math.abs(Math.sin(time * body.bounceSpeed)) * body.bounceAmplitude;

  // 머리 위아래 흔들림 (달리는 느낌)
  horse.headGroup.rotation.x = Math.sin(time * head.nodSpeed) * head.nodAmplitude;

  // 꼬리 좌우 흔들림
  horse.tail.rotation.z = Math.sin(time * tail.swaySpeed) * tail.swayAmplitude;
  horse.tail.rotation.x = tail.baseRotationX + Math.sin(time * tail.bobSpeed) * tail.bobAmplitude;

  // 귀 팔랑거림
  horse.earL.rotation.z = ear.baseRotationL + Math.sin(time * ear.flickSpeed) * ear.flickAmplitude;
  horse.earR.rotation.z = ear.baseRotationR + Math.sin(time * ear.flickSpeed + 1) * ear.flickAmplitude;
}

/**
 * 충격(벼락) 모션 업데이트
 * @param {Object} horse - 말 객체
 * @param {number} time - 현재 시간
 */
export function updateShockMotion(horse, time) {
  const { shock } = MotionConfig;

  // 빠른 경련
  horse.mesh.rotation.x = Math.sin(time * shock.shakeSpeedX) * shock.shakeAmplitudeX;
  horse.mesh.rotation.z = Math.sin(time * shock.shakeSpeedZ) * shock.shakeAmplitudeZ;

  // 파닥파닥
  horse.mesh.position.y = Math.random() * shock.bounceMax;
}

/**
 * 모션 리셋
 * @param {Object} horse - 말 객체
 */
export function resetMotion(horse) {
  horse.mesh.rotation.set(0, 0, 0);
}

/**
 * 상태에 따른 모션 업데이트
 * @param {Object} horse - 말 객체
 * @param {string} status - 현재 상태
 * @param {number} wobbleOffset - 개별 오프셋
 */
export function updateMotion(horse, status, wobbleOffset) {
  const time = Date.now() * 0.015 + wobbleOffset;

  if (status === SkillType.SHOCK) {
    updateShockMotion(horse, time);
  } else {
    updateRunningMotion(horse, time);
  }
}
