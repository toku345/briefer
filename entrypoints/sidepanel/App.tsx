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

export function App() {
  const { tabId, title: tabTitle, url: tabUrl, error: tabError } = useCurrentTab();
  const { data: rawPageContent, error: contentError } = usePageContent(tabId);
  const pageContent = rawPageContent ?? null;
  const { data: chatState } = useChatHistory(tabId);
  const {
    sendMessage,
    cancel,
    streamingContent,
    isStreaming,
    error: streamError,
    clearError,
  } = useChatStream(tabId, pageContent);

  const messages = chatState?.messages ?? [];
  const error = classifyError(tabError, contentError ?? null, streamError);
  const isReady = !!tabId && !!pageContent;
  const placeholder = getPlaceholder(tabId, pageContent, error);

  const handleSend = (content: string) => {
    if (!isReady || isStreaming) return;
    clearError();
    sendMessage(content);
  };

  return (
    <div className="container">
      <Header />
      <PageContextBar title={tabTitle} url={tabUrl} />
      <ChatContainer
        messages={messages}
        streamingContent={streamingContent}
        isStreaming={isStreaming}
        error={error}
        onAction={handleSend}
        actionDisabled={!isReady || isStreaming}
      />
      <InputContainer
        onSend={handleSend}
        onCancel={cancel}
        isStreaming={isStreaming}
        disabled={!isReady || isStreaming}
        placeholder={placeholder}
      />
    </div>
  );
}
