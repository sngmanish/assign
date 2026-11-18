import type { ActivityEntry } from './ActivityTimeline';
import type { Activity, ContactFieldName } from '../../api/types';
import { FIELD_LABEL } from './contactFields';

type Change = { old: unknown; new: unknown };

const label = (field: string) => (FIELD_LABEL[field as ContactFieldName] ?? field).toLowerCase();
const show = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v));

/** "changed email from a@x.com to b@x.com", "set phone to …", "cleared company (was …)". */
function describeChange(field: string, { old, new: next }: Change): string {
  const before = show(old);
  const after = show(next);
  if (before === null) return `set ${label(field)} to ${after}`;
  if (after === null) return `cleared ${label(field)} (was ${before})`;
  return `changed ${label(field)} from ${before} to ${after}`;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** One activity event as a readable timeline entry. A missing actor reads "Anonymous". */
export function toActivityEntry(a: Activity): ActivityEntry {
  const base = { id: a.id, actor: a.actor || 'Anonymous', at: a.createdAt };
  const tagName = typeof a.details.tagName === 'string' ? a.details.tagName : 'a tag';

  switch (a.type) {
    case 'TAG_ADDED':
      return { ...base, text: `added tag ${tagName}` };
    case 'TAG_REMOVED':
      return { ...base, text: `removed tag ${tagName}` };
    case 'CONTACT_UPDATED': {
      const changes = Object.entries((a.details.changes ?? {}) as Record<string, Change>);
      if (changes.length === 1) {
        const [field, change] = changes[0]!;
        return { ...base, text: describeChange(field, change) };
      }
      return {
        ...base,
        text: `updated ${changes.map(([f]) => label(f)).join(', ')}`,
        details: changes.map(([f, c]) => capitalize(describeChange(f, c))),
      };
    }
    default:
      return { ...base, text: 'made a change' };
  }
}
