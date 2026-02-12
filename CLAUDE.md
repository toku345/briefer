# Agent Guide

このファイルは、このリポジトリで作業する AI コーディングエージェント向けの開発ガイドです。

## プロジェクト概要

Briefer はローカル LLM（vLLM）を使って Web ページを要約・チャットできる Chrome 拡張機能（Manifest V3）。

## コマンド

```bash
bun install              # 依存関係のインストール
bun run build            # ビルド（WXT）
bun run dev              # 開発モード（WXT HMR）
bun run test             # テスト実行（Vitest）
bun run test <file>      # 単一ファイルのテスト
bun run typecheck        # 型チェックのみ
bun run lint             # Lintチェック
bun run check            # Lint + フォーマットチェック
bun run check:fix        # Lint + フォーマット自動修正
```

## コミット前チェック

コミット前に以下のコマンドがすべて成功すること:

```bash
bun run typecheck    # 型チェック
bun run check        # Lint + フォーマット
bun run test         # テスト
```

## 拡張機能の読み込み

1. `bun run build` でビルド
2. `chrome://extensions` を開く
3. デベロッパーモードを有効化
4. 「パッケージ化されていない拡張機能を読み込む」から `.output/chrome-mv3` を選択

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
| `lib/types.ts` | 共通型定義（ChatMessage, StreamChunk, Settings等） |
| `lib/extractor.ts` | ページコンテンツ抽出（article > main > role="main" > body） |
| `lib/llm-client.ts` | vLLM APIクライアント（ストリーミング対応、Side Panelから直接呼び出し） |
| `lib/settings-store.ts` | 設定管理（サーバーURL、temperature、max_tokens） |
| `entrypoints/background.ts` | Service Worker（Side Panel開閉 + コンテキストメニュー） |
| `entrypoints/sidepanel/index.tsx` | Side Panel エントリーポイント |
| `entrypoints/sidepanel/hooks/useChatStream.ts` | 統合ストリーミングhook（AbortController管理含む） |
| `entrypoints/sidepanel/hooks/usePageContent.ts` | executeScriptによるページコンテンツ取得 |
| `entrypoints/sidepanel/hooks/useServerHealth.ts` | vLLMサーバーのヘルスチェック |
| `wxt.config.ts` | WXT設定（manifest定義、React module） |

## LLM設定

`lib/settings-store.ts` で管理。サーバーURL（デフォルト: `http://localhost:8000/v1`）、temperature、max_tokens を UI から設定可能。モデルは vLLM サーバーから動的に取得し、UI 上で選択可能。
