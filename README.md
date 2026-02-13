# Briefer

ローカルLLMを使用してWebページを素早く要約・チャットできるChrome拡張機能。

## 特徴

- **サイドパネルUI**: ページを見ながらチャット形式で会話
- **ローカルLLM**: vLLM（OpenAI API互換）を使用、データは外部に送信されない
- **会話履歴**: タブごとに会話を保持
- **ストリーミング**: リアルタイムで応答を表示

## 必要環境

- [Bun](https://bun.sh/)
- Chrome 114+（Side Panel API対応）
- vLLMサーバー（`http://localhost:8000`で起動）

## セットアップ

### 1. 依存関係のインストール

```bash
bun install
```

### 2. ビルド

```bash
bun run build
```

### 3. Chrome拡張機能の読み込み

1. `chrome://extensions` を開く
2. 「デベロッパーモード」を有効化
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. `.output/chrome-mv3` フォルダを選択

### 4. vLLMサーバーの起動

```bash
# 使用するモデルを指定してvLLMサーバーを起動
vllm serve <モデル名> --port 8000
```

利用可能なモデルはUIのドロップダウンから選択可能。

## 使い方

1. 任意のWebページで拡張機能アイコンをクリック
2. サイドパネルが開き、「このページを要約して」が入力済み
3. Enterキーで送信
4. 続けて質問可能

## 開発

```bash
# 開発モード（ファイル変更を監視）
bun run dev

# テスト実行
bun test

# 型チェック
bun run typecheck
```

## 設定変更

サイドパネルのヘッダーにある設定アイコンから、以下を UI 上で変更可能：

- **サーバーURL**: vLLM API のエンドポイント（デフォルト: `http://localhost:8000/v1`）
- **モデル**: vLLM サーバーから動的に取得し、ドロップダウンで選択
- **Temperature / Max Tokens**: 生成パラメータの調整

## ディレクトリ構成

```
briefer/
├── entrypoints/
│   ├── background.ts       # Service Worker（Side Panel開閉 + コンテキストメニュー）
│   └── sidepanel/          # Side Panel UI（React）
│       ├── components/
│       └── hooks/
├── lib/                    # 共通ライブラリ（型定義、APIクライアント、設定管理等）
├── public/                 # アイコン等の静的アセット
├── tests/                  # テスト
├── wxt.config.ts           # WXT設定（manifest定義）
└── .output/chrome-mv3/     # ビルド成果物
```

## ライセンス

MIT
