export interface BadgeProps {
  count?: number;
  /** Counts above this read "{overflowCount}+". */
  overflowCount?: number;
  /** Show the badge at 0 (hidden otherwise). */
  showZero?: boolean;
}
