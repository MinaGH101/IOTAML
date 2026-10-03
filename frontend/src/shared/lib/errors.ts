import { userFriendlyErrorMessage } from './errorMessages';

export type UiMessage = { text: string; tone: 'success' | 'error' | 'info' } | null;

export function messageFromError(error: unknown, fallback: string): UiMessage {
  return { text: userFriendlyErrorMessage(error, fallback), tone: 'error' };
}

export { userFriendlyErrorMessage } from './errorMessages';
