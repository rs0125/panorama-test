'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/apiClient.js';
import { MAX_TTS_CHARS } from '@/lib/limits.js';

// Inline ElevenLabs TTS generator. Shown beneath the audio UploadField so the
// admin can either upload a file *or* type a script and pick a voice/model.
// Voices and models are loaded lazily on first reveal — they're a network hop
// per page render, no point fetching unless the admin opens the panel.

const DEFAULT_MODEL_PREFERENCE = [
  'eleven_multilingual_v2', // high-quality general default
  'eleven_turbo_v2_5',
  'eleven_flash_v2_5',
];

export default function TtsPanel({ onGenerated, disabled }) {
  const [voices, setVoices] = useState(null);
  const [models, setModels] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [voiceId, setVoiceId] = useState('');
  const [modelId, setModelId] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ voices: vs }, { models: ms }] = await Promise.all([
          api.ttsVoices(),
          api.ttsModels(),
        ]);
        if (cancelled) return;
        setVoices(vs);
        setModels(ms);
        // Pick sensible defaults: first voice, preferred model if available.
        if (vs[0]) setVoiceId(vs[0].voiceId);
        const preferred =
          DEFAULT_MODEL_PREFERENCE.map((id) => ms.find((m) => m.modelId === id)).find(Boolean) ||
          ms[0];
        if (preferred) setModelId(preferred.modelId);
      } catch (err) {
        if (!cancelled) setLoadErr(err.message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const canGenerate = !busy && !disabled && voiceId && modelId && text.trim().length > 0;

  const onGenerate = async () => {
    setBusy(true);
    setError(null);
    try {
      const { url } = await api.ttsGenerate({ text: text.trim(), voiceId, modelId });
      onGenerated?.(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loadErr) {
    return (
      <div className="tts__panel">
        <div className="upload__error">
          Couldn't load ElevenLabs voices/models: {loadErr}.
          {' '}
          <span className="picker__hint">
            Check that ELEVENLABS_API_KEY is set in the server's .env.
          </span>
        </div>
      </div>
    );
  }

  if (!voices || !models) {
    return (
      <div className="tts__panel">
        <span className="picker__hint">Loading voices and models…</span>
      </div>
    );
  }

  return (
    <div className="tts__panel">
      <div className="field-row">
        <label className="field">
          <span className="field__label">Voice</span>
          <select
            className="field__input"
            value={voiceId}
            onChange={(e) => setVoiceId(e.target.value)}
            disabled={busy || disabled}
          >
            {voices.map((v) => (
              <option key={v.voiceId} value={v.voiceId}>
                {v.name}{v.category ? ` · ${v.category}` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Model</span>
          <select
            className="field__input"
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            disabled={busy || disabled}
          >
            {models.map((m) => (
              <option key={m.modelId} value={m.modelId}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="field">
        <span className="field__label">Script</span>
        <textarea
          className="field__input field__input--multiline"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          maxLength={MAX_TTS_CHARS}
          placeholder="Type the narration script. Punctuation guides pacing."
          disabled={busy || disabled}
        />
        <span className="field__hint">
          {text.length} / {MAX_TTS_CHARS} chars
        </span>
      </label>

      {error && <div className="upload__error">{error}</div>}

      <div className="admin__form-actions">
        <button
          type="button"
          className="btn btn--primary"
          onClick={onGenerate}
          disabled={!canGenerate}
        >
          {busy ? 'Generating…' : 'Generate & attach'}
        </button>
      </div>
    </div>
  );
}
