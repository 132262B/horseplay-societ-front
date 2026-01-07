/**
 * 스킬 타입 정의
 */
export const SkillType = {
  IDLE: 'idle',     // 가만히 서있기
  RUN: 'run',
  BOOST: 'boost',
  STUN: 'stun',
  BACK: 'back',
  SHOCK: 'shock',
  WALK: 'walk',     // 서서 걸어가기 (좌우 넘어뜨림)
  FALLEN: 'fallen', // 넘어진 상태
};

/**
 * 스킬 설정
 */
export const SkillConfig = {
  [SkillType.BOOST]: {
    duration: 100,
    speedMultiplier: 2.5,
    message: (name) => `🚀 ${name}: 스퍼트 올립니다!`,
  },
  [SkillType.STUN]: {
    duration: 100,
    speedMultiplier: 0,
    message: (name) => `💤 ${name}: 잠시 딴청 피웁니다.`,
  },
  [SkillType.BACK]: {
    duration: 120, // 2초
    speedMultiplier: -0.2, // 20% 속도로 뒤로 이동
    message: (name) => `🔙 ${name}: 뒤로 갑니다?!`,
  },
  [SkillType.SHOCK]: {
    duration: 300,
    speedMultiplier: 0,
    message: (name) => `⚡ 쾅!!! ${name} 선수, 독주하다 벼락 맞았습니다!!`,
  },
  [SkillType.WALK]: {
    duration: 80,
    speedMultiplier: 2.5,
    message: (name) => `🚶 ${name}: 위협의 행진! 좌우를 밀어붙입니다!`,
  },
  [SkillType.FALLEN]: {
    duration: 120, // 2초
    speedMultiplier: 0,
    message: (name) => `💥 ${name}: 넘어졌습니다!`,
  },
};

/**
 * 랜덤 스킬 발동
 * @param {string} name - 말 이름
 * @param {Function} addLog - 로그 추가 함수
 * @returns {{ skill: string, duration: number } | null}
 */
export function triggerRandomSkill(name, addLog) {
  const r = Math.random();

  if (r < 0.3) {
    addLog(SkillConfig[SkillType.BOOST].message(name));
    return { skill: SkillType.BOOST, duration: SkillConfig[SkillType.BOOST].duration };
  } else if (r < 0.5) {
    addLog(SkillConfig[SkillType.STUN].message(name));
    return { skill: SkillType.STUN, duration: SkillConfig[SkillType.STUN].duration };
  } else if (r < 0.7) {
    addLog(SkillConfig[SkillType.BACK].message(name));
    return { skill: SkillType.BACK, duration: SkillConfig[SkillType.BACK].duration };
  }

  return null;
}

/**
 * 스킬에 따른 속도 계산
 * @param {string} status - 현재 상태
 * @param {number} baseSpeed - 기본 속도
 * @returns {number}
 */
export function calculateSkillSpeed(status, baseSpeed) {
  switch (status) {
    case SkillType.BOOST:
      return baseSpeed * SkillConfig[SkillType.BOOST].speedMultiplier;
    case SkillType.WALK:
      return SkillConfig[SkillType.WALK].speedMultiplier;
    case SkillType.STUN:
    case SkillType.SHOCK:
    case SkillType.FALLEN:
      return 0;
    case SkillType.BACK:
      return SkillConfig[SkillType.BACK].speedMultiplier;
    default:
      return baseSpeed;
  }
}

/**
 * 패널티(벼락) 적용
 * @param {string} name - 말 이름
 * @param {Function} addLog - 로그 추가 함수
 * @returns {{ skill: string, duration: number }}
 */
export function applyShockPenalty(name, addLog) {
  addLog(SkillConfig[SkillType.SHOCK].message(name));
  return {
    skill: SkillType.SHOCK,
    duration: SkillConfig[SkillType.SHOCK].duration,
  };
}
