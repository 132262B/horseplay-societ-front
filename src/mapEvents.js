/**
 * 맵 이벤트 타입 정의
 */
export const MapEventType = {
  LIGHTNING: 'lightning',
  REVERSE_GOAL: 'reverse_goal', // 결승선 반전
  OBSTACLE: 'obstacle', // 하늘에서 장애물 낙하
};

/**
 * 맵 이벤트 설정
 */
export const MapEventConfig = {
  [MapEventType.LIGHTNING]: {
    name: '번개',
    triggerCondition: 'halfway', // 'halfway', 'distance', 'time', 'random'
    triggerValue: 0.5, // halfway = 50% 지점
    targetCount: 3, // 영향 받는 말 수
    message: '⚡⚡⚡ 하늘에서 번개가 내려옵니다!!!',
    cameraDuration: 180, // 카메라 전환 시간 (3초)
  },
  [MapEventType.REVERSE_GOAL]: {
    name: '결승선 반전',
    triggerCondition: 'distance',
    triggerValue: 3000, // 선두가 3000m 도달 시
    message: '🔄🔄🔄 반전!! 결승선이 출발지로 이동합니다!!!',
    cameraDuration: 180,
    newFinishZ: 500, // 새 결승선 위치 (출발지 뒤쪽)
  },
  [MapEventType.OBSTACLE]: {
    name: '장애물 낙하',
    triggerCondition: 'halfway',
    triggerValue: 0.5,
    message: '☄️☄️☄️ 하늘에서 장애물이 떨어집니다!!!',
    cameraDuration: 240, // 4초
    obstacleDistance: 200, // 말 앞 거리
    fallHeight: 300, // 낙하 시작 높이
    fallSpeed: 5, // 낙하 속도
  },
};

/**
 * 맵 이벤트 매니저 클래스
 */
export class MapEventManager {
  constructor() {
    this.eventTriggered = false; // 이벤트 발동 여부 (1회만)
    this.activeEvent = null; // 현재 활성 이벤트
    this.cameraTimer = 0; // 이벤트 카메라 타이머
  }

  /**
   * 리셋 (새 게임 시작 시)
   */
  reset() {
    this.eventTriggered = false;
    this.activeEvent = null;
    this.cameraTimer = 0;
  }

  /**
   * 절반 지점 통과 체크
   * @param {Array} horses - 말 배열
   * @param {number} finishLineZ - 결승선 Z 좌표
   * @returns {boolean}
   */
  checkHalfwayReached(horses, finishLineZ) {
    if (this.eventTriggered) return false;

    const halfwayZ = finishLineZ * 0.5;
    return horses.every(h => h.mesh.position.z <= halfwayZ || h.finished);
  }

  /**
   * 랜덤 이벤트 선택 및 발동
   * @param {Object} callbacks - 이벤트별 콜백 { eventType: callback }
   */
  triggerRandomEvent(callbacks) {
    if (this.eventTriggered) return null;

    // 사용 가능한 이벤트 목록
    const eventTypes = Object.keys(MapEventConfig);
    if (eventTypes.length === 0) return null;

    // 랜덤 선택
    const randomIndex = Math.floor(Math.random() * eventTypes.length);
    const selectedEvent = eventTypes[randomIndex];
    const config = MapEventConfig[selectedEvent];

    this.eventTriggered = true;
    this.activeEvent = selectedEvent;
    this.cameraTimer = config.cameraDuration || 180;

    // 해당 이벤트 콜백 실행
    if (callbacks && callbacks[selectedEvent]) {
      callbacks[selectedEvent](config);
    }

    return selectedEvent;
  }

  /**
   * 매 프레임 업데이트
   * @returns {boolean} 이벤트 카메라 활성 여부
   */
  update() {
    if (this.cameraTimer > 0) {
      this.cameraTimer--;
      if (this.cameraTimer <= 0) {
        this.activeEvent = null;
      }
      return true;
    }
    return false;
  }

  /**
   * 현재 활성 이벤트 설정 가져오기
   * @returns {Object|null}
   */
  getActiveEventConfig() {
    if (!this.activeEvent) return null;
    return MapEventConfig[this.activeEvent];
  }

  /**
   * 이벤트 카메라 활성 여부
   * @returns {boolean}
   */
  isEventCameraActive() {
    return this.cameraTimer > 0;
  }

  /**
   * 새 이벤트 타입 등록
   * @param {string} type - 이벤트 타입 키
   * @param {Object} config - 이벤트 설정
   */
  static registerEvent(type, config) {
    MapEventType[type.toUpperCase()] = type.toLowerCase();
    MapEventConfig[type.toLowerCase()] = config;
  }
}

// 싱글톤 인스턴스
export const mapEventManager = new MapEventManager();
