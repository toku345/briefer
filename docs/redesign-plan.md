# Briefer Chrome拡張 再設計プラン

## Context

Briefer はローカル vLLM サーバーを使用して Web ページを要約・チャットする Chrome 拡張機能（MV3）。
PR #16 で Service Worker 中継を廃止し、Side Panel → vLLM 直接 fetch アーキテクチャに移行済み。
本プランでは、ビルド基盤の刷新と UX 強化を段階的に実施する。

---

## 現在の状態

### 完了済み（PR #16）

- Side Panel から vLLM への直接 fetch（Keepalive 不要）
- `chrome.scripting.executeScript` 戻り値方式（Content Script 廃止）
- `useChatStream` 統合 hook（AbortController によるキャンセル対応）
- `useServerHealth` ヘルスチェック hook
- 設定管理（serverUrl, temperature, maxTokens）
- コンテキストメニュー（右クリック「Briefer で質問する」）
- Service Worker の軽量化（170行 → 57行）

### 維持している設計

- `ThinkTagFilter` の状態マシン設計
- `escapeXml`, `sanitizeTitle`, `sanitizeContent` のセキュリティ対策
- `StreamChunk` の判別共用体型
- `buildSystemMessage` のプロンプト構築
- `sender.id` 検証による送信元バリデーション

---

## 技術選定の判断記録

### 採用

| 技術 | 理由 |
|------|------|
| React 19 + TanStack Query | エコシステム（react-markdown, Testing Library）の恩恵が大きい。代替で得られるメリットがない |
| react-markdown + remark-gfm | ストリーミング Markdown レンダリングに最適。自前実装は工数大 |
| Vitest + Biome | テスト・Lint 構成として現状最適 |
| WXT | カスタム Vite プラグインを撲滅。manifest の TS 定義、HMR、出力構造の自動化 |
| zod | Chrome メッセージングの runtime validation。`unknown` が飛んでくる境界の型安全 |
| Playwright | MV3 拡張機能の E2E テスト。モック vLLM サーバーとの結合検証 |

### 不採用（必要になったら再検討）

| 技術 | 理由 |
|------|------|
| Tailwind CSS | Side Panel の CSS 規模が小さく、プレーン CSS で管理可能 |
| Zustand | TanStack Query + chrome.storage + useState で状態管理が完結。隙間がない |
| IndexedDB | chrome.storage.session（10MB）で十分。チャット1会話あたり数十KB |
| Preact / Solid / Svelte | バンドルサイズは拡張機能では問題にならない。エコシステムの喪失が大きい |
| WASM (Rust等) | クライアント側に計算ボトルネックがない。重い処理はすべて vLLM サーバー |

---

## 実装フェーズ

### Phase 1: Core Architecture ✅ 完了（PR #16）

Service Worker 中継の廃止、Direct Fetch アーキテクチャへの移行。
詳細は PR #16 を参照。

### Phase 2: WXT 移行 ✅ 完了

カスタム Vite プラグイン（`copyStaticAssets` 60行）を廃止し、WXT に移行済み。

| 作業 | 状態 | 内容 |
|------|------|------|
| WXT 導入 | ✅ | `wxt` + `@wxt-dev/module-react` を導入、`vite` 直接依存を削除 |
| manifest | ✅ | `src/manifest.json` → `wxt.config.ts` の TypeScript ベース定義に移行 |
| エントリポイント | ✅ | `src/` → `entrypoints/` + `lib/` + `public/` に再配置 |
| vite.config.ts | ✅ | カスタムプラグイン削除。WXT が出力構造を自動管理 |
| HMR | ✅ | WXT の開発モード（`bun run dev`）で Side Panel のホットリロードを有効化 |
| テスト更新 | ✅ | 全7テストファイルのインポートパス更新、`WxtVitest` プラグイン統合 |
| ドキュメント | ✅ | CLAUDE.md, README.md のパス・コマンド更新 |

### Phase 3: UX 強化

PR #18 の UX 要素を Direct Fetch アーキテクチャ上に再実装。6 PR に分割して段階的にマージする。

```
PR-1: 接続ステータスドット ──┬──▶ PR-2: PageContextBar + ErrorMessage
                             ├──▶ PR-3: Quick Actions + placeholder
                             └──▶ PR-4: 会話クリア + 設定ポップオーバー
                                          └──▶ PR-5: 動的パーミッション
PR-6: READY ハンドシェイク + キーボードショートカット（独立）
```

| PR | 作業 | 状態 | 内容 |
|----|------|------|------|
| PR-1 | 接続ステータスドット | | `useServerHealth` を 3 状態（`connected`/`checking`/`disconnected`）に拡張。Header に緑/黄/赤ドット表示 |
| PR-2 | PageContextBar + ErrorMessage | | ページタイトル+URL 表示。エラー 3 分類（サーバー未到達/ページ不可/その他）と対処法 |
| PR-3 | Quick Actions + placeholder | | WelcomeMessage に「要約」「重要ポイント」「簡単に説明」ボタン。InputContainer に送信不可理由表示 |
| PR-4 | 会話クリア + 設定ポップオーバー | | Header に「+」ボタン + 歯車アイコン。インラインポップオーバーで serverUrl/temperature/maxTokens 変更 |
| PR-5 | 動的パーミッション | | `optional_host_permissions` で localhost 以外のサーバーURL に対するホスト権限を動的要求 |
| PR-6 | READY ハンドシェイク + ショートカット | | `PANEL_READY`/`PENDING_TEXT` メッセージングで選択テキスト確実注入。Ctrl+Shift+B でサイドパネル開く |

### Phase 4: 型安全・テスト強化

| 作業 | 内容 |
|------|------|
| zod スキーマ | `StreamChunk`, `Settings`, `MessageType` 等の runtime validation 追加 |
| Playwright E2E | モック vLLM サーバーを起動し、拡張機能の実機挙動を自動検証 |
| コンポーネントテスト | Phase 3 で追加した UI コンポーネントのテスト |

### Phase 5: Power Features（将来）

- ライト/ダークテーマ切替（CSS 変数）
- 会話エクスポート（Markdown/JSON）
- `@mozilla/readability` + `turndown` による高品質コンテンツ抽出
- PDF / YouTube 字幕対応
- ThinkTagFilter の汎用 StreamFilter インターフェース化
- OpenAI 互換 API サーバー（Ollama, llama.cpp 等）への汎用対応

---

## 検証方法

各 Phase 完了後:

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
