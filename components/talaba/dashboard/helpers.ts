import type { AdminChatMessage } from './types';

/** Relative "Bugun / Kecha / N kun avval / date" label for an announcement. */
export function formatElonDate(value: string | null | undefined) {
  if (!value) return 'Bugun';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Bugun';
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'Bugun';
  if (diffDays === 1) return 'Kecha';
  if (diffDays < 7) return `${diffDays} kun avval`;
  return date.toLocaleDateString('uz-UZ');
}

/** Maps an `arizalar`-table row (type='chat') into a chat bubble shape. */
export function toAdminChatMessage(application: {
  id: string;
  title: string | null;
  text: string;
  reason: string | null;
  status: string | null;
  created_at: string;
  date: string | null;
}): AdminChatMessage {
  return {
    id: application.id,
    title: application.title ?? undefined,
    text: application.text,
    reason: application.reason ?? application.text ?? undefined,
    status: application.status ?? undefined,
    created_at: application.created_at,
    date: application.date ?? undefined,
    sender_role: application.title ?? undefined,
  };
}
