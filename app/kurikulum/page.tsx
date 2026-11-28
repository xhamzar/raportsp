'use client';

import React, { Suspense } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { TableSkeleton } from '@/components/ui/Primitives';
import { IntrakurikulerManager } from '@/components/academics/IntrakurikulerManager';

export default function KurikulumPage() {
  return (
    <Suspense
      fallback={
        <AppShell title="Mata Pelajaran Intrakurikuler" requiredModule="kurikulum">
          <TableSkeleton rows={8} />
        </AppShell>
      }
    >
      <IntrakurikulerManager pageTitle="Mata Pelajaran Intrakurikuler" />
    </Suspense>
  );
}
