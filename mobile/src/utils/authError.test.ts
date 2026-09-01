import { getEmailVerificationRequirement, isRequestTimeout } from './authError';

describe('isRequestTimeout', () => {
  it('recognizes Axios and network timeout errors', () => {
    expect(isRequestTimeout({ code: 'ECONNABORTED' })).toBe(true);
    expect(isRequestTimeout({ code: 'ETIMEDOUT' })).toBe(true);
    expect(isRequestTimeout({ message: 'timeout of 30000ms exceeded' })).toBe(true);
  });

  it('does not classify a generic network error as timeout', () => {
    expect(isRequestTimeout({ code: 'ERR_NETWORK', message: 'Network Error' })).toBe(false);
    expect(isRequestTimeout(null)).toBe(false);
  });
});

describe('getEmailVerificationRequirement', () => {
  it('recognizes the current flat backend response', () => {
    const result = getEmailVerificationRequirement({
      response: {
        status: 403,
        data: {
          code: 'EMAIL_NOT_VERIFIED',
          emailVerificationRequired: true,
          email: 'Pendente@Example.com',
        },
      },
    }, 'fallback@example.com');

    expect(result).toEqual({ email: 'pendente@example.com' });
  });

  it('recognizes a response nested inside message', () => {
    const result = getEmailVerificationRequirement({
      response: {
        status: 403,
        data: {
          message: {
            code: 'EMAIL_NOT_VERIFIED',
            email: 'nested@example.com',
          },
        },
      },
    }, 'fallback@example.com');

    expect(result).toEqual({ email: 'nested@example.com' });
  });

  it('supports the legacy textual response and falls back to the attempted email', () => {
    const result = getEmailVerificationRequirement({
      response: {
        status: 403,
        data: { message: 'Confirme seu e-mail para entrar' },
      },
    }, '  USER@Example.com ');

    expect(result).toEqual({ email: 'user@example.com' });
  });

  it('does not redirect for unrelated authentication errors', () => {
    expect(getEmailVerificationRequirement({
      response: { status: 401, data: { message: 'Credenciais inválidas' } },
    }, 'user@example.com')).toBeNull();

    expect(getEmailVerificationRequirement({
      response: { status: 403, data: { message: 'Conta bloqueada' } },
    }, 'user@example.com')).toBeNull();
  });
});
