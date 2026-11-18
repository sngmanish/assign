import * as React from 'react';

import type { PrefixProps } from './types/Prefix.types';

import styles from '../../../../../../styles/input/index.module.css';
import { Text } from '../../../../../Text';

export type { PrefixProps };

const Prefix = React.memo<PrefixProps>((props) => {
  const { prefix, id } = props;

  return prefix ? (
    <>
      <Text
        tag="span"
        color="var(--hl-muted-foreground)"
        size="md"
        className={styles['hl-input-prefix']}
        id={`${id}-prefix`}
      >
        {typeof prefix === 'string' ? prefix : prefix()}
      </Text>
    </>
  ) : null;
});

Prefix.displayName = 'Prefix';

export default Prefix;
