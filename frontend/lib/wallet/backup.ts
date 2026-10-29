import { parseStoredState, type StoredState } from '@/lib/wallet/schema';
import { looksLikeSecret, SECRET_WARNING } from '@/lib/wallet/validate';

// Export / import of the wallet tracker's data as a JSON file.

// Far bigger than any real backup (50 × 50 holdings is ~1 MB); stops a
// wrong file from freezing the tab while it's parsed.
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

/** crypto-wallets-2026-10-30.json, in the user's local date. */
export function backupFileName(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `crypto-wallets-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}

export function serializeBackup(state: StoredState): string {
  return `${JSON.stringify(state, null, 2)}\n`;
}

export type BackupPreview = {
  state: StoredState;
  wallets: number;
  coins: number;
};

export type BackupResult = { ok: true; preview: BackupPreview } | { ok: false; error: string };

/**
 * Reads a backup file's text: JSON, then the same migration and schema
 * check as saved data, then the secret guard. Nothing is changed here;
 * the caller applies the result only after the user confirms.
 */
export function readBackup(text: string): BackupResult {
  if (text.length > MAX_BACKUP_BYTES) {
    return { ok: false, error: 'That file is too large to be a wallet backup.' };
  }

  let raw: unknown;

  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'That file isn’t valid JSON. Choose a file made with Export.' };
  }

  const parsed = parseStoredState(raw);
  if (!parsed.ok) {
    // The schema's own message ("expected one of usd|php at currency") is
    // developer talk; the person only needs to know this file won't work.
    return { ok: false, error: 'That file isn’t a valid wallet backup. It may be from another app, or edited or damaged.' };
  }

  const { state } = parsed;

  if (state.wallets.some((wallet) => looksLikeSecret(wallet.name) || (wallet.note && looksLikeSecret(wallet.note)))) {
    return { ok: false, error: SECRET_WARNING };
  }

  return {
    ok: true,
    preview: {
      state,
      wallets: state.wallets.length,
      coins: state.wallets.reduce((sum, wallet) => sum + wallet.holdings.length, 0),
    },
  };
}

/**
 * Starts a download of `text` as `fileName`. Browser only.
 */
export function downloadText(text: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
