'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Floorplan, { cropAspect } from '@/components/Floorplan.jsx';
import { api } from '@/lib/apiClient.js';
import { clamp01, round } from '@/lib/num.js';
import { cropFromTour } from '@/lib/floorplan.js';

// Tour-level minimap editor.
//
// Two modes:
//   - view: pins are <Link>s. Click navigates into a scene's admin page. No
//     drag — that kept fighting the browser's native anchor-drag.
//   - edit: pins become <button>s, drag-to-reposition is active. Changes stay
//     local until "Save minimap"; "Cancel" reverts to the last server state.
//
// Persisting only on Save (not on every drop) lets admins drag several pins,
// inspect the layout, then commit — same model as the rest of the form panels.

export default function TourMinimapEditor({ tour, scenes: initialScenes }) {
  const innerRef = useRef(null);

  // Server-truth positions. Used to compute "dirty" and to revert on cancel.
  const baseline = useMemo(
    () => Object.fromEntries(initialScenes.map((s) => [s.id, { x: s.minimapX, y: s.minimapY }])),
    [initialScenes]
  );

  const [mode, setMode] = useState('view');
  const [positions, setPositions] = useState(baseline);
  const [dragging, setDragging] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Re-sync when the page revalidates after a save / scene add / delete.
  useEffect(() => {
    setPositions(baseline);
  }, [baseline]);

  const dirty = useMemo(() => {
    for (const s of initialScenes) {
      const p = positions[s.id];
      if (!p) continue;
      if (p.x !== s.minimapX || p.y !== s.minimapY) return true;
    }
    return false;
  }, [positions, initialScenes]);

  const startDrag = (sceneId) => (e) => {
    if (mode !== 'edit') return;
    e.preventDefault();
    e.stopPropagation();
    const p = e.touches ? e.touches[0] : e;
    setDragging({ sceneId, startX: p.clientX, startY: p.clientY, moved: false });
  };

  useEffect(() => {
    if (!dragging) return;
    const move = (e) => {
      const rect = innerRef.current?.getBoundingClientRect();
      if (!rect) return;
      // For touchmove we need to call preventDefault to stop page scrolling.
      if (e.cancelable) e.preventDefault();
      const p = e.touches ? e.touches[0] : e;
      const x = clamp01((p.clientX - rect.left) / rect.width);
      const y = clamp01((p.clientY - rect.top) / rect.height);
      setDragging((d) => (d ? { ...d, moved: true } : d));
      setPositions((all) => ({ ...all, [dragging.sceneId]: { x: round(x), y: round(y) } }));
    };
    const end = () => setDragging(null);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', end);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', end);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', end);
    };
  }, [dragging]);

  const onSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      // Only send positions that actually changed. One transactional round-trip
      // via /scenes/positions, not N PATCHes per scene.
      const changed = initialScenes
        .filter((s) => {
          const p = positions[s.id];
          return p && (p.x !== s.minimapX || p.y !== s.minimapY);
        })
        .map((s) => ({ id: s.id, minimapX: positions[s.id].x, minimapY: positions[s.id].y }));
      if (changed.length > 0) {
        await api.updateScenePositions(tour.id, changed);
      }
      setMode('view');
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const onCancel = () => {
    setPositions(baseline);
    setSaveError(null);
    setMode('view');
  };

  if (!tour.floorplanUrl) {
    return (
      <div className="admin__panel">
        <h2 className="admin__panel-title">Minimap</h2>
        <div className="picker picker--empty">
          <span className="picker__hint">
            Upload a floorplan above to enable the minimap. Each scene's dot will appear here once
            it's set.
          </span>
        </div>
      </div>
    );
  }

  const floorplan = {
    image: tour.floorplanUrl,
    crop: cropFromTour(tour),
  };
  const aspect = cropAspect(floorplan.crop);

  return (
    <div className="admin__panel">
      <div className="admin__panel-header">
        <h2 className="admin__panel-title">Minimap</h2>
        <div className="admin__list-actions">
          {mode === 'view' ? (
            <>
              <span className="picker__hint">Click a dot to open that scene</span>
              <button type="button" className="btn btn--ghost" onClick={() => setMode('edit')}>
                Edit positions
              </button>
            </>
          ) : (
            <>
              <span className="picker__hint">Drag a dot to reposition</span>
              <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={saving}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={onSave}
                disabled={saving || !dirty}
              >
                {saving ? 'Saving…' : 'Save minimap'}
              </button>
            </>
          )}
        </div>
      </div>

      {saveError && <div className="admin__error">{saveError}</div>}

      <div className="picker">
        <div
          ref={innerRef}
          className={`picker__inner picker__inner--large ${mode === 'edit' ? 'is-editing' : ''}`}
          style={{ aspectRatio: aspect }}
          aria-label="Tour floorplan with scene markers"
        >
          <Floorplan floorplan={floorplan} className="picker__img" />
          {initialScenes.map((s, i) => {
            const p = positions[s.id] || { x: s.minimapX, y: s.minimapY };
            const isActive = dragging?.sceneId === s.id;
            const style = { left: `${p.x * 100}%`, top: `${p.y * 100}%` };
            const pinClass = `picker__pin ${isActive ? 'is-dragging' : ''}`;
            const inner = (
              <>
                <span className="picker__pin-num">{i + 1}</span>
                <span className="picker__pin-tip" role="tooltip">{s.title}</span>
              </>
            );
            // In edit mode use a plain button so the browser doesn't try to
            // start a native link-drag with the anchor's URL.
            return mode === 'edit' ? (
              <button
                key={s.id}
                type="button"
                draggable={false}
                onMouseDown={startDrag(s.id)}
                onTouchStart={startDrag(s.id)}
                className={pinClass}
                style={style}
                aria-label={s.title}
              >
                {inner}
              </button>
            ) : (
              <Link
                key={s.id}
                href={`/admin/scene/${s.id}`}
                draggable={false}
                className={pinClass}
                style={style}
                aria-label={s.title}
              >
                {inner}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

