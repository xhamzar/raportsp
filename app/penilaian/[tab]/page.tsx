'use client';

import React, { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import {
  normalizePenilaianTab,
  PenilaianWorkspace,
} from '@/components/assessments/PenilaianWorkspace';
import { TableSkeleton } from '@/components/ui/Primitives';

function PenilaianTabInner() {
  const params = useParams<{ tab?: string }>();
  const tab = normalizePenilaianTab(params?.tab);
  return <PenilaianWorkspace initialTab={tab} />;
}

export default function PenilaianTabPage() {
  return (
    <Suspense
      fallback={
        <AppShell title="Input Nilai" requiredModule={['penilaian', 'keasramaan', 'rapor']}>
          <TableSkeleton rows={8} />
        </AppShell>
      }
    >
      <PenilaianTabInner />
    </Suspense>
  );
}
