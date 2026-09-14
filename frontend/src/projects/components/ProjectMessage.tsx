import type { UiMessage } from '../../shared/lib/errors';

export function ProjectMessage({ message }: { message: UiMessage }) {
  return message ? <div className={`manager-toast ${message.tone}`}>{message.text}</div> : null;
}
