import React, { CSSProperties, ReactNode } from 'react';

import styles from '../../styles/stackspacing/index.module.css';

interface StackProps {
  /** Gap between children, in steps of the spacing scale (0-7). */
  spacing?: number;
  children: ReactNode;
  vertical?: boolean;
  justify?: CSSProperties['justifyContent'];
  align?: CSSProperties['alignItems'];
  wrap?: CSSProperties['flexWrap'];
  style?: CSSProperties;
}

type StackChildProps = Omit<StackProps, 'vertical'>;

const EMPTY_STYLE: CSSProperties = {};

function Stack({
  spacing = 0,
  children,
  vertical = false,
  justify = 'flex-start',
  align = 'stretch',
  wrap = 'nowrap',
  style = EMPTY_STYLE,
}: Readonly<StackProps>) {
  const clampedSpacing = spacing < 0 || spacing >= 8 ? 0 : spacing;
  const spacingVar = vertical ? '--hl-stack-row-spacing' : '--hl-stack-column-spacing';

  const stylesObj: CSSProperties = {
    display: 'flex',
    justifyContent: justify,
    alignItems: align,
    flexWrap: wrap,
    [spacingVar]: `var(--hl-space-${clampedSpacing * 2})`,
    ...style,
  };
  return (
    <div
      style={stylesObj}
      className={vertical ? styles['hl-rows-stack'] : styles['hl-columns-stack']}
    >
      {children}
    </div>
  );
}

function VStack(props: Readonly<StackChildProps>) {
  return <Stack vertical {...props} />;
}

function HStack(props: Readonly<StackChildProps>) {
  return <Stack vertical={false} {...props} />;
}

export { Stack, HStack, VStack };
export type { StackProps, StackChildProps };
