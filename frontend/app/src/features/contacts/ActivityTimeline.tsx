import { useMemo, type ReactNode } from 'react';
import { format, formatDistanceToNowStrict, isToday, isYesterday } from 'date-fns';
import { Avatar, Text, Tooltip } from '@crm/ui';
import styles from './ActivityTimeline.module.css';

export interface ActivityEntry {
  id: string;
  actor: string;
  /** One readable line, e.g. "changed email from a@x.com to b@x.com". */
  text: ReactNode;
  /** Extra lines, e.g. one per field when several fields changed at once. */
  details?: ReactNode[];
  at: string;
}

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || '?';

const dayLabel = (d: Date) =>
  isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'MMM d, yyyy');

/** One activity: the actor's avatar, "<actor> <text>", and "2 min ago" with the exact time on hover. */
function ActivityItem({ entry }: { entry: ActivityEntry }) {
  const at = new Date(entry.at);
  return (
    <li
      style={{
        display: 'flex',
        gap: 'var(--hl-space-3)',
        alignItems: 'flex-start',
        padding: 'var(--hl-space-2) 0',
      }}
    >
      <Avatar size="sm" label={initialsOf(entry.actor)} />
      <div style={{ minWidth: 0, flex: 1, overflowWrap: 'anywhere' }}>
        <Text tag="p" size="sm">
          <Text size="sm" fontFamily="bold">
            {entry.actor}
          </Text>{' '}
          {entry.text}
        </Text>
        {entry.details && entry.details.length > 0 && (
          <ul style={{ margin: '2px 0 0', paddingLeft: 'var(--hl-space-4)' }}>
            {entry.details.map((line, i) => (
              <li key={i}>
                <Text size="sm">{line}</Text>
              </li>
            ))}
          </ul>
        )}
        <Tooltip text={at.toLocaleString()}>
          <span>
            <Text size="sm" color="var(--hl-muted-foreground)">
              {formatDistanceToNowStrict(at, { addSuffix: true })}
            </Text>
          </span>
        </Tooltip>
      </div>
    </li>
  );
}

/** Activity grouped by day ("Today", "Yesterday", "Nov 12, 2026"), newest first. */
export function ActivityTimeline({
  entries,
  footer,
}: {
  entries: ActivityEntry[];
  footer?: ReactNode;
}) {
  const groups = useMemo(() => {
    const out: { label: string; entries: ActivityEntry[] }[] = [];
    for (const entry of entries) {
      const label = dayLabel(new Date(entry.at));
      const last = out[out.length - 1];
      if (last && last.label === label) last.entries.push(entry);
      else out.push({ label, entries: [entry] });
    }
    return out;
  }, [entries]);

  if (entries.length === 0) {
    return (
      <Text tag="p" size="sm" color="var(--hl-muted-foreground)">
        No activity yet
      </Text>
    );
  }

  return (
    <div
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrollable region must be focusable so keyboard users can scroll it
      tabIndex={0}
      role="region"
      aria-label="Activity history"
      className={styles.scroll}
    >
      {groups.map((group) => (
        <section key={group.label} style={{ marginBottom: 'var(--hl-space-3)' }}>
          <Text
            tag="p"
            size="sm"
            fontFamily="interactive"
            color="var(--hl-muted-foreground)"
            style={{ margin: 'var(--hl-space-2) 0' }}
          >
            {group.label}
          </Text>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {group.entries.map((entry) => (
              <ActivityItem key={entry.id} entry={entry} />
            ))}
          </ul>
        </section>
      ))}
      {footer}
    </div>
  );
}
