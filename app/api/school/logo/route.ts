import { NextResponse } from 'next/server';
import { getCachedSchoolLogo } from '@/lib/server/services/school-logo-cache';

export async function GET() {
  const { buffer, contentType } = await getCachedSchoolLogo();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
