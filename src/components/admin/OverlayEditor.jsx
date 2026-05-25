'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/apiClient.js';
import {
  overlayHotspots,
  drawLineOverlays,
  removeLineLayer,
  pannellumIdsForOverlay,
} from '@/lib/overlayRendering.js';

// Overlay editor — text labels + double-arrow dimension lines.
//
// Workflow:
//   - "+ Add text" → click once in pano to place a text overlay.
//   - "+ Add line" → click twice in pano to place a line (start, end).
//   - Each overlay has an inline editable label and a delete button.
//   - Creates/edits/deletes fire immediately and update the viewer in-place
//     via Pannellum's addHotSpot / removeHotSpot — no full rebuild.
//
// We also draw the SVG line layer here (same helpers as the public viewer)
// so the admin's preview matches exactly what the customer will see.

const SCENE_KEY = 'overlay-editor'; // single-scene viewer, fixed scene id.

function waitForPannellum() {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.pannellum) return resolve(window.pannellum);
    const t = setInterval(() => {
      if (window.pannellum) { clearInterval(t); resolve(window.pannellum); }
    }, 30);
  });
}

const round = (v) => Math.round(v * 100) / 100;

export default function OverlayEditor({ sceneId, imageUrl, initialOverlays = [] }) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const ready = useRef(false);

  const [overlays, setOverlays] = useState(initialOverlays);
  const [arm, setArm] = useState(null); // null | 'text' | 'line-first' | 'line-second'
  const [pendingLineStart, setPendingLineStart] = useState(null);
  const [error, setError] = useState(null);

  // Refs mirror state so DOM-attached event handlers see current values.
  const armRef = useRef(arm);
  const pendingRef = useRef(pendingLineStart);
  const cursorRef = useRef({ x: 0, y: 0, visible: false });
  useEffect(() => { armRef.current = arm; }, [arm]);
  useEffect(() => { pendingRef.current = pendingLineStart; }, [pendingLineStart]);

  // Initialise Pannellum once. The viewer is single-scene with all initial
  // overlays' hotspots pre-baked; new overlays use addHotSpot.
  useEffect(() => {
    let cancelled = false;
    let rafId = 0;
    let downX = 0;
    let downY = 0;
    let downAt = 0;

    waitForPannellum().then((p) => {
      if (cancelled || !containerRef.current) return;

      viewerRef.current = p.viewer(containerRef.current, {
        default: { firstScene: SCENE_KEY, showControls: false, hfov: 100 },
        scenes: {
          [SCENE_KEY]: {
            type: 'equirectangular',
            panorama: imageUrl,
            autoLoad: true,
            showControls: false,
            hfov: 100,
            minHfov: 40,
            maxHfov: 120,
            hotSpots: overlayHotspots(initialOverlays),
          },
        },
      });
      ready.current = true;

      // Track mousedown so we can distinguish a real click from a drag-pan.
      // Without this, releasing a long pan over the pano would register as a
      // click and drop an overlay mid-warehouse.
      const onDown = (e) => {
        const p = e.touches ? e.touches[0] : e;
        downX = p.clientX;
        downY = p.clientY;
        downAt = Date.now();
      };
      const onClick = async (e) => {
        const mode = armRef.current;
        if (!mode) return;
        const dx = Math.abs(e.clientX - downX);
        const dy = Math.abs(e.clientY - downY);
        const dt = Date.now() - downAt;
        // Bail only if the user clearly dragged. Generous thresholds so that
        // jittery hands or trackpad taps still register as clicks.
        if (dx > 12 || dy > 12 || dt > 800) return;
        if (!viewerRef.current) return;
        let pitch, yaw;
        try {
          [pitch, yaw] = viewerRef.current.mouseEventToCoords(e);
        } catch {
          return;
        }
        pitch = round(pitch);
        yaw = round(yaw);

        if (mode === 'text') {
          // Disarm immediately (both the ref and state) so a follow-up click
          // that lands before the API responds doesn't trigger another
          // create. setArm alone wasn't enough — armRef only updates via the
          // useEffect on the *next* render.
          armRef.current = null;
          setArm(null);
          createOverlay({ type: 'text', pitch, yaw, title: 'Label' });
        } else if (mode === 'line-first') {
          // Pending start is just (pitch, yaw) in state — the line layer's
          // rAF tick projects it every frame, so the user sees the dot
          // immediately without needing a Pannellum hotspot.
          setPendingLineStart({ pitch, yaw });
          setArm('line-second');
        } else if (mode === 'line-second') {
          const start = pendingRef.current;
          if (!start) { setArm(null); return; }
          // Disarm + clear pending IMMEDIATELY so a stray follow-up click
          // can't re-enter this branch with the same start.
          pendingRef.current = null;
          armRef.current = null;
          setPendingLineStart(null);
          setArm(null);
          createOverlay({
            type: 'line',
            pitch: start.pitch,
            yaw: start.yaw,
            pitch2: pitch,
            yaw2: yaw,
            label: '15m',
          });
        }
      };

      // Track cursor in container-local coords so the rAF tick can draw a
      // pen-tool style rubber-band line from the pending start to the cursor.
      const onMove = (e) => {
        const p = e.touches ? e.touches[0] : e;
        const r = containerRef.current?.getBoundingClientRect();
        if (!r) return;
        cursorRef.current = {
          x: p.clientX - r.left,
          y: p.clientY - r.top,
          visible: true,
        };
      };
      const onLeave = () => { cursorRef.current.visible = false; };

      const el = containerRef.current;
      el.addEventListener('mousedown', onDown);
      el.addEventListener('touchstart', onDown, { passive: true });
      el.addEventListener('click', onClick);
      el.addEventListener('mousemove', onMove);
      el.addEventListener('mouseleave', onLeave);
      viewerRef.current.__cleanup = () => {
        el.removeEventListener('mousedown', onDown);
        el.removeEventListener('touchstart', onDown);
        el.removeEventListener('click', onClick);
        el.removeEventListener('mousemove', onMove);
        el.removeEventListener('mouseleave', onLeave);
      };

      // rAF loop driving the line layer. We project endpoints ourselves
      // using the viewer's current pitch/yaw/hfov — no DOM-reading.
      const tick = () => {
        if (cancelled) return;
        try {
          const v = viewerRef.current;
          if (v) {
            const pending = pendingRef.current;
            const cur = cursorRef.current;
            const preview =
              armRef.current === 'line-second' && pending && cur.visible
                ? {
                    startPitch: pending.pitch,
                    startYaw: pending.yaw,
                    cursorX: cur.x,
                    cursorY: cur.y,
                  }
                : null;
            drawLineOverlays(
              containerRef.current,
              overlaysRef.current.filter((o) => o.type === 'line'),
              {
                view: { pitch: v.getPitch(), yaw: v.getYaw(), hfov: v.getHfov() },
                preview,
              }
            );
          }
        } catch {}
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      removeLineLayer(containerRef.current);
      if (viewerRef.current) {
        try { viewerRef.current.__cleanup?.(); } catch {}
        try { viewerRef.current.destroy(); } catch {}
        viewerRef.current = null;
      }
      ready.current = false;
    };
    // We deliberately don't depend on initialOverlays here — the viewer is
    // initialised once with the server's baseline and then mutated in-place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl]);

  // Mirror overlays into a ref so the rAF tick can read it without re-binding.
  const overlaysRef = useRef(overlays);
  useEffect(() => { overlaysRef.current = overlays; }, [overlays]);

  // ── CRUD ────────────────────────────────────────────────────────────────
  // Optimistic create — we add the overlay to state + the live viewer with a
  // temp id, fire the API call in the background, then swap the temp id for
  // the real one when the server responds. Without this, every click of
  // "+ Add" feels laggy because the user is waiting on a DB round-trip
  // before seeing anything.
  const createOverlay = async (body) => {
    const tempId = `tmp-${Math.random().toString(36).slice(2, 10)}`;
    const optimistic = { id: tempId, ...body };
    setOverlays((all) => [...all, optimistic]);
    overlayHotspots([optimistic]).forEach((h) => {
      try { viewerRef.current?.addHotSpot(h, SCENE_KEY); } catch {}
    });

    try {
      const created = await api.createOverlay(sceneId, body);
      // Swap temp → real. Pannellum hotspot ids are derived from the overlay
      // id, so we remove the temp ones and add fresh ones with the real id.
      pannellumIdsForOverlay(optimistic).forEach((hid) => {
        try { viewerRef.current?.removeHotSpot(hid, SCENE_KEY); } catch {}
      });
      overlayHotspots([created]).forEach((h) => {
        try { viewerRef.current?.addHotSpot(h, SCENE_KEY); } catch {}
      });
      setOverlays((all) => all.map((o) => (o.id === tempId ? created : o)));
      setError(null);
    } catch (err) {
      // Roll back the optimistic insert.
      pannellumIdsForOverlay(optimistic).forEach((hid) => {
        try { viewerRef.current?.removeHotSpot(hid, SCENE_KEY); } catch {}
      });
      setOverlays((all) => all.filter((o) => o.id !== tempId));
      setError(err.message);
    }
  };

  // Optimistic patch — apply locally + to viewer immediately, fire PATCH in
  // background. For label edits this means typing feels instant rather than
  // waiting on the server. On API failure we roll back.
  const patchOverlay = async (id, patch) => {
    const prev = overlays.find((o) => o.id === id);
    if (!prev) return;
    const next = { ...prev, ...patch };
    setOverlays((all) => all.map((o) => (o.id === id ? next : o)));
    // For text overlays, the card content needs to re-render. (Line endpoints
    // don't carry visible label content — the label lives in the line layer,
    // which reads it from state every frame, so it updates automatically.)
    if (next.type !== 'line') {
      pannellumIdsForOverlay(prev).forEach((hid) => {
        try { viewerRef.current?.removeHotSpot(hid, SCENE_KEY); } catch {}
      });
      overlayHotspots([next]).forEach((h) => {
        try { viewerRef.current?.addHotSpot(h, SCENE_KEY); } catch {}
      });
    }
    try {
      await api.updateOverlay(id, patch);
      setError(null);
    } catch (err) {
      // Roll back.
      setOverlays((all) => all.map((o) => (o.id === id ? prev : o)));
      if (next.type !== 'line') {
        pannellumIdsForOverlay(next).forEach((hid) => {
          try { viewerRef.current?.removeHotSpot(hid, SCENE_KEY); } catch {}
        });
        overlayHotspots([prev]).forEach((h) => {
          try { viewerRef.current?.addHotSpot(h, SCENE_KEY); } catch {}
        });
      }
      setError(err.message);
    }
  };

  // Optimistic delete — yank from state + viewer immediately, fire DELETE in
  // background. Without this, click-confirm sat for the full server
  // round-trip before the overlay disappeared, which feels broken.
  const removeOverlay = async (id) => {
    const target = overlays.find((o) => o.id === id);
    if (!target) return;
    if (!confirm('Delete this overlay?')) return;

    const index = overlays.findIndex((o) => o.id === id);
    setOverlays((all) => all.filter((o) => o.id !== id));
    pannellumIdsForOverlay(target).forEach((hid) => {
      try { viewerRef.current?.removeHotSpot(hid, SCENE_KEY); } catch {}
    });

    // Temp-id overlays never made it to the server yet (mid-create). Skip
    // the API call entirely — there's nothing to delete remotely.
    if (String(id).startsWith('tmp-')) return;

    try {
      await api.deleteOverlay(id);
      setError(null);
    } catch (err) {
      // Roll back the optimistic delete.
      setOverlays((all) => {
        const next = [...all];
        next.splice(index, 0, target);
        return next;
      });
      overlayHotspots([target]).forEach((h) => {
        try { viewerRef.current?.addHotSpot(h, SCENE_KEY); } catch {}
      });
      setError(err.message);
    }
  };

  // ── UI ──────────────────────────────────────────────────────────────────
  // Pending start is just state now (no Pannellum hotspot to clean up).
  const armText = () => { setPendingLineStart(null); setArm(arm === 'text' ? null : 'text'); };
  const armLine = () => { setPendingLineStart(null); setArm(arm?.startsWith('line') ? null : 'line-first'); };

  const armTextLabel = arm === 'text' ? 'Click pano to place…' : '+ Add text';
  const armLineLabel =
    arm === 'line-first'  ? 'Click START point…' :
    arm === 'line-second' ? 'Click END point…'   : '+ Add line';

  return (
    <div className="admin__panel">
      <div className="admin__panel-header">
        <h2 className="admin__panel-title">Overlays</h2>
        <div className="admin__list-actions">
          <button type="button" className={`btn ${arm === 'text' ? 'btn--primary' : 'btn--ghost'}`} onClick={armText}>
            {armTextLabel}
          </button>
          <button type="button" className={`btn ${arm?.startsWith('line') ? 'btn--primary' : 'btn--ghost'}`} onClick={armLine}>
            {armLineLabel}
          </button>
        </div>
      </div>

      {error && <div className="admin__error">{error}</div>}

      <div className={`hs-edit-stage is-editing ${arm ? 'is-arming' : ''}`}>
        <div ref={containerRef} className="hs-edit-pano" />
      </div>

      {overlays.length === 0 ? (
        <div className="admin__empty">
          Use “+ Add text” to drop a label, or “+ Add line” to mark a width/height (click two points).
        </div>
      ) : (
        <ul className="hs-edit-list">
          {overlays.map((o, i) => (
            <li key={o.id} className="hs-edit-list__row">
              <span className="hs-edit-list__num">{i + 1}</span>
              <span className="picker__coords" style={{ minWidth: 56 }}>
                {o.type === 'line' ? 'line' : 'text'}
              </span>
              {o.type === 'line' ? (
                <input
                  className="field__input"
                  defaultValue={o.label || ''}
                  placeholder="Dimension (e.g. 15m)"
                  onBlur={(e) => {
                    const next = e.target.value.trim() || null;
                    if (next !== (o.label || null)) patchOverlay(o.id, { label: next });
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                  style={{ flex: 1 }}
                />
              ) : (
                <input
                  className="field__input"
                  defaultValue={o.title || o.label || ''}
                  placeholder="Label text"
                  onBlur={(e) => {
                    const next = e.target.value.trim();
                    if ((next || null) !== (o.title || null)) {
                      patchOverlay(o.id, { title: next || null });
                    }
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                  style={{ flex: 1 }}
                />
              )}
              <span className="hs-edit-list__coord">
                {o.type === 'line'
                  ? `(${o.pitch}, ${o.yaw}) → (${o.pitch2}, ${o.yaw2})`
                  : `(${o.pitch}, ${o.yaw})`}
              </span>
              <button
                type="button"
                className="btn btn--ghost btn--danger"
                onClick={() => removeOverlay(o.id)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
