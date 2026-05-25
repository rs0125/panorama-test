// Thin wrapper around the ElevenLabs HTTP API. Server-only — never expose
// ELEVENLABS_API_KEY to the browser. Admin TTS routes proxy through this so
// the key stays on our backend.
//
// Reference: https://elevenlabs.io/docs/api-reference

const BASE = 'https://api.elevenlabs.io';

function apiKey() {
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k) throw new Error('ELEVENLABS_API_KEY is not set');
  return k;
}

async function elFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'xi-api-key': apiKey(),
      ...(opts.body && !opts.headers?.['Content-Type']
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...opts.headers,
    },
  });
  if (!res.ok) {
    let detail;
    try {
      detail = await res.text();
    } catch {
      detail = '';
    }
    const err = new Error(
      `ElevenLabs ${res.status} ${res.statusText}${detail ? ': ' + detail.slice(0, 300) : ''}`
    );
    err.status = res.status;
    throw err;
  }
  return res;
}

export async function listVoices() {
  const res = await elFetch('/v1/voices');
  const data = await res.json();
  // Slim payload — UI just needs voice_id + a label.
  return (data.voices || []).map((v) => ({
    voiceId: v.voice_id,
    name: v.name,
    category: v.category,
    description: v.description || null,
    labels: v.labels || null,
    previewUrl: v.preview_url || null,
  }));
}

export async function listModels() {
  const res = await elFetch('/v1/models');
  const data = await res.json();
  // ElevenLabs returns a plain array. Keep only fields we actually display.
  return (Array.isArray(data) ? data : []).map((m) => ({
    modelId: m.model_id,
    name: m.name,
    description: m.description || null,
    canDoTextToSpeech: m.can_do_text_to_speech !== false,
    languages: (m.languages || []).map((l) => l.name).filter(Boolean),
  }));
}

// Returns the audio bytes (Buffer) and content-type.
// output_format: see https://elevenlabs.io/docs/api-reference/text-to-speech
// mp3_44100_128 is a sane default for narration (small, broadly compatible).
export async function synthesize({ text, voiceId, modelId, outputFormat = 'mp3_44100_128' }) {
  if (!text?.trim()) throw new Error('text is required');
  if (!voiceId) throw new Error('voiceId is required');
  if (!modelId) throw new Error('modelId is required');

  const res = await elFetch(
    `/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${encodeURIComponent(outputFormat)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: modelId }),
    }
  );
  const arrayBuf = await res.arrayBuffer();
  const contentType = res.headers.get('content-type') || mimeFromFormat(outputFormat);
  return { buffer: Buffer.from(arrayBuf), contentType };
}

function mimeFromFormat(fmt) {
  if (fmt.startsWith('mp3')) return 'audio/mpeg';
  if (fmt.startsWith('pcm')) return 'audio/wav';
  if (fmt.startsWith('ulaw') || fmt.startsWith('alaw')) return 'audio/basic';
  return 'application/octet-stream';
}
