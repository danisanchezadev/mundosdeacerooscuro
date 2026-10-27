export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export function formatRating(value) {
  const number = Number(value);
  if (value === null || value === undefined || Number.isNaN(number)) return '—';
  return number.toFixed(1);
}

export const LANGUAGES = { es: 'Español', en: 'Inglés', fr: 'Francés', de: 'Alemán', it: 'Italiano', pt: 'Portugués', ru: 'Ruso', pl: 'Polaco' };

export function languageLabel(code) {
  if (!code) return '—';
  return LANGUAGES[code.toLowerCase()] ?? code.toUpperCase();
}

export const LOAN_STATUS_LABELS = {
  REQUESTED: 'SOLICITADO',
  APPROVED: 'APROBADO',
  BORROWED: 'PRESTADO',
  RETURN_PENDING: 'DEVOLUCIÓN PENDIENTE',
  RETURN_CONFIRMED: 'DEVUELTO',
  CANCELLED: 'CANCELADO',
  LOST: 'PERDIDO',
};

export const LOAN_ACTION_LABELS = {
  approve: 'APROBAR',
  cancel: 'CANCELAR',
  mark_borrowed: 'ENTREGADO',
  confirm_return: 'CONFIRMAR DEVOLUCIÓN',
  mark_lost: 'MARCAR PERDIDO',
};

/** Extracts a plain list from a DRF response (paginated or not). */
export function results(data) {
  if (!data) return [];
  return Array.isArray(data) ? data : (data.results ?? []);
}
