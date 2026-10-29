import { z } from 'zod';

// Everything the wallet tracker saves, in one localStorage key. The schema
// is the single source of truth: types are inferred from it, and anything
// loaded or imported is checked against it before use.

export const STORAGE_KEY = 'cryptoTracker.wallets.v1';
export const CURRENT_VERSION = 1;

export const WALLET_NAME_MAX = 40;
export const WALLET_NOTE_MAX = 120;

export const PROVIDER_ID_PATTERN = /^(cg|app):[a-z0-9_-]{1,60}$/;

// Plain positive decimal, no sign or exponent: "0.25", "12", "0.000000000000000001".
export const AMOUNT_PATTERN = /^\d{1,16}(\.\d{1,18})?$/;

const sortDir = z.enum(['asc', 'desc']);

export const currencySchema = z.enum(['usd', 'php']);

export const holdingSortSchema = z.object({
  by: z.enum(['value', 'name', 'amount', 'change24h', 'price']),
  dir: sortDir,
});

export const walletSortSchema = z.object({
  by: z.enum(['value', 'name', 'createdAt']),
  dir: sortDir,
});

export const holdingSchema = z.object({
  coinId: z.string().min(1).max(100),
  symbol: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  image: z.url({ protocol: /^https$/ }).optional(),
  amount: z.string().regex(AMOUNT_PATTERN),
  updatedAt: z.iso.datetime(),
});

export const walletSchema = z
  .object({
    id: z.string().min(1).max(64),
    name: z.string().trim().min(1).max(WALLET_NAME_MAX),
    note: z.string().max(WALLET_NOTE_MAX).optional(),
    // Exchange or wallet it's held at ("cg:binance", "app:ledger"), for its
    // logo. Optional, so wallets saved before it existed stay valid.
    provider: z.string().regex(PROVIDER_ID_PATTERN).optional(),
    createdAt: z.iso.datetime(),
    collapsed: z.boolean(),
    holdingSort: holdingSortSchema,
    holdings: z.array(holdingSchema),
  })
  .refine(
    (wallet) => new Set(wallet.holdings.map((holding) => holding.coinId)).size === wallet.holdings.length,
    { message: 'A coin appears twice in one wallet', path: ['holdings'] }
  );

export const storedStateSchema = z
  .object({
    version: z.literal(CURRENT_VERSION),
    currency: currencySchema,
    walletSort: walletSortSchema,
    wallets: z.array(walletSchema),
  })
  .refine(
    (state) => new Set(state.wallets.map((wallet) => wallet.name.toLowerCase())).size === state.wallets.length,
    { message: 'Two wallets have the same name', path: ['wallets'] }
  );

export type Currency = z.infer<typeof currencySchema>;
export type HoldingSort = z.infer<typeof holdingSortSchema>;
export type WalletSort = z.infer<typeof walletSortSchema>;
export type Holding = z.infer<typeof holdingSchema>;
export type Wallet = z.infer<typeof walletSchema>;
export type StoredState = z.infer<typeof storedStateSchema>;

export const DEFAULT_HOLDING_SORT: HoldingSort = { by: 'value', dir: 'desc' };

export function emptyState(): StoredState {
  return {
    version: CURRENT_VERSION,
    currency: 'usd',
    walletSort: { by: 'value', dir: 'desc' },
    wallets: [],
  };
}

/**
 * Brings saved data from any older version up to the current one. Each
 * future version adds one step here, so old data is upgraded, never wiped.
 * Returns null when the data isn't something this app ever wrote.
 */
export function migrate(raw: unknown): unknown | null {
  if (typeof raw !== 'object' || raw === null || !('version' in raw)) {
    return null;
  }

  const version = (raw as { version: unknown }).version;

  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1 || version > CURRENT_VERSION) {
    return null;
  }

  // v1 is current. Future: if (version === 1) raw = v1ToV2(raw); …
  return raw;
}

/**
 * Migrate, then validate. The one entry point for saved or imported data.
 */
export function parseStoredState(raw: unknown): { ok: true; state: StoredState } | { ok: false; error: string } {
  const migrated = migrate(raw);

  if (migrated === null) {
    return { ok: false, error: 'Not a wallet tracker file, or from a newer version of the app.' };
  }

  const result = storedStateSchema.safeParse(migrated);

  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue?.path.length ? ` (at ${issue.path.join('.')})` : '';
    return { ok: false, error: `${issue?.message ?? 'Invalid data'}${where}` };
  }

  return { ok: true, state: result.data };
}
