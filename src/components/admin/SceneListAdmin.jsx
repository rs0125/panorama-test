'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/apiClient.js';
import { uploadFileToR2 } from '@/lib/uploadClient.js';

// Derive a sensible default title from an image filename.
//   "WH_Loading_Dock_North.jpg" → "Wh Loading Dock North"
// Admin can still rewrite it before hitting "Create scenes".
function titleFromFilename(name) {
  return String(name || '')
    .replace(/\.[^.]+$/, '') // strip extension
    .replace(/[_\-.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ''))
    .join(' ');
}

// Per-row state machine: idle → uploading → creating → (done | failed).
// We persist a thumbnail object URL on the row so we can preview the file
// without re-reading it; revoked on unmount/removal to avoid leaks.

let _rowKeySeq = 0;
function makeRow(file) {
  _rowKeySeq += 1;
  return {
    key: `r${Date.now()}-${_rowKeySeq}`,
    file,
    title: titleFromFilename(file.name),
    previewUrl: URL.createObjectURL(file),
    status: 'idle',
    progress: 0,
    error: null,
    sceneId: null,
  };
}

export default function SceneListAdmin({ tourId, initialScenes }) {
  const router = useRouter();
  const [scenes, setScenes] = useState(initialScenes);
  const [staging, setStaging] = useState([]);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const fileInputRef = useRef(null);

  // Drag-to-reorder state for the persisted list (unchanged from before).
  const [dragFrom, setDragFrom] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [reorderError, setReorderError] = useState(null);

  // ── Staging additions ────────────────────────────────────────────────────
  const addFiles = (files) => {
    const incoming = [...files].filter((f) => f.type.startsWith('image/'));
    if (!incoming.length) return;
    setStaging((rows) => [...rows, ...incoming.map(makeRow)]);
  };

  const updateRow = (key, patch) =>
    setStaging((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const removeRow = (key) =>
    setStaging((rows) => {
      const r = rows.find((x) => x.key === key);
      if (r?.previewUrl) URL.revokeObjectURL(r.previewUrl);
      return rows.filter((x) => x.key !== key);
    });

  const clearStaging = () => {
    staging.forEach((r) => r.previewUrl && URL.revokeObjectURL(r.previewUrl));
    setStaging([]);
  };

  // ── Bulk create ─────────────────────────────────────────────────────────
  const onCreateAll = async () => {
    if (!staging.length || busy) return;
    setBusy(true);

    // Serial — gives the admin a clear "this row is happening now" affordance,
    // avoids spiky R2/DB concurrency, and lets a failure on row N not abort
    // rows 1..N-1.
    for (const row of staging) {
      if (row.status === 'done') continue;
      try {
        updateRow(row.key, { status: 'uploading', progress: 0, error: null });
        const imageUrl = await uploadFileToR2(row.file, {
          kind: 'pano',
          onProgress: (p) => updateRow(row.key, { progress: p }),
        });
        updateRow(row.key, { status: 'creating' });
        const scene = await api.createScene(tourId, {
          title: row.title.trim() || titleFromFilename(row.file.name),
          imageUrl,
        });
        updateRow(row.key, { status: 'done', sceneId: scene.id });
        setScenes((s) => [...s, { ...scene, _count: { annotations: 0 } }]);
      } catch (err) {
        updateRow(row.key, { status: 'failed', error: err.message });
      }
    }

    setBusy(false);
    // Drop fully-successful rows; keep failed ones around so the admin can
    // fix titles and retry without re-picking files.
    setStaging((rows) => {
      const keep = rows.filter((r) => r.status !== 'done');
      rows
        .filter((r) => r.status === 'done' && r.previewUrl)
        .forEach((r) => URL.revokeObjectURL(r.previewUrl));
      return keep;
    });
    router.refresh();
  };

  // ── Drop-zone handlers ──────────────────────────────────────────────────
  const onDragOverZone = (e) => {
    e.preventDefault();
    setDrag(true);
  };
  const onDragLeaveZone = () => setDrag(false);
  const onDropZone = (e) => {
    e.preventDefault();
    setDrag(false);
    addFiles(e.dataTransfer.files);
  };
  const onPick = (e) => {
    addFiles(e.target.files || []);
    e.target.value = ''; // allow picking the same file again later
  };

  // ── Delete / drag-to-reorder of saved scenes ────────────────────────────
  const onDelete = async (id) => {
    if (!confirm('Delete this scene and its annotations/hotspots/overlays?')) return;
    try {
      await api.deleteScene(id);
      setScenes((s) => s.filter((sc) => sc.id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  const onDragStart = (idx) => (e) => {
    setDragFrom(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
  };
  const onDragOverRow = (idx) => (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOver !== idx) setDragOver(idx);
  };
  const onDragLeaveRow = (idx) => () => {
    if (dragOver === idx) setDragOver(null);
  };
  const onDragEnd = () => {
    setDragFrom(null);
    setDragOver(null);
  };
  const onDropRow = (idx) => async (e) => {
    e.preventDefault();
    const from = dragFrom;
    setDragFrom(null);
    setDragOver(null);
    if (from == null || from === idx) return;
    const prev = scenes;
    const next = [...prev];
    const [moved] = next.splice(from, 1);
    next.splice(idx, 0, moved);
    setScenes(next);
    setReorderError(null);
    try {
      await api.reorderScenes(tourId, next.map((s) => s.id));
    } catch (err) {
      setScenes(prev);
      setReorderError(err.message);
    }
  };

  const hasStaging = staging.length > 0;

  return (
    <div className="admin__panel">
      <div className="admin__panel-header">
        <h2 className="admin__panel-title">Scenes</h2>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
        >
          + Add scenes
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={onPick}
        style={{ display: 'none' }}
      />

      {/* Drop zone is always available, but its visual weight increases when
          something is being dragged over it. */}
      <div
        className={`drop-zone ${drag ? 'is-active' : ''} ${hasStaging ? 'is-compact' : ''}`}
        onDragOver={onDragOverZone}
        onDragLeave={onDragLeaveZone}
        onDrop={onDropZone}
      >
        <div className="drop-zone__hint">
          Drop pano images here, or{' '}
          <button
            type="button"
            className="drop-zone__pick"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
          >
            browse
          </button>
          . Multiple files welcome.
        </div>
      </div>

      {hasStaging && (
        <div className="staging">
          <ul className="staging__list">
            {staging.map((r) => (
              <li key={r.key} className={`staging__row status-${r.status}`}>
                <img className="staging__thumb" src={r.previewUrl} alt="" />
                <div className="staging__main">
                  <input
                    className="field__input staging__title"
                    value={r.title}
                    onChange={(e) => updateRow(r.key, { title: e.target.value })}
                    placeholder="Scene title"
                    disabled={busy && r.status !== 'failed'}
                  />
                  <div className="staging__meta">
                    <span className="staging__file" title={r.file.name}>
                      {r.file.name}
                    </span>
                    <StatusBadge row={r} />
                  </div>
                  {r.status === 'uploading' && (
                    <div className="upload__progress" style={{ marginTop: 6 }}>
                      <div
                        className="upload__progress-bar"
                        style={{ width: `${Math.round(r.progress * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
                {r.status !== 'uploading' && r.status !== 'creating' && (
                  <button
                    type="button"
                    className="btn btn--ghost btn--danger staging__rm"
                    onClick={() => removeRow(r.key)}
                    aria-label="Remove from queue"
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>

          <div className="staging__actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={clearStaging}
              disabled={busy}
            >
              Clear queue
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={onCreateAll}
              disabled={busy || staging.every((r) => r.status === 'done')}
            >
              {busy ? 'Creating…' : `Create ${staging.length} scene${staging.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      )}

      {reorderError && <div className="admin__error">{reorderError}</div>}

      {scenes.length === 0 ? (
        <div className="admin__empty">No scenes yet.</div>
      ) : (
        <ul className="admin__list">
          {scenes.map((s, i) => {
            const isDragging = dragFrom === i;
            const isOver = dragOver === i && dragFrom !== i;
            return (
              <li
                key={s.id}
                className={`admin__list-item admin__list-item--draggable ${isDragging ? 'is-dragging' : ''} ${isOver ? 'is-drop-target' : ''}`}
                draggable
                onDragStart={onDragStart(i)}
                onDragOver={onDragOverRow(i)}
                onDragLeave={onDragLeaveRow(i)}
                onDrop={onDropRow(i)}
                onDragEnd={onDragEnd}
              >
                <span className="admin__drag-handle" aria-hidden="true">⠿</span>
                <div
                  className="admin__list-thumb"
                  style={{ backgroundImage: `url('${s.previewUrl || s.imageUrl}')` }}
                />
                <div className="admin__list-main">
                  <Link href={`/admin/scene/${s.id}`} className="admin__list-title">
                    {s.title}
                  </Link>
                  <div className="admin__list-meta">
                    /{s.slug} · {s._count?.annotations ?? 0} captions{s.audioUrl ? ' · audio' : ''}
                  </div>
                </div>
                <div className="admin__list-actions">
                  <Link href={`/admin/scene/${s.id}`} className="btn btn--ghost">Edit</Link>
                  <button type="button" className="btn btn--ghost btn--danger" onClick={() => onDelete(s.id)}>
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StatusBadge({ row }) {
  switch (row.status) {
    case 'uploading':
      return <span className="staging__badge staging__badge--working">{Math.round(row.progress * 100)}% upload</span>;
    case 'creating':
      return <span className="staging__badge staging__badge--working">Creating…</span>;
    case 'done':
      return <span className="staging__badge staging__badge--ok">Created</span>;
    case 'failed':
      return <span className="staging__badge staging__badge--err" title={row.error}>Failed</span>;
    default:
      return null;
  }
}
