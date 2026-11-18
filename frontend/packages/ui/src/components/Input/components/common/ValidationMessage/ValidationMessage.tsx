import * as React from 'react';

import type { ValidationMessageProps } from './types/ValidationMessage.types';
import { Text } from '../../../../Text';

import styles from '../../../../../styles/input/index.module.css';
import CrossCircledIcon from '../../../../../icons/react/CrossCircledIcon';
export type { ValidationMessageProps };

const ValidationMessage = React.memo<ValidationMessageProps>((props) => {
  const { isError, validationText, id, accessibleErrorText } = props;

  const getIcon = () =>
    isError ? (
      <>
        <span className={styles['hl-sr-only']}> {accessibleErrorText}</span>
        <CrossCircledIcon height={16} width={16} aria-hidden="true" />
      </>
    ) : null;

  return validationText && isError ? (
    <Text
      size="sm"
      tag="span"
      color="var(--hl-destructive)"
      className={styles['hl-input-validation']}
      aria-live="assertive"
      id={`${id}-validationText`}
      style={{ marginTop: '4px' }}
    >
      <span className={styles['hl-input-validation--icon']}> {getIcon()}</span>
      <span>{validationText}</span>
    </Text>
  ) : null;
});

ValidationMessage.displayName = 'ValidationMessage';

export default ValidationMessage;
