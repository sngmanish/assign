import * as React from 'react';

import { Heading } from '../Heading';
import { Button, VARIANTS } from '../Button';
import { Text } from '../Text';

import ExclamationTriangleIcon from '../../icons/react/ExclamationTriangleIcon';

export interface StateMessageProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

/** A centred icon, title, text and actions: the base of the not-found and error states. */
function StateMessage({ icon, title, description, actions }: StateMessageProps) {
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 'var(--hl-space-3)',
        padding: 'var(--hl-space-12, 48px) var(--hl-space-4)',
      }}
    >
      {icon}
      <Heading level={2} size="sm">
        {title}
      </Heading>
      {description && (
        <Text tag="p" color="var(--hl-muted-foreground)" style={{ margin: 0, maxWidth: 480 }}>
          {description}
        </Text>
      )}
      {actions && <div style={{ display: 'flex', gap: 'var(--hl-space-2)' }}>{actions}</div>}
    </div>
  );
}

export interface NotFoundStateProps {
  /** Shown above the title, e.g. an image. */
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
}

/** "This doesn't exist": a 404, separate from the generic error state. */
export function NotFoundState({
  icon,
  title = 'Not found',
  description,
  actions,
}: NotFoundStateProps) {
  return <StateMessage icon={icon} title={title} description={description} actions={actions} />;
}

export interface ErrorStateProps {
  title?: string;
  /** What went wrong, in words the user can act on. */
  description?: string;
  onRetry?: () => void;
  retrying?: boolean;
}

/** A page or panel that could not load, with Retry. */
export function ErrorState({
  title = "Couldn't load this",
  description,
  onRetry,
  retrying = false,
}: ErrorStateProps) {
  return (
    <div role="alert">
      <StateMessage
        icon={
          <ExclamationTriangleIcon
            width={32}
            height={32}
            aria-hidden="true"
            style={{ color: 'var(--hl-destructive, #b42318)' }}
          />
        }
        title={title}
        description={description}
        actions={
          onRetry ? (
            <Button
              label="Retry"
              variant={VARIANTS.SECONDARY}
              onClick={onRetry}
              loading={retrying}
              disabled={retrying}
            />
          ) : null
        }
      />
    </div>
  );
}

export default StateMessage;
