import api from './api';
import { UserStats } from '../types';

export const statsService = {
  getUserStats: async (): Promise<UserStats> => {
    const response = await api.get('/stats', { params: { version: 2 } });
    return response.data;
  },

  getWeeklyStats: async (): Promise<any> => {
    const response = await api.get('/stats/weekly', { params: { version: 2 } });
    return response.data;
  },
};
