import { DYNAMIC_KEY_REGEX } from './constants';

interface PaginationLabels {
  range: string;
  rangeSecondaryText: string;
  totalPagesLabel: string;
}

export const generatePaginationLabels = (
  rangeLabel: string,
  totalPagesLabel: string,
  totalResults: number,
  currentPage: number,
  rowCountNum: number,
): PaginationLabels => {
  const totalPages = Math.ceil(totalResults / rowCountNum);
  const startRange = Math.max(1, (currentPage - 1) * rowCountNum + 1);
  const endRange = Math.min(currentPage * rowCountNum, totalResults);
  const range = `${startRange}-${endRange}`;

  const replaceKeys = (label: string, defaultLabel: string, values: (string | number)[]): string =>
    label?.length
      ? [...label.matchAll(DYNAMIC_KEY_REGEX)].reduce(
          (result, match, index) => result.replace(match[0], String(values[index])),
          label,
        )
      : defaultLabel;

  const structuredRangeLabel = replaceKeys(rangeLabel, `${range} of ${totalResults}`, [
    range,
    totalResults,
  ]);

  const rangeSecondaryLabel = structuredRangeLabel.replace(range, '');

  return {
    range,
    rangeSecondaryText: rangeSecondaryLabel,
    totalPagesLabel: replaceKeys(totalPagesLabel, `of ${totalPages} pages`, [totalPages]),
  };
};
