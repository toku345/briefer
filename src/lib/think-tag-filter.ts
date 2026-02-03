/** ThinkTagFilterの内部状態 */
export type ThinkTagFilterState = 'normal' | 'maybe-opening' | 'inside-think' | 'maybe-closing';

/**
 * Qwen3モデルの<think>タグをストリーミング対応でフィルタリングする
 * 状態を保持しながら、チャンク単位でフィルタ処理を行う
 */
export class ThinkTagFilter {
  private _state: ThinkTagFilterState = 'normal';
  private _buffer = '';

  private static readonly OPENING_TAG = '<think>';
  private static readonly CLOSING_TAG = '</think>';

  /** 現在のフィルタ状態（デバッグ用） */
  get currentState(): ThinkTagFilterState {
    return this._state;
  }

  /** <think>タグ内にいるかどうか */
  get isInsideThinkTag(): boolean {
    return this._state === 'inside-think' || this._state === 'maybe-closing';
  }

  /**
   * チャンクを処理し、出力すべきテキストを返す
   * @param chunk 入力チャンク
   * @returns フィルタ後の出力テキスト（空文字列の場合は出力なし）
   */
  process(chunk: string): string {
    let output = '';

    for (const char of chunk) {
      output += this.processChar(char);
    }

    return output;
  }

  private processChar(char: string): string {
    switch (this._state) {
      case 'normal':
        return this.handleNormal(char);
      case 'maybe-opening':
        return this.handleMaybeOpening(char);
      case 'inside-think':
        return this.handleInsideThink(char);
      case 'maybe-closing':
        return this.handleMaybeClosing(char);
      default: {
        const _exhaustive: never = this._state;
        throw new Error(`Unknown state: ${_exhaustive}`);
      }
    }
  }

  private handleNormal(char: string): string {
    if (char === '<') {
      this._state = 'maybe-opening';
      this._buffer = char;
      return '';
    }
    return char;
  }

  private handleMaybeOpening(char: string): string {
    this._buffer += char;

    if (this._buffer === ThinkTagFilter.OPENING_TAG) {
      this._state = 'inside-think';
      this._buffer = '';
      return '';
    }

    if (ThinkTagFilter.OPENING_TAG.startsWith(this._buffer)) {
      return '';
    }

    // <think>のプレフィックスでない場合、バッファを出力してnormalに戻る
    const output = this._buffer;
    this._buffer = '';
    this._state = 'normal';
    return output;
  }

  private handleInsideThink(char: string): string {
    if (char === '<') {
      this._state = 'maybe-closing';
      this._buffer = char;
    }
    // <think>内のコンテンツは破棄
    return '';
  }

  private handleMaybeClosing(char: string): string {
    this._buffer += char;

    if (this._buffer === ThinkTagFilter.CLOSING_TAG) {
      this._state = 'normal';
      this._buffer = '';
      return '';
    }

    if (ThinkTagFilter.CLOSING_TAG.startsWith(this._buffer)) {
      return '';
    }

    // </think>のプレフィックスでない場合、inside-thinkに戻る（バッファは破棄）
    this._buffer = '';
    this._state = 'inside-think';
    return '';
  }

  /**
   * ストリーム終了時に呼び出し、保留中のバッファをフラッシュ
   * @returns 最終出力テキスト
   */
  flush(): string {
    // normalまたはmaybe-openingの場合、バッファを出力
    if (this._state === 'normal' || this._state === 'maybe-opening') {
      const output = this._buffer;
      this.reset();
      return output;
    }

    // inside-thinkまたはmaybe-closingの場合、バッファは破棄
    // LLMが不完全な応答を返した可能性があるため警告
    console.warn(
      `[ThinkTagFilter] Stream ended in incomplete state: ${this._state}. ` +
        'The LLM may have returned an incomplete response.',
    );
    this.reset();
    return '';
  }

  /**
   * 状態をリセット（新しいストリーム開始時）
   */
  reset(): void {
    this._state = 'normal';
    this._buffer = '';
  }
}
