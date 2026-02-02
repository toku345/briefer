# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

BrieferはローカルLLM（vLLM）を使用してWebページを要約・チャットできるChrome拡張機能（Manifest V3）。

## コマンド

```bash
bun install          # 依存関係インストール
bun run build        # ビルド（型チェック + Vite）
bun run dev          # 開発モード（ファイル監視）
bun test             # テスト実行
bun test <file>      # 単一ファイルのテスト
bun run typecheck    # 型チェックのみ
```

## 拡張機能の読み込み

1. `bun run build` でビルド
2. `chrome://extensions` → デベロッパーモード → 「パッケージ化されていない拡張機能を読み込む」 → `dist`フォルダ選択

## アーキテクチャ

```
┌─────────────┐     GET_CONTENT      ┌─────────────────┐
│ Side Panel  │ ──────────────────▶  │ Content Script  │
│ (チャットUI) │ ◀──────────────────  │ (DOM解析)       │
└─────────────┘                      └─────────────────┘
       │
       │ CHAT (with tabId)
       ▼
┌─────────────────┐     POST /v1/chat/completions
│ Service Worker  │ ─────────────────────────────────▶ vLLM
│ (API・状態管理)  │ ◀───────── streaming response ────  :8000
└─────────────────┘
       │
       │ STREAM_CHUNK
       ▼
   Side Panel
```

### コンポーネント間通信

- **Side Panel → Content Script**: `chrome.tabs.sendMessage(tabId, { type: 'GET_CONTENT' })`
- **Side Panel → Service Worker**: `chrome.runtime.sendMessage({ type: 'CHAT', tabId, payload })`
- **Service Worker → Side Panel**: `chrome.runtime.sendMessage({ type: 'STREAM_CHUNK', tabId, payload })`

重要: Side Panelからのメッセージでは`sender.tab`がundefinedになるため、メッセージに`tabId`を含める必要がある。

### 主要ファイル

| ファイル | 役割 |
|---------|------|
| `src/lib/types.ts` | 共通型定義（ChatMessage, StreamChunk等） |
| `src/lib/extractor.ts` | ページコンテンツ抽出（article > main > role="main" > body） |
| `src/lib/llm-client.ts` | vLLM APIクライアント（ストリーミング対応） |
| `src/lib/chat-store.ts` | 会話履歴管理（chrome.storage.session） |
| `src/content/index.ts` | Content Script |
| `src/background/index.ts` | Service Worker |
| `src/sidepanel/index.ts` | Side Panel UI |

## LLM設定

`src/lib/llm-client.ts` で設定:

```typescript
const VLLM_BASE_URL = 'http://localhost:8000/v1';
const DEFAULT_MODEL = 'Qwen/Qwen3-Coder-30B-A3B-Instruct';
```
