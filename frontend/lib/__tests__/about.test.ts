import { afterEach, describe, expect, it, vi } from 'vitest';
import { about } from '@/content/about';
import { filledLinks, findPlaceholders, hasDeveloper, isPlaceholder, loadAbout } from '@/lib/about';

afterEach(() => vi.restoreAllMocks());

describe('about content', () => {
  it('is valid as shipped', () => {
    expect(() => loadAbout(about)).not.toThrow();
  });

  it('fails loudly on a missing or wrong field', () => {
    const broken = structuredClone(about) as Record<string, unknown>;
    delete broken.disclaimer;
    expect(() => loadAbout(broken)).toThrow(/disclaimer/);

    const badLink = structuredClone(about);
    badLink.features[0].href = 'javascript:alert(1)';
    expect(() => loadAbout(badLink)).toThrow(/features\.0\.href/);
  });

  it('only links to features that exist in the app', () => {
    const routes = ['/', '/news', '/portfolio'];
    for (const feature of about.features.filter((f) => f.enabled)) {
      expect(routes).toContain(feature.href);
    }
  });

  it('finds every [placeholder] by path', () => {
    expect(isPlaceholder('[Your Name]')).toBe(true);
    expect(isPlaceholder('Mike')).toBe(false);
    expect(findPlaceholders({ a: 'ok', b: ['x', '[todo]'], c: { d: '[fill]' } })).toEqual(['b.1', 'c.d']);
    expect(findPlaceholders(about)).toContain('developer.name');
  });

  it('hides unfilled developer details', () => {
    const content = structuredClone(about);
    expect(hasDeveloper(content)).toBe(false);
    expect(filledLinks(content)).toEqual([]);

    content.developer.name = 'Jane Dev';
    content.developer.links[0].href = 'https://github.com/jane';
    expect(hasDeveloper(content)).toBe(true);
    expect(filledLinks(content).map((l) => l.label)).toEqual(['GitHub']);
  });
});
