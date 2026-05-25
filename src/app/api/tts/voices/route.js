import { jsonError } from '@/lib/http.js';
import { listVoices } from '@/lib/elevenlabs.js';

// Admin-only — gated by middleware.js along with everything under /api/.
// Returns the trimmed voice list for populating the TTS voice dropdown.

export async function GET() {
  try {
    const voices = await listVoices();
    return Response.json({ voices });
  } catch (err) {
    console.error('[tts/voices]', err);
    return jsonError(err.message || 'failed to list voices', err.status === 401 ? 401 : 502);
  }
}
