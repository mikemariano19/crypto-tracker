// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import PriceFlash from '@/components/PriceFlash';

// jsdom has no Web Animations API; record what would have been played.
const animate = vi.fn();
const cancel = vi.fn();

Object.assign(HTMLElement.prototype, {
  animate,
  getAnimations: () => [{ cancel }],
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const firstColor = () => (animate.mock.calls[0][0] as Keyframe[])[0].color;

describe('PriceFlash', () => {
  it('does not flash on first render', () => {
    render(<PriceFlash value={100}>$100</PriceFlash>);
    expect(animate).not.toHaveBeenCalled();
  });

  it('flashes green when the value goes up and red when it goes down', () => {
    const { rerender } = render(<PriceFlash value={100}>$100</PriceFlash>);

    rerender(<PriceFlash value={101}>$101</PriceFlash>);
    expect(animate).toHaveBeenCalledTimes(1);
    expect(firstColor()).toContain('150.069'); // green-700 hue

    animate.mockClear();
    rerender(<PriceFlash value={99}>$99</PriceFlash>);
    expect(animate).toHaveBeenCalledTimes(1);
    expect(firstColor()).toContain('27.325'); // red-600 hue
    expect(cancel).toHaveBeenCalled(); // restarts instead of stacking
  });

  it('ignores unchanged and missing values', () => {
    const { rerender } = render(<PriceFlash value={100}>$100</PriceFlash>);

    rerender(<PriceFlash value={100}>$100</PriceFlash>);
    rerender(<PriceFlash value={null}>—</PriceFlash>);
    rerender(<PriceFlash value={105}>$105</PriceFlash>);

    expect(animate).not.toHaveBeenCalled();
  });

  it('fades back to the normal colour (no end keyframe colour)', () => {
    const { rerender } = render(<PriceFlash value={1}>$1</PriceFlash>);
    rerender(<PriceFlash value={2}>$2</PriceFlash>);

    const keyframes = animate.mock.calls[0][0] as Keyframe[];
    expect(keyframes.at(-1)?.offset).toBeLessThan(1);
  });
});
