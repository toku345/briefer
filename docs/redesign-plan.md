# Briefer Chrome拡張 再設計プラン

## Context

Brieferはローカル vLLM サーバーを使用してWebページを要約・チャットする Chrome 拡張機能（MV3）。
現在の設計では Service Worker がすべての LLM 通信を中継しており、MV3 の 30 秒タイムアウト制約に起因する Keepalive 機構の複雑さ、ストリーミングキャンセル不能、エラーハンドリングの複雑化といった問題を抱えている。
本プランでは外部 LLM サーバーの制約のみを維持し、アーキテクチャを根本から再設計する。

---

## 分析チームの所見サマリー

### UX担当
- ウェルカム画面が貧弱（固定テキストのみ）。クイックアクションが必要
- コンテンツ抽出状態が不可視。ユーザーは成功/失敗を判別できない
- ストリーミング中断手段がない（Stop Generation ボタン不在）
- エラー時にリトライ手段がない
- 設定がモデル選択のみ。サーバーURL変更不可はローカルLLMツールとして致命的
- ダークテーマ固定

### 技術アーキテクチャ担当
- **最重要**: Side Panel から vLLM へ直接 fetch 可能（`host_permissions` で許可済み）。Service Worker 中継は不要
- 直接 fetch にすれば Keepalive 不要、AbortController でキャンセル可能、エラーハンドリングが単純化
- Content Script も `chrome.scripting.executeScript` の戻り値で代替可能（100ms 遅延ハック解消）
- 状態管理は TanStack Query + カスタム hook の洗練で十分（Zustand 追加は過剰）

### 悪魔の代弁者
- CSP に `connect-src` が未指定 → 直接 fetch 前に PoC 検証が必須
- 全てを一度に変えるのはリスク大 → 段階的実施を推奨
- 現在良くできている点: メッセージ型の判別共用体、セキュリティ対策（sender検証、XMLエスケープ、プロンプトインジェクション防御）、ThinkTagFilter の状態マシン設計
- `background.test.ts`（444行）は Service Worker 中継前提 → 書き直し必要

### 既存ツール愛用者
- 競合（ChatGPT Sidebar, Sider, Monica AI）と比較してプロンプトテンプレート、右クリックメニュー、サーバーURL設定が欠如
- ローカル LLM はプライバシー面で最大の差別化要因 → 明示的に訴求すべき
- サーバー接続状態の常時表示が必要（現在はチャット送信時に初めてエラー判明）
- OpenAI 互換 API サーバー（Ollama, llama.cpp 等）への汎用対応で価値向上

---

## 設計方針

### 核心的な変更: Service Worker 中継の廃止

**Before（現在）:**
```
Side Panel → sendMessage → Service Worker → fetch → vLLM
Side Panel ← sendMessage ← Service Worker ← SSE ← vLLM
+ Keepalive port (20s ping)
```

**After（再設計）:**
```
Side Panel → fetch → vLLM (直接)
Side Panel → executeScript → DOM抽出 (戻り値)
```

Service Worker の残存責務:
- `chrome.action.onClicked` → Side Panel 開閉
- `chrome.sidePanel.setOptions` / `chrome.sidePanel.open`
- `chrome.contextMenus` → 選択テキスト送信

---

## 実装フェーズ

### Phase 0: PoC 検証

Side Panel から `http://localhost:8000/v1/models` への直接 fetch が動作することを確認。
CSP に `connect-src 'self' http://localhost:*` の追加が必要か検証。

### Phase 1: Core Architecture（Service Worker 中継廃止） ✅

**変更ファイル:**

| ファイル | 変更内容 |
|---------|---------|
| `src/manifest.json` | `content_scripts` セクション削除、CSP に `connect-src` 追加、`contextMenus` permission 追加 |
| `src/background/index.ts` | CHAT/GET_CHAT_STATE/GET_MODELS ハンドラ削除、Keepalive リスナー削除。Side Panel open + contextMenus のみ（~57行に縮小） |
| `src/lib/llm-client.ts` | `AbortSignal` パラメータ追加、設定からURL取得に変更 |
| `src/lib/settings-store.ts` | 拡充: サーバーURL、temperature、max_tokens を管理 |
| `src/lib/types.ts` | Keepalive/STREAM_CHUNK/CHAT 関連型を削除、Settings 型追加 |
| `src/sidepanel/hooks/usePageContent.ts` | `chrome.scripting.executeScript` + 戻り値方式に変更 |
| `src/sidepanel/hooks/useChatStream.ts` | **新規**: 統合ストリーミング hook（AbortController 管理を含む） |
| `src/sidepanel/hooks/useModels.ts` | 直接 `fetchModels()` 呼び出し |
| `src/sidepanel/hooks/useServerHealth.ts` | **新規**: `/v1/models` への定期ヘルスチェック（30秒間隔） |

**削除ファイル:**

| ファイル | 理由 |
|---------|------|
| `src/content/index.ts` | executeScript 戻り値方式で不要 |
| `src/sidepanel/hooks/useKeepalive.ts` | 直接 fetch で Keepalive 不要 |
| `src/sidepanel/hooks/useSendMessage.ts` | `useChatStream` に統合 |
| `src/sidepanel/hooks/useStreamListener.ts` | `useChatStream` に統合 |
| `src/lib/chat-store.ts` | Side Panel 内で TanStack Query + chrome.storage 直接管理 |

**維持した設計:**
- `ThinkTagFilter` の状態マシン設計（Side Panel 内で使用）
- `escapeXml`, `sanitizeTitle`, `sanitizeContent` のセキュリティ対策
- `StreamChunk` の判別共用体型
- `buildSystemMessage` のプロンプト構築

### Phase 2: UX Enhancement

| ファイル | 変更内容 |
|---------|---------|
| `src/sidepanel/components/WelcomeMessage.tsx` | クイックアクションボタン追加（「要約」「キーポイント抽出」「翻訳」等） |
| `src/sidepanel/components/Header.tsx` | サーバー接続状態インジケーター（緑/赤ドット）、設定ギアアイコン追加 |
| `src/sidepanel/components/SettingsPanel.tsx` | **新規**: サーバーURL、temperature、max_tokens、応答言語の設定UI |
| `src/sidepanel/components/InputContainer.tsx` | ストリーミング中は送信ボタンを停止ボタンに切替（Phase 1 で実装済み） |
| `src/sidepanel/components/MessageBubble.tsx` | エラー時リトライボタン、モデル名表示、再生成ボタン追加 |
| `src/sidepanel/style.css` | CSS 変数によるテーマシステム導入（ライト/ダーク切替） |
| `src/background/index.ts` | `chrome.contextMenus` 登録（Phase 1 で実装済み） |

### Phase 3: Content Extraction 改善 + テスト拡充

- `@mozilla/readability` + `turndown` による高品質コンテンツ抽出
- `executeScript` で Readability.js のロジックを注入実行
- コンポーネントテスト、hook テスト大幅追加

### Phase 4: Power Features

- 会話エクスポート（Markdown/JSON）
- キーボードショートカット
- ThinkTagFilter の汎用 StreamFilter インターフェース化
- PDF/YouTube 字幕対応

---

## `useChatStream` hook の設計概要（Phase 1 の核心）

3 つの hook（`useSendMessage`, `useStreamListener`, `useKeepalive`）に分散していたストリーミングロジックを 1 つに統合:

```
useChatStream(tabId, pageContent)
  ├── sendMessage(userMessage)
  │     ├── AbortController 生成
  │     ├── ユーザーメッセージを QueryClient に楽観的追加
  │     ├── streamChat() を直接呼び出し（AbortSignal 付き）
  │     ├── AsyncGenerator を消費 → streamingContent を更新
  │     ├── ThinkTagFilter でフィルタリング
  │     ├── done 時に履歴に確定 + chrome.storage.session に保存
  │     └── error 時にエラー状態を設定
  ├── cancel() → AbortController.abort()
  ├── streamingContent: string
  ├── isStreaming: boolean
  └── error: string | null
```

---

## 検証方法

### Phase 1 完了後
```bash
bun run typecheck    # 型チェック
bun run check        # Lint + フォーマット
bun run test         # テスト
```

手動テスト:
1. 拡張機能をリロードし、Side Panel を開く
2. ページ要約を実行 → ストリーミング応答を確認
3. ストリーミング中に停止ボタンで中断 → 即座に停止することを確認
4. vLLM サーバーを停止した状態で送信 → 適切なエラー表示を確認
5. 右クリックメニュー「Briefer で質問する」が表示・動作することを確認
6. 複数タブでの独立した会話を確認
