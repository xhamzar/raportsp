import { redirect } from 'next/navigation';

export default function RaporPage() {
  redirect('/cetak?doc=rapor');
}
