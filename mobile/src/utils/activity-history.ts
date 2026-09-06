import type { Activity } from '../types';

/**
 * O TypeORM devolve findAndCount como [registros, total]. Algumas versões
 * antigas da API devolveram uma lista simples ou { activities }. Esta função
 * aceita os três contratos sem confundir o total com uma atividade.
 */
export function unwrapActivityHistory(data: unknown): Activity[] {
  let candidate: unknown = data;
  if (Array.isArray(data)) {
    candidate = Array.isArray(data[0]) ? data[0] : data;
  } else if (data && typeof data === 'object' && 'activities' in data) {
    candidate = (data as { activities?: unknown }).activities;
  }
  if (!Array.isArray(candidate)) return [];
  return candidate.filter((item): item is Activity => (
    Boolean(item) && typeof item === 'object' && typeof (item as Activity).id === 'string'
  ));
}
