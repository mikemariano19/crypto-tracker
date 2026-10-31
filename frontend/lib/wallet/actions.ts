import {
  DEFAULT_HOLDING_SORT,
  PROVIDER_ID_PATTERN,
  type Currency,
  type Holding,
  type HoldingSort,
  type StoredState,
  type Wallet,
  type WalletSort,
} from '@/lib/wallet/schema';
import { SECRET_WARNING, addAmounts, looksLikeSecret, parseAmount, walletNameError, walletNoteError } from '@/lib/wallet/validate';

// Pure state transitions for the wallet store: (state, input) → new state,
// or an error message for the form. No storage or React in here.

export type ActionResult = { ok: true; state: StoredState } | { ok: false; error: string };

/** The coin as picked in the search box; display fields are cached on the holding. */
export type CoinPick = Pick<Holding, 'coinId' | 'symbol' | 'name' | 'image'>;

export type AddMode = 'add' | 'replace';

type Clock = { now: () => string; newId: () => string };

/** What the wallet form sends: provider is the picked exchange/wallet, if any. */
export type WalletInput = { name: string; note?: string; provider?: string | null };

const ok = (state: StoredState): ActionResult => ({ ok: true, state });
const fail = (error: string): ActionResult => ({ ok: false, error });

function updateWallet(state: StoredState, walletId: string, change: (wallet: Wallet) => Wallet | string): ActionResult {
  const wallet = state.wallets.find((w) => w.id === walletId);
  if (!wallet) return fail('That wallet no longer exists.');

  const next = change(wallet);
  if (typeof next === 'string') return fail(next);

  return ok({ ...state, wallets: state.wallets.map((w) => (w.id === walletId ? next : w)) });
}

function cleanNote(note: string | undefined): string | undefined {
  const trimmed = note?.trim();
  return trimmed ? trimmed : undefined;
}

function cleanProvider(provider: string | null | undefined): string | undefined {
  return provider && PROVIDER_ID_PATTERN.test(provider) ? provider : undefined;
}

export function createWallet(state: StoredState, input: WalletInput, clock: Clock): ActionResult {
  const nameError = walletNameError(input.name, state.wallets);
  if (nameError) return fail(nameError);

  const noteError = input.note ? walletNoteError(input.note) : null;
  if (noteError) return fail(noteError);

  const wallet: Wallet = {
    id: clock.newId(),
    name: input.name.trim(),
    note: cleanNote(input.note),
    provider: cleanProvider(input.provider),
    createdAt: clock.now(),
    collapsed: false,
    holdingSort: DEFAULT_HOLDING_SORT,
    holdings: [],
  };

  return ok({ ...state, wallets: [...state.wallets, wallet] });
}

export function renameWallet(
  state: StoredState,
  walletId: string,
  input: WalletInput
): ActionResult {
  const nameError = walletNameError(input.name, state.wallets, walletId);
  if (nameError) return fail(nameError);

  const noteError = input.note ? walletNoteError(input.note) : null;
  if (noteError) return fail(noteError);

  return updateWallet(state, walletId, (wallet) => ({
    ...wallet,
    name: input.name.trim(),
    note: cleanNote(input.note),
    provider: cleanProvider(input.provider),
  }));
}

export function deleteWallet(state: StoredState, walletId: string): ActionResult {
  return ok({ ...state, wallets: state.wallets.filter((wallet) => wallet.id !== walletId) });
}

export function setCollapsed(state: StoredState, walletId: string, collapsed: boolean): ActionResult {
  return updateWallet(state, walletId, (wallet) => ({ ...wallet, collapsed }));
}

/**
 * Adds a coin to a wallet. If the wallet already holds it, `mode` decides
 * whether the amount is added to the existing one or replaces it.
 */
export function addHolding(
  state: StoredState,
  walletId: string,
  coin: CoinPick,
  amountInput: string,
  mode: AddMode,
  clock: Clock
): ActionResult {
  const parsed = parseAmount(amountInput);
  if (!parsed.ok) return fail(parsed.error);

  return updateWallet(state, walletId, (wallet) => {
    const existing = wallet.holdings.find((holding) => holding.coinId === coin.coinId);
    const amount = existing && mode === 'add' ? addAmounts(existing.amount, parsed.amount) : parsed.amount;

    if (parseAmount(amount).ok === false) return 'The new total is too large.';

    const holding: Holding = {
      coinId: coin.coinId,
      symbol: coin.symbol.toUpperCase(),
      name: coin.name,
      image: coin.image ?? existing?.image,
      amount,
      updatedAt: clock.now(),
    };

    return {
      ...wallet,
      holdings: existing
        ? wallet.holdings.map((h) => (h.coinId === coin.coinId ? holding : h))
        : [...wallet.holdings, holding],
    };
  });
}

export function updateHolding(
  state: StoredState,
  walletId: string,
  coinId: string,
  amountInput: string,
  clock: Pick<Clock, 'now'>
): ActionResult {
  const parsed = parseAmount(amountInput);
  if (!parsed.ok) return fail(parsed.error);

  return updateWallet(state, walletId, (wallet) => {
    if (!wallet.holdings.some((holding) => holding.coinId === coinId)) {
      return 'That coin is no longer in this wallet.';
    }

    return {
      ...wallet,
      holdings: wallet.holdings.map((holding) =>
        holding.coinId === coinId ? { ...holding, amount: parsed.amount, updatedAt: clock.now() } : holding
      ),
    };
  });
}

export function removeHolding(state: StoredState, walletId: string, coinId: string): ActionResult {
  return updateWallet(state, walletId, (wallet) => ({
    ...wallet,
    holdings: wallet.holdings.filter((holding) => holding.coinId !== coinId),
  }));
}

export function setCurrency(state: StoredState, currency: Currency): ActionResult {
  return ok({ ...state, currency });
}

export function setWalletSort(state: StoredState, walletSort: WalletSort): ActionResult {
  return ok({ ...state, walletSort });
}

export function setHoldingSort(state: StoredState, walletId: string, holdingSort: HoldingSort): ActionResult {
  return updateWallet(state, walletId, (wallet) => ({ ...wallet, holdingSort }));
}

/**
 * Applies an already-validated backup. "replace" swaps everything; "merge"
 * keeps current wallets, adds new ones, and for a wallet with the same name
 * keeps whichever copy of each coin was updated last, so importing the
 * same file twice changes nothing.
 */
export function importState(
  state: StoredState,
  incoming: StoredState,
  mode: 'replace' | 'merge',
  clock: Pick<Clock, 'newId'>
): ActionResult {
  // Imported files are checked like typed input: no secrets in names or notes.
  if (incoming.wallets.some((wallet) => looksLikeSecret(wallet.name) || (wallet.note && looksLikeSecret(wallet.note)))) {
    return fail(SECRET_WARNING);
  }

  if (mode === 'replace') return ok(incoming);

  const wallets = state.wallets.map((wallet) => ({ ...wallet }));

  for (const theirs of incoming.wallets) {
    const index = wallets.findIndex((wallet) => wallet.name.toLowerCase() === theirs.name.toLowerCase());

    if (index === -1) {
      // Fresh id so it can never collide with a wallet already here.
      wallets.push({ ...theirs, id: clock.newId() });
      continue;
    }

    const mine = wallets[index];
    const holdings = new Map(mine.holdings.map((holding) => [holding.coinId, holding]));

    for (const holding of theirs.holdings) {
      const current = holdings.get(holding.coinId);
      if (!current || Date.parse(holding.updatedAt) > Date.parse(current.updatedAt)) {
        holdings.set(holding.coinId, holding);
      }
    }

    wallets[index] = { ...mine, holdings: [...holdings.values()] };
  }

  return ok({ ...state, wallets });
}
