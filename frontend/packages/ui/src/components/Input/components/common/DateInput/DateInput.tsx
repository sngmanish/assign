import * as React from 'react';

import type { DateInputProps } from './types/DateInput.types';
import useInputMask from './hooks/useInputMask';
import { TextInput } from '../TextInput';

export type { DateInputProps };

const PLACEHOLDER = 'DD/MM/YYYY';

const pad = (n: number) => String(n).padStart(2, '0');
/** A Date as dd/mm/yyyy ('' for no date or an invalid one). */
const toText = (date: Date | string) =>
  date instanceof Date && !Number.isNaN(date.getTime())
    ? `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`
    : '';

/** A masked dd/mm/yyyy text input. Uncontrolled: `selectedDate` sets what it shows. */
const DateInput = React.memo(
  React.forwardRef<HTMLInputElement, DateInputProps>((props, ref) => {
    const { disabled = false, readOnly = false, selectedDate = '', ...restProps } = props;

    const dateInputRef = React.useRef<HTMLInputElement>(null);
    React.useImperativeHandle(ref, () => dateInputRef.current as HTMLInputElement);

    useInputMask(dateInputRef, PLACEHOLDER);

    React.useEffect(() => {
      if (dateInputRef.current) dateInputRef.current.value = toText(selectedDate);
    }, [selectedDate]);

    return (
      <TextInput
        {...restProps}
        prefix={null}
        ref={dateInputRef}
        placeholder={PLACEHOLDER}
        readOnly={readOnly}
        disabled={disabled}
        data-inputmask-alias="date"
        data-inputmask-inputformat={PLACEHOLDER}
        im-insert="false"
      />
    );
  }),
);

DateInput.displayName = 'DateInput';

export default DateInput;
