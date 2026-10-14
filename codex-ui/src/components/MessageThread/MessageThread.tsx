import type { Message as MessageModel } from '../../types';
import styles from './MessageThread.module.css';
import { Message } from './Message';
import { TypingIndicator } from './TypingIndicator';

export interface MessageThreadProps {
  messages: MessageModel[];
  generating: boolean;
  thinkingLabel: string;
  userName: string;
  userInitial: string;
  copiedId: string | null;
  onCopy: (id: string) => void;
}

export function MessageThread({
  messages,
  generating,
  thinkingLabel,
  userName,
  userInitial,
  copiedId,
  onCopy,
}: MessageThreadProps) {
  return (
    <div className={styles.thread}>
      {messages.map((message) => (
        <Message
          key={message.id}
          message={message}
          userName={userName}
          userInitial={userInitial}
          copiedId={copiedId}
          onCopy={onCopy}
        />
      ))}
      {generating ? <TypingIndicator thinkingLabel={thinkingLabel} /> : null}
    </div>
  );
}
