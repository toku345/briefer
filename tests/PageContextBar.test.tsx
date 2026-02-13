/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageContextBar } from '../entrypoints/sidepanel/components/PageContextBar';

describe('PageContextBar', () => {
  it('title と hostname が表示される', () => {
    render(<PageContextBar title="Example Page" url="https://example.com/path" />);

    expect(screen.getByText('Example Page')).not.toBeNull();
    expect(screen.getByText('example.com')).not.toBeNull();
  });

  it('title が null の場合は「(無題)」が表示される', () => {
    render(<PageContextBar title={null} url="https://example.com" />);

    expect(screen.getByText('(無題)')).not.toBeNull();
    expect(screen.getByText('example.com')).not.toBeNull();
  });

  it('url が null の場合はホスト名が表示されない', () => {
    render(<PageContextBar title="Test" url={null} />);

    expect(screen.getByText('Test')).not.toBeNull();
    expect(screen.queryByText('example.com')).toBeNull();
  });

  it('title と url が両方 null の場合は何も表示されない', () => {
    const { container } = render(<PageContextBar title={null} url={null} />);

    expect(container.innerHTML).toBe('');
  });

  it('不正な URL の場合はホスト名が表示されない', () => {
    render(<PageContextBar title="Test" url="not-a-url" />);

    expect(screen.getByText('Test')).not.toBeNull();
    // ホスト名要素が存在しないことを確認
    const bar = screen.getByText('Test').parentElement;
    const urlSpan = bar?.querySelector('.page-context-url');
    expect(urlSpan).toBeNull();
  });

  it('title 属性にフルタイトルが設定される', () => {
    render(<PageContextBar title="Full Title Text" url="https://example.com" />);

    const bar = screen.getByText('Full Title Text').closest('.page-context-bar');
    expect(bar?.getAttribute('title')).toBe('Full Title Text');
  });
});
