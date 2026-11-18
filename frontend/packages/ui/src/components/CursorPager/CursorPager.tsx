import * as React from 'react';

import { Button, VARIANTS } from '../Button';
import { OptionSelect } from '../OptionSelect';
import { Text } from '../Text';
import { Tooltip } from '../Tooltip';

import styles from '../../styles/pagination/index.module.css';
import ChevronLeftIcon from '../../icons/react/ChevronLeftIcon';
import ChevronRightIcon from '../../icons/react/ChevronRightIcon';

export interface CursorPagerProps {
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  /** The current page, counted from 1. */
  page: number;
  rowCount: number;
  /** The total as text, e.g. "10,000+". */
  totalLabel: string;
  pageSize: number;
  pageSizes: number[];
  onPageSizeChange: (size: number) => void;
  /** Disable the controls while a page is loading. */
  disabled?: boolean;
  noun?: string;
}

const ArrowButton = ({
  label,
  icon,
  disabled,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
}) => {
  const button = (
    <Button
      icon={() => icon}
      ariaLabel={label}
      iconAlone
      variant={VARIANTS.TERTIARY}
      disabled={disabled}
      onClick={onClick}
    />
  );
  // always wrapped, so the button is not re-created when it is disabled while a page loads
  return <Tooltip text={label}>{button}</Tooltip>;
};

/**
 * Pagination for results too long to count exactly (the server caps its count). Looks like the
 * table's own pagination, "1-20 of 10,000+  ‹ Page 1 ›", but moves by cursor: there is no last
 * page and no jumping to a page number.
 */
function CursorPager({
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  page,
  rowCount,
  totalLabel,
  pageSize,
  pageSizes,
  onPageSizeChange,
  disabled = false,
  noun = 'Items',
}: CursorPagerProps) {
  const first = (page - 1) * pageSize + 1;
  const last = first + Math.max(rowCount, 1) - 1;

  return (
    <div
      className={styles['hl-pagination']}
      style={{ justifyContent: 'flex-end', padding: 'var(--hl-space-3) 0' }}
    >
      <span style={{ marginRight: 'var(--hl-space-2)' }}>
        <OptionSelect
          ariaLabel={`${noun} per page`}
          options={pageSizes.map((n) => ({ label: String(n), value: n }))}
          value={pageSize}
          onChange={onPageSizeChange}
          disabled={disabled}
          placement="top-start"
        />
      </span>
      <span className={styles['hl-pagination-title']}>{noun} per page</span>
      <div className={styles['stats__wrapper']}>
        <Text fontFamily="interactive">
          {first.toLocaleString()}-{last.toLocaleString()}
        </Text>{' '}
        of {totalLabel}
      </div>
      <nav className={styles['hl-pagination-links-wrapper']} aria-label="pagination navigation">
        <ul className={styles['hl-pagination-links']}>
          <li>
            <ArrowButton
              label="Previous page"
              icon={<ChevronLeftIcon />}
              disabled={disabled || !hasPrev}
              onClick={onPrev}
            />
          </li>
          <li className={styles['hl-pagination-total-pages']} aria-current="page">
            <Text>Page {page.toLocaleString()}</Text>
          </li>
          <li>
            <ArrowButton
              label="Next page"
              icon={<ChevronRightIcon />}
              disabled={disabled || !hasNext}
              onClick={onNext}
            />
          </li>
        </ul>
      </nav>
    </div>
  );
}

export default CursorPager;
