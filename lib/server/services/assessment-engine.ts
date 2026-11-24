export interface WeightConfig {
  weightLm: number;
  weightSts: number;
  weightSas: number;
  kktpMin: number;
}

export interface RawScoreComponents {
  lm1?: number | null;
  lm2?: number | null;
  lm3?: number | null;
  lm4?: number | null;
  sts?: number | null;
  sas?: number | null;
  remedialScore?: number | null;
}

export interface ScoreBreakdown {
  lmValues: number[];
  lmAverage: number | null;
  effectiveLm: number | null;
  midtermScore: number | null;
  finalScore: number | null;
  kktpPassed: boolean | null;
  formulaDescription: string;
}

export function calculateSummativeScores(
  scores: RawScoreComponents,
  weights: WeightConfig = { weightLm: 40, weightSts: 30, weightSas: 30, kktpMin: 75 }
): ScoreBreakdown {
  const lmValues = [scores.lm1, scores.lm2, scores.lm3, scores.lm4].filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v)
  );

  const lmAverage =
    lmValues.length > 0
      ? Number((lmValues.reduce((acc, v) => acc + v, 0) / lmValues.length).toFixed(2))
      : null;

  // Remedial raises effective LM average up to KKTP if higher than raw LM average
  const effectiveLm =
    lmAverage !== null && typeof scores.remedialScore === 'number'
      ? Math.max(lmAverage, Math.min(scores.remedialScore, Math.max(weights.kktpMin, lmAverage)))
      : lmAverage;

  const sts = typeof scores.sts === 'number' && Number.isFinite(scores.sts) ? scores.sts : null;
  const sas = typeof scores.sas === 'number' && Number.isFinite(scores.sas) ? scores.sas : null;

  let midtermScore: number | null = null;
  const midtermDenom = weights.weightLm + weights.weightSts;
  if (effectiveLm !== null && sts !== null && midtermDenom > 0) {
    midtermScore = Number(
      ((effectiveLm * weights.weightLm + sts * weights.weightSts) / midtermDenom).toFixed(2)
    );
  } else if (effectiveLm !== null && sts === null) {
    midtermScore = effectiveLm;
  } else if (sts !== null) {
    midtermScore = sts;
  }

  let finalScore: number | null = null;
  const activeParts: Array<{ val: number; weight: number }> = [];
  if (effectiveLm !== null && weights.weightLm > 0) {
    activeParts.push({ val: effectiveLm, weight: weights.weightLm });
  }
  if (sts !== null && weights.weightSts > 0) {
    activeParts.push({ val: sts, weight: weights.weightSts });
  }
  if (sas !== null && weights.weightSas > 0) {
    activeParts.push({ val: sas, weight: weights.weightSas });
  }

  if (activeParts.length > 0) {
    const totalWeight = activeParts.reduce((s, p) => s + p.weight, 0);
    const weightedSum = activeParts.reduce((s, p) => s + p.val * p.weight, 0);
    finalScore = totalWeight > 0 ? Number((weightedSum / totalWeight).toFixed(2)) : null;
  }

  const kktpPassed = finalScore !== null ? finalScore >= weights.kktpMin : null;

  const formulaDescription = `(${weights.weightLm}% Rata-rata Lingkup Materi + ${weights.weightSts}% STS + ${weights.weightSas}% SAS) · KKTP ${weights.kktpMin}`;

  return {
    lmValues,
    lmAverage,
    effectiveLm,
    midtermScore,
    finalScore,
    kktpPassed,
    formulaDescription,
  };
}

export function buildCompetencyParts(params: {
  studentName: string;
  subjectName: string;
  achievedMaterials: string[];
  needsGuidanceMaterials: string[];
  finalScore: number | null;
}): { achievedText: string; needsGuidanceText: string; fullText: string } {
  const { studentName, subjectName, achievedMaterials, needsGuidanceMaterials, finalScore } = params;
  const firstName = studentName.split(' ')[0] || 'Ananda';

  let achievedText = '';
  if (achievedMaterials.length > 0) {
    const label = finalScore !== null && finalScore >= 88 ? 'sangat baik' : 'baik';
    achievedText = `Ananda ${firstName} menunjukkan penguasaan yang ${label} dalam ${achievedMaterials.slice(0, 2).join(' dan ')} pada mata pelajaran ${subjectName}.`;
  } else if (finalScore !== null) {
    const label = finalScore >= 88 ? 'sangat baik' : finalScore >= 75 ? 'baik' : 'cukup baik';
    achievedText = `Ananda ${firstName} menunjukkan capaian yang ${label} pada mata pelajaran ${subjectName}.`;
  } else {
    achievedText = `Capaian pembelajaran ${subjectName} telah tercatat.`;
  }

  let needsGuidanceText = '';
  if (needsGuidanceMaterials.length > 0) {
    needsGuidanceText = `Perlu pendampingan dan penguatan lanjutan dalam ${needsGuidanceMaterials.slice(0, 2).join(' serta ')}.`;
  }

  const fullText = [achievedText, needsGuidanceText].filter(Boolean).join(' ').trim();
  return { achievedText, needsGuidanceText, fullText };
}

export function buildCompetencyDescription(params: {
  studentName: string;
  subjectName: string;
  achievedMaterials: string[];
  needsGuidanceMaterials: string[];
  finalScore: number | null;
}): string {
  return buildCompetencyParts(params).fullText;
}
