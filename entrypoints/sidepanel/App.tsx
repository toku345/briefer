import { classifyError } from '@/lib/error-classifier';
import { getPlaceholder } from '@/lib/get-placeholder';
import { ChatContainer } from './components/ChatContainer';
import { Header } from './components/Header';
import { InputContainer } from './components/InputContainer';
import { PageContextBar } from './components/PageContextBar';
import { useChatHistory } from './hooks/useChatHistory';
import { useChatStream } from './hooks/useChatStream';
import { useCurrentTab } from './hooks/useCurrentTab';
import { usePageContent } from './hooks/usePageContent';
import { usePendingText } from './hooks/usePendingText';
import { useServerHealth } from './hooks/useServerHealth';

export function App() {
  const { status: serverStatus } = useServerHealth();
  const { tabId, title: tabTitle, url: tabUrl, error: tabError } = useCurrentTab();
  const { data: rawPageContent, error: contentError } = usePageContent(tabId);
  const pageContent = rawPageContent ?? null;
  const { pendingText, consume } = usePendingText(tabId);
  const { data: chatState } = useChatHistory(tabId);
  const {
    sendMessage,
    retry,
    cancel,
    clearChat,
    streamingContent,
    isStreaming,
    error: streamError,
    clearError,
  } = useChatStream(tabId, pageContent);

  const messages = chatState?.messages ?? [];
  const error = classifyError(tabError, contentError ?? null, streamError);
  const isReady = !!tabId && !!pageContent && serverStatus === 'connected';
  const placeholder = getPlaceholder(tabId, pageContent, error);

  const handleSend = (content: string) => {
    if (!isReady || isStreaming) return;
    sendMessage(content);
  };

  const handleRetry = () => {
    retry();
  };

  const handleDismissError = () => {
    clearError();
  };

  return (
    <div className="container">
      <Header onClearChat={clearChat} hasMessages={messages.length > 0} />
      <PageContextBar title={tabTitle} url={tabUrl} />
      <ChatContainer
        messages={messages}
        streamingContent={streamingContent}
        isStreaming={isStreaming}
        error={error}
        onAction={handleSend}
        actionDisabled={!isReady || isStreaming}
        // Retry gated by classified error's retryable flag; dismiss only for stream-origin errors
        onRetry={error?.retryable ? handleRetry : undefined}
        onDismiss={streamError ? handleDismissError : undefined}
      />
      <InputContainer
        onSend={handleSend}
        onCancel={cancel}
        isStreaming={isStreaming}
        disabled={!isReady || isStreaming || !!error}
        placeholder={placeholder}
        pendingText={pendingText}
        onPendingTextConsumed={consume}
      />
    </div>
  );
}
