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
  // 뒤로 가기 애니메이션
  back: {
    targetRotationY: Math.PI, // 180도 회전
    rotationSpeed: 0.15, // 회전 속도 (lerp)
  },
  // 딴청(잠자기) 애니메이션
  stun: {
    targetRotationZ: Math.PI / 2, // 90도 옆으로 눕기
    targetPositionY: -5, // 바닥에 눕기
    rotationSpeed: 0.1, // 눕는 속도
    breathAmplitude: 0.3, // 숨쉬기 움직임
    breathSpeed: 0.5, // 숨쉬기 속도
    legFold: -0.5, // 다리 접기
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
 * 딴청(잠자기) 모션 업데이트
 * @param {Object} horse - 말 객체
 * @param {number} time - 현재 시간
 */
export function updateStunMotion(horse, time) {
  const { stun } = MotionConfig;

  // 부드럽게 옆으로 눕기
  const currentZ = horse.mesh.rotation.z;
  horse.mesh.rotation.z += (stun.targetRotationZ - currentZ) * stun.rotationSpeed;

  // 바닥으로 내려가기
  const currentY = horse.mesh.position.y;
  horse.mesh.position.y += (stun.targetPositionY - currentY) * stun.rotationSpeed;

  // 다리 접기 (누운 상태)
  horse.legs.forEach((leg) => {
    const currentLegX = leg.rotation.x;
    leg.rotation.x += (stun.legFold - currentLegX) * stun.rotationSpeed;
  });

  // 숨쉬기 애니메이션 (배가 오르락내리락)
  const breathOffset = Math.sin(time * stun.breathSpeed) * stun.breathAmplitude;
  horse.body.scale.y = 1 + breathOffset * 0.1;
  horse.body.scale.x = 1 - breathOffset * 0.05;

  // 머리 푹 숙이기 (자는 중)
  const headTargetX = 0.3;
  horse.headGroup.rotation.x += (headTargetX - horse.headGroup.rotation.x) * stun.rotationSpeed;

  // 꼬리 늘어뜨리기
  horse.tail.rotation.x += (0.2 - horse.tail.rotation.x) * stun.rotationSpeed;
  horse.tail.rotation.z = Math.sin(time * 0.5) * 0.1; // 살짝 흔들림

  // 귀 접기 (자는 중)
  horse.earL.rotation.z += (-0.8 - horse.earL.rotation.z) * stun.rotationSpeed;
  horse.earR.rotation.z += (0.8 - horse.earR.rotation.z) * stun.rotationSpeed;
}

/**
 * 뒤로 가기 모션 업데이트
 * @param {Object} horse - 말 객체
 * @param {number} time - 현재 시간
 */
export function updateBackMotion(horse, time) {
  const { leg, body, head, tail, ear, back } = MotionConfig;

  // 부드럽게 180도 회전 (뒤를 바라봄)
  const currentY = horse.mesh.rotation.y;
  horse.mesh.rotation.y += (back.targetRotationY - currentY) * back.rotationSpeed;

  // 다리 애니메이션 (역방향으로 달리기)
  horse.legs[0].rotation.x = Math.sin(time * leg.speed) * leg.amplitude * 0.7;
  horse.legs[1].rotation.x = Math.sin(time * leg.speed + Math.PI) * leg.amplitude * 0.7;
  horse.legs[2].rotation.x = Math.sin(time * leg.speed + Math.PI) * leg.amplitude * 0.7;
  horse.legs[3].rotation.x = Math.sin(time * leg.speed) * leg.amplitude * 0.7;

  // 몸 위아래 움직임 (약간 줄임)
  horse.mesh.position.y = Math.abs(Math.sin(time * body.bounceSpeed)) * body.bounceAmplitude * 0.7;

  // 머리 흔들림
  horse.headGroup.rotation.x = Math.sin(time * head.nodSpeed) * head.nodAmplitude;

  // 꼬리 흔들림
  horse.tail.rotation.z = Math.sin(time * tail.swaySpeed) * tail.swayAmplitude;
  horse.tail.rotation.x = tail.baseRotationX + Math.sin(time * tail.bobSpeed) * tail.bobAmplitude;

  // 귀 팔랑거림
  horse.earL.rotation.z = ear.baseRotationL + Math.sin(time * ear.flickSpeed) * ear.flickAmplitude;
  horse.earR.rotation.z = ear.baseRotationR + Math.sin(time * ear.flickSpeed + 1) * ear.flickAmplitude;
}

/**
 * 모션 리셋
 * @param {Object} horse - 말 객체
 */
export function resetMotion(horse) {
  horse.mesh.rotation.set(0, 0, 0);
  horse.mesh.position.y = 0;
  // 몸통 스케일 복구
  horse.body.scale.set(1, 1, 1);
  // 다리 복구
  horse.legs.forEach((leg) => {
    leg.rotation.x = 0;
  });
  // 귀 복구
  horse.earL.rotation.z = MotionConfig.ear.baseRotationL;
  horse.earR.rotation.z = MotionConfig.ear.baseRotationR;
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
  } else if (status === SkillType.BACK) {
    updateBackMotion(horse, time);
  } else if (status === SkillType.STUN) {
    updateStunMotion(horse, time);
  } else {
    // RUN, BOOST 상태에서는 정상 자세로 복구
    const currentY = horse.mesh.rotation.y;
    const currentZ = horse.mesh.rotation.z;

    // Y축 회전 복구 (뒤로 가기에서 복구)
    if (Math.abs(currentY) > 0.01) {
      horse.mesh.rotation.y += (0 - currentY) * MotionConfig.back.rotationSpeed;
    }

    // Z축 회전 복구 (눕기에서 복구)
    if (Math.abs(currentZ) > 0.01) {
      horse.mesh.rotation.z += (0 - currentZ) * MotionConfig.stun.rotationSpeed;
    }

    // 몸통 스케일 복구
    horse.body.scale.x += (1 - horse.body.scale.x) * 0.1;
    horse.body.scale.y += (1 - horse.body.scale.y) * 0.1;

    updateRunningMotion(horse, time);
  }
}
