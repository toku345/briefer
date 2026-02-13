import { beforeEach, describe, expect, it, vi } from 'vitest';

let actionClickedListener: (tab: chrome.tabs.Tab) => void;
let contextMenuClickedListener: (
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab,
) => void;
let installedListener: () => void;

const mockChrome = {
  runtime: {
    id: 'test-extension-id',
    sendMessage: vi.fn(),
    onInstalled: {
      addListener: vi.fn((listener) => {
        installedListener = listener;
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

    it('briefer-ask クリック時にサイドパネルを開く', () => {
      const info = {
        menuItemId: 'briefer-ask',
        selectionText: '選択テキスト',
      } as chrome.contextMenus.OnClickData;
      const tab = { id: 789 } as chrome.tabs.Tab;

      contextMenuClickedListener(info, tab);

      expect(mockChrome.sidePanel.setOptions).toHaveBeenCalledWith({
        tabId: 789,
        path: 'sidepanel.html',
        enabled: true,
      });
      expect(mockChrome.sidePanel.open).toHaveBeenCalledWith({ tabId: 789 });
      expect(mockChrome.storage.session.set).toHaveBeenCalledWith({
        pending_text_789: '選択テキスト',
      });
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
});
