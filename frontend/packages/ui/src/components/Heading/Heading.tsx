import React from 'react';

import classNames from 'classnames';

export interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  className?: string;
  children: React.ReactNode;
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  style?: React.CSSProperties;
}

// eslint-disable-next-line react/display-name
const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>((props, ref) => {
  const { className = '', children, size, level = 2, style, ...restProps } = props;

  const HeadingTag = `h${level}` as React.ElementType;

  const defaultSizes: Record<number, string> = {
    1: 'lg',
    2: 'md',
    3: 'sm',
    4: 'xs',
    5: 'xs',
    6: 'xs',
  };

  // the page title is semibold with tight tracking; other headings are medium weight
  const fontFamilyVariant = level === 1 ? 'primary' : 'secondary_interactive';

  const headingSize = size || defaultSizes[level];

  const headingClasses = classNames({
    [className]: !!className,
    [`hl-typo_heading--${fontFamilyVariant}`]: true,
    [`hl-typo_heading-size--${headingSize}`]: !!headingSize,
  });

  return (
    <HeadingTag className={headingClasses} ref={ref} {...restProps} style={style}>
      {children}
    </HeadingTag>
  );
});

export default Heading;
