export type ChatMessage = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
};
export function createMessageId(prefix = 'assistant') {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
