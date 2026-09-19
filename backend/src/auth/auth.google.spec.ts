import { AuthService } from './auth.service';
import { OAuth2Client } from 'google-auth-library';
import * as bcrypt from 'bcrypt';

describe('Google login', () => {
  let service: AuthService;
  let repo: any;
  let tokens: any;
  let verifier: jest.SpyInstance;
  let payload: any;
  const originalClient = process.env.GOOGLE_CLIENT_ID;
  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = 'test-client';
    payload = { sub: 'google-id', email: 'user@gmail.com', email_verified: true };
    verifier = jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockImplementation(async () => ({ getPayload: () => payload } as any));
    const query: any = { getOne: jest.fn().mockResolvedValue(null) };
    for (const method of ['withDeleted', 'addSelect', 'where']) query[method] = jest.fn().mockReturnValue(query);
    repo = { createQueryBuilder: jest.fn(() => query), create: jest.fn(x => ({ id: 'user-id', isActive: true, ...x })), save: jest.fn(), update: jest.fn() };
    tokens = { issueTokenPair: jest.fn().mockResolvedValue({ accessToken: 'session', refreshToken: 'refresh', refreshExpiresAt: new Date() }) };
    service = new AuthService(repo, {} as any, { log: jest.fn() } as any, tokens);
  });
  afterEach(() => { jest.restoreAllMocks(); if (originalClient === undefined) delete process.env.GOOGLE_CLIENT_ID; else process.env.GOOGLE_CLIENT_ID = originalClient; });
  it('requires configured audience', async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    await expect(service.googleLogin('token')).rejects.toThrow('não está configurado');
    expect(verifier).not.toHaveBeenCalled();
  });
  it('rejects signature/audience/expiry verification failures', async () => {
    verifier.mockRejectedValue(new Error('invalid token'));
    await expect(service.googleLogin('invalid')).rejects.toThrow('validar');
    expect(repo.createQueryBuilder).not.toHaveBeenCalled();
  });
  it.each([false, undefined, 'true'])('rejects non-boolean or missing email verification %s', async value => {
    payload.email_verified = value;
    await expect(service.googleLogin('token')).rejects.toThrow('não verificado');
  });
  it('creates a Google account with an unpredictable password and stores subject', async () => {
    const result = await service.googleLogin('token');
    expect(verifier).toHaveBeenCalledWith({ idToken: 'token', audience: expect.arrayContaining(['test-client']) });
    const created = repo.create.mock.calls[0][0];
    expect(created.googleSubject).toBe('google-id');
    expect(await bcrypt.compare('google-google-id-user@gmail.com', created.password)).toBe(false);
    expect(result.accessToken).toBe('session');
    expect(result.user).not.toHaveProperty('password');
    expect(result.user).not.toHaveProperty('googleSubject');
  });
  it.each([{ isActive: false }, { isActive: true, deletedAt: new Date() }])('blocks disabled/deleted accounts %s', async state => {
    repo.createQueryBuilder().getOne.mockResolvedValue({ id: 'existing', googleSubject: 'google-id', ...state });
    await expect(service.googleLogin('token')).rejects.toThrow('Credenciais inválidas');
    expect(tokens.issueTokenPair).not.toHaveBeenCalled();
  });
  it('links a Gmail account to its existing SYNC account', async () => {
    repo.createQueryBuilder().getOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'existing', isActive: true });
    await service.googleLogin('token');
    expect(repo.update).toHaveBeenCalledWith('existing', { googleSubject: 'google-id', emailVerified: true });
    expect(repo.create).not.toHaveBeenCalled();
  });
  it('does not automatically link a third-party email', async () => {
    payload.email = 'user@example.org';
    repo.createQueryBuilder().getOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'existing', isActive: true });
    await expect(service.googleLogin('token')).rejects.toThrow('email e senha');
    expect(tokens.issueTokenPair).not.toHaveBeenCalled();
  });
  it('requires separate email verification for new third-party email accounts', async () => {
    payload.email = 'user@example.org';
    await expect(service.googleLogin('token')).rejects.toThrow('confirme seu email');
    expect(repo.create).not.toHaveBeenCalled();
  });
  it('accepts a verified Workspace email', async () => {
    payload.email = 'user@workspace.example';
    payload.hd = 'workspace.example';
    await service.googleLogin('token');
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ googleSubject: 'google-id', email: payload.email }));
  });
  it('does not replace a previously linked Google identity', async () => {
    repo.createQueryBuilder().getOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'existing', isActive: true, googleSubject: 'another-id' });
    await expect(service.googleLogin('token')).rejects.toThrow('email e senha');
  });
  it('finds returning users by stable subject even after Google email changes', async () => {
    payload.email = 'changed@example.org';
    repo.createQueryBuilder().getOne.mockResolvedValue({ id: 'existing', isActive: true, emailVerified: true, googleSubject: 'google-id' });
    await service.googleLogin('token');
    expect(repo.createQueryBuilder().where).toHaveBeenCalledWith({ googleSubject: 'google-id' });
    expect(repo.create).not.toHaveBeenCalled();
  });
});
