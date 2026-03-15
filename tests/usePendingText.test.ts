/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type MessageListener = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
) => void;

const messageListeners: MessageListener[] = [];

const mockChrome = {
  runtime: {
    id: 'test-extension-id',
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn((listener: MessageListener) => {
        messageListeners.push(listener);
      }),
      removeListener: vi.fn((listener: MessageListener) => {
        const idx = messageListeners.indexOf(listener);
        if (idx !== -1) messageListeners.splice(idx, 1);
      }),
    },
  },
};

(globalThis as unknown as { chrome: typeof chrome }).chrome =
  mockChrome as unknown as typeof chrome;

const { usePendingText } = await import('../entrypoints/sidepanel/hooks/usePendingText');

describe('usePendingText', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    messageListeners.length = 0;
  });

  it('tabId が null の場合 sendMessage を呼ばない', () => {
    renderHook(() => usePendingText(null));
    expect(mockChrome.runtime.sendMessage).not.toHaveBeenCalled();
  });

  it('tabId 確定時に PANEL_READY を送信し、text ありレスポンスで pendingText をセット', async () => {
    mockChrome.runtime.sendMessage.mockResolvedValue({
      type: 'PENDING_TEXT',
      tabId: 1,
      text: 'テスト',
    });

    const { result } = renderHook(() => usePendingText(1));

    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'PANEL_READY',
      tabId: 1,
    });

    await waitFor(() => {
      expect(result.current.pendingText).toBe('以下のテキストについて質問:\n\nテスト');
    });
  });

  it('text 空レスポンスでは pendingText が null のまま', async () => {
    mockChrome.runtime.sendMessage.mockResolvedValue({
      type: 'PENDING_TEXT',
      tabId: 1,
      text: '',
    });

    const { result } = renderHook(() => usePendingText(1));

    await waitFor(() => {
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalled();
    });

    expect(result.current.pendingText).toBeNull();
  });

  it('onMessage で PENDING_TEXT 受信 → pendingText 更新', async () => {
    mockChrome.runtime.sendMessage.mockResolvedValue(undefined);

    const { result } = renderHook(() => usePendingText(42));

    await waitFor(() => {
      expect(messageListeners.length).toBe(1);
    });

    act(() => {
      messageListeners[0](
        { type: 'PENDING_TEXT', tabId: 42, text: '選択テキスト' },
        {} as chrome.runtime.MessageSender,
        vi.fn(),
      );
    });

    expect(result.current.pendingText).toBe('以下のテキストについて質問:\n\n選択テキスト');
  });

  it('異なる tabId の PENDING_TEXT は無視する', async () => {
    mockChrome.runtime.sendMessage.mockResolvedValue(undefined);

    const { result } = renderHook(() => usePendingText(42));

    await waitFor(() => {
      expect(messageListeners.length).toBe(1);
    });

    act(() => {
      messageListeners[0](
        { type: 'PENDING_TEXT', tabId: 999, text: '別タブ' },
        {} as chrome.runtime.MessageSender,
        vi.fn(),
      );
    });

    expect(result.current.pendingText).toBeNull();
  });

  it('consume() で pendingText が null になる', async () => {
    mockChrome.runtime.sendMessage.mockResolvedValue({
      type: 'PENDING_TEXT',
      tabId: 1,
      text: 'テスト',
    });

    const { result } = renderHook(() => usePendingText(1));

    await waitFor(() => {
      expect(result.current.pendingText).toBe('以下のテキストについて質問:\n\nテスト');
    });

    act(() => {
      result.current.consume();
    });

    expect(result.current.pendingText).toBeNull();
  });

  it('unmount 時に removeListener が呼ばれる', async () => {
    mockChrome.runtime.sendMessage.mockResolvedValue(undefined);

    const { unmount } = renderHook(() => usePendingText(1));

    await waitFor(() => {
      expect(messageListeners.length).toBe(1);
    });

    unmount();

    expect(mockChrome.runtime.onMessage.removeListener).toHaveBeenCalled();
    expect(messageListeners.length).toBe(0);
  });

  it('sendMessage が reject しても pendingText は null のまま', async () => {
    mockChrome.runtime.sendMessage.mockRejectedValueOnce(new Error('No receiver'));

    const { result } = renderHook(() => usePendingText(1));

    await waitFor(() => {
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalled();
    });

    expect(result.current.pendingText).toBeNull();
  });

  it('unmount 後に sendMessage が resolve しても pendingText は更新されない', async () => {
    let resolveMsg: (value: unknown) => void = () => {};
    mockChrome.runtime.sendMessage.mockReturnValue(
      new Promise((resolve) => {
        resolveMsg = resolve;
      }),
    );

    const { result, unmount } = renderHook(() => usePendingText(1));
    unmount();

    // unmount 後に resolve
    resolveMsg({ type: 'PENDING_TEXT', tabId: 1, text: '遅延テキスト' });

    // pendingText は null のまま（setState が呼ばれない）
    expect(result.current.pendingText).toBeNull();
  });

  it('直送 PENDING_TEXT 受信後に PANEL_READY 応答が返っても上書きしない', async () => {
    let resolvePanelReady: (value: unknown) => void = () => {};
    mockChrome.runtime.sendMessage.mockReturnValue(
      new Promise((resolve) => {
        resolvePanelReady = resolve;
      }),
    );

    const { result } = renderHook(() => usePendingText(42));

    await waitFor(() => {
      expect(messageListeners.length).toBe(1);
    });

    // 直送 PENDING_TEXT が先に到着
    act(() => {
      messageListeners[0](
        { type: 'PENDING_TEXT', tabId: 42, text: '新しいテキスト' },
        {} as chrome.runtime.MessageSender,
        vi.fn(),
      );
    });

    expect(result.current.pendingText).toBe('以下のテキストについて質問:\n\n新しいテキスト');

    // 古い PANEL_READY 応答が遅れて resolve
    resolvePanelReady({ type: 'PENDING_TEXT', tabId: 42, text: '古いテキスト' });

    // 上書きされないことを確認
    await waitFor(() => {
      expect(result.current.pendingText).toBe('以下のテキストについて質問:\n\n新しいテキスト');
    });
  });
});
