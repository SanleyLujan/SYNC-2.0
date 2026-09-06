import { unwrapActivityHistory } from './activity-history';

const activity = {
  id: 'activity-1',
  user_id: 'user-1',
  sport: 'running',
  startTime: '2026-09-04T10:00:00.000Z',
  distance: 1_000,
  duration: 300,
  isCompleted: true,
};

describe('unwrapActivityHistory', () => {
  it('não transforma [lista vazia, total zero] em duas atividades', () => {
    expect(unwrapActivityHistory([[], 0])).toEqual([]);
  });

  it('extrai registros da resposta paginada do TypeORM', () => {
    expect(unwrapActivityHistory([[activity], 1])).toEqual([activity]);
  });

  it('mantém compatibilidade com lista simples e envelope legado', () => {
    expect(unwrapActivityHistory([activity])).toEqual([activity]);
    expect(unwrapActivityHistory({ activities: [activity] })).toEqual([activity]);
  });
});
