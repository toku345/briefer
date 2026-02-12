import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActiveStream, ChatState, GetStreamStateResponse, StreamChunk } from '@/lib/types';

function isDuplicateSeq(seq: number | undefined, lastSeq: number): boolean {
  if (seq == null) return false;
  return seq <= lastSeq;
}

export function useStreamListener(tabId: number | null, onStreamEnd?: () => void) {
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeStream, setActiveStreamState] = useState<ActiveStream | null>(null);

  const queryClient = useQueryClient();
  const contentRef = useRef('');
  const onStreamEndRef = useRef(onStreamEnd);
  const activeStreamRef = useRef<ActiveStream | null>(null);
  const lastSeqRef = useRef(0);

  useEffect(() => {
    onStreamEndRef.current = onStreamEnd;
  }, [onStreamEnd]);

  useEffect(() => {
    activeStreamRef.current = activeStream;
  }, [activeStream]);

  useEffect(() => {
    contentRef.current = streamingContent;
  }, [streamingContent]);

  const setActiveStream = useCallback((stream: ActiveStream | null) => {
    setActiveStreamState(stream);
    activeStreamRef.current = stream;
    lastSeqRef.current = 0;
  }, []);

  useEffect(() => {
    if (!tabId) return;

    chrome.runtime
      .sendMessage({ type: 'GET_STREAM_STATE', tabId })
      .then((raw) => {
        const response = raw as GetStreamStateResponse;
        if (!response.success || !response.data) {
          return;
        }

        if (response.data.status !== 'streaming') {
          return;
        }

        const resumed = {
          requestId: response.data.requestId,
          sessionId: response.data.sessionId,
        };

        setActiveStreamState(resumed);
        activeStreamRef.current = resumed;
        lastSeqRef.current = response.data.lastAckSeq;
        setIsStreaming(true);

        chrome.runtime.sendMessage({
          type: 'RESUME_STREAM',
          tabId,
          requestId: resumed.requestId,
          sessionId: resumed.sessionId,
          lastSeq: lastSeqRef.current,
        });
      })
      .catch((resumeError) => {
        console.error('[Briefer] Failed to restore stream state:', resumeError);
        setIsStreaming(false);
      });
  }, [tabId]);

  useEffect(() => {
    const listener = (message: { type: string; tabId: number; payload: StreamChunk }) => {
      if (message.type !== 'STREAM_CHUNK' || message.tabId !== tabId) {
        return;
      }

      const chunk = message.payload;
      const currentStream = activeStreamRef.current;

      if (currentStream && chunk.requestId && chunk.sessionId) {
        const isCurrent =
          chunk.requestId === currentStream.requestId &&
          chunk.sessionId === currentStream.sessionId;
        if (!isCurrent) {
          return;
        }
      } else if (!currentStream && chunk.requestId && chunk.sessionId) {
        setActiveStream({ requestId: chunk.requestId, sessionId: chunk.sessionId });
      }

      if (isDuplicateSeq(chunk.seq, lastSeqRef.current)) {
        return;
      }

      if (chunk.seq != null) {
        lastSeqRef.current = chunk.seq;
      }

      if (chunk.type === 'chunk' && chunk.content) {
        setStreamingContent((prev) => prev + chunk.content);
      } else if (chunk.type === 'done') {
        const finalContent = contentRef.current;
        if (finalContent) {
          queryClient.setQueryData<ChatState>(['chat', tabId], (old) => {
            const existing = old?.messages.some(
              (msg) =>
                msg.role === 'assistant' && msg.requestId && msg.requestId === chunk.requestId,
            );
            if (existing) {
              return old ?? { messages: [], pageContent: null };
            }

            return {
              messages: [
                ...(old?.messages ?? []),
                {
                  role: 'assistant',
                  content: finalContent,
                  modelId: chunk.modelId,
                  createdAt: Date.now(),
                  requestId: chunk.requestId,
                  sessionId: chunk.sessionId,
                },
              ],
              pageContent: old?.pageContent ?? null,
            };
          });
        }

        setStreamingContent('');
        setIsStreaming(false);
        setActiveStreamState(null);
        activeStreamRef.current = null;
        lastSeqRef.current = 0;
        onStreamEndRef.current?.();
      } else if (chunk.type === 'error') {
        setError(chunk.error || 'エラーが発生しました');

        setStreamingContent('');
        setIsStreaming(false);
        setActiveStreamState(null);
        activeStreamRef.current = null;
        lastSeqRef.current = 0;
        onStreamEndRef.current?.();
      }

      if (tabId != null && chunk.seq != null && chunk.requestId && chunk.sessionId) {
        chrome.runtime.sendMessage({
          type: 'STREAM_ACK',
          tabId,
          requestId: chunk.requestId,
          sessionId: chunk.sessionId,
          lastSeq: chunk.seq,
        });
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [tabId, queryClient, setActiveStream]);

  const clearError = useCallback(() => setError(null), []);

  return {
    streamingContent,
    isStreaming,
    setIsStreaming,
    activeStream,
    setActiveStream,
    error,
    clearError,
  };
}
