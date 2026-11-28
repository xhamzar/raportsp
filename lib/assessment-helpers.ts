export type CocurricularPredicate = 'Sangat Baik' | 'Baik' | 'Cukup' | 'Perlu Bimbingan';
export type ExtracurricularPredicate = 'Sangat Baik' | 'Baik' | 'Cukup' | 'Kurang';

export interface TpScopeSummary {
  scopeMaterial: string;
  average: number | null;
  filledCount: number;
  totalTp: number;
}

export function computeAverageTwo(a?: number | null, b?: number | null): number | null {
  const valid = [a, b].filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (valid.length === 0) return null;
  return Number((valid.reduce((acc, v) => acc + v, 0) / valid.length).toFixed(2));
}

export function computeScopeAveragesFromTpScores(
  tps: Array<{ id: number; scopeMaterial: string }>,
  tpScores: Record<string, number | null | undefined>
): {
  scopes: TpScopeSummary[];
  lm1: number | null;
  lm2: number | null;
  lm3: number | null;
  lm4: number | null;
  lmAverage: number | null;
} {
  const scopeOrder: string[] = [];
  const grouped = new Map<string, { values: number[]; totalTp: number }>();

  for (const tp of tps) {
    const scope = (tp.scopeMaterial || 'Umum').trim() || 'Umum';
    if (!grouped.has(scope)) {
      scopeOrder.push(scope);
      grouped.set(scope, { values: [], totalTp: 0 });
    }
    const bucket = grouped.get(scope)!;
    bucket.totalTp += 1;
    const raw = tpScores[String(tp.id)];
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      bucket.values.push(raw);
    }
  }

  const scopes: TpScopeSummary[] = scopeOrder.map((scopeMaterial) => {
    const bucket = grouped.get(scopeMaterial)!;
    const average =
      bucket.values.length > 0
        ? Number((bucket.values.reduce((acc, v) => acc + v, 0) / bucket.values.length).toFixed(2))
        : null;
    return {
      scopeMaterial,
      average,
      filledCount: bucket.values.length,
      totalTp: bucket.totalTp,
    };
  });

  const nonNullAverages = scopes
    .map((s) => s.average)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

  const lmAverage =
    nonNullAverages.length > 0
      ? Number((nonNullAverages.reduce((acc, v) => acc + v, 0) / nonNullAverages.length).toFixed(2))
      : null;

  return {
    scopes,
    lm1: scopes[0]?.average ?? null,
    lm2: scopes[1]?.average ?? null,
    lm3: scopes[2]?.average ?? null,
    lm4: scopes[3]?.average ?? null,
    lmAverage,
  };
}

function joinIndonesianPhrases(phrases: string[]): string {
  if (phrases.length === 0) return '';
  if (phrases.length === 1) return phrases[0];
  if (phrases.length === 2) return `${phrases[0]} dan ${phrases[1]}`;
  return `${phrases.slice(0, -1).join(', ')}, dan ${phrases[phrases.length - 1]}`;
}

export function buildCocurricularDescription(
  dimensions: string[],
  dimensionScores: Record<string, string>,
  fallbackPredicate: CocurricularPredicate = 'Baik'
): { predicate: CocurricularPredicate; description: string } {
  const rankMap: Record<string, number> = {
    'Sangat Baik': 4,
    Baik: 3,
    Cukup: 2,
    'Perlu Bimbingan': 1,
  };
  const activeDims = dimensions.filter((d) => d.trim().length > 0);
  if (activeDims.length === 0) {
    return {
      predicate: fallbackPredicate,
      description: `Ananda menunjukkan capaian ${fallbackPredicate.toLowerCase()} dalam kegiatan kokurikuler.`,
    };
  }

  let sumRank = 0;
  let countRank = 0;
  const clauses: string[] = [];

  for (const dim of activeDims) {
    const pred = (dimensionScores[dim] || fallbackPredicate) as CocurricularPredicate;
    const score = rankMap[pred] ?? 3;
    sumRank += score;
    countRank += 1;
    clauses.push(`${pred.toLowerCase()} dalam ${dim.toLowerCase()}`);
  }

  const avg = countRank > 0 ? sumRank / countRank : 3;
  let overall: CocurricularPredicate = 'Baik';
  if (avg >= 3.5) overall = 'Sangat Baik';
  else if (avg >= 2.5) overall = 'Baik';
  else if (avg >= 1.5) overall = 'Cukup';
  else overall = 'Perlu Bimbingan';

  const joined = joinIndonesianPhrases(clauses);
  const sentence = joined.charAt(0).toUpperCase() + joined.slice(1) + '.';
  return { predicate: overall, description: sentence };
}

export function buildExtracurricularDescription(
  tpScores: Array<{ objective: string; predicate: string }>,
  fallbackPredicate: ExtracurricularPredicate = 'Baik'
): { predicate: ExtracurricularPredicate; description: string } {
  const rankMap: Record<string, number> = {
    'Sangat Baik': 4,
    Baik: 3,
    Cukup: 2,
    Kurang: 1,
  };
  const validItems = tpScores.filter((x) => x.objective.trim().length > 0 && x.predicate.trim().length > 0);
  if (validItems.length === 0) {
    return {
      predicate: fallbackPredicate,
      description: `Ananda ${fallbackPredicate.toLowerCase()} dalam berpartisipasi aktif pada kegiatan ekstrakurikuler.`,
    };
  }

  let sumRank = 0;
  const clauses: string[] = [];
  for (const item of validItems) {
    const pred = (item.predicate || fallbackPredicate) as ExtracurricularPredicate;
    sumRank += rankMap[pred] ?? 3;
    const objClean = item.objective.trim().replace(/\.$/, '');
    const objLower = objClean.charAt(0).toLowerCase() + objClean.slice(1);
    clauses.push(`${pred.toLowerCase()} dalam ${objLower}`);
  }

  const avg = sumRank / validItems.length;
  let overall: ExtracurricularPredicate = 'Baik';
  if (avg >= 3.5) overall = 'Sangat Baik';
  else if (avg >= 2.5) overall = 'Baik';
  else if (avg >= 1.5) overall = 'Cukup';
  else overall = 'Kurang';

  return {
    predicate: overall,
    description: `Ananda ${joinIndonesianPhrases(clauses)}.`,
  };
}
