import * as React from 'react';

import { formatDistanceToNowStrict } from 'date-fns';

import { Button, VARIANTS } from '../Button';
import { Modal } from '../Modal';
import { Text } from '../Text';

export interface ConflictRow {
  field: string;
  label: string;
  theirs: string;
  mine: string;
  changedByMe: boolean;
  /** Someone else changed this field since the form was loaded. */
  changedByThem?: boolean;
}

export interface ConflictDialogProps {
  visible: boolean;
  rows: ConflictRow[];
  /** The newest change to the contact, shown as "Last changed by Heer, 2 minutes ago". */
  lastChangedBy?: { actor: string; at: string } | null;
  /** Drop my edits and show the latest saved contact. */
  onReloadLatest: () => void;
  /** Load the latest version but keep my edits in the form, to review and save again. */
  onReapply: () => void;
  /** Re-save only my changed fields on top of the latest version. Offered only when given. */
  onMergeBoth?: () => void;
  onClose: () => void;
  busy?: boolean;
}

const cell: React.CSSProperties = {
  padding: 'var(--hl-space-2)',
  borderBottom: '1px solid var(--hl-border)',
  textAlign: 'left',
  verticalAlign: 'top',
  overflowWrap: 'anywhere',
};

const show = (v: string) => v || '—';

/** "Someone else saved this contact first": the latest saved values next to the user's edits. */
function ConflictDialog({
  visible,
  rows,
  lastChangedBy,
  onReloadLatest,
  onReapply,
  onMergeBoth,
  onClose,
  busy = false,
}: ConflictDialogProps) {
  return (
    <Modal isVisible={visible} closeModal={onClose} size="md">
      <Modal.Header title="This contact was changed by someone else" />
      <Modal.Body>
        <div>
          <Text tag="p" size="sm" color="var(--hl-muted-foreground)" style={{ margin: 0 }}>
            Someone saved this contact after you started editing. Your changes are not saved yet.
          </Text>
          {lastChangedBy && (
            <Text tag="p" size="sm" color="var(--hl-muted-foreground)">
              Last changed by {lastChangedBy.actor},{' '}
              {formatDistanceToNowStrict(new Date(lastChangedBy.at), { addSuffix: true })}
            </Text>
          )}
          <table
            style={{ width: '100%', borderCollapse: 'collapse', margin: 'var(--hl-space-3) 0' }}
          >
            <thead>
              <tr>
                <th style={cell}>
                  <Text size="sm" fontFamily="bold">
                    Field
                  </Text>
                </th>
                <th style={cell}>
                  <Text size="sm" fontFamily="bold">
                    Latest saved
                  </Text>
                </th>
                <th style={cell}>
                  <Text size="sm" fontFamily="bold">
                    Your edit
                  </Text>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.field}>
                  <td style={cell}>
                    <Text size="sm">{r.label}</Text>
                  </td>
                  <td
                    style={{
                      ...cell,
                      background: r.changedByThem ? 'var(--hl-warning-50, #fffaeb)' : undefined,
                    }}
                  >
                    <Text size="sm">{show(r.theirs)}</Text>
                    {r.changedByThem && (
                      <Text tag="div" size="sm" color="var(--hl-warning-700, #b54708)">
                        changed by someone else
                      </Text>
                    )}
                  </td>
                  <td style={cell}>
                    <Text size="sm" fontFamily={r.changedByMe ? 'bold' : 'regular'}>
                      {r.changedByMe ? show(r.mine) : 'unchanged'}
                    </Text>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {onMergeBoth && (
            <Text tag="p" size="sm">
              The fields you changed do not overlap with theirs, so both changes can be kept.
            </Text>
          )}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--hl-space-2)',
              justifyContent: 'flex-end',
              marginTop: 'var(--hl-space-4)',
            }}
          >
            <Button
              label="Reload latest"
              variant={VARIANTS.SECONDARY}
              onClick={onReloadLatest}
              disabled={busy}
            />
            <Button
              label="Reapply my changes"
              variant={onMergeBoth ? VARIANTS.SECONDARY : VARIANTS.PRIMARY}
              onClick={onReapply}
              disabled={busy}
            />
            {onMergeBoth && (
              <Button
                label="Merge both"
                variant={VARIANTS.PRIMARY}
                onClick={onMergeBoth}
                loading={busy}
                disabled={busy}
              />
            )}
          </div>
        </div>
      </Modal.Body>
    </Modal>
  );
}

export default ConflictDialog;
