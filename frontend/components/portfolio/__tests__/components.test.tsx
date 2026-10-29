// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import CoinCombobox from '@/components/portfolio/CoinCombobox';
import CurrencyToggle from '@/components/portfolio/CurrencyToggle';
import { NoMatches, NoWallets } from '@/components/portfolio/EmptyState';
import { StalePricesBanner } from '@/components/portfolio/Notices';
import type { SearchResult } from '@/hooks/useCoinSearch';

// The picker's data hook does network calls; tests feed it fixed options.
const options: SearchResult[] = [
  { id: 'solana', name: 'Solana', symbol: 'sol', image: null, market_cap_rank: 7 },
  { id: 'solv-protocol', name: 'Solv Protocol', symbol: 'solv', image: null, market_cap_rank: 742 },
  { id: 'solayer', name: 'Solayer', symbol: 'layer', image: null, market_cap_rank: 1089 },
];
vi.mock('@/hooks/useCoinOptions', () => ({
  useCoinOptions: () => ({ options, isLoading: false, query: '' }),
}));

afterEach(cleanup);

describe('empty states', () => {
  it('first visit offers to create a wallet or import a backup', () => {
    const onCreate = vi.fn();
    const onImport = vi.fn();
    render(<NoWallets onCreate={onCreate} onImport={onImport} />);

    fireEvent.click(screen.getByRole('button', { name: /create your first wallet/i }));
    fireEvent.click(screen.getByRole('button', { name: /import a backup/i }));

    expect(onCreate).toHaveBeenCalledOnce();
    expect(onImport).toHaveBeenCalledOnce();
  });

  it('search with no match names the search and clears it', () => {
    const onClear = vi.fn();
    render(<NoMatches query="kraken" onClear={onClear} />);

    expect(screen.getByText(/No wallets named “kraken”/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /clear search/i }));
    expect(onClear).toHaveBeenCalledOnce();
  });
});

describe('StalePricesBanner', () => {
  it('says prices may be outdated and when they were last updated', () => {
    render(<StalePricesBanner updatedAt={new Date(2026, 9, 30, 13, 40).getTime()} />);

    const banner = screen.getByRole('status');
    expect(banner.textContent).toMatch(/Prices may be outdated/);
    expect(banner.textContent).toMatch(/13:40|1:40/);
  });
});

describe('CurrencyToggle', () => {
  it('marks the selected currency and reports changes', () => {
    const onChange = vi.fn();
    render(<CurrencyToggle value="usd" onChange={onChange} />);

    expect(screen.getByRole('button', { name: 'USD' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'PHP' }).getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: 'PHP' }));
    expect(onChange).toHaveBeenCalledWith('php');
  });
});

describe('CoinCombobox keyboard', () => {
  function setup() {
    const onSelect = vi.fn();
    render(<CoinCombobox onSelect={onSelect} />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'sol' } });
    return { input, onSelect };
  }

  it('moves with arrows and picks with Enter', () => {
    const { input, onSelect } = setup();

    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getAllByRole('option')).toHaveLength(3);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });

    const active = document.getElementById(input.getAttribute('aria-activedescendant') ?? '');
    expect(active?.textContent).toMatch(/Solv Protocol/);

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith(options[1]);
  });

  it('closes the list on Escape, and ArrowDown reopens on the first option', () => {
    const { input, onSelect } = setup();

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('listbox')).toBeNull();

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.getAttribute('aria-expanded')).toBe('true');

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith(options[0]);
  });
});
