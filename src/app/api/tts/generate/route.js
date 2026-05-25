import { jsonError, readJson } from '@/lib/http.js';
import { synthesize } from '@/lib/elevenlabs.js';
import { generateObjectKey, uploadBufferToR2 } from '@/lib/r2.js';

// One-shot: synthesise via ElevenLabs and stash the result in R2 under the
// 'audio' prefix so the scene's audioUrl is a normal CDN URL like uploaded
// files. The browser never sees the raw audio bytes — they go server → R2
// directly — which keeps response size small and avoids re-uploading.
//
// Request JSON: { text, voiceId, modelId, outputFormat? }
// Response JSON: { url, key, contentType, bytes }

const MAX_TEXT = 5000; // soft cap; ElevenLabs has its own per-model limits

export async function POST(req) {
  const body = await readJson(req);
  if (!body) return jsonError('invalid JSON');
  if (!body.text?.trim()) return jsonError('text is required');
  if (body.text.length > MAX_TEXT) return jsonError(`text exceeds ${MAX_TEXT} characters`, 413);
  if (!body.voiceId) return jsonError('voiceId is required');
  if (!body.modelId) return jsonError('modelId is required');

  try {
    const { buffer, contentType } = await synthesize({
      text: body.text,
      voiceId: body.voiceId,
      modelId: body.modelId,
      outputFormat: body.outputFormat || 'mp3_44100_128',
    });

    const ext = contentType.startsWith('audio/mpeg') ? '.mp3' : '.bin';
    const key = generateObjectKey({ prefix: 'audio', filename: `tts${ext}` });
    const { url } = await uploadBufferToR2({ key, body: buffer, contentType });

    return Response.json({ url, key, contentType, bytes: buffer.byteLength });
  } catch (err) {
    console.error('[tts/generate]', err);
    return jsonError(err.message || 'tts failed', err.status === 401 ? 401 : 502);
  }
}
