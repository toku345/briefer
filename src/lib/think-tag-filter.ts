/**
 * Qwen3モデルの<think>タグをストリーミング対応でフィルタリングする
 * 状態を保持しながら、チャンク単位でフィルタ処理を行う
 */
export class ThinkTagFilter {
  private state: 'normal' | 'maybe-opening' | 'inside-think' | 'maybe-closing' = 'normal';
  private buffer = '';

  private static readonly OPENING_TAG = '<think>';
  private static readonly CLOSING_TAG = '</think>';

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
    switch (this.state) {
      case 'normal':
        return this.handleNormal(char);
      case 'maybe-opening':
        return this.handleMaybeOpening(char);
      case 'inside-think':
        return this.handleInsideThink(char);
      case 'maybe-closing':
        return this.handleMaybeClosing(char);
    }
  }

  private handleNormal(char: string): string {
    if (char === '<') {
      this.state = 'maybe-opening';
      this.buffer = char;
      return '';
    }
    return char;
  }

  private handleMaybeOpening(char: string): string {
    this.buffer += char;

    if (this.buffer === ThinkTagFilter.OPENING_TAG) {
      this.state = 'inside-think';
      this.buffer = '';
      return '';
    }

    if (ThinkTagFilter.OPENING_TAG.startsWith(this.buffer)) {
      return '';
    }

    // <think>のプレフィックスでない場合、バッファを出力してnormalに戻る
    const output = this.buffer;
    this.buffer = '';
    this.state = 'normal';
    return output;
  }

  private handleInsideThink(char: string): string {
    if (char === '<') {
      this.state = 'maybe-closing';
      this.buffer = char;
    }
    // <think>内のコンテンツは破棄
    return '';
  }

  private handleMaybeClosing(char: string): string {
    this.buffer += char;

    if (this.buffer === ThinkTagFilter.CLOSING_TAG) {
      this.state = 'normal';
      this.buffer = '';
      return '';
    }

    if (ThinkTagFilter.CLOSING_TAG.startsWith(this.buffer)) {
      return '';
    }

    // </think>のプレフィックスでない場合、inside-thinkに戻る（バッファは破棄）
    this.buffer = '';
    this.state = 'inside-think';
    return '';
  }

  /**
   * ストリーム終了時に呼び出し、保留中のバッファをフラッシュ
   * @returns 最終出力テキスト
   */
  flush(): string {
    // normalまたはmaybe-openingの場合、バッファを出力
    if (this.state === 'normal' || this.state === 'maybe-opening') {
      const output = this.buffer;
      this.reset();
      return output;
    }

    // inside-thinkまたはmaybe-closingの場合、バッファは破棄
    this.reset();
    return '';
  }

  /**
   * 状態をリセット（新しいストリーム開始時）
   */
  reset(): void {
    this.state = 'normal';
    this.buffer = '';
  }
}
