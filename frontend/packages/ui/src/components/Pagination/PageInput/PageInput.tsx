import React, { useState, useEffect, useCallback } from 'react';

import { Input } from '../../Input';
import { SIZES } from '../../Input/constants';

import styles from '../../../styles/pagination/index.module.css';

const PAGE_INPUT_ID = 'pagination-page-input';
const NUMERIC_REGEX = /^\d*$/;

interface PageInputProps {
  currentPage: number;
  totalPages: number;
  onPageSelect: (page: number) => void;
}

function PageInput({ currentPage, totalPages, onPageSelect }: PageInputProps) {
  const [inputValue, setInputValue] = useState(String(currentPage));

  useEffect(() => {
    setInputValue(String(currentPage));
  }, [currentPage]);

  const clampAndNavigate = useCallback(
    (value: string) => {
      const maxPage = Math.max(1, totalPages);
      let pageNum = Number.parseInt(value, 10);
      if (Number.isNaN(pageNum) || pageNum < 1) {
        pageNum = 1;
      } else if (pageNum > maxPage) {
        pageNum = maxPage;
      }
      setInputValue(String(pageNum));
      onPageSelect(pageNum);
    },
    [totalPages, onPageSelect],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (NUMERIC_REGEX.test(value)) {
      setInputValue(value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clampAndNavigate(inputValue);
    }
  };

  const handleBlur = () => {
    const parsed = Number.parseInt(inputValue, 10);
    if (parsed !== currentPage) {
      clampAndNavigate(inputValue);
    } else {
      setInputValue(String(currentPage));
    }
  };

  const charCount = Math.max(2, inputValue.length);
  const dynamicWidth = `${charCount}ch`;

  return (
    <div
      className={styles['hl-pagination-page-input']}
      style={{ width: `calc(${dynamicWidth} + var(--hl-space-7))` }}
    >
      <Input
        id={PAGE_INPUT_ID}
        type="text"
        inputMode="numeric"
        size={SIZES.SMALL}
        value={inputValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        dataTestId="pagination-page-input"
        aria-label="Page number"
      />
    </div>
  );
}

export default PageInput;
