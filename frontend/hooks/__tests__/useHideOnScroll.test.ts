// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useHideOnScroll } from '@/hooks/useHideOnScroll';

const VIEWPORT = 800;
const PAGE = 3000;
const PAGE_END = PAGE - VIEWPORT;

// jsdom has no layout, so give the hook the numbers a browser would.
function setPageHeight(height: number) {
  Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: height });
}

function scrollTo(y: number) {
  act(() => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: y });
    window.dispatchEvent(new Event('scroll'));
  });
}

beforeEach(() => {
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: VIEWPORT });
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
  setPageHeight(PAGE);
});

afterEach(cleanup);

describe('useHideOnScroll', () => {
  it('starts visible', () => {
    const { result } = renderHook(() => useHideOnScroll('/'));

    expect(result.current).toBe(false);
  });

  it('hides when scrolling down and shows when scrolling up', () => {
    const { result } = renderHook(() => useHideOnScroll('/'));

    scrollTo(300);
    expect(result.current).toBe(true);

    scrollTo(200);
    expect(result.current).toBe(false);
  });

  it('stays visible inside the top zone', () => {
    const { result } = renderHook(() => useHideOnScroll('/'));

    scrollTo(40);
    expect(result.current).toBe(false);
  });

  it('ignores jitter but adds up a slow scroll', () => {
    const { result } = renderHook(() => useHideOnScroll('/'));

    scrollTo(300);
    scrollTo(295);
    expect(result.current).toBe(true);

    scrollTo(290);
    expect(result.current).toBe(false);
  });

  it('shows at the end of the page, including past it on iOS', () => {
    const { result } = renderHook(() => useHideOnScroll('/'));

    scrollTo(1000);
    expect(result.current).toBe(true);

    scrollTo(PAGE_END + 60);
    expect(result.current).toBe(false);
  });

  it('stays visible on a page too short to scroll past the top zone', () => {
    setPageHeight(VIEWPORT + 30);
    const { result } = renderHook(() => useHideOnScroll('/'));

    scrollTo(30);
    expect(result.current).toBe(false);
  });

  it('shows again after a route change', () => {
    const { result, rerender } = renderHook(({ path }) => useHideOnScroll(path), {
      initialProps: { path: '/' },
    });

    scrollTo(300);
    expect(result.current).toBe(true);

    rerender({ path: '/news' });
    expect(result.current).toBe(false);
  });
});
