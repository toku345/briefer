import { beforeEach, describe, expect, it, vi } from 'vitest';

let actionClickedListener: (tab: chrome.tabs.Tab) => void;
let contextMenuClickedListener: (
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab,
) => void;
let installedListener: () => void;

type MessageListener = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
) => boolean | undefined;
const messageListeners: MessageListener[] = [];

const mockChrome = {
  runtime: {
    id: 'test-extension-id',
    sendMessage: vi.fn().mockResolvedValue(undefined),
    onInstalled: {
      addListener: vi.fn((listener) => {
        installedListener = listener;
      }),
    },
    onMessage: {
      addListener: vi.fn((listener: MessageListener) => {
        messageListeners.push(listener);
      }),
    },
  },
  action: {
    onClicked: {
      addListener: vi.fn((listener) => {
        actionClickedListener = listener;
      }),
    },
  },
  sidePanel: {
    setOptions: vi.fn().mockResolvedValue(undefined),
    open: vi.fn().mockResolvedValue(undefined),
  },
  storage: {
    session: {
      set: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue({}),
      remove: vi.fn().mockResolvedValue(undefined),
    },
  },
  contextMenus: {
    create: vi.fn(),
    onClicked: {
      addListener: vi.fn((listener) => {
        contextMenuClickedListener = listener;
      }),
    },
  },
};

(globalThis as unknown as { chrome: typeof chrome }).chrome =
  mockChrome as unknown as typeof chrome;

const { setupBackground } = await import('../entrypoints/background');
setupBackground();

const initialSetOptionsCall = mockChrome.sidePanel.setOptions.mock.calls[0];

describe('background service worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Side Panel 初期化', () => {
    it('モジュール読み込み時にデフォルトで無効化する', () => {
      expect(initialSetOptionsCall).toEqual([{ enabled: false }]);
    });
  });

  describe('アクションボタン', () => {
    it('クリック時にサイドパネルを開く', () => {
      const tab = { id: 456 } as chrome.tabs.Tab;

      actionClickedListener(tab);

      expect(mockChrome.sidePanel.setOptions).toHaveBeenCalledWith({
        tabId: 456,
        path: 'sidepanel.html',
        enabled: true,
      });
      expect(mockChrome.sidePanel.open).toHaveBeenCalledWith({ tabId: 456 });
    });

    it('タブIDがない場合はサイドパネルを開かない', () => {
      const tab = {} as chrome.tabs.Tab;

      actionClickedListener(tab);

      expect(mockChrome.sidePanel.setOptions).not.toHaveBeenCalled();
      expect(mockChrome.sidePanel.open).not.toHaveBeenCalled();
    });
  });

  describe('コンテキストメニュー', () => {
    it('onInstalled でメニューを登録する', () => {
      installedListener();

      expect(mockChrome.contextMenus.create).toHaveBeenCalledWith(
        {
          id: 'briefer-ask',
          title: 'Briefer で質問する',
          contexts: ['selection'],
        },
        expect.any(Function),
      );
    });

    it('briefer-ask クリック時に storage 保存 → サイドパネル開く → sendMessage', async () => {
      const info = {
        menuItemId: 'briefer-ask',
        selectionText: '選択テキスト',
      } as chrome.contextMenus.OnClickData;
      const tab = { id: 789 } as chrome.tabs.Tab;

      await contextMenuClickedListener(info, tab);

      expect(mockChrome.storage.session.set).toHaveBeenCalledWith({
        pending_text_789: '選択テキスト',
      });
      expect(mockChrome.sidePanel.setOptions).toHaveBeenCalledWith({
        tabId: 789,
        path: 'sidepanel.html',
        enabled: true,
      });
      expect(mockChrome.sidePanel.open).toHaveBeenCalledWith({ tabId: 789 });
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'PENDING_TEXT',
        tabId: 789,
        text: '選択テキスト',
      });
    });

    it('sendMessage 失敗時もエラーが伝播しない', async () => {
      mockChrome.runtime.sendMessage.mockRejectedValueOnce(new Error('No receiver'));

      const info = {
        menuItemId: 'briefer-ask',
        selectionText: 'text',
      } as chrome.contextMenus.OnClickData;
      const tab = { id: 100 } as chrome.tabs.Tab;

      await expect(contextMenuClickedListener(info, tab)).resolves.not.toThrow();
    });

    it('タブIDがない場合はサイドパネルを開かない', () => {
      const info = {
        menuItemId: 'briefer-ask',
        selectionText: 'text',
      } as chrome.contextMenus.OnClickData;

      contextMenuClickedListener(info, undefined);

      expect(mockChrome.sidePanel.setOptions).not.toHaveBeenCalled();
    });

    it('他のメニューIDは無視する', () => {
      const info = {
        menuItemId: 'other-menu',
        selectionText: 'text',
      } as chrome.contextMenus.OnClickData;
      const tab = { id: 100 } as chrome.tabs.Tab;

      contextMenuClickedListener(info, tab);

      expect(mockChrome.sidePanel.setOptions).not.toHaveBeenCalled();
    });
  });

  describe('PANEL_READY メッセージ', () => {
    it('pending_text あり → sendResponse(PENDING_TEXT, text) + storage 削除', async () => {
      mockChrome.storage.session.get.mockResolvedValue({ pending_text_10: '保留テキスト' });
      const sendResponse = vi.fn();

      const returned = messageListeners[0](
        { type: 'PANEL_READY', tabId: 10 },
        {} as chrome.runtime.MessageSender,
        sendResponse,
      );

      // 非同期 sendResponse のため true を返す
      expect(returned).toBe(true);

      // storage.get の Promise を解決させる
      await vi.waitFor(() => {
        expect(sendResponse).toHaveBeenCalledWith({
          type: 'PENDING_TEXT',
          tabId: 10,
          text: '保留テキスト',
        });
      });
      expect(mockChrome.storage.session.remove).toHaveBeenCalledWith('pending_text_10');
    });

    it('pending_text なし → sendResponse(PENDING_TEXT, "") で storage 削除しない', async () => {
      mockChrome.storage.session.get.mockResolvedValue({});
      const sendResponse = vi.fn();

      messageListeners[0](
        { type: 'PANEL_READY', tabId: 20 },
        {} as chrome.runtime.MessageSender,
        sendResponse,
      );

      await vi.waitFor(() => {
        expect(sendResponse).toHaveBeenCalledWith({
          type: 'PENDING_TEXT',
          tabId: 20,
          text: '',
        });
      });
      expect(mockChrome.storage.session.remove).not.toHaveBeenCalled();
    });
  });
});
