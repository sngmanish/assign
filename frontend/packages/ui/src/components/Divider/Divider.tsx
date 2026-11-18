import React from 'react';

import classNames from 'classnames';

import styles from '../../styles/divider/index.module.css';

export type DividerProps = React.HTMLAttributes<HTMLHRElement>;

function Divider({ className, ...rest }: DividerProps) {
  return <hr className={classNames(styles['hl-divider'], className)} {...rest} />;
}

export default Divider;
