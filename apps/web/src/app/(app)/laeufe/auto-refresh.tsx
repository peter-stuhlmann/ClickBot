'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export const REFRESH_MS = 2_000;

/** Reloads the server data of the page every two seconds while `active`, e.g. while a run runs. */
export function AutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [active, router]);
  return null;
}
