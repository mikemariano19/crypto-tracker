import Decimal from 'decimal.js';
import { WALLET_NAME_MAX, WALLET_NOTE_MAX } from '@/lib/wallet/schema';

// Wallet amounts are money-adjacent: exact decimals only, never JS floats.
export const Dec = Decimal.clone({ precision: 64, toExpNeg: -40, toExpPos: 40 });

export const SECRET_WARNING =
  'Never enter seed phrases or private keys. This tracker only needs coin amounts.';

export const MAX_AMOUNT = '1000000000000000'; // 1e15
export const MAX_AMOUNT_DECIMALS = 18;

const SEED_WORD_COUNTS = new Set([12, 15, 18, 21, 24]);

// BIP-39 words are 3–8 lowercase letters; requiring that keeps ordinary
// notes ("my long term coins for…") from tripping the guard as often.
const SEED_WORD = /^[a-z]{3,8}$/;

const PRIVATE_KEY_PATTERNS = [
  /\b(?:0x)?[0-9a-fA-F]{64}\b/, // raw hex key (Ethereum etc.)
  /\b[5KL][1-9A-HJ-NP-Za-km-z]{50,51}\b/, // Bitcoin WIF
  /\b[xyzt]prv[1-9A-HJ-NP-Za-km-z]{100,}\b/, // extended private keys
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];

/**
 * True when text looks like a recovery phrase or private key. Used on every
 * free-text field; this app must never hold secrets.
 */
export function looksLikeSecret(text: string): boolean {
  const words = text.trim().split(/\s+/);

  if (SEED_WORD_COUNTS.has(words.length) && words.every((word) => SEED_WORD.test(word))) {
    return true;
  }

  return PRIVATE_KEY_PATTERNS.some((pattern) => pattern.test(text));
}

export type AmountResult = { ok: true; amount: string } | { ok: false; error: string };

/**
 * Turns what the user typed into a canonical decimal string ("0.25"), or an
 * error to show inline. A lone comma is read as a decimal point only when
 * it can't be a thousands separator ("1,5" yes, "1,500" no).
 */
export function parseAmount(input: string, what = 'Amount'): AmountResult {
  let text = input.trim().replace(/[\s_]/g, '');

  if (text === '') return { ok: false, error: 'Enter an amount.' };
  if (text.startsWith('-')) return { ok: false, error: `${what} can’t be negative.` };
  if (/[eE]/.test(text)) return { ok: false, error: 'Write the full number, e.g. 0.00001.' };
  if (/[^0-9.,]/.test(text)) return { ok: false, error: 'Use digits and a decimal point only.' };

  const commas = (text.match(/,/g) ?? []).length;
  const dots = (text.match(/\./g) ?? []).length;

  if (commas > 0) {
    const afterComma = text.split(',')[1] ?? '';

    if (commas === 1 && dots === 0 && afterComma.length !== 3) {
      text = text.replace(',', '.');
    } else {
      return { ok: false, error: 'Unclear number format. Use a dot for decimals, e.g. 1500.25.' };
    }
  }

  if (!/^\d*\.?\d*$/.test(text) || text === '.') {
    return { ok: false, error: 'That isn’t a valid number.' };
  }

  const decimals = text.split('.')[1]?.length ?? 0;
  if (decimals > MAX_AMOUNT_DECIMALS) {
    return { ok: false, error: `At most ${MAX_AMOUNT_DECIMALS} decimal places.` };
  }

  const value = new Dec(text.startsWith('.') ? `0${text}` : text);

  if (value.lte(0)) return { ok: false, error: `${what} must be more than 0.` };
  if (value.gt(MAX_AMOUNT)) return { ok: false, error: `That ${what.toLowerCase()} is too large.` };

  return { ok: true, amount: value.toFixed() };
}

export type BuyPriceResult = { ok: true; price: string | null } | { ok: false; error: string };

/**
 * The optional "buy price per coin" field: blank means none, anything else
 * follows the amount rules.
 */
export function parseBuyPrice(input: string): BuyPriceResult {
  if (input.trim() === '') return { ok: true, price: null };

  const parsed = parseAmount(input, 'Price');
  return parsed.ok ? { ok: true, price: parsed.amount } : parsed;
}

/**
 * Average price after topping up: (held × avg + added × price) ÷ total,
 * rounded to the 18 decimals a stored price can have.
 */
export function averageBuyPrice(heldAmount: string, heldPrice: string, addedAmount: string, addedPrice: string): string {
  const cost = new Dec(heldAmount).times(heldPrice).plus(new Dec(addedAmount).times(addedPrice));
  const total = new Dec(heldAmount).plus(addedAmount);
  return cost.div(total).toDecimalPlaces(MAX_AMOUNT_DECIMALS).toFixed();
}

/**
 * Exact sum of two stored amounts, still a canonical decimal string.
 */
export function addAmounts(a: string, b: string): string {
  return new Dec(a).plus(b).toFixed();
}

/**
 * Error message for a wallet name, or null when it's fine. Names are unique
 * regardless of case; `exceptId` lets a wallet keep its own name on rename.
 */
export function walletNameError(
  name: string,
  wallets: readonly { id: string; name: string }[],
  exceptId?: string
): string | null {
  const trimmed = name.trim();

  if (trimmed === '') return 'Give the wallet a name.';
  // Before the length check: a pasted phrase is long, and this warning matters more.
  if (looksLikeSecret(trimmed)) return SECRET_WARNING;
  if (trimmed.length > WALLET_NAME_MAX) return `Keep it to ${WALLET_NAME_MAX} characters.`;

  const taken = wallets.some(
    (wallet) => wallet.id !== exceptId && wallet.name.toLowerCase() === trimmed.toLowerCase()
  );

  return taken ? `You already have a wallet named “${trimmed}”.` : null;
}

export function walletNoteError(note: string): string | null {
  if (looksLikeSecret(note)) return SECRET_WARNING;
  if (note.trim().length > WALLET_NOTE_MAX) return `Keep the note to ${WALLET_NOTE_MAX} characters.`;
  return null;
}
