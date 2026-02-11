import { ChatContainer } from './components/ChatContainer';
import { Header } from './components/Header';
import { InputContainer } from './components/InputContainer';
import { useChatHistory } from './hooks/useChatHistory';
import { useCurrentTab } from './hooks/useCurrentTab';
import { useKeepalive } from './hooks/useKeepalive';
import { usePageContent } from './hooks/usePageContent';
import { useSendMessage } from './hooks/useSendMessage';
import { useStreamListener } from './hooks/useStreamListener';

function classifyError(message: string): string {
  if (message.includes('このページでは使用できません')) {
    return 'このページは拡張機能がアクセスできません。通常のWebページでお試しください。';
  }
  if (
    message.includes('Failed to fetch') ||
    message.includes('Network') ||
    message.includes('API error')
  ) {
    return 'LLMサーバーへ接続できませんでした。サーバー起動状態とURLを確認してください。';
  }
  if (message.includes('model') || message.includes('Model') || message.includes('No models')) {
    return 'モデル設定に問題があります。モデル一覧を再取得して選び直してください。';
  }
  return message;
}

export function App() {
  const { tabId, error: tabError } = useCurrentTab();
  const { data: pageContent, error: contentError } = usePageContent(tabId);
  const { data: chatState } = useChatHistory(tabId);
  const { startKeepalive, stopKeepalive } = useKeepalive();
  const {
    streamingContent,
    isStreaming,
    setIsStreaming,
    setActiveStream,
    error: streamError,
    clearError,
  } = useStreamListener(tabId, stopKeepalive);
  const { mutate: sendMessage, isPending } = useSendMessage(
    tabId,
    pageContent ?? null,
    setIsStreaming,
    setActiveStream,
    startKeepalive,
    stopKeepalive,
  );

  const messages = chatState?.messages ?? [];
  const rawError = tabError ?? contentError?.message ?? streamError;
  const error = rawError ? classifyError(rawError) : null;
  const isReady = !!tabId && !!pageContent;
  const isSending = isStreaming || isPending;

  const handleSend = (content: string) => {
    if (!isReady || isSending) return;
    clearError();
    sendMessage(content);
  };

  const quickActions = [
    'このページを要約して',
    '重要なポイントを3つ教えて',
    '次に読むべき観点を提案して',
  ];

  return (
    <div className="container">
      <Header pageContent={pageContent ?? null} />
      <ChatContainer
        messages={messages}
        streamingContent={streamingContent}
        isStreaming={isStreaming}
        error={error}
        quickActions={quickActions}
        onQuickAction={handleSend}
      />
      <InputContainer
        onSend={handleSend}
        disabled={!isReady || isSending}
        defaultValue={messages.length === 0 ? 'このページを要約して' : ''}
      />
    </div>
  );
}
