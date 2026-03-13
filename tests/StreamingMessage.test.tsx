/**
 * @vitest-environment jsdom
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StreamingMessage } from '../entrypoints/sidepanel/components/StreamingMessage';

describe('StreamingMessage', () => {
  it('デフォルトで .streaming クラスが付与される', () => {
    const { container } = render(<StreamingMessage content="test" />);
    const el = container.querySelector('.message.assistant');
    expect(el?.classList.contains('streaming')).toBe(true);
  });

  it('showCursor=true の場合 .streaming クラスが付与される', () => {
    const { container } = render(<StreamingMessage content="test" showCursor={true} />);
    const el = container.querySelector('.message.assistant');
    expect(el?.classList.contains('streaming')).toBe(true);
  });

  it('showCursor=false の場合 .streaming クラスが付与されない', () => {
    const { container } = render(<StreamingMessage content="test" showCursor={false} />);
    const el = container.querySelector('.message.assistant');
    expect(el?.classList.contains('streaming')).toBe(false);
  });

  it('content がレンダリングされる', () => {
    const { container } = render(<StreamingMessage content="hello world" />);
    expect(container.textContent).toContain('hello world');
  });
});
