import { Suspense } from 'react';
import { ListenUi } from '@/components/listen-ui';

export const dynamic = 'force-dynamic';

export default function ListenPage() {
  return (
    <Suspense fallback={null}>
      <ListenUi />
    </Suspense>
  );
}
