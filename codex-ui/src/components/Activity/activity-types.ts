/** Minimal event model for the grouped Codex-style activity stream. */
export type ActivityKind = 'read' | 'shell' | 'edit' | 'search' | 'question' | 'approval' | 'note';
export type ActivityStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export type ActivityEvent = {
  id: string;
  kind: ActivityKind;
  /** One-line label, such as a command, path or search query. */
  title: string;
  /** Expandable details such as stdout or a diff. */
  detail?: string;
  status: ActivityStatus;
  /** Optional because legacy snapshots do not always include tool timestamps. */
  startedAt?: number;
  endedAt?: number;
};

export type ActivityGroup =
  | {type: 'single'; event: ActivityEvent}
  | {type: 'group'; id: string; events: ActivityEvent[]; status: ActivityStatus};

const GROUPABLE: ReadonlySet<ActivityKind> = new Set(['read', 'shell', 'edit', 'search']);

export function groupActivities(events: ActivityEvent[], minGroupSize = 2): ActivityGroup[] {
  const out: ActivityGroup[] = [];
  let buf: ActivityEvent[] = [];
  const flush = () => {
    if (!buf.length) return;
    if (buf.length < minGroupSize) buf.forEach(event => out.push({type: 'single', event}));
    else out.push({type: 'group', id: `g-${buf[0].id}`, events: buf, status: groupStatus(buf)});
    buf = [];
  };
  for (const event of events) {
    if (GROUPABLE.has(event.kind)) buf.push(event);
    else {
      flush();
      out.push({type: 'single', event});
    }
  }
  flush();
  return out;
}

export function groupStatus(events: ActivityEvent[]): ActivityStatus {
  if (events.some(event => event.status === 'running')) return 'running';
  if (events.some(event => event.status === 'failed')) return 'failed';
  if (events.every(event => event.status === 'cancelled')) return 'cancelled';
  return 'completed';
}

const KIND_VERB: Record<ActivityKind, [string, string]> = {
  read: ['读取文件', '已读取文件'],
  shell: ['运行命令', '运行了命令'],
  edit: ['编辑文件', '已编辑文件'],
  search: ['搜索', '已搜索'],
  question: ['提问', '已提问'],
  approval: ['等待审批', '已审批'],
  note: ['', ''],
};

/** "已读取文件、运行了 5 条命令" / "正在运行命令（第 3 条）…" */
export function summarize(events: ActivityEvent[]): string {
  const running = events.find(event => event.status === 'running');
  if (running) {
    const sameKind = events.filter(event => event.kind === running.kind);
    const position = Math.max(1, sameKind.findIndex(event => event.id === running.id) + 1);
    const [verb] = KIND_VERB[running.kind];
    return `正在${verb}${sameKind.length > 1 ? `（第 ${position} 条）` : ''}…`;
  }
  const counts = new Map<ActivityKind, number>();
  for (const event of events) counts.set(event.kind, (counts.get(event.kind) ?? 0) + 1);
  const parts: string[] = [];
  for (const [kind, count] of counts) {
    const [, done] = KIND_VERB[kind];
    parts.push(kind === 'shell' && count > 1 ? `运行了 ${count} 条命令` : count > 1 ? `${done}（${count}）` : done);
  }
  return parts.filter(Boolean).join('、');
}

export function formatDuration(event: ActivityEvent): string {
  if (event.startedAt === undefined) return '';
  if (event.endedAt === undefined && event.status !== 'running') return '';
  const duration = (event.endedAt ?? Date.now()) - event.startedAt;
  if (!Number.isFinite(duration) || duration < 0) return '';
  if (duration < 1000) return '<1s';
  if (duration < 60_000) return `${Math.round(duration / 1000)}s`;
  return `${Math.floor(duration / 60_000)}m${Math.round((duration % 60_000) / 1000)}s`;
}
