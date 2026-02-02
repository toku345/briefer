import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatState, StreamChunk } from '@/lib/types';

export function useStreamListener(tabId: number | null) {
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const contentRef = useRef('');

  useEffect(() => {
    contentRef.current = streamingContent;
  }, [streamingContent]);

  useEffect(() => {
    const listener = (message: { type: string; tabId: number; payload: StreamChunk }) => {
      if (message.type !== 'STREAM_CHUNK' || message.tabId !== tabId) {
        return;
      }

      const chunk = message.payload;

      if (chunk.type === 'chunk' && chunk.content) {
        setStreamingContent((prev) => prev + chunk.content);
      } else if (chunk.type === 'done') {
        const finalContent = contentRef.current;
        if (finalContent) {
          queryClient.setQueryData<ChatState>(['chat', tabId], (old) => ({
            messages: [...(old?.messages ?? []), { role: 'assistant', content: finalContent }],
            pageContent: old?.pageContent ?? null,
          }));
        }
        setStreamingContent('');
        setIsStreaming(false);
      } else if (chunk.type === 'error') {
        setError(chunk.error || 'エラーが発生しました');
        setStreamingContent('');
        setIsStreaming(false);
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [tabId, queryClient]);

  const clearError = useCallback(() => setError(null), []);

  return {
    streamingContent,
    isStreaming,
    setIsStreaming,
    error,
    clearError,
  };
}
