import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { clearChat } from '@/lib/chat-store';
import { ChatContainer } from './components/ChatContainer';
import { ErrorMessage } from './components/ErrorMessage';
import { Header } from './components/Header';
import { InputContainer } from './components/InputContainer';
import { PageContextBar } from './components/PageContextBar';
import { useChatHistory } from './hooks/useChatHistory';
import { useCurrentTab } from './hooks/useCurrentTab';
import { useKeepalive } from './hooks/useKeepalive';
import { useModels } from './hooks/useModels';
import { usePageContent } from './hooks/usePageContent';
import { useSendMessage } from './hooks/useSendMessage';
import { useStreamListener } from './hooks/useStreamListener';

export function App() {
  const [selectedText, setSelectedText] = useState<string>();
  const { tabId, error: tabError } = useCurrentTab();
  const { data: pageContent, error: contentError } = usePageContent(tabId);
  const { data: chatState } = useChatHistory(tabId);
  const { isError: modelsError } = useModels();
  const { startKeepalive, stopKeepalive } = useKeepalive();
  const {
    streamingContent,
    isStreaming,
    setIsStreaming,
    error: streamError,
    clearError,
  } = useStreamListener(tabId, stopKeepalive);
  const { mutate: sendMessage, isPending } = useSendMessage(
    tabId,
    pageContent ?? null,
    setIsStreaming,
    startKeepalive,
    stopKeepalive,
  );
  const queryClient = useQueryClient();

  useEffect(() => {
    const listener = (message: { type: string; text?: string }) => {
      if (message.type === 'SELECTED_TEXT' && message.text) {
        setSelectedText(message.text);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const messages = chatState?.messages ?? [];
  const error = tabError ?? contentError?.message ?? streamError;
  const isReady = !!tabId && !!pageContent;
  const isSending = isStreaming || isPending;

  const handleSend = (content: string) => {
    if (!isReady || isSending) return;
    clearError();
    sendMessage(content);
  };

  const handleCancel = () => {
    if (!tabId) return;
    chrome.runtime.sendMessage({ type: 'CANCEL_CHAT', tabId });
    setIsStreaming(false);
    stopKeepalive();
  };

  const handleClearChat = async () => {
    if (!tabId) return;
    await clearChat(tabId);
    queryClient.invalidateQueries({ queryKey: ['chat', tabId] });
  };

  const getDisabledReason = (): 'loading' | 'sending' | 'server-error' | undefined => {
    if (!tabId || !pageContent) return 'loading';
    if (isSending) return 'sending';
    if (modelsError) return 'server-error';
    return undefined;
  };

  return (
    <div className="container">
      <Header onClearChat={handleClearChat} />
      <PageContextBar
        title={pageContent?.title}
        url={pageContent?.url}
        isLoading={!!tabId && !pageContent && !contentError}
      />
      {error && (
        <ErrorMessage
          error={error}
          onRetry={streamError ? () => clearError() : undefined}
          onDismiss={clearError}
        />
      )}
      <ChatContainer
        messages={messages}
        streamingContent={streamingContent}
        isStreaming={isStreaming}
        onSend={handleSend}
        sendDisabled={!isReady || isSending}
      />
      <InputContainer
        onSend={handleSend}
        disabledReason={getDisabledReason()}
        prefillText={selectedText}
        isStreaming={isStreaming}
        onCancel={handleCancel}
      />
    </div>
  );
}
