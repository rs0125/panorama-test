import { jsonError } from '@/lib/http.js';
import { listModels } from '@/lib/elevenlabs.js';

export async function GET() {
  try {
    const models = (await listModels()).filter((m) => m.canDoTextToSpeech);
    return Response.json({ models });
  } catch (err) {
    console.error('[tts/models]', err);
    return jsonError(err.message || 'failed to list models', err.status === 401 ? 401 : 502);
  }
}
