import { useState } from 'react';
import { useUpdateContactMutation, contactsApi } from '../../api/contactsApi';
import { isApiError } from '../../api/errors';
import type { Contact } from '../../api/types';
import { useAppDispatch } from '../../store/hooks';
import { useToast } from '../../app/useToast';
import {
  type FieldErrors,
  type FormValues,
  fromServerErrors,
  toChanges,
  toFormValues,
  validate,
} from './contactFields';

/** A save refused with 409 VERSION_CONFLICT: what the form started from, and the latest contact. */
export interface Conflict {
  base: FormValues;
  mine: FormValues;
  latest: Contact;
}

/**
 * The detail page's edit mode: read-only until `startEdit`, then a form that sends only the
 * changed fields plus the version it was loaded with. Failures never drop the user's edits.
 */
export function useContactEditor(contact: Contact | undefined) {
  const dispatch = useAppDispatch();
  const toast = useToast();
  const [updateContact, { isLoading: saving }] = useUpdateContactMutation();

  const [editing, setEditing] = useState(false);
  // what the form loaded with: the base of the diff and of the three-way compare
  const [base, setBase] = useState<{ values: FormValues; version: number } | null>(null);
  const [values, setValues] = useState<FormValues | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [conflict, setConflict] = useState<Conflict | null>(null);
  // bumped to rebuild the inputs from `values` (the phone input keeps its own state)
  const [resetKey, setResetKey] = useState(0);

  const changes = base && values ? toChanges(base.values, values) : {};
  const hasChanges = Object.keys(changes).length > 0;

  function startEdit() {
    if (!contact) return;
    const loaded = toFormValues(contact);
    setBase({ values: loaded, version: contact.version });
    setValues(loaded);
    setErrors({});
    setResetKey((k) => k + 1);
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setBase(null);
    setValues(null);
    setErrors({});
  }

  function change(name: string, value: string) {
    setValues((v) => (v ? { ...v, [name]: value } : v));
    // the message goes away as soon as the field is edited; Save checks again
    setErrors((e) => (e[name as keyof FieldErrors] ? { ...e, [name]: undefined } : e));
  }

  /** Save `fieldChanges` on top of `version`. */
  async function send(
    fieldChanges: ReturnType<typeof toChanges>,
    from: { values: FormValues; version: number },
    current: FormValues,
  ) {
    if (!contact) return;
    try {
      await updateContact({
        id: contact.id,
        changes: fieldChanges,
        version: from.version,
      }).unwrap();
      toast.success('Contact saved');
      setConflict(null);
      cancel();
    } catch (err) {
      if (!isApiError(err)) {
        toast.error('Could not save the contact.');
        return;
      }
      switch (err.kind) {
        case 'version-conflict':
          setBase(from);
          setConflict({ base: from.values, mine: current, latest: err.latest });
          break;
        case 'email-taken':
          setErrors({ email: 'Email already used by another contact' });
          break;
        case 'validation':
          setErrors(fromServerErrors(err.fieldErrors));
          break;
        case 'not-found':
          toast.error('This contact no longer exists.');
          break;
        default:
          toast.error(`Could not save: ${err.message}`);
      }
    }
  }

  async function save() {
    if (!base || !values) return;
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    await send(changes, base, values);
  }

  /** Put the latest contact in the cache at once (the refetch the 409 triggered may still be on its way). */
  function showLatest(latest: Contact) {
    dispatch(contactsApi.util.updateQueryData('getContact', latest.id, () => latest));
  }

  /** Drop my edits and show the latest saved contact. */
  function reloadLatest() {
    if (!conflict) return;
    showLatest(conflict.latest);
    setConflict(null);
    cancel();
  }

  /** Load the latest version and keep my edits in the form, for review before saving again. */
  function reapplyMine() {
    if (!conflict) return;
    showLatest(conflict.latest);
    setBase({ values: toFormValues(conflict.latest), version: conflict.latest.version });
    setValues(mineOnLatest(conflict));
    setErrors({});
    setResetKey((k) => k + 1);
    setConflict(null);
  }

  /** Re-save only my changed fields on the new version (offered when the changes do not overlap). */
  async function mergeBoth() {
    if (!conflict) return;
    const latest = { values: toFormValues(conflict.latest), version: conflict.latest.version };
    const merged = mineOnLatest(conflict);
    setValues(merged);
    await send(toChanges(conflict.base, conflict.mine), latest, merged);
  }

  return {
    editing,
    values: values ?? (contact ? toFormValues(contact) : null),
    errors,
    saving,
    hasChanges,
    resetKey,
    conflict,
    startEdit,
    cancel,
    change,
    save,
    reloadLatest,
    reapplyMine,
    mergeBoth,
    closeConflict: () => setConflict(null),
  };
}

/** The latest saved values with my changed fields on top. */
function mineOnLatest(conflict: Conflict): FormValues {
  const next = toFormValues(conflict.latest);
  for (const name of Object.keys(toChanges(conflict.base, conflict.mine)) as (keyof FormValues)[]) {
    next[name] = conflict.mine[name];
  }
  return next;
}

/** What `useContactEditor` returns (the lazily loaded ContactEditor takes it as a prop). */
export type ContactEditorState = ReturnType<typeof useContactEditor>;
