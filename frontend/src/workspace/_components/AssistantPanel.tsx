import { memo, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Bot, LoaderCircle, Send, Trash2, X } from 'lucide-react';

import { workspaceApi } from '../_service/workspaceApi';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type AssistantPanelProps = {
  workflowId: number | null;
  onClose?: () => void;
};

const MAX_CONTEXT_MESSAGES = 6;
const MAX_CONTEXT_MESSAGE_LENGTH = 1_200;

function createMessageId() {
  return `assistant-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function compactMessage(value: string) {
  const normalized = value.trim();
  if (normalized.length <= MAX_CONTEXT_MESSAGE_LENGTH) return normalized;
  return `${normalized.slice(0, MAX_CONTEXT_MESSAGE_LENGTH)}…`;
}

function buildRequestMessage(messages: ChatMessage[], currentMessage: string) {
  const recentConversation = messages
    .slice(-MAX_CONTEXT_MESSAGES)
    .map((message) => {
      const speaker = message.role === 'user' ? 'User' : 'Assistant';
      return `${speaker}: ${compactMessage(message.content)}`;
    })
    .join('\n\n');

  if (!recentConversation) return currentMessage;

  return [
    'Use the following recent conversation only as compact context.',
    recentConversation,
    '',
    'Current user request:',
    currentMessage,
  ].join('\n');
}

function AssistantPanelComponent({ workflowId, onClose }: AssistantPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const messageListRef = useRef<HTMLDivElement | null>(null);

  const canSend = useMemo(() => Boolean(draft.trim()) && !busy, [draft, busy]);

  useEffect(() => {
    const list = messageListRef.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
  }, [busy, messages]);

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const content = draft.trim();
    if (!content || busy) return;

    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: 'user',
      content,
    };

    const requestMessage = buildRequestMessage(messages, content);

    setMessages((current) => [...current, userMessage]);
    setDraft('');
    setError('');
    setBusy(true);

    try {
      const response = await workspaceApi.assistantChat({
        message: requestMessage,
        workflow_id: workflowId,
      });

      setMessages((current) => [
        ...current,
        {
          id: createMessageId(),
          role: 'assistant',
          content: response.message,
        },
      ]);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'ارسال درخواست به دستیار هوشمند ناموفق بود.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="assistant-panel" aria-label="دستیار هوشمند IOTA">
      <header className="assistant-panel-header">
        <div className="assistant-panel-title">
          <Bot size={18}/>
          <div>
            <strong>دستیار هوشمند</strong>
            <span>{workflowId ? `Workflow #${workflowId}` : 'بدون جریان ذخیره‌شده'}</span>
          </div>
        </div>

        <div className="assistant-panel-actions">
          <button
            type="button"
            className="icon-button icon-only"
            disabled={messages.length === 0 || busy}
            onClick={() => {
              setMessages([]);
              setError('');
            }}
            title="پاک کردن گفتگو"
            aria-label="پاک کردن گفتگو"
          >
            <Trash2 size={16}/>
          </button>
          {onClose && (
            <button
              type="button"
              className="icon-button icon-only"
              onClick={onClose}
              title="بستن دستیار"
              aria-label="بستن دستیار"
            >
              <X size={17}/>
            </button>
          )}
        </div>
      </header>

      <div className="assistant-message-list" ref={messageListRef}>
        {messages.length === 0 && (
          <div className="assistant-empty-state">
            <Bot size={30}/>
            <strong>چطور می‌توانم کمک کنم؟</strong>
            <span>درباره نودها، تنظیمات یا جریان فعلی سؤال کنید.</span>
          </div>
        )}

        {messages.map((message) => (
          <article
            key={message.id}
            className={`assistant-message ${message.role}`}
          >
            <span>{message.role === 'user' ? 'شما' : 'IOTA AI'}</span>
            <p>{message.content}</p>
          </article>
        ))}

        {busy && (
          <div className="assistant-loading">
            <LoaderCircle size={17} className="spin"/>
            <span>در حال بررسی...</span>
          </div>
        )}
      </div>

      {error && <div className="assistant-error" role="alert">{error}</div>}

      <form className="assistant-input-wrap" onSubmit={sendMessage}>
        <textarea
          value={draft}
          disabled={busy}
          rows={3}
          placeholder="پیام خود را بنویسید..."
          aria-label="پیام دستیار هوشمند"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />

        <button
          type="submit"
          className="assistant-send-button"
          disabled={!canSend}
          title="ارسال"
          aria-label="ارسال"
        >
          {busy
            ? <LoaderCircle size={18} className="spin"/>
            : <Send size={18}/>}
        </button>
      </form>
    </section>
  );
}

export const AssistantPanel = memo(AssistantPanelComponent);
