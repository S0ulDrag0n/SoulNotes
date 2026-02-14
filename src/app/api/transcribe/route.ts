export const runtime = 'nodejs';

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get('file');

  if (!file || !(file instanceof Blob)) {
    return new Response('Missing audio file', { status: 400 });
  }

  const speechBaseUrl = process.env.SPEACHES_BASE_URL ?? 'http://10.61.46.95:10300';
  const speechEndpoint = '/v1/audio/transcriptions';
  const speechModel =
    process.env.SPEACHES_TRANSCRIBE_MODEL ?? 'Systran/faster-whisper-large-v3';
  const speechLanguage = process.env.SPEACHES_TRANSCRIBE_LANGUAGE;

  const upstreamForm = new FormData();
  upstreamForm.append('file', file, 'audio.webm');
  upstreamForm.append('model', speechModel);

  if (speechLanguage) {
    upstreamForm.append('language', speechLanguage);
  }

  const upstreamUrl = new URL(speechEndpoint, speechBaseUrl).toString();
  const upstreamResponse = await fetch(upstreamUrl, {
    method: 'POST',
    body: upstreamForm,
  });

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: {
      'Content-Type': upstreamResponse.headers.get('Content-Type') ?? 'text/plain',
    },
  });
}
