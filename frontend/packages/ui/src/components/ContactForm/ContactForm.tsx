import * as React from 'react';

import { Form } from '../Form';
import { Button, VARIANTS } from '../Button';
import { Input } from '../Input';
import { PhoneInput, splitPhoneNumber } from '../PhoneInput';

export interface ContactFormField {
  name: string;
  label: string;
  kind?: 'text' | 'email' | 'phone';
  required?: boolean;
  maxLength?: number;
}

export interface ContactFormProps {
  fields: ContactFormField[];
  /** The values being edited. Empty string = no value. */
  values: Record<string, string>;
  errors?: Record<string, string | undefined>;
  onChange?: (name: string, value: string) => void;
  onSubmit?: () => void;
  onCancel?: () => void;
  /** Save is disabled when false (e.g. nothing changed). */
  canSave?: boolean;
  saving?: boolean;
  /**
   * Change it to throw away what the inputs hold and start again from `values` (the phone input
   * keeps its own state, so it has to be re-created).
   */
  resetKey?: string | number;
}

/**
 * The contact's fields as an edit form, with errors under the fields and Save / Cancel.
 * `ContactFieldList` shows the same fields read-only (and does not load the phone input).
 */
function ContactForm({
  fields,
  values,
  errors = {},
  onChange = () => {},
  onSubmit = () => {},
  onCancel = () => {},
  canSave = true,
  saving = false,
  resetKey = 0,
}: ContactFormProps) {
  return (
    <Form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (canSave && !saving) onSubmit();
      }}
    >
      {fields.map((f) => {
        const error = errors[f.name];
        if (f.kind === 'phone') {
          const split = splitPhoneNumber(values[f.name]);
          return (
            <Form.Item key={`${f.name}-${resetKey}`}>
              <PhoneInput
                label={f.label}
                identifier={`contact-${f.name}`}
                defaultCountryCode={split.countryCode}
                defaultCallingCode={split.callingCode}
                defaultPhoneNumber={split.nationalNumber}
                onPhoneChange={(data) =>
                  onChange(f.name, data.phoneNumber ? data.formattedPhoneNumberWithCallingCode : '')
                }
                hasError={Boolean(error)}
                invalidNumberErrorMessage={error ?? 'Invalid phone number'}
                disabled={saving}
                inputStyles={{ width: '100%' }}
              />
            </Form.Item>
          );
        }
        return (
          <Form.Item key={f.name}>
            <Input
              id={`contact-${f.name}`}
              name={f.name}
              label={f.label}
              type={f.kind === 'email' ? 'email' : 'text'}
              value={values[f.name] ?? ''}
              maxLength={f.maxLength}
              required={f.required}
              isError={Boolean(error)}
              validationText={error}
              accessibleErrorText={error}
              disabled={saving}
              style={{ width: '100%' }}
              onChange={(e) => onChange(f.name, e.target.value)}
            />
          </Form.Item>
        );
      })}
      <div
        style={{
          display: 'flex',
          gap: 'var(--hl-space-2)',
          justifyContent: 'flex-end',
          marginTop: 'var(--hl-space-4)',
        }}
      >
        <Button
          type="button"
          label="Cancel"
          variant={VARIANTS.SECONDARY}
          onClick={onCancel}
          disabled={saving}
        />
        <Button
          type="submit"
          label="Save"
          variant={VARIANTS.PRIMARY}
          disabled={!canSave || saving}
          loading={saving}
        />
      </div>
    </Form>
  );
}

export default ContactForm;
