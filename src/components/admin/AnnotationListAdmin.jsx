'use client';

import { useState } from 'react';
import { api } from '@/lib/apiClient.js';

// One row in the annotation list. Owns its own draft state and saves on blur
// (or when the user clicks "Save row") so editing a single field doesn't
// trigger a server round-trip on every keystroke.
function Row({ annotation, onChange, onDelete }) {
  const [draft, setDraft] = useState({
    title: annotation.title ?? '',
    body: annotation.body ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const dirty =
    (draft.title ?? '') !== (annotation.title ?? '') ||
    (draft.body ?? '') !== (annotation.body ?? '');

  const save = async () => {
    if (!dirty) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api.updateAnnotation(annotation.id, {
        title: draft.title || null,
        body: draft.body || null,
      });
      onChange(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="annotation">
      <div className="field-row">
        <label className="field">
          <span className="field__label">Title</span>
          <input
            className="field__input"
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            onBlur={save}
            placeholder="e.g. Location"
          />
        </label>
        <button
          type="button"
          className="btn btn--ghost btn--danger annotation__delete"
          onClick={() => onDelete(annotation.id)}
        >
          Delete
        </button>
      </div>
      <label className="field">
        <span className="field__label">Body</span>
        <textarea
          className="field__input field__input--multiline"
          rows={2}
          value={draft.body}
          onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
          onBlur={save}
          placeholder="Caption text shown in the info panel."
        />
      </label>
      <div className="annotation__status">
        {error && <span className="admin__error">{error}</span>}
        {!error && busy && <span className="annotation__hint">Saving…</span>}
        {!error && !busy && dirty && <span className="annotation__hint">Unsaved</span>}
      </div>
    </div>
  );
}

export default function AnnotationListAdmin({ sceneId, initialAnnotations }) {
  const [items, setItems] = useState(initialAnnotations);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const onAdd = async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await api.createAnnotation(sceneId, { title: '', body: '' });
      setItems((xs) => [...xs, created]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (id) => {
    if (!confirm('Delete this caption?')) return;
    try {
      await api.deleteAnnotation(id);
      setItems((xs) => xs.filter((a) => a.id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  const onChange = (updated) => {
    setItems((xs) => xs.map((a) => (a.id === updated.id ? updated : a)));
  };

  return (
    <div className="admin__panel">
      <div className="admin__panel-header">
        <h2 className="admin__panel-title">Captions</h2>
        <button type="button" className="btn btn--primary" onClick={onAdd} disabled={busy}>
          + Add caption
        </button>
      </div>
      {error && <div className="admin__error">{error}</div>}
      {items.length === 0 ? (
        <div className="admin__empty">No captions yet.</div>
      ) : (
        <div className="annotation-list">
          {items.map((a) => (
            <Row key={a.id} annotation={a} onChange={onChange} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
