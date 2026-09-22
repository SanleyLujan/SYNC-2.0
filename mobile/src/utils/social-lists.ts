import type { Conversation } from '../types';
import type { LikeReceivedItem } from '../services/matching.service';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

// A deleted/missing peer must not take down the whole list or remain actionable.
function hasPeer(value: unknown): value is Record<string, unknown> & {
  user: Record<string, unknown> & { id: string; name: string };
} {
  return isRecord(value) && isRecord(value.user)
    && typeof value.user.id === 'string' && value.user.id.length > 0
    && typeof value.user.name === 'string';
}

function displayPeer(user: Record<string, unknown> & { id: string; name: string }) {
  return {
    ...user,
    avatarUrl: typeof user.avatarUrl === 'string' ? user.avatarUrl : undefined,
    bio: typeof user.bio === 'string' ? user.bio : undefined,
    sports: Array.isArray(user.sports)
      ? user.sports.filter((sport): sport is string => typeof sport === 'string')
      : [],
  };
}

export type ConversationListItem = Pick<Conversation, 'matchId' | 'unreadCount'> & {
  user: Pick<Conversation['user'], 'id' | 'name' | 'avatarUrl'>;
  lastMessage?: Pick<NonNullable<Conversation['lastMessage']>, 'content' | 'createdAt'>;
};

export function normalizeConversations(data: unknown): ConversationListItem[] {
  if (!Array.isArray(data)) throw new Error('Resposta de conversas inválida');
  return data.filter(hasPeer).flatMap(item => {
    if (typeof item.matchId !== 'string' || !item.matchId) return [];
    return [{
      matchId: item.matchId,
      user: displayPeer(item.user),
      unreadCount: typeof item.unreadCount === 'number' && Number.isFinite(item.unreadCount)
        ? Math.max(0, Math.floor(item.unreadCount)) : 0,
      lastMessage: isRecord(item.lastMessage) && typeof item.lastMessage.content === 'string'
        && typeof item.lastMessage.createdAt === 'string'
        ? { content: item.lastMessage.content, createdAt: item.lastMessage.createdAt } : undefined,
    }];
  });
}

export function normalizeLikesReceived(data: unknown): LikeReceivedItem[] {
  if (!Array.isArray(data)) throw new Error('Resposta de curtidas inválida');
  return data.filter(hasPeer)
    .filter(item => typeof item.likeId === 'string' && item.likeId.length > 0)
    .map(item => ({
      likeId: item.likeId as string,
      user: displayPeer(item.user),
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : '',
      isSuperLike: item.isSuperLike === true,
    }));
}
