import React from 'react';

import type { FormProps, FormItemProps } from './types/Form.types';

import styles from '../../styles/form/index.module.css';

function Form({ children, ...rest }: FormProps) {
  return (
    <form className={`${styles['hl-form']} ${styles['hl-form-column']}`} {...rest}>
      {children}
    </form>
  );
}

function FormItem({ children }: FormItemProps) {
  return <div className={styles['hl-form--item']}>{children}</div>;
}

Form.displayName = 'Form';

export type FormWithItem = typeof Form & { Item: typeof FormItem };

export default Object.assign(Form, {
  Item: FormItem,
}) as FormWithItem;
