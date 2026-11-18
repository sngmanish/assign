import React from 'react';

import classNames from 'classnames';

export interface TextProps extends React.HTMLAttributes<HTMLElement> {
  className?: string;
  children: React.ReactNode;
  tag?: 'span' | 'p' | 'div';
  size?: 'sm' | 'md' | 'lg';
  fontFamily?: 'regular' | 'interactive' | 'bold';
  color?: string;
  style?: React.CSSProperties;
}

// eslint-disable-next-line react/display-name
const Text = React.forwardRef<HTMLElement, TextProps>((props, ref) => {
  const {
    className = '',
    children,
    tag = 'span',
    size = 'md',
    fontFamily = 'regular',
    color = '',
    style = {},
    ...restProps
  } = props;

  const TextTag = tag as React.ElementType;

  const textClasses = classNames({
    [className]: !!className,
    [`hl-typo_text--${fontFamily}`]: !!fontFamily,
    [`hl-typo_text_size--${size}`]: !!size,
    [`hl-typo_text_color`]: true,
  });

  const textStyles: React.CSSProperties = {
    ...(color && { color: color }),
    ...style,
  };

  return (
    <TextTag className={textClasses} ref={ref} style={textStyles} {...restProps}>
      {children}
    </TextTag>
  );
});

export default Text;
