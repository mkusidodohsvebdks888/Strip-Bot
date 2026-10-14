import type { Message as MessageModel } from '../../types';
import styles from './MessageThread.module.css';
import { CodeCard } from './CodeCard';
import { DiffCard } from './DiffCard';

export interface MessageProps {
  message: MessageModel;
  userName: string;
  userInitial: string;
  copiedId: string | null;
  onCopy: (id: string) => void;
}

export function Message({
  message,
  userName,
  userInitial,
  copiedId,
  onCopy,
}: MessageProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const name = isUser ? userName.trim().split(' ')[0] || 'U' : 'Codex';

  return (
    <div className={styles.row}>
      {isUser ? (
        <div className={styles.avatarUser} aria-hidden="true">
          {userInitial}
        </div>
      ) : (
        <div className={styles.avatarAssistant} aria-hidden="true">
          {'❯'}
        </div>
      )}

      <div className={styles.body}>
        <div className={styles.name}>
          {name}
          {isAssistant && message.model ? (
            <span className={styles.modelBadge}>{message.model}</span>
          ) : null}
        </div>

        <div className={styles.text}>
          {message.text}
          {message.streaming ? (
            <span className={styles.caret} aria-hidden="true" />
          ) : null}
        </div>

        {message.showCode && message.codeLines ? (
          <CodeCard
            fileName={message.fileName ?? ''}
            lang={message.lang ?? ''}
            codeLines={message.codeLines}
            copyLabel={copiedId === message.id ? 'Copied' : 'Copy'}
            onCopy={() => onCopy(message.id)}
          />
        ) : null}

        {message.showDiff && message.diffLines ? (
          <DiffCard
            diffFile={message.diffFile ?? ''}
            added={message.added ?? 0}
            removed={message.removed ?? 0}
            diffLines={message.diffLines}
          />
        ) : null}
      </div>
    </div>
  );
}
