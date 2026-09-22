import { ChatService } from './chat.service';

describe('conversation list with deleted users', () => {
  it.each(['user1', 'user2'])('omits missing peers when the viewer is %s, preserving valid history', async viewerSide => {
    const self = { id: 'self', name: 'Self' };
    const peer = { id: 'peer', name: 'Peer' };
    const rows = [null, peer].map((other, index) => ({
      id: index ? 'valid-match' : 'orphan-match',
      user1_id: viewerSide === 'user1' ? self.id : 'peer',
      user2_id: viewerSide === 'user2' ? self.id : 'peer',
      user1: viewerSide === 'user1' ? self : other,
      user2: viewerSide === 'user2' ? self : other,
    }));
    const matchQuery: any = {};
    for (const method of ['leftJoinAndSelect', 'where']) matchQuery[method] = jest.fn().mockReturnValue(matchQuery);
    matchQuery.getMany = jest.fn().mockResolvedValue(rows);
    const countQuery: any = {};
    for (const method of ['select', 'addSelect', 'where', 'andWhere', 'groupBy']) countQuery[method] = jest.fn().mockReturnValue(countQuery);
    countQuery.getRawMany = jest.fn().mockResolvedValue([{ matchId: 'valid-match', count: '2' }]);
    const message = { content: 'Hello', createdAt: new Date() };
    const messages = { createQueryBuilder: () => countQuery, findOne: jest.fn().mockResolvedValue(message) };
    const service = new ChatService(messages as any, { createQueryBuilder: () => matchQuery } as any, {} as any, {} as any);
    const result = await service.getConversations('self');
    expect(result).toEqual([{ matchId: 'valid-match', user: expect.objectContaining({ id: 'peer' }), lastMessage: message, unreadCount: 2 }]);
    expect(messages.findOne).toHaveBeenCalledTimes(1);
    expect(countQuery.where).toHaveBeenCalledWith('msg.match_id IN (:...matchIds)', { matchIds: ['valid-match'] });
  });
});
