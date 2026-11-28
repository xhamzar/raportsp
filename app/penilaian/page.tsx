import React, { Suspense } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PenilaianWorkspace } from '@/components/assessments/PenilaianWorkspace';
import { TableSkeleton } from '@/components/ui/Primitives';

export default function PenilaianPage() {
  return (
    <Suspense
      fallback={
        <AppShell title="Input Nilai" requiredModule={['penilaian', 'keasramaan', 'rapor']}>
          <TableSkeleton rows={8} />
        </AppShell>
      }
    >
      <PenilaianWorkspace initialTab="sumatif" />
    </Suspense>
  );
}
