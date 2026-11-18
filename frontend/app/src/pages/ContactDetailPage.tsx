import type { ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  ArrowLeftIcon,
  Avatar,
  Divider,
  ErrorState,
  HStack,
  Heading,
  NotFoundState,
  Skeleton,
  Text,
  VStack,
} from '@crm/ui';
import { useGetContactQuery } from '../api/contactsApi';
import { NotFoundGif } from '../app/NotFoundGif';
import { isApiError } from '../api/errors';
import { initials, type FromListState } from '../features/contacts/columns';
import styles from './ContactDetailPage.module.css';
import { ContactActivity } from '../features/contacts/ContactActivity';
import { ContactDetails } from '../features/contacts/ContactDetails';
import { ContactTags } from '../features/contacts/ContactTags';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A bordered white box (shadcn Card look). */
const panel = {
  padding: 'var(--hl-space-5)',
  background: 'var(--hl-background)',
  border: '1px solid var(--hl-border)',
  borderRadius: 'var(--hl-radius-lg, 12px)',
  boxShadow: 'var(--hl-shadow-xs)',
} as const;

function Panel({ children }: { children: ReactNode }) {
  return <section style={panel}>{children}</section>;
}

/** Two panels: the contact (name, tags, fields) on the left, recent activity on the right. */
export function ContactDetailPage() {
  const { id = '' } = useParams();
  const location = useLocation();
  // back to the list with the same search, filters, sort and page
  const listUrl = `/contacts${(location.state as FromListState | null)?.listSearch ?? ''}`;

  const validId = UUID_RE.test(id);
  const {
    data: contact,
    error,
    isLoading,
    isFetching,
    refetch,
  } = useGetContactQuery(id, { skip: !validId });
  const apiError = isApiError(error) ? error : undefined;

  const back = (
    <Link to={listUrl} className={styles.back}>
      <ArrowLeftIcon aria-hidden="true" /> Contacts
    </Link>
  );

  if (!validId || apiError?.kind === 'not-found') {
    return (
      <main>
        {back}
        <NotFoundState
          icon={<NotFoundGif />}
          title="Contact not found"
          description="This contact doesn't exist or was removed."
          actions={<Link to={listUrl}>Back to contacts</Link>}
        />
      </main>
    );
  }

  if (error && !contact) {
    return (
      <main>
        {back}
        <ErrorState
          title="Couldn't load this contact"
          description={apiError?.message}
          onRetry={refetch}
          retrying={isFetching}
        />
      </main>
    );
  }

  return (
    <main>
      {back}
      <div className={styles.columns}>
        <Panel>
          {isLoading || !contact ? (
            <DetailsSkeleton />
          ) : (
            <VStack spacing={4}>
              <HStack spacing={3} align="center">
                <div style={{ flexShrink: 0 }}>
                  <Avatar size="lg" label={initials(contact)} />
                </div>
                {/* long names or companies without spaces wrap instead of running off the panel */}
                <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                  <Heading level={1} size="md">
                    {contact.firstName} {contact.lastName}
                  </Heading>
                  {contact.company && (
                    <Text color="var(--hl-muted-foreground)">{contact.company}</Text>
                  )}
                </div>
              </HStack>
              <ContactTags contact={contact} />
              <Divider />
              <ContactDetails contact={contact} />
            </VStack>
          )}
        </Panel>
        <Panel>
          <Heading level={2} size="sm" style={{ marginBottom: 'var(--hl-space-3)' }}>
            Recent activity
          </Heading>
          <ContactActivity contactId={id} />
        </Panel>
      </div>
    </main>
  );
}

function DetailsSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading contact">
      <HStack spacing={3} align="center">
        <Skeleton circle width={48} height={48} />
        <Skeleton width={180} height={24} />
      </HStack>
      <Skeleton count={5} height={40} style={{ display: 'block', marginTop: 16 }} />
    </div>
  );
}
