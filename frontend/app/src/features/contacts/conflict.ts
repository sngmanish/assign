import type { ContactFieldName } from '../../api/types';
import { CONTACT_FIELDS, changedFieldNames, type FormValues } from './contactFields';

export interface ThreeWayResult {
  /** Fields I changed (base → mine). */
  mine: ContactFieldName[];
  /** Fields someone else changed (base → theirs). */
  theirs: ContactFieldName[];
  /** Fields both changed, to different values. */
  overlap: ContactFieldName[];
  /** True when both sets of changes can be kept: re-save only my fields on the new version. */
  canMerge: boolean;
}

/**
 * Three-way compare for a version conflict. base = what the form loaded with, mine = the user's
 * edits, theirs = the latest saved contact (from the 409). Pure, so it can be unit-tested.
 */
export function threeWayCompare(
  base: FormValues,
  mine: FormValues,
  theirs: FormValues,
): ThreeWayResult {
  const mineChanged = changedFieldNames(base, mine);
  const theirsChanged = changedFieldNames(base, theirs);
  // both touched it and ended on different values; the same edit on both sides is not a clash
  const overlap = mineChanged.filter(
    (f) => theirsChanged.includes(f) && changedFieldNames(mine, theirs).includes(f),
  );
  return {
    mine: mineChanged,
    theirs: theirsChanged,
    overlap,
    canMerge: mineChanged.length > 0 && overlap.length === 0,
  };
}

/** The fields worth showing in the dialog: any that either side changed, in form order. */
export const conflictFields = (r: ThreeWayResult): ContactFieldName[] =>
  CONTACT_FIELDS.map((f) => f.name).filter((f) => r.mine.includes(f) || r.theirs.includes(f));
