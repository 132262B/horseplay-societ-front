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
    targetPositionY: 6, // 바닥 위에 눕기
    rotationSpeed: 0.1, // 눕는 속도
    breathAmplitude: 0.3, // 숨쉬기 움직임
    breathSpeed: 0.5, // 숨쉬기 속도
    legFold: -0.5, // 다리 접기
  },
  // 서서 걸어가기 애니메이션 (사람처럼 직립 - 뒷발로 서기)
  walk: {
    targetRotationX: Math.PI / 3, // 앞으로 들어서 뒷발로 직립 (60도)
    targetPositionY: 16, // 높이 올라감
    rotationSpeed: 0.12,
    backLegSpeed: 3, // 뒷다리 걷기 속도
    backLegAmplitude: 0.4,
    frontLegWave: 0.3, // 앞다리 흔들기
    frontLegSpeed: 2, // 앞다리 회전 속도
    headBob: 0.3, // 머리 까딱
  },
  // 넘어지기 애니메이션
  fallen: {
    targetRotationX: 0, // 서있는 자세 유지
    targetPositionY: -8, // 기본 높이
    rotationSpeed: 0.2,
  },
  // 가만히 서있기 애니메이션
  idle: {
    breathAmplitude: 0.15, // 숨쉬기
    breathSpeed: 0.8,
    tailSwayAmplitude: 0.15, // 꼬리 살짝 흔들림
    tailSwaySpeed: 1,
    earFlickAmplitude: 0.05, // 귀 살짝 움직임
    earFlickSpeed: 2,
    headBobAmplitude: 0.03, // 머리 미세하게 움직임
    headBobSpeed: 0.5,
  },
  // 비틀비틀 애니메이션
  zigzag: {
    swayAmplitude: 30, // 좌우 흔들림 크기
    swaySpeed: 2, // 흔들림 속도
    bodyTiltAmplitude: 0.3, // 몸 기울기
    headSwayAmplitude: 0.4, // 머리 흔들림
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

  // 몸 위아래 움직임 (기본 높이 + 바운스)
  horse.mesh.position.y = 4 + Math.abs(Math.sin(time * body.bounceSpeed)) * body.bounceAmplitude;

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

  // 파닥파닥 (기본 높이 + 랜덤 바운스)
  horse.mesh.position.y = 4 + Math.random() * shock.bounceMax;
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
 * 서서 걸어가기 모션 업데이트 (뒷발로 직립 보행)
 * @param {Object} horse - 말 객체
 * @param {number} time - 현재 시간
 */
export function updateWalkMotion(horse, time) {
  const { walk } = MotionConfig;

  // 반전 상태 확인 - 반전 시 X축 회전 방향 반대
  const dir = horse.isReversed ? -1 : 1;
  const targetRotX = walk.targetRotationX * dir;

  // 몸을 앞으로 들어서 뒷발로 직립
  const currentRotX = horse.mesh.rotation.x;
  horse.mesh.rotation.x += (targetRotX - currentRotX) * walk.rotationSpeed;

  // 높이 올라감
  const currentY = horse.mesh.position.y;
  horse.mesh.position.y += (walk.targetPositionY - currentY) * walk.rotationSpeed;

  // 뒷다리(legs 0,1)로 걷기 - 아래로 뻗어서 지탱
  horse.legs[0].rotation.x = -0.8 + Math.sin(time * walk.backLegSpeed) * walk.backLegAmplitude;
  horse.legs[1].rotation.x = -0.8 + Math.sin(time * walk.backLegSpeed + Math.PI) * walk.backLegAmplitude;

  // 앞다리(legs 2,3) 360도 회전 (팔 휘두르기)
  horse.legs[2].rotation.x = time * walk.frontLegSpeed;
  horse.legs[3].rotation.x = time * walk.frontLegSpeed + Math.PI; // 반대 위상

  // 머리 위로 들고 까딱까딱
  horse.headGroup.rotation.x = -0.5 + Math.sin(time * 4) * walk.headBob;
  horse.headGroup.rotation.z = Math.sin(time * 2) * 0.2;

  // 꼬리 위로 세우고 흔들기
  horse.tail.rotation.x = 1.5;
  horse.tail.rotation.z = Math.sin(time * 3) * 0.5;

  // 귀 팔랑팔랑 (신남)
  horse.earL.rotation.z = -0.5 + Math.sin(time * 6) * 0.3;
  horse.earR.rotation.z = 0.5 + Math.sin(time * 6 + 1) * 0.3;
}

/**
 * 넘어지기 모션 업데이트 (서있는 자세에서 다리만 벌림)
 * @param {Object} horse - 말 객체
 * @param {number} time - 현재 시간
 */
export function updateFallenMotion(horse, time) {
  const { fallen, idle, tail, ear } = MotionConfig;

  // 서있는 자세 유지
  horse.mesh.rotation.x += (fallen.targetRotationX - horse.mesh.rotation.x) * fallen.rotationSpeed;
  horse.mesh.rotation.z += (0 - horse.mesh.rotation.z) * fallen.rotationSpeed;

  // 기본 높이 유지 + 숨쉬기
  const breathOffset = Math.sin(time * idle.breathSpeed) * idle.breathAmplitude;
  horse.mesh.position.y = fallen.targetPositionY + breathOffset;

  // 다리 벌리기 (J L 모양)
  // 뒷다리 뒤로 뻗기
  horse.legs[0].rotation.x += (-1.5 - horse.legs[0].rotation.x) * 0.15;
  horse.legs[1].rotation.x += (-1.5 - horse.legs[1].rotation.x) * 0.15;
  // 앞다리 앞으로 뻗기
  horse.legs[2].rotation.x += (1.5 - horse.legs[2].rotation.x) * 0.15;
  horse.legs[3].rotation.x += (1.5 - horse.legs[3].rotation.x) * 0.15;

  // 머리 아래로 떨구기
  horse.headGroup.rotation.x += (0.8 - horse.headGroup.rotation.x) * 0.1;

  // 꼬리 늘어뜨리기
  horse.tail.rotation.x = tail.baseRotationX;
  horse.tail.rotation.z = Math.sin(time * 0.5) * 0.1;

  // 귀 살짝 접기
  horse.earL.rotation.z = ear.baseRotationL - 0.2;
  horse.earR.rotation.z = ear.baseRotationR + 0.2;
}

/**
 * 가만히 서있기 모션 업데이트
 * @param {Object} horse - 말 객체
 * @param {number} time - 현재 시간
 */
export function updateIdleMotion(horse, time) {
  const { idle, ear, tail } = MotionConfig;

  // 숨쉬기 (몸통 미세하게 움직임) - 기본 높이 유지
  const breathOffset = Math.sin(time * idle.breathSpeed) * idle.breathAmplitude;
  horse.mesh.position.y = 4 + breathOffset; // 기본 높이 4

  // 다리는 가만히
  horse.legs.forEach((leg) => {
    leg.rotation.x += (0 - leg.rotation.x) * 0.1;
  });

  // 머리 미세하게 움직임
  horse.headGroup.rotation.x = Math.sin(time * idle.headBobSpeed) * idle.headBobAmplitude;
  horse.headGroup.rotation.z = Math.sin(time * idle.headBobSpeed * 0.7) * idle.headBobAmplitude * 0.5;

  // 꼬리 살짝 흔들림
  horse.tail.rotation.z = Math.sin(time * idle.tailSwaySpeed) * idle.tailSwayAmplitude;
  horse.tail.rotation.x = tail.baseRotationX;

  // 귀 가끔씩 움찔
  horse.earL.rotation.z = ear.baseRotationL + Math.sin(time * idle.earFlickSpeed) * idle.earFlickAmplitude;
  horse.earR.rotation.z = ear.baseRotationR + Math.sin(time * idle.earFlickSpeed + 2) * idle.earFlickAmplitude;
}

/**
 * 비틀비틀 모션 업데이트 (취한 것처럼 좌우로 흔들림)
 * @param {Object} horse - 말 객체
 * @param {number} time - 현재 시간
 * @returns {number} 좌우 이동량 (충돌 체크용)
 */
export function updateZigzagMotion(horse, time) {
  const { leg, body, zigzag, tail, ear } = MotionConfig;

  // 좌우로 비틀거리며 이동 (사인파)
  const swayOffset = Math.sin(time * zigzag.swaySpeed) * zigzag.swayAmplitude;

  // 원래 X 위치 저장 (첫 호출 시)
  if (horse.zigzagBaseX === undefined) {
    horse.zigzagBaseX = horse.mesh.position.x;
  }
  horse.mesh.position.x = horse.zigzagBaseX + swayOffset;

  // 몸 기울기 (이동 방향으로)
  horse.mesh.rotation.z = Math.sin(time * zigzag.swaySpeed) * zigzag.bodyTiltAmplitude;

  // 기본 높이 + 바운스
  horse.mesh.position.y = 4 + Math.abs(Math.sin(time * body.bounceSpeed)) * body.bounceAmplitude;

  // 다리 애니메이션 (달리기와 비슷하지만 약간 불규칙)
  horse.legs[0].rotation.x = Math.sin(time * leg.speed * 0.8) * leg.amplitude;
  horse.legs[1].rotation.x = Math.sin(time * leg.speed * 0.8 + Math.PI) * leg.amplitude;
  horse.legs[2].rotation.x = Math.sin(time * leg.speed * 0.8 + Math.PI) * leg.amplitude;
  horse.legs[3].rotation.x = Math.sin(time * leg.speed * 0.8) * leg.amplitude;

  // 머리 흔들림 (취한 느낌)
  horse.headGroup.rotation.x = Math.sin(time * 1.5) * 0.2;
  horse.headGroup.rotation.z = Math.sin(time * zigzag.swaySpeed) * zigzag.headSwayAmplitude;

  // 꼬리 흔들림
  horse.tail.rotation.z = Math.sin(time * 3) * 0.5;

  // 귀 팔랑거림
  horse.earL.rotation.z = ear.baseRotationL + Math.sin(time * 5) * 0.15;
  horse.earR.rotation.z = ear.baseRotationR + Math.sin(time * 5 + 1) * 0.15;

  return swayOffset; // 충돌 체크용으로 반환
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

  // 몸 위아래 움직임 (기본 높이 + 바운스)
  horse.mesh.position.y = 4 + Math.abs(Math.sin(time * body.bounceSpeed)) * body.bounceAmplitude * 0.7;

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
  horse.mesh.position.y = 4; // 기본 높이
  // 몸통 스케일 복구
  horse.body.scale.set(1, 1, 1);
  // 다리 복구
  horse.legs.forEach((leg) => {
    leg.rotation.x = 0;
  });
  // 귀 복구
  horse.earL.rotation.z = MotionConfig.ear.baseRotationL;
  horse.earR.rotation.z = MotionConfig.ear.baseRotationR;
  // zigzag 기준 위치 초기화
  if (horse.zigzagBaseX !== undefined) {
    horse.mesh.position.x = horse.zigzagBaseX;
    delete horse.zigzagBaseX;
  }
}

/**
 * 상태에 따른 모션 업데이트
 * @param {Object} horse - 말 객체
 * @param {string} status - 현재 상태
 * @param {number} wobbleOffset - 개별 오프셋
 */
export function updateMotion(horse, status, wobbleOffset) {
  const time = Date.now() * 0.015 + wobbleOffset;

  if (status === SkillType.IDLE) {
    updateIdleMotion(horse, time);
  } else if (status === SkillType.SHOCK) {
    updateShockMotion(horse, time);
  } else if (status === SkillType.BACK) {
    updateBackMotion(horse, time);
  } else if (status === SkillType.STUN) {
    updateStunMotion(horse, time);
  } else if (status === SkillType.WALK) {
    updateWalkMotion(horse, time);
  } else if (status === SkillType.FALLEN) {
    updateFallenMotion(horse, time);
  } else if (status === SkillType.ZIGZAG) {
    updateZigzagMotion(horse, time);
  } else {
    // RUN, BOOST 상태에서는 정상 자세로 복구
    const currentZ = horse.mesh.rotation.z;
    const currentX = horse.mesh.rotation.x;

    // Y축 회전 복구 (반전 상태가 아닐 때만)
    if (!horse.isReversed) {
      const currentY = horse.mesh.rotation.y;
      if (Math.abs(currentY) > 0.01) {
        horse.mesh.rotation.y += (0 - currentY) * MotionConfig.back.rotationSpeed;
      }
    }

    // Z축 회전 복구 (눕기에서 복구)
    if (Math.abs(currentZ) > 0.01) {
      horse.mesh.rotation.z += (0 - currentZ) * MotionConfig.stun.rotationSpeed;
    }

    // X축 회전 복구 (넘어지기에서 복구)
    if (Math.abs(currentX) > 0.01) {
      horse.mesh.rotation.x += (0 - currentX) * MotionConfig.fallen.rotationSpeed;
    }

    // 몸통 스케일 복구
    horse.body.scale.x += (1 - horse.body.scale.x) * 0.1;
    horse.body.scale.y += (1 - horse.body.scale.y) * 0.1;

    updateRunningMotion(horse, time);
  }
}
