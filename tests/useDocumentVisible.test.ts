/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

let useDocumentVisible: typeof import('../entrypoints/sidepanel/hooks/useDocumentVisible').useDocumentVisible;

describe('useDocumentVisible', () => {
  beforeAll(async () => {
    const module = await import('../entrypoints/sidepanel/hooks/useDocumentVisible');
    useDocumentVisible = module.useDocumentVisible;
  });

  beforeEach(() => {
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    });
  });

  it('初期状態で visible を返す', () => {
    const { result } = renderHook(() => useDocumentVisible());
    expect(result.current).toBe(true);
  });

  it('visibilityState が hidden になると false を返す', () => {
    const { result } = renderHook(() => useDocumentVisible());

    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(result.current).toBe(false);
  });

  it('visibilityState が visible に戻ると true を返す', () => {
    const { result } = renderHook(() => useDocumentVisible());

    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current).toBe(false);

    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current).toBe(true);
  });

  it('初期状態が hidden の場合 false を返す', () => {
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useDocumentVisible());
    expect(result.current).toBe(false);
  });

  it('unmount 後にイベントリスナーが解除される', () => {
    const { unmount } = renderHook(() => useDocumentVisible());

    const removeSpy = vi.spyOn(document, 'removeEventListener');
    unmount();

    expect(removeSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    removeSpy.mockRestore();
  });
});
