import { normalizeConversations, normalizeLikesReceived } from './social-lists';

const peer = { id: 'peer', name: 'Pessoa válida', avatarUrl: null };

it('keeps valid conversations and skips missing/deleted peers in either position', () => {
  const message = { content: 'Olá', createdAt: '2026-09-22T12:00:00Z' };
  const result = normalizeConversations([
    { matchId: 'deleted', user: null }, null,
    { matchId: 'valid', user: peer, unreadCount: 2, lastMessage: message },
    { matchId: 'missing' }, { user: peer },
  ]);
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({ matchId: 'valid', user: { id: 'peer' }, unreadCount: 2, lastMessage: message });
});

it('keeps valid likes, hides orphaned likes and normalizes optional display fields', () => {
  const result = normalizeLikesReceived([
    { likeId: 'deleted', user: null }, null,
    { likeId: 'valid', user: { ...peer, sports: 'running', bio: {}, avatarUrl: {} } },
    { likeId: 'normal', user: { ...peer, sports: ['running', null] }, isSuperLike: true },
  ]);
  expect(result.map(item => item.likeId)).toEqual(['valid', 'normal']);
  expect(result[0].user).toMatchObject({ sports: [], bio: undefined, avatarUrl: undefined });
  expect(result[1].user.sports).toEqual(['running']);
  expect(result[1].isSuperLike).toBe(true);
});

it('does not expose malformed unread counts or message objects to rendering/search', () => {
  const [item] = normalizeConversations([{ matchId: 'valid', user: peer, unreadCount: {}, lastMessage: { content: {} } }]);
  expect(item.unreadCount).toBe(0);
  expect(item.lastMessage).toBeUndefined();
});

it.each([normalizeConversations, normalizeLikesReceived])('distinguishes a failed payload from an empty list', normalize => {
  expect(normalize([])).toEqual([]);
  expect(() => normalize({ message: 'invalid response' })).toThrow();
});
