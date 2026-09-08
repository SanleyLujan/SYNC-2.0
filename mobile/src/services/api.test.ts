export {};
const mockValues = new Map<string, string>();
const mockStorage = {
  getItem: jest.fn(async (key: string) => mockValues.get(key) || null),
  setItem: jest.fn(async (key: string, value: string) => { mockValues.set(key, value); }),
  removeItem: jest.fn(async (key: string) => { mockValues.delete(key); }),
};
jest.mock('./secure-storage', () => ({ secureStorage: mockStorage }));
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: mockStorage }));
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
jest.mock('axios', () => {
  const api: any = jest.fn(async () => ({ data: 'retried' }));
  api.interceptors = { request: { use: jest.fn() }, response: { use: jest.fn() } };
  return { __esModule: true, default: { create: () => api, post: jest.fn(), get: jest.fn() } };
});

describe('renovação da sessão no cliente', () => {
  let api: any, axios: any, rejectResponse: any, expired: jest.Mock, invalidate: () => void;
  const unauthorized = () => ({ response: { status: 401 }, config: { url: '/users/me', headers: { Authorization: 'Bearer old' } } });
  beforeEach(() => {
    jest.resetModules(); jest.clearAllMocks(); mockValues.clear();
    mockValues.set('@sync:token', 'old'); mockValues.set('@sync:refresh-token', 'refresh');
    const module = require('./api'); api = module.default; invalidate = module.invalidatePendingRefresh;
    axios = require('axios').default;
    rejectResponse = api.interceptors.response.use.mock.calls[0][1];
    expired = jest.fn(); module.setSessionExpiredHandler(expired);
  });
  it.each([undefined, 500, 503, 429])('preserva login em falha temporária %s do refresh', async status => {
    axios.post.mockRejectedValue({ response: status ? { status } : undefined });
    await expect(rejectResponse(unauthorized())).rejects.toBeDefined();
    expect(mockValues.get('@sync:refresh-token')).toBe('refresh');
    expect(expired).not.toHaveBeenCalled();
  });
  it('encerra sessão quando o servidor recusa definitivamente o refresh', async () => {
    axios.post.mockRejectedValue({ response: { status: 401 } });
    await expect(rejectResponse(unauthorized())).rejects.toBeDefined();
    expect(mockValues.has('@sync:token')).toBe(false);
    expect(expired).toHaveBeenCalledTimes(1);
  });
  it('compartilha uma renovação entre requisições concorrentes e reaproveita para 401 atrasado', async () => {
    axios.post.mockResolvedValue({ data: { accessToken: 'new', refreshToken: 'new-refresh' } });
    await Promise.all([rejectResponse(unauthorized()), rejectResponse(unauthorized())]);
    await rejectResponse(unauthorized());
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(api).toHaveBeenCalledTimes(3);
  });
  it('não restaura uma sessão invalidada enquanto o refresh estava em trânsito', async () => {
    let finish: any;
    axios.post.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const result = rejectResponse(unauthorized()).catch((e: any) => e);
    while (!finish) await Promise.resolve();
    invalidate(); mockValues.clear();
    finish({ data: { accessToken: 'late', refreshToken: 'late-refresh' } });
    await result;
    expect(mockValues.size).toBe(0);
  });
});
