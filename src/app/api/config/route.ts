export const runtime = 'nodejs';

export async function GET() {
  return Response.json({
    speachesBaseUrl: process.env.SPEACHES_BASE_URL ?? 'http://10.61.46.95:10300',
    speachesTranscribeModel:
      process.env.SPEACHES_TRANSCRIBE_MODEL ?? 'Systran/faster-whisper-large-v3',
    speachesTranscribeLanguage: process.env.SPEACHES_TRANSCRIBE_LANGUAGE ?? 'zh'
  });
}
