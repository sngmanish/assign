import { Suspense, lazy } from 'react';
import { Navigate, createBrowserRouter } from 'react-router-dom';
import { Skeleton } from '@crm/ui';
import { ContactsPage } from '../pages/ContactsPage';
import { AppShell } from './AppShell';

// The detail and not-found pages are their own chunks: the list (the landing page) loads without them.
const ContactDetailPage = lazy(() =>
  import('../pages/ContactDetailPage').then((m) => ({ default: m.ContactDetailPage })),
);
const NotFoundPage = lazy(() =>
  import('../pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
);

/** Shown while a page's chunk downloads (once per visit). */
function PageFallback() {
  return (
    <main role="status" aria-busy="true" aria-label="Loading page">
      <Skeleton width={120} height={20} style={{ display: 'block', marginBottom: 16 }} />
      <Skeleton count={6} height={40} style={{ display: 'block', marginTop: 16 }} />
    </main>
  );
}

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <Navigate to="/contacts" replace /> },
      { path: '/contacts', element: <ContactsPage /> },
      {
        path: '/contacts/:id',
        element: (
          <Suspense fallback={<PageFallback />}>
            <ContactDetailPage />
          </Suspense>
        ),
      },
      {
        path: '*',
        element: (
          <Suspense fallback={<PageFallback />}>
            <NotFoundPage />
          </Suspense>
        ),
      },
    ],
  },
]);
