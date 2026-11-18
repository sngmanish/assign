import { ErrorState, Skeleton, Text } from '@crm/ui';
import { ActivityTimeline } from './ActivityTimeline';
import { ACTIVITY_LIMIT, useGetActivityQuery } from '../../api/contactsApi';
import { isApiError } from '../../api/errors';
import { toActivityEntry } from './activityText';

export function ContactActivity({ contactId }: { contactId: string }) {
  const { data, error, isLoading, isFetching, refetch } = useGetActivityQuery(contactId);

  if (isLoading)
    return <Skeleton count={4} height={40} style={{ display: 'block', marginBottom: 12 }} />;
  if (error && !data) {
    return (
      <ErrorState
        title="Couldn't load the activity"
        description={isApiError(error) ? error.message : undefined}
        onRetry={refetch}
        retrying={isFetching}
      />
    );
  }

  const items = data?.items ?? [];
  return (
    <ActivityTimeline
      entries={items.map(toActivityEntry)}
      footer={
        items.length >= ACTIVITY_LIMIT ? (
          <Text size="sm" color="var(--hl-muted-foreground)">
            Showing the latest {ACTIVITY_LIMIT} changes.
          </Text>
        ) : null
      }
    />
  );
}
