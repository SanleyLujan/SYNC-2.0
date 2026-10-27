import { DataSource } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { testDataSource } from '../common/testing/test-data-source';
import { User } from '../users/entities/user.entity';
import { EventsService } from './events.service';
import { Event } from './entities/event.entity';
import { EventParticipant } from './entities/event-participant.entity';
import { EventComment } from './entities/event-comment.entity';

describe('event attendance (real database)', () => {
  let db: DataSource, service: EventsService, creator: User, first: User, second: User;
  beforeEach(async () => {
    db = await testDataSource();
    [creator, first, second] = await db.getRepository(User).save(['creator', 'first', 'second'].map(name => ({
      name, email: `${name}@events.test.invalid`, password: 'hash', latitude: 0, longitude: 0,
    })));
    service = new EventsService(db.getRepository(Event), db.getRepository(EventParticipant),
      db.getRepository(EventComment), db.getRepository(User), { create: jest.fn() } as any);
  });
  afterEach(async () => { await db?.destroy(); });
  const create = (maxParticipants = 10) => service.create(creator.id, {
    title: 'Evento de teste', sport: 'running', latitude: 0, longitude: 0,
    date: new Date(Date.now() + 3_600_000).toISOString(), maxParticipants,
  });

  it('devolve zero ao criar e a inscrição confirmada ao entrar', async () => {
    const event = await create();
    expect(event).toMatchObject({ participantCount: 0, isJoined: false });
    const joined = await service.join(first.id, event.id);
    expect(joined).toMatchObject({ participantCount: 1, isJoined: true });
    expect(joined.participants[0]).toMatchObject({ joinedAt: expect.any(Date), user: { id: first.id } });
    expect(joined.participants[0].user).not.toHaveProperty('email');
    expect(joined.creator).not.toHaveProperty('password');
  });

  it('mantém a mesma contagem no mapa, detalhe e meus eventos de contas diferentes', async () => {
    const event = await create();
    await service.join(first.id, event.id);
    await service.join(second.id, event.id);
    const nearby = await service.findNearby(0, 0, 10, undefined, first.id);
    expect(nearby).toEqual([expect.objectContaining({ id: event.id, participantCount: 2, isJoined: true })]);
    expect(nearby[0].creator).not.toHaveProperty('email');
    expect(await service.findById(event.id, creator.id)).toMatchObject({ participantCount: 2, isJoined: false });
    expect((await service.getMyEvents(creator.id)).created[0]).toMatchObject({ participantCount: 2, isJoined: false });
    expect((await service.getMyEvents(first.id)).participating[0]).toMatchObject({ participantCount: 2, isJoined: true });
  });

  it('reduz a contagem ao sair e não duplica ao entrar novamente', async () => {
    const event = await create();
    await service.join(first.id, event.id);
    expect(await service.leave(first.id, event.id)).toMatchObject({ participantCount: 0, isJoined: false });
    expect((await service.getMyEvents(first.id)).participating).toEqual([]);
    expect(await service.join(first.id, event.id)).toMatchObject({ participantCount: 1, isJoined: true });
  });

  it('uma tentativa repetida de entrar não aumenta a contagem', async () => {
    const event = await create();
    await service.join(first.id, event.id);
    await expect(service.join(first.id, event.id)).rejects.toBeInstanceOf(BadRequestException);
    expect((await service.findById(event.id)).participantCount).toBe(1);
  });

  it('usa as inscrições reais para recusar evento lotado e liberar vaga após saída', async () => {
    const event = await create(2);
    await service.join(first.id, event.id);
    await service.join(second.id, event.id);
    await expect(service.join(creator.id, event.id)).rejects.toThrow('Evento lotado');
    await service.leave(second.id, event.id);
    expect(await service.join(creator.id, event.id)).toMatchObject({ participantCount: 2, isJoined: true });
  });

  it('não conta participações desativadas no mapa, detalhe ou lista pessoal', async () => {
    const event = await create();
    await service.join(first.id, event.id);
    await service.join(second.id, event.id);
    await db.getRepository(EventParticipant).softDelete({ event_id: event.id, user_id: second.id });
    expect((await service.findNearby(0, 0, 10, undefined, second.id))[0]).toMatchObject({ participantCount: 1, isJoined: false });
    expect(await service.findById(event.id, second.id)).toMatchObject({ participantCount: 1, isJoined: false });
    expect((await service.getMyEvents(second.id)).participating).toEqual([]);
    expect(await db.getRepository(EventParticipant).count({ withDeleted: true })).toBe(2);
  });

  it('também calcula a contagem de eventos relâmpago', async () => {
    const event = await service.createFlash(creator.id, { sport: 'running', latitude: 0, longitude: 0 });
    expect(event).toMatchObject({ participantCount: 0 });
    await service.join(first.id, event.id);
    expect((await service.findNearby(0, 0, 10, undefined, creator.id))[0]).toMatchObject({ participantCount: 1, isJoined: false });
  });
});
