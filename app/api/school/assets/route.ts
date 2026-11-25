import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { ensureSeeded } from '@/lib/server/db/seed';
import { getDb } from '@/lib/server/db';
import { schools } from '@/lib/server/db/schema';
import { logAudit, requireApiAuth } from '@/lib/server/auth/session';
import {
  deleteSchoolAssetFile,
  MAX_SCHOOL_ASSET_BYTES,
  readSchoolAssetFile,
  saveSchoolAssetFile,
  type SchoolAssetType,
} from '@/lib/server/services/school-assets';

function parseAssetType(raw: string | null): SchoolAssetType | null {
  if (raw === 'signature' || raw === 'stamp') return raw;
  return null;
}

export async function GET(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req);
  if ('error' in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const assetType = parseAssetType(searchParams.get('type'));
  if (!assetType) {
    return NextResponse.json({ error: 'Parameter jenis aset tidak valid.' }, { status: 400 });
  }

  const db = getDb();
  const [school] = await db
    .select({
      principalSignaturePath: schools.principalSignaturePath,
      schoolStampPath: schools.schoolStampPath,
    })
    .from(schools)
    .limit(1);

  const fileName =
    assetType === 'signature' ? school?.principalSignaturePath : school?.schoolStampPath;
  const file = readSchoolAssetFile(fileName);
  if (!file) {
    return NextResponse.json({ error: 'Berkas belum diunggah.' }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(file.buffer), {
    status: 200,
    headers: {
      'Content-Type': file.contentType,
      'Content-Length': String(file.buffer.byteLength),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function POST(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, 'sekolah', 'update');
  if ('error' in auth) return auth.error;

  const formData = await req.formData().catch(() => null);
  const assetType = parseAssetType(
    typeof formData?.get('type') === 'string' ? (formData.get('type') as string) : null
  );
  if (!assetType) {
    return NextResponse.json(
      { error: 'Pilih jenis aset (signature atau stamp).' },
      { status: 400 }
    );
  }

  const uploaded = formData?.get('file');
  if (!(uploaded instanceof File)) {
    return NextResponse.json(
      { error: 'Silakan pilih file gambar PNG/JPG/WebP terlebih dahulu.' },
      { status: 400 }
    );
  }

  if (uploaded.size > MAX_SCHOOL_ASSET_BYTES) {
    return NextResponse.json(
      { error: 'Ukuran gambar maksimal 2 MB.' },
      { status: 400 }
    );
  }

  const db = getDb();
  const [school] = await db.select().from(schools).limit(1);
  if (!school) {
    return NextResponse.json({ error: 'Data sekolah tidak ditemukan.' }, { status: 404 });
  }

  const previousPath =
    assetType === 'signature' ? school.principalSignaturePath : school.schoolStampPath;
  const buffer = Buffer.from(await uploaded.arrayBuffer());

  let saved: { fileName: string; contentType: string };
  try {
    saved = saveSchoolAssetFile(assetType, buffer, previousPath);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal menyimpan file gambar.' },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const updatePayload =
    assetType === 'signature'
      ? { principalSignaturePath: saved.fileName, showPrincipalSignature: true, updatedAt: now }
      : { schoolStampPath: saved.fileName, showSchoolStamp: true, updatedAt: now };

  await db.update(schools).set(updatePayload).where(eq(schools.id, school.id));

  await logAudit({
    userId: auth.user.id,
    actorName: auth.user.fullName,
    action: assetType === 'signature' ? 'UPLOAD_PRINCIPAL_SIGNATURE' : 'UPLOAD_SCHOOL_STAMP',
    entityType: 'school',
    entityId: school.id,
    details:
      assetType === 'signature'
        ? 'Mengunggah tanda tangan Kepala Sekolah untuk dokumen cetak.'
        : 'Mengunggah stempel resmi sekolah untuk dokumen cetak.',
  });

  return NextResponse.json({
    ok: true,
    type: assetType,
    fileName: saved.fileName,
    assetUrl: `/api/school/assets?type=${assetType}&v=${Date.now()}`,
  });
}

const toggleSchema = z.object({
  showPrincipalSignature: z.boolean().optional(),
  showSchoolStamp: z.boolean().optional(),
  showLetterhead: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, 'sekolah', 'update');
  if ('error' in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = toggleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Format pembaruan tidak valid.' }, { status: 400 });
  }

  const db = getDb();
  const [school] = await db.select().from(schools).limit(1);
  if (!school) {
    return NextResponse.json({ error: 'Data sekolah tidak ditemukan.' }, { status: 404 });
  }

  const nextShowSig = parsed.data.showPrincipalSignature ?? school.showPrincipalSignature;
  const nextShowStamp = parsed.data.showSchoolStamp ?? school.showSchoolStamp;
  const nextShowLetterhead = parsed.data.showLetterhead ?? school.showLetterhead;

  await db
    .update(schools)
    .set({
      showPrincipalSignature: nextShowSig,
      showSchoolStamp: nextShowStamp,
      showLetterhead: nextShowLetterhead,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schools.id, school.id));

  await logAudit({
    userId: auth.user.id,
    actorName: auth.user.fullName,
    action: 'TOGGLE_PRINT_SIGNATURE_STAMP',
    entityType: 'school',
    entityId: school.id,
    details: `Mengatur tampilan cetak: Kop Surat (${nextShowLetterhead ? 'On' : 'Off'}), Tanda Tangan (${nextShowSig ? 'On' : 'Off'}), Stempel (${nextShowStamp ? 'On' : 'Off'}).`,
  });

  return NextResponse.json({
    ok: true,
    showPrincipalSignature: nextShowSig,
    showSchoolStamp: nextShowStamp,
    showLetterhead: nextShowLetterhead,
  });
}

export async function DELETE(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, 'sekolah', 'update');
  if ('error' in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const assetType = parseAssetType(searchParams.get('type'));
  if (!assetType) {
    return NextResponse.json({ error: 'Parameter jenis aset tidak valid.' }, { status: 400 });
  }

  const db = getDb();
  const [school] = await db.select().from(schools).limit(1);
  if (!school) {
    return NextResponse.json({ error: 'Data sekolah tidak ditemukan.' }, { status: 404 });
  }

  const currentPath =
    assetType === 'signature' ? school.principalSignaturePath : school.schoolStampPath;
  deleteSchoolAssetFile(currentPath);

  const now = new Date().toISOString();
  await db
    .update(schools)
    .set(
      assetType === 'signature'
        ? { principalSignaturePath: '', updatedAt: now }
        : { schoolStampPath: '', updatedAt: now }
    )
    .where(eq(schools.id, school.id));

  await logAudit({
    userId: auth.user.id,
    actorName: auth.user.fullName,
    action: assetType === 'signature' ? 'DELETE_PRINCIPAL_SIGNATURE' : 'DELETE_SCHOOL_STAMP',
    entityType: 'school',
    entityId: school.id,
    details:
      assetType === 'signature'
        ? 'Menghapus gambar tanda tangan Kepala Sekolah.'
        : 'Menghapus gambar stempel sekolah.',
  });

  return NextResponse.json({ ok: true, type: assetType });
}
