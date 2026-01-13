/**
 * 오디오 컨텍스트 (싱글톤)
 */
let audioCtx = null;
let isMuted = false;
let isAudioUnlocked = false;
let masterVolume = 1.0; // 마스터 볼륨 (0~1)

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

/**
 * iOS Safari 등에서 오디오 unlock (첫 사용자 상호작용 시 호출)
 */
export async function unlockAudio() {
  if (isAudioUnlocked) return;

  const ctx = getAudioContext();

  // suspended 상태면 resume (await로 확실히 대기)
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch (e) {
      console.warn('AudioContext resume failed:', e);
    }
  }

  // 무음 버퍼 재생하여 완전히 unlock
  const buffer = ctx.createBuffer(1, 1, 22050);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start(0);

  // iOS Safari를 위한 추가 unlock 시도 - 짧은 oscillator 재생
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.001; // 거의 들리지 않는 볼륨
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(0);
    osc.stop(ctx.currentTime + 0.001);
  } catch (e) {
    // 무시
  }

  isAudioUnlocked = true;
  console.log('Audio unlocked for iOS Safari, state:', ctx.state);
}

/**
 * 음소거 상태 확인
 */
export function getIsMuted() {
  return isMuted;
}

/**
 * 음소거 토글
 */
export function toggleMute() {
  isMuted = !isMuted;
  return isMuted;
}

/**
 * 마스터 볼륨 설정
 * @param {number} volume - 볼륨 (0~1)
 */
export function setMasterVolume(volume) {
  masterVolume = Math.max(0, Math.min(1, volume));
  // BGM 볼륨도 조절
  if (bgmAudio) {
    bgmAudio.volume = 0.3 * masterVolume;
  }
  return masterVolume;
}

/**
 * 마스터 볼륨 가져오기
 */
export function getMasterVolume() {
  return masterVolume;
}

/**
 * 기본 톤 재생
 * @param {number} freq - 주파수
 * @param {string} type - 파형 타입 ('sine', 'square', 'sawtooth', 'triangle')
 * @param {number} dur - 지속 시간 (초)
 * @param {number} vol - 볼륨 (0~1)
 */
export function playTone(freq, type, dur, vol = 0.1) {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') ctx.resume();

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(ctx.destination);
  gain.gain.value = vol;

  osc.start();
  gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + dur);
  osc.stop(ctx.currentTime + dur);
}

/**
 * 천둥 소리 재생
 */
export function playThunder() {
  playTone(100, 'sawtooth', 0.5, 0.5);
  playTone(50, 'square', 0.8, 0.5);
}


// 순간이동 사운드
export function playTeleportSound() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') ctx.resume();

  // 워프 느낌의 상승음
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(200, ctx.currentTime);
  osc1.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.3);
  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  gain1.gain.setValueAtTime(0.3, ctx.currentTime);
  gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
  osc1.start();
  osc1.stop(ctx.currentTime + 0.4);

  // 공간 왜곡 느낌의 저음
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(80, ctx.currentTime);
  osc2.frequency.setValueAtTime(120, ctx.currentTime + 0.1);
  osc2.frequency.setValueAtTime(60, ctx.currentTime + 0.2);
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  gain2.gain.setValueAtTime(0.2, ctx.currentTime);
  gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
  osc2.start();
  osc2.stop(ctx.currentTime + 0.5);

  // 팝/스파클 효과음
  setTimeout(() => {
    playTone(800, 'sine', 0.1, 0.2);
    playTone(1000, 'sine', 0.08, 0.15);
    playTone(1200, 'sine', 0.06, 0.1);
  }, 150);
}

/**
 * 폭죽 소리 재생
 */
export function playFirework() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') ctx.resume();

  // 발사 소리 (휘이이잉)
  const launchOsc = ctx.createOscillator();
  const launchGain = ctx.createGain();

  launchOsc.type = 'sawtooth';
  launchOsc.frequency.setValueAtTime(200, ctx.currentTime);
  launchOsc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.3);
  launchOsc.connect(launchGain);
  launchGain.connect(ctx.destination);
  launchGain.gain.setValueAtTime(0.2, ctx.currentTime);
  launchGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
  launchOsc.start();
  launchOsc.stop(ctx.currentTime + 0.3);

  // 폭발 소리 (빵!)
  setTimeout(() => {
    // 노이즈 생성
    const bufferSize = ctx.sampleRate * 0.3;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.1));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.5, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    noise.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start();

    // 반짝이 소리 (찌지직)
    for (let j = 0; j < 5; j++) {
      setTimeout(() => {
        playTone(1000 + Math.random() * 2000, 'sine', 0.1, 0.1);
      }, j * 50);
    }
  }, 300);
}

/**
 * 카운트다운 소리 재생
 * @param {boolean} isGo - GO! 인지 여부
 */
export function playCountSound(isGo = false) {
  if (isGo) {
    playTone(800, 'square', 0.4, 0.4);
  } else {
    playTone(400, 'square', 0.2, 0.3);
  }
}

/**
 * 스퍼트(부스트) 불꽃 소리
 */
export function playBoostSound() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') ctx.resume();

  // 불꽃 소리 (쉬익~ 웅)
  const bufferSize = ctx.sampleRate * 0.4;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    // 노이즈 + 저주파 혼합
    const t = i / bufferSize;
    data[i] = (Math.random() * 2 - 1) * 0.3 * (1 - t) +
              Math.sin(i * 0.01) * 0.2 * (1 - t);
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  // 필터로 불꽃 느낌
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 800;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.35, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  noise.start();
}

/**
 * 바위 착지 소리 (쿵!)
 */
export function playRockLandSound() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') ctx.resume();

  // 묵직한 착지음
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(80, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.2);
  gain.gain.setValueAtTime(0.4, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.25);

  // 먼지/충격 노이즈
  const bufferSize = ctx.sampleRate * 0.15;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    const t = i / bufferSize;
    data[i] = (Math.random() * 2 - 1) * (1 - t) * 0.5;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.15, ctx.currentTime);
  noiseGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 400;

  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start();
}

/**
 * 바위 부서지는 소리
 */
export function playRockBreakSound() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') ctx.resume();

  // 충격음 (쿵)
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.1);
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.15);

  // 부서지는 소리 (쩌적)
  const bufferSize = ctx.sampleRate * 0.2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    const t = i / bufferSize;
    // 거친 노이즈
    data[i] = (Math.random() * 2 - 1) * (1 - t) * (1 - t);
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.2, ctx.currentTime);
  noiseGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

  // 하이패스로 날카로운 느낌
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 500;

  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start();
}

/**
 * 발굽 소리 재생 (최적화됨)
 * @param {number} volume - 볼륨 (0~1), 기본값 0.03 (매우 작게)
 */
let lastHoofTime = 0;
const HOOF_COOLDOWN = 80; // 최소 80ms 간격

export function playHoofSound(volume = 0.04) {
  if (isMuted) return;
  const now = Date.now();
  if (now - lastHoofTime < HOOF_COOLDOWN) return; // 쿨다운 체크
  lastHoofTime = now;

  const ctx = getAudioContext();
  if (ctx.state === 'suspended') ctx.resume();

  // 짧은 클릭음으로 발굽 소리 표현
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  // 랜덤 피치로 자연스러움 추가
  const pitch = 80 + Math.random() * 40;
  osc.type = 'triangle';
  osc.frequency.value = pitch;

  osc.connect(gain);
  gain.connect(ctx.destination);

  // 아주 짧고 빠르게 감쇠
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

  osc.start();
  osc.stop(ctx.currentTime + 0.05);
}

/**
 * 룰렛 회전 틱 사운드 (딸깍)
 */
export function playRouletteTickSound() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') ctx.resume();

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'square';
  osc.frequency.value = 800 + Math.random() * 200;
  osc.connect(gain);
  gain.connect(ctx.destination);

  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

  osc.start();
  osc.stop(ctx.currentTime + 0.05);
}

/**
 * 룰렛 시작 사운드 (드럼롤 느낌)
 */
export function playRouletteStartSound() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') ctx.resume();

  // 상승하는 톤
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(200, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.5);
  osc.connect(gain);
  gain.connect(ctx.destination);

  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

  osc.start();
  osc.stop(ctx.currentTime + 0.5);
}

/**
 * 룰렛 결과 사운드 (팡파레)
 */
export function playRouletteResultSound() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') ctx.resume();

  // 팡파레 효과 (3개의 음)
  const notes = [523, 659, 784]; // C5, E5, G5
  notes.forEach((freq, i) => {
    setTimeout(() => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);

      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    }, i * 100);
  });
}

/**
 * 비 소리 (지속적인 루프)
 */
let rainNoiseSource = null;
let rainGainNode = null;

export function startRainSound() {
  if (isMuted) return;
  if (rainNoiseSource) return; // 이미 재생 중

  const ctx = getAudioContext();
  if (ctx.state === 'suspended') ctx.resume();

  // 비 소리용 노이즈 버퍼 생성 (2초 루프)
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    // 부드러운 노이즈
    data[i] = (Math.random() * 2 - 1) * 0.5;
  }

  rainNoiseSource = ctx.createBufferSource();
  rainNoiseSource.buffer = buffer;
  rainNoiseSource.loop = true;

  // 밴드패스 필터로 비 소리 느낌
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 3000;
  filter.Q.value = 0.5;

  // 하이패스 필터로 저음 제거
  const highpass = ctx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 500;

  rainGainNode = ctx.createGain();
  rainGainNode.gain.setValueAtTime(0, ctx.currentTime);
  rainGainNode.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 1); // 페이드인

  rainNoiseSource.connect(filter);
  filter.connect(highpass);
  highpass.connect(rainGainNode);
  rainGainNode.connect(ctx.destination);

  rainNoiseSource.start();
}

export function stopRainSound() {
  if (!rainNoiseSource) return;

  const ctx = getAudioContext();

  // 페이드 아웃
  if (rainGainNode) {
    rainGainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
  }

  setTimeout(() => {
    if (rainNoiseSource) {
      rainNoiseSource.stop();
      rainNoiseSource.disconnect();
      rainNoiseSource = null;
    }
    if (rainGainNode) {
      rainGainNode.disconnect();
      rainGainNode = null;
    }
  }, 600);
}

/**
 * BGM 관련
 */
let bgmAudio = null;

export function playBGM() {
  if (bgmAudio) return; // 이미 재생 중

  bgmAudio = new Audio('/bgm.mp3');
  bgmAudio.loop = true;
  bgmAudio.volume = 0.3;

  if (!isMuted) {
    bgmAudio.play().catch(e => {
      console.warn('BGM 재생 실패:', e);
    });
  }
}

export function stopBGM() {
  if (!bgmAudio) return;

  bgmAudio.pause();
  bgmAudio.currentTime = 0;
  bgmAudio = null;
}

export function setBGMMuted(muted) {
  if (!bgmAudio) return;

  if (muted) {
    bgmAudio.pause();
  } else {
    bgmAudio.play().catch(() => {});
  }
}
