import { memo, useEffect, useRef, type FormEvent } from 'react';
import { Bot, LoaderCircle, Send, Trash2, X } from 'lucide-react';
import { AssistantMessageContent } from './assistant/AssistantMessageContent';
import { useAssistantChat } from './assistant/useAssistantChat';
type AssistantPanelProps = {
    workflowId: number | null;
    onClose?: () => void;
};
function AssistantPanelComponent({ workflowId, onClose }: AssistantPanelProps) {
    const chat = useAssistantChat(workflowId);
    const messageListRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        const list = messageListRef.current;
        if (!list)
            return;
        list.scrollTo({ top: list.scrollHeight, behavior: chat.loadingHistory ? 'auto' : 'smooth' });
    }, [chat.busy, chat.loadingHistory, chat.messages]);
    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        void chat.send();
    };
    return (<section className="assistant-panel" aria-label="دستیار هوشمند IOTA">
      <header className="assistant-panel-header">
        <div className="assistant-panel-title">
          <Bot size={18}/>
          <div>
            <strong>دستیار هوشمند</strong>
            <span>{workflowId ? `Workflow #${workflowId}` : 'بدون جریان ذخیره‌شده'}</span>
          </div>
        </div>
        <div className="assistant-panel-actions">
          <button type="button" className="icon-button icon-only" disabled={!workflowId || chat.messages.length === 0 || chat.busy || chat.loadingHistory || chat.clearingHistory} onClick={() => { void chat.clear(); }} title="پاک کردن گفتگو" aria-label="پاک کردن گفتگو">
            {chat.clearingHistory ? <LoaderCircle size={16} className="spin"/> : <Trash2 size={16}/>}
          </button>
          {onClose && (<button type="button" className="icon-button icon-only" onClick={onClose} title="بستن دستیار" aria-label="بستن دستیار">
              <X size={17}/>
            </button>)}
        </div>
      </header>

      <div className="assistant-message-list" ref={messageListRef}>
        {chat.loadingHistory && <div className="assistant-loading"><LoaderCircle size={17} className="spin"/><span>در حال بارگذاری گفتگو...</span></div>}
        {!chat.loadingHistory && chat.messages.length === 0 && (<div className="assistant-empty-state">
            <Bot size={30}/>
            <strong>چطور می‌توانم کمک کنم؟</strong>
            <span>{workflowId ? 'درباره نودها، تنظیمات یا جریان فعلی سؤال کنید.' : 'ابتدا یک جریان ذخیره‌شده باز کنید.'}</span>
          </div>)}
        {chat.messages.map((message) => (<article key={message.id} className={`assistant-message ${message.role}`}>
            <span>{message.role === 'user' ? 'شما' : 'IOTA AI'}</span>
            {message.role === 'assistant'
                ? <AssistantMessageContent content={message.content}/>
                : <p className="assistant-user-message">{message.content}</p>}
          </article>))}
        {chat.busy && <div className="assistant-loading"><LoaderCircle size={17} className="spin"/><span>در حال بررسی...</span></div>}
      </div>

      {chat.error && <div className="assistant-error" role="alert">{chat.error}</div>}
      <form className="assistant-input-wrap" onSubmit={submit}>
        <textarea value={chat.draft} disabled={!workflowId || chat.busy || chat.loadingHistory || chat.clearingHistory} rows={3} placeholder={workflowId ? 'پیام خود را بنویسید...' : 'ابتدا یک جریان ذخیره‌شده باز کنید...'} aria-label="پیام دستیار هوشمند" onChange={(event) => chat.setDraft(event.target.value)} onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
            }
        }}/>
        <button type="submit" className="assistant-send-button" disabled={!chat.canSend} title="ارسال" aria-label="ارسال">
          {chat.busy ? <LoaderCircle size={18} className="spin"/> : <Send size={18}/>}
        </button>
      </form>
    </section>);
}
export const AssistantPanel = memo(AssistantPanelComponent);
