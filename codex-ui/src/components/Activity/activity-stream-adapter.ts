import type {ActivityEvent as SourceEvent} from './activity-events';
import type {ActivityEvent, ActivityKind, ActivityStatus} from './activity-types.ts';

const KIND: Record<string, ActivityKind> = {
  command: 'shell',
  edit: 'edit',
  read: 'read',
  search: 'search',
  plan: 'note',
  error: 'note',
  approval: 'approval',
};

function string(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function detailText(event: SourceEvent): string | undefined {
  const detail = event.detail;
  if (!detail) return undefined;
  if (detail.kind === 'command') {
    const command = string(detail.command);
    const output = string(detail.output);
    return [`$ ${command}`, output].filter(Boolean).join('\n');
  }
  if (detail.kind === 'diff') {
    const lines = Array.isArray(detail.diff) ? detail.diff : [];
    return lines.map(item => {
      const line = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      const prefix = line.kind === 'add' ? '+' : line.kind === 'del' ? '-' : ' ';
      return prefix + string(line.text);
    }).join('\n');
  }
  return string(detail.message) || undefined;
}

function titleFor(event: SourceEvent): string {
  if (event.type === 'command') return string(event.detail?.command) || event.title;
  if (event.path) return event.path;
  return event.title;
}

export function toStreamActivity(event: SourceEvent): ActivityEvent {
  const status: ActivityStatus = event.status === 'success'
    ? 'completed'
    : event.status === 'running'
      ? 'running'
      : event.status === 'error'
        ? 'failed'
        : event.status === 'idle'
          ? 'cancelled'
          : 'running';
  return {
    id: event.id,
    kind: KIND[event.type] || (event.type === 'approval' ? 'approval' : 'note'),
    title: titleFor(event),
    detail: detailText(event),
    status,
    startedAt: event.startedAt,
    endedAt: event.endedAt,
  };
}
