import api from './api';
import { normalizeLikesReceived } from '../utils/social-lists';

export interface LikeReceivedItem {
  likeId: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    avatarUrl?: string | null;
    level?: string | null;
    sports?: string[] | null;
    bio?: string | null;
  };
}

export const matchingApi = {
  likesReceived: () =>
    api.get<LikeReceivedItem[]>('/matching/likes-received').then((r) => normalizeLikesReceived(r.data)),

  likesReceivedCount: () =>
    api
      .get<{ count: number }>('/matching/likes-received/count')
      .then((r) => r.data.count),

  swipe: (toUserId: string, action: 'like' | 'pass') =>
    api
      .post<{ matched: boolean; matchId?: string; alreadyLiked?: boolean }>('/matching/swipe', {
        targetUserId: toUserId,
        isLike: action !== 'pass',
      })
      .then((r) => r.data),
};
