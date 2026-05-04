'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

export function SuccessRedirect({ delayMs = 4000 }: { delayMs?: number }) {
  const router = useRouter();
  React.useEffect(() => {
    const t = setTimeout(() => router.push('/'), delayMs);
    return () => clearTimeout(t);
  }, [delayMs, router]);
  return null;
}
