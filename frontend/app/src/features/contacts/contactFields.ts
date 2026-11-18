import type { ContactFormField } from '@crm/ui';
import type { Contact, ContactFieldName, ContactFields } from '../../api/types';

/** The five editable fields, in the order the form shows them. Limits match the backend's. */
export const CONTACT_FIELDS: (ContactFormField & { name: ContactFieldName })[] = [
  { name: 'firstName', label: 'First name', required: true, maxLength: 100 },
  { name: 'lastName', label: 'Last name', required: true, maxLength: 100 },
  { name: 'email', label: 'Email', kind: 'email', maxLength: 254 },
  { name: 'phone', label: 'Phone', kind: 'phone' },
  { name: 'company', label: 'Company', maxLength: 200 },
];

export const FIELD_LABEL: Record<ContactFieldName, string> = Object.fromEntries(
  CONTACT_FIELDS.map((f) => [f.name, f.label]),
) as Record<ContactFieldName, string>;

/** What the form edits: every field as a string, '' for "no value". */
export type FormValues = Record<ContactFieldName, string>;
export type FieldErrors = Partial<Record<ContactFieldName, string>>;

export const toFormValues = (c: Pick<Contact, ContactFieldName>): FormValues => ({
  firstName: c.firstName,
  lastName: c.lastName,
  email: c.email ?? '',
  phone: c.phone ?? '',
  company: c.company ?? '',
});

const digits = (v: string) => v.replace(/\D/g, '');

/** Are two form values the same? Phones compare by digits ("+1-514…" and "+1 514…" are equal). */
export function sameValue(field: ContactFieldName, a: string, b: string): boolean {
  if (field === 'phone') return digits(a) === digits(b);
  if (field === 'email') return a.trim().toLowerCase() === b.trim().toLowerCase();
  return a.trim() === b.trim();
}

/** The fields whose value differs between `from` and `to`. */
export const changedFieldNames = (from: FormValues, to: FormValues): ContactFieldName[] =>
  CONTACT_FIELDS.map((f) => f.name).filter((name) => !sameValue(name, from[name], to[name]));

/** The PATCH body (without `version`): only the changed fields; '' becomes null except for names. */
export function toChanges(base: FormValues, values: FormValues): Partial<ContactFields> {
  const changes: Partial<ContactFields> = {};
  for (const name of changedFieldNames(base, values)) {
    const v = values[name].trim();
    if (name === 'firstName' || name === 'lastName') changes[name] = v;
    else changes[name] = v || null;
  }
  return changes;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Client checks, the same rules the backend applies (it checks again and answers 422). */
export function validate(values: FormValues): FieldErrors {
  const errors: FieldErrors = {};
  for (const name of ['firstName', 'lastName'] as const) {
    const v = values[name].trim();
    if (!v) errors[name] = `${FIELD_LABEL[name]} is required`;
    else if (v.length > 100) errors[name] = 'Must be at most 100 characters';
  }
  const email = values.email.trim();
  if (email && (email.length > 254 || !EMAIL_RE.test(email)))
    errors.email = 'Enter a valid email address';
  const phone = values.phone.trim();
  if (phone && (phone.length > 30 || !/^\+?[0-9 ().-]+$/.test(phone) || digits(phone).length < 7)) {
    errors.phone = 'Enter a valid phone number';
  }
  if (values.company.trim().length > 200) errors.company = 'Must be at most 200 characters';
  return errors;
}

/** Map the backend's 422 `details` (`{ path, message }`) to the form's fields. */
export function fromServerErrors(fieldErrors: { path: string; message: string }[]): FieldErrors {
  const out: FieldErrors = {};
  for (const { path, message } of fieldErrors) {
    const name = path.split('.')[0] as ContactFieldName;
    if (name in FIELD_LABEL && !out[name]) out[name] = message;
  }
  return out;
}
