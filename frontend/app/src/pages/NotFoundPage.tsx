import { Link } from 'react-router-dom';
import { NotFoundState } from '@crm/ui';
import { NotFoundGif } from '../app/NotFoundGif';

export function NotFoundPage() {
  return (
    <main>
      <NotFoundState
        icon={<NotFoundGif />}
        title="Page not found"
        description="There's nothing at this address."
        actions={<Link to="/contacts">Go to the contacts</Link>}
      />
    </main>
  );
}
