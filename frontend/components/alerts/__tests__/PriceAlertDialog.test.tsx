// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import PriceAlertDialog, { type AlertCoin } from '@/components/alerts/PriceAlertDialog';
import type { PushStatus } from '@/hooks/usePushAlerts';

const push = {
  status: 'off' as PushStatus,
  state: null as null | { alerts: unknown[] },
  busy: false,
  error: null as string | null,
  addAlert: vi.fn(),
  removeAlert: vi.fn(),
};

vi.mock('@/hooks/usePushAlerts', () => ({ usePushAlerts: () => push }));

// Pesos at 58 to the dollar, as the visitor's display currency.
vi.mock('@/hooks/useDisplayCurrency', () => ({
  useDisplayCurrency: () => ({ money: { code: 'php', rate: 58 }, code: 'php' }),
}));

vi.mock('@/hooks/useExchangeRates', () => ({
  useExchangeRates: () => ({ byCode: new Map([['php', { per_usd: 58 }]]) }),
}));

const bitcoin: AlertCoin = { id: 'bitcoin', name: 'Bitcoin', symbol: 'btc', price: 70_000, priceCurrency: 'usd' };

function open(coin: AlertCoin = bitcoin) {
  render(<PriceAlertDialog open onOpenChange={() => {}} coin={coin} />);

  return screen.getByLabelText('Target price (PHP)') as HTMLInputElement;
}

beforeEach(() => {
  push.status = 'off';
  push.state = null;
  push.error = null;
  push.addAlert.mockReset().mockResolvedValue({});
});

afterEach(cleanup);

describe('PriceAlertDialog', () => {
  it('starts a little above today\'s price, in the display currency', () => {
    // ₱4,060,000 today; 5% up, rounded.
    expect(open().value).toBe('4300000');
    expect(screen.getByText(/Alert me when BTC goes above ₱4,300,000/)).toBeTruthy();
  });

  it('turns a target under today\'s price into a "below" alert', async () => {
    fireEvent.change(open(), { target: { value: '3,900,000' } });

    expect(screen.getByText(/goes below ₱3,900,000/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Alert me/ }));

    await waitFor(() => expect(push.addAlert).toHaveBeenCalledWith({
      coinId: 'bitcoin', symbol: 'btc', direction: 'below', threshold: 3_900_000, currency: 'php',
    }));
  });

  it('asks for the direction when there is no price to compare with', async () => {
    fireEvent.change(open({ ...bitcoin, price: null }), { target: { value: '100' } });
    fireEvent.click(screen.getByLabelText('Goes below'));
    fireEvent.click(screen.getByRole('button', { name: /Alert me/ }));

    await waitFor(() => expect(push.addAlert).toHaveBeenCalledWith(expect.objectContaining({ direction: 'below', threshold: 100 })));
  });

  it('converts a wallet price from its own currency', () => {
    // ₱4,060,000 from a peso wallet is the same $70,000.
    expect(open({ ...bitcoin, price: 4_060_000, priceCurrency: 'php' }).value).toBe('4300000');
  });

  it('refuses an empty or zero target', () => {
    fireEvent.change(open(), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: /Alert me/ }));

    expect(screen.getByText('Enter a price above zero.')).toBeTruthy();
    expect(push.addAlert).not.toHaveBeenCalled();
  });

  it('shows the iPhone install steps instead of a form outside the Home Screen app', () => {
    push.status = 'needs-install';
    render(<PriceAlertDialog open onOpenChange={() => {}} coin={bitcoin} />);

    expect(screen.getByText('Install the app to get alerts on iPhone')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Alert me/ })).toBeNull();
  });
});
