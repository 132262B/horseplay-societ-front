import { playRouletteTickSound, playRouletteStartSound, playRouletteResultSound } from './sound.js';

/**
 * 맵 이벤트 타입 정의
 */
export const MapEventType = {
  LIGHTNING: 'lightning',
  REVERSE_GOAL: 'reverse_goal', // 결승선 반전
  OBSTACLE: 'obstacle', // 하늘에서 장애물 낙하
};

/**
 * 이벤트별 슬롯머신 표시 정보
 */
export const MapEventDisplay = {
  // [MapEventType.LIGHTNING]: {
  //   name: '번개 낙뢰',
  //   color: '#ffff00',
  //   svg: `<svg viewBox="0 0 24 24" fill="#ffff00"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>`,
  // },
  [MapEventType.REVERSE_GOAL]: {
    name: '결승선 반전',
    color: '#00ff88',
    svg: `<svg viewBox="0 0 24 24" fill="#00ff88"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>`,
  },
  // [MapEventType.OBSTACLE]: {
  //   name: '장애물 낙하',
  //   color: '#ff6b6b',
  //   svg: `<svg viewBox="0 0 24 24" fill="#ff6b6b"><circle cx="12" cy="12" r="10"/><circle cx="8" cy="9" r="2" fill="#333"/><circle cx="15" cy="8" r="1.5" fill="#333"/><circle cx="16" cy="14" r="2" fill="#333"/><circle cx="9" cy="15" r="1.5" fill="#333"/></svg>`,
  // },
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
    this.rouletteActive = false; // 룰렛 활성 여부
    this.pendingCallbacks = null; // 룰렛 완료 후 실행할 콜백
  }

  /**
   * 리셋 (새 게임 시작 시)
   */
  reset() {
    this.eventTriggered = false;
    this.activeEvent = null;
    this.cameraTimer = 0;
    this.rouletteActive = false;
    this.pendingCallbacks = null;
    // 룰렛 숨기기
    const overlay = document.getElementById('roulette-overlay');
    if (overlay) overlay.style.display = 'none';
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
   * 룰렛을 돌려서 랜덤 이벤트 선택
   * @param {Object} callbacks - 이벤트별 콜백 { eventType: callback }
   */
  triggerRandomEvent(callbacks) {
    if (this.eventTriggered || this.rouletteActive) return null;

    this.eventTriggered = true;
    this.rouletteActive = true;
    this.pendingCallbacks = callbacks;

    // 룰렛 표시 및 회전
    this.showRoulette();

    return null; // 실제 이벤트는 룰렛 완료 후 결정
  }

  /**
   * 슬롯머신 표시 및 회전 애니메이션
   */
  showRoulette() {
    const overlay = document.getElementById('roulette-overlay');
    const slotMachine = document.getElementById('slot-machine');
    const reel = document.getElementById('slot-reel');
    const result = document.getElementById('slot-result');

    if (!overlay || !reel) return;

    // 사용 가능한 이벤트 목록 (MapEventDisplay에 정의된 것만)
    const eventTypes = Object.keys(MapEventDisplay);
    const eventCount = eventTypes.length;

    // 이벤트가 1개면 룰렛 없이 바로 발동
    if (eventCount === 1) {
      this.rouletteActive = false;
      this.executeEvent(eventTypes[0]);
      return;
    }

    // 랜덤으로 선택할 이벤트 결정
    const selectedIndex = Math.floor(Math.random() * eventCount);
    const selectedEvent = eventTypes[selectedIndex];

    // 릴 아이템 생성 (여러 번 반복해서 스크롤 효과)
    const totalSpins = 8; // 몇 바퀴 돌릴지
    const totalItems = eventCount * totalSpins + selectedIndex + 1;

    let reelHTML = '';
    for (let i = 0; i < totalItems; i++) {
      const eventIndex = i % eventCount;
      const eventType = eventTypes[eventIndex];
      const displayInfo = MapEventDisplay[eventType];
      reelHTML += `
        <div class="slot-item" style="color: ${displayInfo.color}">
          ${displayInfo.svg}
          <span class="slot-item-label" style="color: ${displayInfo.color}">${displayInfo.name}</span>
        </div>
      `;
    }
    reel.innerHTML = reelHTML;

    // 초기화
    overlay.style.display = 'flex';
    reel.style.transition = 'none';
    reel.style.transform = 'translateY(0)';
    result.classList.remove('show');
    result.textContent = '';

    // 약간의 딜레이 후 회전 시작
    setTimeout(() => {
      // 시작 사운드
      playRouletteStartSound();

      // 슬롯머신 글로우 효과
      slotMachine.classList.add('spinning');

      // 최종 위치 계산 (아이템 높이 120px)
      const itemHeight = 120;
      const finalPosition = (totalItems - 1) * itemHeight;

      // 회전 애니메이션
      reel.style.transition = 'transform 3s cubic-bezier(0.15, 0.85, 0.20, 1)';
      reel.style.transform = `translateY(-${finalPosition}px)`;

      // 틱 사운드 (회전 중) - 점점 느려지는 간격
      let tickCount = 0;
      let tickDelay = 50;
      let tickStopped = false;
      const playTick = () => {
        if (tickCount < 25 && !tickStopped) { // 25번으로 줄임 (약 2.5초)
          playRouletteTickSound();
          tickCount++;
          tickDelay = 60 + tickCount * 10; // 점점 느려짐
          setTimeout(playTick, tickDelay);
        }
      };
      playTick();

      // 3초 후 틱 사운드 강제 중지
      setTimeout(() => {
        tickStopped = true;
      }, 2800);

      // 회전 완료 후 결과 표시
      setTimeout(() => {
        slotMachine.classList.remove('spinning');

        // 결과 표시
        const displayInfo = MapEventDisplay[selectedEvent];
        if (displayInfo) {
          result.innerHTML = `${displayInfo.svg.replace('width="60"', 'width="24"').replace('height="60"', 'height="24"')} ${displayInfo.name}`;
          result.style.color = displayInfo.color;
          result.classList.add('show');
        }

        // 결과 사운드
        playRouletteResultSound();

        // 잠시 후 슬롯머신 숨기고 이벤트 실행
        setTimeout(() => {
          overlay.style.display = 'none';
          result.classList.remove('show');
          this.rouletteActive = false;

          // 이벤트 실행
          this.executeEvent(selectedEvent);
        }, 1500);
      }, 3000);
    }, 300);
  }

  /**
   * 선택된 이벤트 실행
   * @param {string} selectedEvent - 선택된 이벤트 타입
   */
  executeEvent(selectedEvent) {
    const config = MapEventConfig[selectedEvent];

    this.activeEvent = selectedEvent;
    this.cameraTimer = config.cameraDuration || 180;

    // 해당 이벤트 콜백 실행
    if (this.pendingCallbacks && this.pendingCallbacks[selectedEvent]) {
      this.pendingCallbacks[selectedEvent](config);
    }

    this.pendingCallbacks = null;
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
    return this.cameraTimer > 0 || this.rouletteActive;
  }

  /**
   * 룰렛이 현재 돌아가고 있는지 확인
   * @returns {boolean}
   */
  isRouletteSpinning() {
    return this.rouletteActive;
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
