import { redirect } from 'next/navigation';
import { ensureSeeded } from '@/lib/server/db/seed';
import { getAuthenticatedUser } from '@/lib/server/auth/session';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  await ensureSeeded();
  const user = await getAuthenticatedUser();
  if (user) {
    redirect('/dashboard');
  }
  redirect('/login');
}
