type ErrorPayload = Record<string, unknown>;

export interface EmailVerificationRequirement {
  email: string;
}

function asPayload(value: unknown): ErrorPayload | null {
  return value !== null && typeof value === 'object' ? value as ErrorPayload : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeForComparison(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function getEmailVerificationRequirement(
  error: unknown,
  attemptedEmail: string,
): EmailVerificationRequirement | null {
  const response = asPayload(asPayload(error)?.response);
  if (response?.status !== 403) return null;

  const data = asPayload(response.data);
  if (!data) return null;

  // Nest pode devolver o objeto diretamente ou dentro de `message`, dependendo
  // de como a exceção foi criada e da versão implantada do backend.
  const nestedMessage = asPayload(data.message);
  const code = asString(data.code) || asString(nestedMessage?.code);
  const required = data.emailVerificationRequired === true
    || nestedMessage?.emailVerificationRequired === true;
  const message = asString(data.message) || asString(nestedMessage?.message) || '';
  const normalizedMessage = normalizeForComparison(message);
  const compactMessage = normalizedMessage.replace(/[^a-z0-9]+/g, '');
  const legacyMessage = normalizedMessage.includes('confirm')
    && compactMessage.includes('email');

  if (code !== 'EMAIL_NOT_VERIFIED' && !required && !legacyMessage) return null;

  const responseEmail = asString(data.email) || asString(nestedMessage?.email);
  return {
    email: (responseEmail || attemptedEmail).trim().toLowerCase(),
  };
}
