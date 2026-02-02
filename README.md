# Briefer

ローカルLLMを使用してWebページを素早く要約・チャットできるChrome拡張機能。

## 特徴

- **サイドパネルUI**: ページを見ながらチャット形式で会話
- **ローカルLLM**: vLLM（OpenAI API互換）を使用、データは外部に送信されない
- **会話履歴**: タブごとに会話を保持
- **ストリーミング**: リアルタイムで応答を表示

## 必要環境

- Node.js 18+
- Chrome 114+（Side Panel API対応）
- vLLMサーバー（`http://localhost:8000`で起動）

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. ビルド

```bash
npm run build
```

### 3. Chrome拡張機能の読み込み

1. `chrome://extensions` を開く
2. 「デベロッパーモード」を有効化
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. `dist` フォルダを選択

### 4. vLLMサーバーの起動

```bash
# 例: Qwenモデルの場合
vllm serve Qwen/Qwen3-Coder-30B-A3B-Instruct --port 8000
```

## 使い方

1. 任意のWebページで拡張機能アイコンをクリック
2. サイドパネルが開き、「このページを要約して」が入力済み
3. Enterキーで送信
4. 続けて質問可能

## 開発

```bash
# 開発モード（ファイル変更を監視）
npm run dev

# テスト実行
npm test

# 型チェック
npm run typecheck
```

## 設定変更

### モデル名の変更

`src/lib/llm-client.ts` の `DEFAULT_MODEL` を編集：

```typescript
const DEFAULT_MODEL = 'your-model-name';
```

### APIエンドポイントの変更

`src/lib/llm-client.ts` の `VLLM_BASE_URL` を編集：

```typescript
const VLLM_BASE_URL = 'http://your-server:port/v1';
```

## ディレクトリ構成

```
briefer/
├── src/
│   ├── background/     # Service Worker
│   ├── content/        # Content Script
│   ├── sidepanel/      # Side Panel UI
│   ├── lib/            # 共通ライブラリ
│   ├── icons/          # アイコン
│   └── manifest.json
├── tests/              # テスト
└── dist/               # ビルド成果物
```

## ライセンス

MIT
