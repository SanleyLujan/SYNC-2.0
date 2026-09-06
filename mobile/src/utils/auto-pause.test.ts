import { AutoPauseDetector } from './auto-pause';

describe('AutoPauseDetector', () => {
  it('pausa após cinco segundos parado e retoma quando volta a se mover', () => {
    const detector = new AutoPauseDetector();
    let action: ReturnType<typeof detector.push> = null;
    for (let second = 0; second <= 6; second++) {
      action = detector.push({
        latitude: -23.55,
        longitude: -46.63,
        timestamp: second * 1000,
        speed: 0,
      });
    }
    expect(action).toBe('pause');
    expect(detector.paused()).toBe(true);

    expect(detector.push({
      latitude: -23.549,
      longitude: -46.63,
      timestamp: 7000,
      speed: 2,
    })).toBe('resume');
    expect(detector.paused()).toBe(false);
  });

  it('reset limpa a pausa e a janela anterior', () => {
    const detector = new AutoPauseDetector();
    for (let second = 0; second <= 6; second++) {
      detector.push({ latitude: 0, longitude: 0, timestamp: second * 1000, speed: 0 });
    }
    detector.reset();
    expect(detector.paused()).toBe(false);
    expect(detector.currentSpeed()).toBeNull();
  });
});
