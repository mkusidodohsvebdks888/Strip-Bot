import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../Icons';
import sidebar from './Sidebar.module.css';
import styles from './ChatHistoryList.module.css';

export type HistoryEntry = {
  id: string;
  title: string;
  description: string;
  updatedAt: number;
};

type GroupId = 'today' | 'yesterday' | 'week' | 'earlier';
type GroupFoldState = Record<GroupId, boolean>;
type FoldState = { list: boolean; groups: GroupFoldState };

const FOLD_KEY = 'strip_chat_history_folds_v1';
const GROUPS: ReadonlyArray<{ id: GroupId; title: string }> = [
  { id: 'today', title: '今天' },
  { id: 'yesterday', title: '昨天' },
  { id: 'week', title: '最近 7 天' },
  { id: 'earlier', title: '更早' },
];

function emptyGroupFolds(): GroupFoldState {
  return { today: false, yesterday: false, week: false, earlier: false };
}

function readFolds(): FoldState {
  const defaults = { list: false, groups: emptyGroupFolds() };
  try {
    const raw = window.localStorage.getItem(FOLD_KEY);
    if (!raw) return defaults;
    const saved: unknown = JSON.parse(raw);
    if (!saved || typeof saved !== 'object') return defaults;
    const stored = saved as { list?: unknown; groups?: unknown };
    const groups: Partial<Record<GroupId, unknown>> = stored.groups && typeof stored.groups === 'object'
      ? stored.groups as Partial<Record<GroupId, unknown>>
      : {};
    return {
      list: stored.list === true,
      groups: {
        today: groups.today === true,
        yesterday: groups.yesterday === true,
        week: groups.week === true,
        earlier: groups.earlier === true,
      },
    };
  } catch {
    return defaults;
  }
}

function groupForTimestamp(timestamp: number, today: Date): GroupId {
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const yesterdayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1).getTime();
  const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6).getTime();
  const time = Number.isFinite(timestamp) && timestamp > 0 ? timestamp : 0;
  if (time >= todayStart) return 'today';
  if (time >= yesterdayStart) return 'yesterday';
  if (time >= weekStart) return 'week';
  return 'earlier';
}

export interface ChatHistoryListProps {
  entries: HistoryEntry[];
  activeId: string;
  query: string;
  busy: boolean;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}

export function ChatHistoryList({
  entries, activeId, query, busy, onSelect, onRemove,
}: ChatHistoryListProps) {
  const [folds, setFolds] = useState<FoldState>(readFolds);
  const [searchListFolded, setSearchListFolded] = useState(false);
  const [searchGroupFolds, setSearchGroupFolds] = useState<GroupFoldState>(emptyGroupFolds);
  const search = query.trim().toLocaleLowerCase();
  const searching = search.length > 0;
  const listFolded = searching ? searchListFolded : folds.list;

  useEffect(() => {
    try { window.localStorage.setItem(FOLD_KEY, JSON.stringify(folds)); }
    catch { /* Folding preferences must not block chatting. */ }
  }, [folds]);

  useEffect(() => {
    setSearchListFolded(false);
    setSearchGroupFolds(emptyGroupFolds());
  }, [search]);

  const grouped = useMemo(() => {
    const buckets: Record<GroupId, HistoryEntry[]> = {
      today: [], yesterday: [], week: [], earlier: [],
    };
    const now = new Date();
    for (const entry of entries) {
      if (search && !entry.title.toLocaleLowerCase().includes(search)
        && !entry.description.toLocaleLowerCase().includes(search)) continue;
      buckets[groupForTimestamp(entry.updatedAt, now)].push(entry);
    }
    return GROUPS.map(({ id, title }) => ({ id, title, items: buckets[id] }))
      .filter(group => group.items.length > 0);
  }, [entries, search]);

  const visibleCount = grouped.reduce((sum, group) => sum + group.items.length, 0);
  function toggleList() {
    if (searching) setSearchListFolded(value => !value);
    else setFolds(value => ({ ...value, list: !value.list }));
  }
  function toggleGroup(id: GroupId) {
    if (searching) setSearchGroupFolds(value => ({ ...value, [id]: !value[id] }));
    else setFolds(value => ({ ...value, groups: { ...value.groups, [id]: !value.groups[id] } }));
  }

  return (
    <>
      <button type="button" className={styles.heading} aria-expanded={!listFolded}
        aria-controls="strip-chat-history-groups" onClick={toggleList}
        title={listFolded ? '展开聊天记录' : '收起聊天记录'}>
        <span className={styles.headingTitle}>聊天记录</span>
        <span className={styles.count}>{searching ? visibleCount : entries.length}</span>
        <span className={styles.chevron} data-collapsed={listFolded} aria-hidden="true">
          <Icon name="chevron-down" />
        </span>
      </button>
      <div id="strip-chat-history-groups" className={styles.groups} hidden={listFolded}>
        {grouped.map(group => {
          const folded = searching ? searchGroupFolds[group.id] : folds.groups[group.id];
          const hasActive = group.items.some(entry => entry.id === activeId);
          return (
            <section className={styles.group} key={group.id} aria-label={group.title}>
              <button type="button" className={styles.groupHeading}
                aria-expanded={!folded} aria-controls={'strip-chat-group-' + group.id}
                onClick={() => toggleGroup(group.id)}>
                <span className={styles.chevron} data-collapsed={folded} aria-hidden="true">
                  <Icon name="chevron-down" />
                </span>
                <span>{group.title}</span>
                {hasActive && folded && <span className={styles.activeMarker} title="包含当前对话" />}
                <span className={styles.groupCount}>{group.items.length}</span>
              </button>
              <div id={'strip-chat-group-' + group.id} className={styles.items} hidden={folded}>
                {group.items.map(entry => (
                  <div className={'strip-task ' + styles.itemRow + (activeId === entry.id ? ' ' + sidebar.itemActive : '')}
                    key={entry.id}>
                    <button type="button" className={sidebar.item} disabled={busy}
                      aria-current={activeId === entry.id ? 'page' : undefined}
                      title={entry.title} onClick={() => onSelect(entry.id)}>
                      <span className={styles.itemText}>
                        <span className={sidebar.itemTitle}>{entry.title}</span>
                        <span className={sidebar.itemRepo}>{entry.description}</span>
                      </span>
                    </button>
                    <button type="button" className="strip-delete strip-btn strip-btn--ghost strip-btn--icon strip-btn--sm"
                      aria-label={'删除会话：' + entry.title} title="删除会话" disabled={busy}
                      onClick={() => onRemove(entry.id)}>
                      <Icon name="trash-bin-trash" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
        {visibleCount === 0 && (
          <p className={styles.empty}>{searching ? '没有找到匹配的聊天记录' : '还没有对话'}</p>
        )}
      </div>
    </>
  );
}
