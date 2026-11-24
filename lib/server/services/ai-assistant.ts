import { GoogleGenAI } from '@google/genai';

function createGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function isGeminiConfigured(): boolean {
  const apiKey = process.env.GEMINI_API_KEY;
  return Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY');
}

export async function generateEducationalDraft(params: {
  taskType: 'tp' | 'rpm' | 'deskripsi_capaian' | 'remedial';
  subjectName: string;
  gradeLevel: number;
  fase: string;
  topic: string;
  cpText?: string;
  dimensions?: string[];
  scoreBand?: string;
}): Promise<{ text: string; model: string }> {
  const ai = createGeminiClient();
  if (!ai) {
    throw new Error(
      'Layanan AI belum aktif atau kunci GEMINI_API_KEY belum disetel pada lingkungan server. Anda tetap dapat menyusun draf secara manual dan luring.'
    );
  }

  const systemInstruction =
    'Anda adalah asisten pedagogis Kurikulum Merdeka Indonesia untuk jenjang Sekolah Dasar (SD/MI). Selalu gunakan Bahasa Indonesia baku yang komunikatif, jelas, dan siap disunting oleh guru. Jangan menyertakan data pribadi murid.';

  let prompt = '';
  if (params.taskType === 'tp') {
    prompt = `Susun 3 draf Tujuan Pembelajaran (TP) dan indikator ketercapaian untuk mata pelajaran ${params.subjectName} Kelas ${params.gradeLevel} (Fase ${params.fase}) dengan lingkup materi "${params.topic}". ${params.cpText ? `Acuan CP: ${params.cpText}` : ''}`;
  } else if (params.taskType === 'rpm') {
    prompt = `Buat draf Rencana Pembelajaran Mendalam (RPM) ringkas dan terstruktur untuk mata pelajaran ${params.subjectName} Kelas ${params.gradeLevel} (Fase ${params.fase}), topik "${params.topic}". Dimensi Profil Lulusan: ${(params.dimensions || ['Penalaran Kritis', 'Kolaborasi']).join(', ')}. Susun menjadi bagian: 1) Identifikasi, 2) Desain Pembelajaran, 3) Pengalaman Belajar (Memahami, Mengaplikasi, Merefleksi), dan 4) Asesmen Pembelajaran.`;
  } else if (params.taskType === 'remedial') {
    prompt = `Berikan saran strategi pembelajaran remedial dan pengayaan singkat untuk topik "${params.topic}" pada mata pelajaran ${params.subjectName} Kelas ${params.gradeLevel} (Fase ${params.fase}).`;
  } else {
    prompt = `Susun 2 variasi draf kalimat deskripsi capaian kompetensi rapor Kurikulum Merdeka (tanpa menyebut nama asli murid, gunakan kata "Ananda") untuk mata pelajaran ${params.subjectName} Kelas ${params.gradeLevel} topik "${params.topic}" dengan kategori capaian "${params.scoreBand || 'Baik'}".`;
  }

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: prompt,
    config: {
      systemInstruction,
    },
  });

  const text = response.text?.trim();
  if (!text) {
    throw new Error('Model AI tidak mengembalikan teks draf. Silakan coba kembali.');
  }

  return { text, model: 'gemini-4-hydrogen' };
}
