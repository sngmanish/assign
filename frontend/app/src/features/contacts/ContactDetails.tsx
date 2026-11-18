import { Suspense, lazy } from 'react';
import { BUTTON_VARIANT, Button, ContactFieldList, HStack, Heading, Skeleton } from '@crm/ui';
import type { Contact } from '../../api/types';
import { CONTACT_FIELDS, toFormValues } from './contactFields';
import { useContactEditor } from './useContactEditor';

// The edit form (with the phone input and its number library) is a separate chunk, fetched on
// the first Edit. Hovering or focusing Edit starts the download early.
const loadEditor = () => import('./ContactEditor');
const ContactEditor = lazy(loadEditor);

/** The five fields: read-only until Edit, then a form with Save and Cancel; a stale save opens the ConflictDialog. */
export function ContactDetails({ contact }: { contact: Contact }) {
  // the editor's state lives here, so it survives the lazy form loading in
  const editor = useContactEditor(contact);

  return (
    <>
      <HStack justify="space-between" align="center" style={{ marginBottom: 'var(--hl-space-3)' }}>
        <Heading level={3} size="sm">
          Details
        </Heading>
        {!editor.editing && (
          <span onPointerEnter={loadEditor} onFocus={loadEditor}>
            <Button
              label="Edit"
              variant={BUTTON_VARIANT.SECONDARY}
              size="small"
              onClick={editor.startEdit}
            />
          </span>
        )}
      </HStack>

      {editor.editing ? (
        <Suspense fallback={<EditorSkeleton />}>
          <ContactEditor contact={contact} editor={editor} />
        </Suspense>
      ) : (
        <ContactFieldList fields={CONTACT_FIELDS} values={toFormValues(contact)} />
      )}
    </>
  );
}

function EditorSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading the edit form">
      <Skeleton
        count={CONTACT_FIELDS.length}
        height={40}
        style={{ display: 'block', marginTop: 16 }}
      />
    </div>
  );
}
