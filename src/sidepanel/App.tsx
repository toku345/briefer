import { ChatContainer } from './components/ChatContainer';
import { Header } from './components/Header';
import { InputContainer } from './components/InputContainer';
import { useChatHistory } from './hooks/useChatHistory';
import { useCurrentTab } from './hooks/useCurrentTab';
import { usePageContent } from './hooks/usePageContent';
import { useSendMessage } from './hooks/useSendMessage';
import { useStreamListener } from './hooks/useStreamListener';

export function App() {
  const { tabId, error: tabError } = useCurrentTab();
  const { data: pageContent, error: contentError } = usePageContent(tabId);
  const { data: chatState } = useChatHistory(tabId);
  const {
    streamingContent,
    isStreaming,
    setIsStreaming,
    error: streamError,
    clearError,
  } = useStreamListener(tabId);
  const { mutate: sendMessage, isPending } = useSendMessage(
    tabId,
    pageContent ?? null,
    setIsStreaming,
  );

  const messages = chatState?.messages ?? [];
  const error = tabError ?? contentError?.message ?? streamError;
  const isReady = !!tabId && !!pageContent;
  const isSending = isStreaming || isPending;

  const handleSend = (content: string) => {
    if (!isReady || isSending) return;
    clearError();
    sendMessage(content);
  };

  return (
    <div className="container">
      <Header />
      <ChatContainer
        messages={messages}
        streamingContent={streamingContent}
        isStreaming={isStreaming}
        error={error}
      />
      <InputContainer
        onSend={handleSend}
        disabled={!isReady || isSending}
        defaultValue={messages.length === 0 ? 'このページを要約して' : ''}
      />
    </div>
  );
}
