/**
 * 오디오 컨텍스트 (싱글톤)
 */
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

/**
 * 기본 톤 재생
 * @param {number} freq - 주파수
 * @param {string} type - 파형 타입 ('sine', 'square', 'sawtooth', 'triangle')
 * @param {number} dur - 지속 시간 (초)
 * @param {number} vol - 볼륨 (0~1)
 */
export function playTone(freq, type, dur, vol = 0.1) {
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

/**
 * 폭죽 소리 재생
 */
export function playFirework() {
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
