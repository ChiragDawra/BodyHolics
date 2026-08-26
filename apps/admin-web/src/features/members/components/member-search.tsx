'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui';

/**
 * Search is a URL parameter, not component state, so a staff member can share or
 * bookmark a filtered list and the back button behaves.
 */
export function MemberSearch({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(initialQuery);

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (value.trim()) next.set('q', value.trim());
      else next.delete('q');
      router.replace(`/members${next.size > 0 ? `?${next}` : ''}`);
    }, 250);
    return () => clearTimeout(timer);
    // `params` is a new object each render; keying on its string form keeps this
    // from re-firing on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, params.toString(), router]);

  return (
    <Input
      type="search"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      placeholder="Search by name or member code"
      aria-label="Search members"
      className="max-w-sm"
    />
  );
}
