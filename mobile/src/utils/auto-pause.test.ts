import { AutoPauseDetector } from './auto-pause';

describe('AutoPauseDetector', () => {
  it('retoma caminhada leve, sem exigir velocidade de corrida', () => {
    const detector = new AutoPauseDetector('walking');
    for (let s=0;s<=6;s++) detector.push({latitude:0,longitude:0,timestamp:s*1000,speed:0});
    expect(detector.push({latitude:0,longitude:0,timestamp:7000,speed:0.7})).toBe('resume');
  });
  it('não confunde perda de GPS com parada nem aceita pontos fora de ordem', () => {
    const detector = new AutoPauseDetector();
    const point = (timestamp: number) => ({latitude:0,longitude:0,timestamp,speed:0});
    detector.push(point(0)); detector.push(point(1000));
    expect(detector.push(point(30000))).toBeNull();
    expect(detector.push(point(2000))).toBeNull();
    expect(detector.paused()).toBe(false);
  });
  it('não usa GPS para pausar academia/yoga/natação', () => {
    for (const sport of ['gym','yoga','swimming']) {
      const detector = new AutoPauseDetector(sport);
      for (let s=0;s<20;s++) expect(detector.push({latitude:0,longitude:0,timestamp:s*1000,speed:0})).toBeNull();
    }
  });
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
