import { useNavigate } from 'react-router-dom';
import { ChatHeader } from '../components/ChatHeader/ChatHeader';
import { EmptyState } from '../components/EmptyState/EmptyState';
import { Composer } from '../components/Composer/Composer';
import { useComposer } from '../hooks/useComposer';
import { useTasks } from '../store/TasksContext';
import { suggestions } from '../data';
import styles from './Home.module.css';

/**
 * Home (`/`): the existing empty state + composer. Submitting (chip or Enter)
 * -> createTask(prompt) -> navigate('/tasks/' + id).
 */
export function Home() {
  const navigate = useNavigate();
  const { createTask } = useTasks();

  const submit = (prompt: string) => {
    const id = createTask(prompt);
    navigate(`/tasks/${id}`);
  };

  const composer = useComposer({ onSubmit: submit });

  return (
    <>
      <ChatHeader />
      <div className={styles.body}>
        <EmptyState suggestions={suggestions} onPick={submit} />
      </div>
      <Composer
        draft={composer.draft}
        focused={composer.focused}
        canSend={composer.canSend}
        model={composer.model}
        onDraftChange={composer.setDraft}
        onKeyDown={composer.onKeyDown}
        onFocus={() => composer.setFocused(true)}
        onBlur={() => composer.setFocused(false)}
        onSend={composer.send}
        onCycleModel={composer.cycleModel}
      />
    </>
  );
}
