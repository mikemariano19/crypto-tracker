// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AboutPage from '@/app/about/page';
import DeveloperCard from '@/components/about/DeveloperCard';
import FeatureGrid from '@/components/about/FeatureGrid';
import { about } from '@/content/about';

vi.spyOn(console, 'warn').mockImplementation(() => {});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('About page', () => {
  it('has one h1 and every required section anchor', () => {
    const { container } = render(<AboutPage />);

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    for (const id of ['features', 'how-it-works', 'data-sources', 'ai', 'privacy', 'disclaimer', 'tech']) {
      expect(container.querySelector(`section#${id} h2`)).not.toBeNull();
    }
  });

  it('shows the disclaimer text and CoinGecko attribution', () => {
    render(<AboutPage />);

    expect(screen.getByRole('note').textContent).toBe(about.disclaimer);
    expect(screen.getByRole('link', { name: /Data provided by CoinGecko/ }).getAttribute('href')).toBe('https://www.coingecko.com');
  });

  it('opens external links safely in a new tab', () => {
    render(<AboutPage />);

    for (const link of screen.getAllByRole('link', { name: /opens in new tab/ })) {
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    }
  });

  it('leaves the developer section out while it is all placeholders', () => {
    const { container } = render(<AboutPage />);

    expect(container.querySelector('#developer')).toBeNull();
    expect(container.textContent).not.toMatch(/\[Your/);
  });
});

describe('FeatureGrid', () => {
  it('hides disabled features', () => {
    const features = structuredClone(about.features);
    features[2].enabled = false;
    render(<FeatureGrid features={features} />);

    const list = screen.getByRole('list');
    expect(within(list).getAllByRole('link')).toHaveLength(2);
    expect(within(list).queryByText(features[2].title)).toBeNull();
  });
});

describe('DeveloperCard', () => {
  it('shows only filled-in values', () => {
    const content = structuredClone(about);
    content.developer.name = 'Jane Dev';
    content.developer.links[3].href = 'mailto:jane@example.com';
    render(<DeveloperCard content={content} />);

    expect(screen.getByRole('heading', { name: 'Jane Dev' })).toBeTruthy();
    expect(screen.queryByText(/\[Your role/)).toBeNull();
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Email' }).getAttribute('href')).toBe('mailto:jane@example.com');
  });
});
