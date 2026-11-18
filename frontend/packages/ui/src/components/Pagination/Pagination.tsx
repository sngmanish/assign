import React, { useState, useEffect, useMemo } from 'react';

import {
  TYPES,
  DEFAULT_TITLE,
  DEFAULT_INITIAL_ROW,
  DEFAULT_PAGE,
  DEFAULT_ROW_LIST,
  DEFAULT_RANGE_LABEL,
  DEFAULT_TOTAL_PAGES_LABEL,
} from './constants';
import { generatePaginationLabels } from './helper';
import NavigationButtons from './NavigationButtons';
import PageInput from './PageInput';
import { SelectMenu } from '../SelectMenu';
import { SIZES, VARIANTS } from '../Button';

import type { PaginationProps, PageOption } from './types/Pagination.types';

import styles from '../../styles/pagination/index.module.css';
import { Text } from '../Text';

function Pagination({
  showRowsPerPage = false,
  title = DEFAULT_TITLE,
  rowList = DEFAULT_ROW_LIST,
  initialRow = DEFAULT_INITIAL_ROW,
  currentPage = '1',
  totalResults = 250,
  onChange = () => {},
  onPageChange = () => {},
  totalPagesLabel = DEFAULT_TOTAL_PAGES_LABEL,
  pageLabel = '',
}: PaginationProps): React.ReactElement {
  const [selected, setSelected] = useState<PageOption[]>([initialRow]);
  const [selectedPage, setSelectedPage] = useState<PageOption>({
    label: currentPage.toString(),
    value: Number.parseInt(String(currentPage)),
  });

  const rowCountNum = selected?.[0]?.value || initialRow?.value;
  const currentPageInt = Number.parseInt(String(currentPage));
  const totalPages = Math.ceil(totalResults / rowCountNum);

  const paginationLabels = useMemo(
    () =>
      generatePaginationLabels(
        DEFAULT_RANGE_LABEL,
        totalPagesLabel,
        totalResults,
        currentPageInt,
        rowCountNum,
      ),
    [totalPagesLabel, totalResults, currentPageInt, rowCountNum],
  );

  const handlePageInputSelect = (pageValue: number): void => {
    setSelectedPage({
      label: String(pageValue),
      value: pageValue,
    });
    onPageChange(pageValue);
  };

  useEffect(() => {
    if (initialRow) {
      setSelected([initialRow]);
    }
  }, [initialRow]);

  useEffect(() => {
    setSelectedPage({
      label: currentPage.toString(),
      value: Number.parseInt(String(currentPage)),
    });
  }, [currentPage]);

  const handleRowSelect = (newOption: PageOption): void => {
    onChange(newOption);
    setSelected([newOption]);
    setSelectedPage(DEFAULT_PAGE);
    onPageChange(DEFAULT_PAGE.value || 1);
  };

  const handlePageChange = (type: string): void => {
    const newPageValue = type === TYPES.DECREMENT ? selectedPage.value - 1 : selectedPage.value + 1;
    if (newPageValue < 1 || newPageValue > totalPages) return;

    setSelectedPage({
      label: `${newPageValue}`,
      value: newPageValue,
    });
    onPageChange(newPageValue);
  };

  return (
    <div className={styles['hl-pagination']}>
      {showRowsPerPage ? (
        <>
          <SelectMenu
            identifier="rows-per-page"
            options={rowList.map((o) => ({ key: o.value, label: o.label }))}
            selectedKey={(selected?.[0] ?? initialRow).value}
            onSelect={(option) =>
              handleRowSelect({ label: option.label, value: Number(option.key) })
            }
            searchable={false}
            controlButtonMetaData={{
              label: selected?.[0]?.label || initialRow?.label,
              ariaLabel: title,
              variant: VARIANTS.SECONDARY,
              size: SIZES.SMALL,
            }}
          />
          <span className={styles['hl-pagination-title']}>{title}</span>
        </>
      ) : null}

      <div className={styles['stats__wrapper']}>
        <Text fontFamily="interactive">{paginationLabels.range}</Text>
        {paginationLabels.rangeSecondaryText}
      </div>

      <nav className={styles['hl-pagination-links-wrapper']} aria-label="pagination navigation">
        <NavigationButtons
          currentPageInt={currentPageInt}
          totalPages={totalPages}
          handlePageChange={handlePageChange}
        >
          {
            <>
              {pageLabel ? (
                <li className={styles['hl-pagination-total-pages']}>
                  <Text>{pageLabel}</Text>
                </li>
              ) : null}
              <li className={styles['hl-pagination-input-item']}>
                <PageInput
                  currentPage={selectedPage.value}
                  totalPages={totalPages}
                  onPageSelect={handlePageInputSelect}
                />
              </li>
              <li className={styles['hl-pagination-total-pages']}>
                <Text>{paginationLabels.totalPagesLabel}</Text>
              </li>
            </>
          }
        </NavigationButtons>
      </nav>
    </div>
  );
}

export default Pagination;
