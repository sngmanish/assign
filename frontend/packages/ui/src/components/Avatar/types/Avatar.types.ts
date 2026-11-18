export type AvatarSize = 'sm' | 'md' | 'lg';

export interface AvatarProps {
  size?: AvatarSize;
  /** The initials to show, e.g. "AL". */
  label?: string;
}
