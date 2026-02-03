import { beforeEach, describe, expect, it } from 'vitest';
import { ThinkTagFilter } from '../src/lib/think-tag-filter';

describe('ThinkTagFilter', () => {
  let filter: ThinkTagFilter;

  beforeEach(() => {
    filter = new ThinkTagFilter();
  });

  describe('基本動作', () => {
    it('通常テキストはそのまま通す', () => {
      expect(filter.process('Hello, world!')).toBe('Hello, world!');
    });

    it('空文字列を正しく処理する', () => {
      expect(filter.process('')).toBe('');
    });

    it('<think>...</think>を完全に除去する', () => {
      expect(filter.process('<think>考え中です</think>回答します')).toBe('回答します');
    });

    it('複数の<think>タグを除去する', () => {
      const input = '<think>思考1</think>最初の回答<think>思考2</think>次の回答';
      expect(filter.process(input)).toBe('最初の回答次の回答');
    });

    it('タグの前後にテキストがある場合も正しく処理する', () => {
      const input = '前のテキスト<think>思考中</think>後のテキスト';
      expect(filter.process(input)).toBe('前のテキスト後のテキスト');
    });

    it('<think>タグのみの入力は空文字列を返す', () => {
      expect(filter.process('<think>思考のみ</think>')).toBe('');
    });
  });

  describe('ストリーミング対応', () => {
    it('タグが分割されて到着しても正しくフィルタする', () => {
      let result = '';
      result += filter.process('<thi');
      result += filter.process('nk>考え中');
      result += filter.process('</think>回答');
      expect(result).toBe('回答');
    });

    it('開始タグが1文字ずつ到着しても正しく処理する', () => {
      let result = '';
      result += filter.process('<');
      result += filter.process('t');
      result += filter.process('h');
      result += filter.process('i');
      result += filter.process('n');
      result += filter.process('k');
      result += filter.process('>');
      result += filter.process('思考');
      result += filter.process('</think>');
      result += filter.process('回答');
      expect(result).toBe('回答');
    });

    it('終了タグが分割されて到着しても正しく処理する', () => {
      let result = '';
      result += filter.process('<think>思考中</');
      result += filter.process('thi');
      result += filter.process('nk>');
      result += filter.process('回答です');
      expect(result).toBe('回答です');
    });

    it('タグ内コンテンツが複数チャンクに分割されても除去する', () => {
      let result = '';
      result += filter.process('<think>');
      result += filter.process('これは');
      result += filter.process('思考過程');
      result += filter.process('です');
      result += filter.process('</think>');
      result += filter.process('最終回答');
      expect(result).toBe('最終回答');
    });

    it('複数チャンクに分散した複数のタグを正しく処理する', () => {
      let result = '';
      result += filter.process('こんにちは<think>考え');
      result += filter.process('中</think>。<thi');
      result += filter.process('nk>別の思考</th');
      result += filter.process('ink>さようなら');
      expect(result).toBe('こんにちは。さようなら');
    });
  });

  describe('エッジケース', () => {
    it('不完全な開始タグはflush()で出力される', () => {
      let result = '';
      result += filter.process('テスト<thi');
      result += filter.flush();
      expect(result).toBe('テスト<thi');
    });

    it('<thinking>など類似タグはフィルタしない', () => {
      expect(filter.process('<thinking>別のタグ</thinking>')).toBe('<thinking>別のタグ</thinking>');
    });

    it('<thinkで始まるが>がない場合は出力する', () => {
      let result = '';
      result += filter.process('<think');
      result += filter.process('er>タグではない');
      result += filter.flush();
      expect(result).toBe('<thinker>タグではない');
    });

    it('<で始まるがthinkでない場合は出力する', () => {
      expect(filter.process('<div>content</div>')).toBe('<div>content</div>');
    });

    it('タグ内で<が出現しても正しく処理する', () => {
      expect(filter.process('<think>考え<中>です</think>回答')).toBe('回答');
    });

    it('reset()で状態が初期化される', () => {
      filter.process('<think>途中');
      filter.reset();
      expect(filter.process('新しいテキスト')).toBe('新しいテキスト');
    });

    it('flush()後も正常に動作する', () => {
      filter.process('<thi');
      filter.flush();
      expect(filter.process('新しいテキスト')).toBe('新しいテキスト');
    });

    it('タグ内でストリームが終了した場合は破棄', () => {
      let result = '';
      result += filter.process('前<think>思考中');
      result += filter.flush();
      expect(result).toBe('前');
    });

    it('終了タグ途中でストリームが終了した場合は破棄', () => {
      let result = '';
      result += filter.process('<think>思考</thi');
      result += filter.flush();
      expect(result).toBe('');
    });
  });

  describe('実際のQwen3出力パターン', () => {
    it('改行を含む<think>タグを処理する', () => {
      const input = `<think>
Okay, I need to summarize this webpage about Codex by OpenAI. Let me read through the content carefully.

The page title is "Codex | OpenAI の AI コーディングパートナー | OpenAI".
</think>

1. **概要**: OpenAIのCodexは、AIを活用したコード作成・管理ツールです。`;
      expect(filter.process(input)).toBe(
        `

1. **概要**: OpenAIのCodexは、AIを活用したコード作成・管理ツールです。`,
      );
    });

    it('複数行の思考をストリーミングでフィルタする', () => {
      let result = '';
      result += filter.process('<think>\nOkay, ');
      result += filter.process("let me think about this.\n\nThe user's question is");
      result += filter.process(' about...\n</think>\n');
      result += filter.process('Here is my answer.');
      expect(result).toBe('\nHere is my answer.');
    });
  });
});
