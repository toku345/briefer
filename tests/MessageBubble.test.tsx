/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MessageBubble } from '../entrypoints/sidepanel/components/MessageBubble';
import type { ChatMessage } from '../lib/types';

describe('MessageBubble', () => {
  it('truncated: true のassistantメッセージに警告を表示する', () => {
    const message: ChatMessage = {
      role: 'assistant',
      content: 'partial output',
      truncated: true,
    };

    render(<MessageBubble message={message} />);

    expect(screen.getByText(/max_tokensの上限に達した/)).not.toBeNull();
  });

  it('truncated でないassistantメッセージに警告を表示しない', () => {
    const message: ChatMessage = {
      role: 'assistant',
      content: 'full output',
    };

    render(<MessageBubble message={message} />);

    expect(screen.queryByText(/max_tokensの上限に達した/)).toBeNull();
  });

  it('userメッセージにはtruncated警告を表示しない', () => {
    const message: ChatMessage = {
      role: 'user',
      content: 'hello',
    };

    render(<MessageBubble message={message} />);

    expect(screen.queryByText(/max_tokensの上限に達した/)).toBeNull();
  });
});
