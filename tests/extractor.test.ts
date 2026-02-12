import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { extractMainContent } from '../lib/extractor';

describe('extractMainContent', () => {
  it('article要素からコンテンツを抽出する', () => {
    const dom = new JSDOM(`
      <html>
        <head><title>Test Page</title></head>
        <body>
          <nav>Navigation</nav>
          <article>Main article content here.</article>
          <footer>Footer</footer>
        </body>
      </html>
    `);

    const result = extractMainContent(dom.window.document);

    expect(result.title).toBe('Test Page');
    expect(result.content).toBe('Main article content here.');
  });

  it('main要素にフォールバックする', () => {
    const dom = new JSDOM(`
      <html>
        <head><title>Test</title></head>
        <body>
          <main>Main content area.</main>
        </body>
      </html>
    `);

    const result = extractMainContent(dom.window.document);
    expect(result.content).toBe('Main content area.');
  });

  it('role="main"属性から抽出する', () => {
    const dom = new JSDOM(`
      <html>
        <head><title>Test</title></head>
        <body>
          <div role="main">Role main content.</div>
        </body>
      </html>
    `);

    const result = extractMainContent(dom.window.document);
    expect(result.content).toBe('Role main content.');
  });

  it('一般的なコンテンツクラスから抽出する', () => {
    const dom = new JSDOM(`
      <html>
        <head><title>Test</title></head>
        <body>
          <div class="post-content">Post content here.</div>
        </body>
      </html>
    `);

    const result = extractMainContent(dom.window.document);
    expect(result.content).toBe('Post content here.');
  });

  it('フォールバックでbodyから抽出（不要要素除去）', () => {
    const dom = new JSDOM(`
      <html>
        <head><title>Test</title></head>
        <body>
          <nav>Navigation</nav>
          <div>Body content here.</div>
          <script>console.log('script');</script>
          <footer>Footer</footer>
        </body>
      </html>
    `);

    const result = extractMainContent(dom.window.document);
    expect(result.content).toBe('Body content here.');
  });

  it('長いテキストは10000文字で切り捨てる', () => {
    const longText = 'a'.repeat(15000);
    const dom = new JSDOM(`
      <html>
        <head><title>Test</title></head>
        <body><article>${longText}</article></body>
      </html>
    `);

    const result = extractMainContent(dom.window.document);
    expect(result.content.length).toBe(10000);
  });

  it('連続する空白を単一スペースに変換する', () => {
    const dom = new JSDOM(`
      <html>
        <head><title>Test</title></head>
        <body>
          <article>
            Multiple   spaces   and
            newlines   here.
          </article>
        </body>
      </html>
    `);

    const result = extractMainContent(dom.window.document);
    expect(result.content).toBe('Multiple spaces and newlines here.');
  });
});
