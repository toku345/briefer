# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

BrieferはローカルLLM（vLLM）を使用してWebページを要約・チャットできるChrome拡張機能（Manifest V3）。

## コマンド

```bash
bun install              # 依存関係インストール
bun run build            # ビルド（型チェック + Vite）
bun run dev              # 開発モード（ファイル監視）
bun run test             # テスト実行（vitestを使用）
bun run test <file>      # 単一ファイルのテスト
bun run typecheck        # 型チェックのみ
bun run lint             # Lintチェック
bun run check            # Lint + フォーマットチェック
bun run check:fix        # Lint + フォーマット自動修正
```

## コミット前チェック

コミット作成前に以下のコマンドが全てパスすることを確認する:

```bash
bun run typecheck    # 型チェック
bun run check        # Lint + フォーマット
bun run test         # テスト
```

## 拡張機能の読み込み

1. `bun run build` でビルド
2. `chrome://extensions` → デベロッパーモード → 「パッケージ化されていない拡張機能を読み込む」 → `dist`フォルダ選択

## アーキテクチャ

Side Panel から vLLM API へ直接 fetch する構成。Service Worker はリレーせず、Side Panel の開閉とコンテキストメニューのみ担当。

```
┌─────────────┐     POST /v1/chat/completions
│ Side Panel  │ ─────────────────────────────────▶ vLLM
│ (チャットUI) │ ◀───────── streaming response ────  :8000
└─────────────┘
       │
       │ chrome.scripting.executeScript (戻り値でDOM取得)
       ▼
   対象タブ

┌─────────────────┐
│ Service Worker  │  Side Panel 開閉 + コンテキストメニュー登録のみ
│ (軽量)          │
└─────────────────┘
```

### 主要ファイル

| ファイル | 役割 |
|---------|------|
| `src/lib/types.ts` | 共通型定義（ChatMessage, StreamChunk, Settings等） |
| `src/lib/extractor.ts` | ページコンテンツ抽出（article > main > role="main" > body） |
| `src/lib/llm-client.ts` | vLLM APIクライアント（ストリーミング対応、Side Panelから直接呼び出し） |
| `src/lib/settings-store.ts` | 設定管理（サーバーURL、temperature、max_tokens） |
| `src/background/index.ts` | Service Worker（Side Panel開閉 + コンテキストメニュー） |
| `src/sidepanel/index.tsx` | Side Panel エントリーポイント |
| `src/sidepanel/hooks/useChatStream.ts` | 統合ストリーミングhook（AbortController管理含む） |
| `src/sidepanel/hooks/usePageContent.ts` | executeScriptによるページコンテンツ取得 |
| `src/sidepanel/hooks/useServerHealth.ts` | vLLMサーバーのヘルスチェック |

## LLM設定

`src/lib/settings-store.ts` で管理。サーバーURL（デフォルト: `http://localhost:8000/v1`）、temperature、max_tokens をUIから設定可能。モデルはvLLMサーバーから動的に取得。
