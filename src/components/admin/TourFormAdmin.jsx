'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/apiClient.js';
import UploadField from './UploadField.jsx';
import FloorplanCropEditor from './FloorplanCropEditor.jsx';

export default function TourFormAdmin({ initialTour }) {
  const router = useRouter();
  const [form, setForm] = useState({
    slug: initialTour.slug,
    title: initialTour.title,
    description: initialTour.description ?? '',
    location: initialTour.location ?? '',
    coverUrl: initialTour.coverUrl ?? '',
    floorplanUrl: initialTour.floorplanUrl ?? '',
    floorplanCropX: initialTour.floorplanCropX ?? 0,
    floorplanCropY: initialTour.floorplanCropY ?? 0,
    floorplanCropW: initialTour.floorplanCropW ?? 1,
    floorplanCropH: initialTour.floorplanCropH ?? 1,
  });
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);

  const setField = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const onSave = async (e) => {
    e.preventDefault();
    setStatus('saving');
    setError(null);
    try {
      // Crop fields are meaningful only when a floorplan is present; null
      // them out otherwise so we don't carry a stale rectangle on disk.
      const hasFloorplan = Boolean(form.floorplanUrl);
      const payload = {
        ...form,
        description: form.description || null,
        location: form.location || null,
        coverUrl: form.coverUrl || null,
        floorplanUrl: form.floorplanUrl || null,
        floorplanCropX: hasFloorplan ? form.floorplanCropX : null,
        floorplanCropY: hasFloorplan ? form.floorplanCropY : null,
        floorplanCropW: hasFloorplan ? form.floorplanCropW : null,
        floorplanCropH: hasFloorplan ? form.floorplanCropH : null,
      };
      const updated = await api.updateTour(initialTour.id, payload);
      setStatus('saved');
      // If slug changed, the URL changes too — push to the new id-based route stays valid either way.
      if (updated.slug !== initialTour.slug) router.refresh();
      setTimeout(() => setStatus(null), 1200);
    } catch (err) {
      setError(err.message);
      setStatus(null);
    }
  };

  return (
    <form className="admin__panel admin__form" onSubmit={onSave}>
      <h2 className="admin__panel-title">Tour metadata</h2>

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

      <label className="field">
        <span className="field__label">Location</span>
        <input
          className="field__input"
          value={form.location}
          onChange={(e) => setField('location')(e.target.value)}
          placeholder="e.g. Attibele, Bangalore"
        />
      </label>

      <label className="field">
        <span className="field__label">Description</span>
        <textarea
          className="field__input field__input--multiline"
          value={form.description}
          onChange={(e) => setField('description')(e.target.value)}
          rows={3}
          placeholder="One-liner shown on the homepage card."
        />
      </label>

      <UploadField
        label="Cover image"
        kind="cover"
        accept="image/*"
        value={form.coverUrl}
        onUploaded={setField('coverUrl')}
        onClear={() => setField('coverUrl')('')}
      />

      <h3 className="admin__panel-subtitle">Floorplan</h3>
      <UploadField
        label="Floorplan image"
        kind="floorplan"
        accept="image/*"
        value={form.floorplanUrl}
        onUploaded={(url) => setForm((f) => ({
          ...f,
          floorplanUrl: url,
          // New image → reset crop so the previous rectangle (for the old
          // image) doesn't land in a weird spot on the new one.
          floorplanCropX: 0,
          floorplanCropY: 0,
          floorplanCropW: 1,
          floorplanCropH: 1,
        }))}
        onClear={() => setForm((f) => ({
          ...f,
          floorplanUrl: '',
          floorplanCropX: 0,
          floorplanCropY: 0,
          floorplanCropW: 1,
          floorplanCropH: 1,
        }))}
      />
      <label className="field">
        <span className="field__label">Minimap crop</span>
        <FloorplanCropEditor
          imageUrl={form.floorplanUrl}
          value={{
            x: form.floorplanCropX,
            y: form.floorplanCropY,
            w: form.floorplanCropW,
            h: form.floorplanCropH,
          }}
          onChange={({ x, y, w, h }) =>
            setForm((f) => ({
              ...f,
              floorplanCropX: x,
              floorplanCropY: y,
              floorplanCropW: w,
              floorplanCropH: h,
            }))
          }
        />
      </label>

      {error && <div className="admin__error">{error}</div>}

      <div className="admin__form-actions">
        <button type="submit" className="btn btn--primary" disabled={status === 'saving'}>
          {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
