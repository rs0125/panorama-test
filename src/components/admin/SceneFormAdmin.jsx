'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/apiClient.js';
import UploadField from './UploadField.jsx';
import MinimapPicker from './MinimapPicker.jsx';

function cropFromTour(tour) {
  const { floorplanCropX: x, floorplanCropY: y, floorplanCropW: w, floorplanCropH: h } = tour;
  if (x == null || y == null || w == null || h == null) return { x: 0, y: 0, w: 1, h: 1 };
  return { x, y, w, h };
}

export default function SceneFormAdmin({ initialScene, siblings = [] }) {
  const router = useRouter();
  const [form, setForm] = useState({
    slug: initialScene.slug,
    title: initialScene.title,
    imageUrl: initialScene.imageUrl ?? '',
    previewUrl: initialScene.previewUrl ?? '',
    audioUrl: initialScene.audioUrl ?? '',
    minimapX: initialScene.minimapX,
    minimapY: initialScene.minimapY,
  });
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);

  const setField = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const onSave = async (e) => {
    e.preventDefault();
    setStatus('saving');
    setError(null);
    try {
      await api.updateScene(initialScene.id, {
        ...form,
        previewUrl: form.previewUrl || null,
        audioUrl: form.audioUrl || null,
        minimapX: Number(form.minimapX),
        minimapY: Number(form.minimapY),
      });
      setStatus('saved');
      router.refresh();
      setTimeout(() => setStatus(null), 1200);
    } catch (err) {
      setError(err.message);
      setStatus(null);
    }
  };

  const floorplan = initialScene.tour?.floorplanUrl
    ? {
        image: initialScene.tour.floorplanUrl,
        crop: cropFromTour(initialScene.tour),
      }
    : null;

  return (
    <form className="admin__panel admin__form" onSubmit={onSave}>
      <h2 className="admin__panel-title">Scene metadata</h2>

      <div className="field-row">
        <label className="field">
          <span className="field__label">Title</span>
          <input
            className="field__input"
            value={form.title}
            onChange={(e) => setField('title')(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span className="field__label">Slug</span>
          <input
            className="field__input"
            value={form.slug}
            onChange={(e) => setField('slug')(e.target.value)}
          />
        </label>
      </div>

      <div className="field">
        <span className="field__label">Position on floorplan</span>
        <MinimapPicker
          floorplan={floorplan}
          siblings={siblings}
          value={{ x: form.minimapX, y: form.minimapY }}
          onChange={({ x, y }) => setForm((f) => ({ ...f, minimapX: x, minimapY: y }))}
          activeTitle={form.title}
        />
      </div>

      <UploadField
        label="Pano image (equirectangular)"
        kind="pano"
        accept="image/*"
        value={form.imageUrl}
        onUploaded={setField('imageUrl')}
      />
      <UploadField
        label="Preview image (small / blurred fallback)"
        kind="preview"
        accept="image/*"
        value={form.previewUrl}
        onUploaded={setField('previewUrl')}
        onClear={() => setField('previewUrl')('')}
      />
      <UploadField
        label="Audio narration (optional)"
        kind="audio"
        accept="audio/*"
        value={form.audioUrl}
        onUploaded={setField('audioUrl')}
        onClear={() => setField('audioUrl')('')}
      />

      {error && <div className="admin__error">{error}</div>}

      <div className="admin__form-actions">
        <button type="submit" className="btn btn--primary" disabled={status === 'saving'}>
          {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
