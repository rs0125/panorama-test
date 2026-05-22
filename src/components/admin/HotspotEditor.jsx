'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/apiClient.js';

// In-pano hotspot editor.
//
// View mode  → pano is panable, pins are read-only (just visual context).
// Edit mode  → pins become draggable; "+ Add" arms a click-to-place gesture.
//
// Persistence is deferred to the "Save hotspots" button, which diffs the
// current item list against the server baseline and sends one bulk request.

function waitForPannellum() {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.pannellum) return resolve(window.pannellum);
    const t = setInterval(() => {
      if (window.pannellum) {
        clearInterval(t);
        resolve(window.pannellum);
      }
    }, 30);
  });
}

// Pannellum invokes this with the hotspot's DOM container — we own everything
// inside. The createTooltipArgs object carries handlers + per-pin info.
function buildPin(div, args) {
  div.classList.add('hs-edit');
  const pill = document.createElement('div');
  pill.className = 'hs-edit__pill';
  pill.dataset.editable = args.editable ? '1' : '0';

  const num = document.createElement('span');
  num.className = 'hs-edit__num';
  num.textContent = args.num;
  pill.appendChild(num);

  const label = document.createElement('span');
  label.className = 'hs-edit__label';
  label.textContent = args.label;
  pill.appendChild(label);

  if (args.editable && args.onDelete) {
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'hs-edit__del';
    del.setAttribute('aria-label', 'Delete hotspot');
    del.textContent = '×';
    del.addEventListener('mousedown', (e) => e.stopPropagation()); // don't start drag
    del.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      args.onDelete();
    });
    pill.appendChild(del);
  }

  if (args.editable && args.onMouseDown) {
    pill.addEventListener('mousedown', args.onMouseDown);
    pill.addEventListener('touchstart', args.onMouseDown, { passive: false });
  }

  div.appendChild(pill);
}

const round = (v) => Math.round(v * 100) / 100;

export default function HotspotEditor({ scene, siblings, initialHotspots }) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);

  // Lookup for target-scene titles; titles are stable, build once.
  const titleById = useMemo(
    () => Object.fromEntries(siblings.map((s) => [s.id, s.title])),
    [siblings]
  );

  // Items mirror the React-side hotspot list. Each carries _key (stable across
  // renders), id (cuid for existing rows, null for unsaved new ones), and the
  // pitch/yaw/toSceneId being edited.
  const [items, setItems] = useState(() =>
    initialHotspots.map((h) => ({ _key: h.id, id: h.id, pitch: h.pitch, yaw: h.yaw, toSceneId: h.toSceneId }))
  );
  const baseline = useMemo(() => initialHotspots.map((h) => ({ ...h })), [initialHotspots]);

  const [mode, setMode] = useState('view'); // 'view' | 'edit'
  const [addArmed, setAddArmed] = useState(false);
  const [addTarget, setAddTarget] = useState(siblings[0]?.id || '');
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  // Toggled true after Pannellum finishes loading. The items-sync effect
  // depends on this so the initial pins get rendered once the viewer exists.
  const [viewerReady, setViewerReady] = useState(false);

  // Refs mirroring state for closures attached to DOM/Pannellum (which see
  // them at attach-time and would otherwise capture stale values).
  const modeRef = useRef(mode);
  const addArmedRef = useRef(addArmed);
  const addTargetRef = useRef(addTarget);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { addArmedRef.current = addArmed; }, [addArmed]);
  useEffect(() => { addTargetRef.current = addTarget; }, [addTarget]);

  const draggingRef = useRef(null);

  // ── Mount Pannellum once ──────────────────────────────────────────────────
  useEffect(() => {
    let destroyed = false;
    let detachClick;
    waitForPannellum().then((p) => {
      if (destroyed || !containerRef.current) return;
      viewerRef.current = p.viewer(containerRef.current, {
        type: 'equirectangular',
        panorama: scene.imageUrl,
        autoLoad: true,
        showControls: false,
        hfov: 90,
        minHfov: 40,
        maxHfov: 120,
        sceneFadeDuration: 0,
      });
      // Flip the flag so the items-sync effect can now paint pins.
      viewerRef.current.on('load', () => setViewerReady(true));

      // Single click handler on the pano. Decides what to do based on mode:
      //   view: nothing
      //   edit + add armed: place new pin at click coords
      //   edit + drag-just-ended: swallow the click that browsers fire after mouseup
      const onClick = (e) => {
        if (draggingRef.current?.consumedClick) {
          draggingRef.current = null;
          return;
        }
        if (modeRef.current !== 'edit' || !addArmedRef.current) return;
        const target = addTargetRef.current;
        if (!target) return;
        try {
          const [pitch, yaw] = viewerRef.current.mouseEventToCoords(e);
          const tempKey = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          setItems((xs) => [
            ...xs,
            { _key: tempKey, id: null, pitch: round(pitch), yaw: round(yaw), toSceneId: target },
          ]);
          setAddArmed(false);
        } catch {
          // Outside pano bounds — ignore.
        }
      };
      containerRef.current.addEventListener('click', onClick);
      detachClick = () => containerRef.current?.removeEventListener('click', onClick);
    });
    return () => {
      destroyed = true;
      detachClick?.();
      try { viewerRef.current?.destroy(); } catch {}
      viewerRef.current = null;
      setViewerReady(false);
    };
  }, [scene.imageUrl]);

  // ── Sync items → Pannellum hotspots ───────────────────────────────────────
  // We rebuild the hotspot list on items change (add/remove/target swap) and
  // also on the first `viewerReady` flip so the initial pins paint. Drag
  // moves bypass this path by mutating Pannellum's in-memory config directly,
  // so we don't churn DOM on every mousemove frame.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !viewerReady) return;
    const cfg = viewer.getConfig();
    [...(cfg.hotSpots || [])].forEach((h) => {
      try { viewer.removeHotSpot(h.id); } catch {}
    });
    items.forEach((it, i) => {
      viewer.addHotSpot({
        id: it._key,
        pitch: it.pitch,
        yaw: it.yaw,
        cssClass: 'hs-edit-wrap',
        createTooltipFunc: buildPin,
        createTooltipArgs: {
          num: i + 1,
          label: titleById[it.toSceneId] || '(unknown)',
          editable: mode === 'edit',
          onMouseDown: (e) => onPinPress(it._key, e),
          onDelete: () => removeItem(it._key),
        },
      });
    });
    // After rebuild, also nudge a render to settle positions
    try { viewer.setYaw(viewer.getYaw()); } catch {}
  }, [items, titleById, mode, viewerReady]);

  // ── Drag bookkeeping (mouse + touch) ──────────────────────────────────────
  useEffect(() => {
    const onMove = (ev) => {
      const drag = draggingRef.current;
      if (!drag || !viewerRef.current) return;
      const p = ev.touches ? ev.touches[0] : ev;
      const dx = Math.abs(p.clientX - drag.startX);
      const dy = Math.abs(p.clientY - drag.startY);
      if (!drag.moved && dx + dy < 4) return; // ignore tiny tremors so a click still registers
      drag.moved = true;
      if (ev.cancelable) ev.preventDefault();
      try {
        const [pitch, yaw] = viewerRef.current.mouseEventToCoords(ev);
        // Mutate Pannellum's live config — its animate loop reads pitch/yaw
        // each frame, so this repositions the pin without a remove/add cycle.
        const cfg = viewerRef.current.getConfig();
        const hs = (cfg.hotSpots || []).find((h) => h.id === drag.key);
        if (hs) {
          hs.pitch = pitch;
          hs.yaw = yaw;
          // Kick the render loop — setYaw to current value is the cheapest way.
          viewerRef.current.setYaw(viewerRef.current.getYaw());
        }
      } catch {}
    };
    const onUp = () => {
      const drag = draggingRef.current;
      if (!drag) return;
      if (!drag.moved) {
        draggingRef.current = null;
        return;
      }
      // Read the final position out of Pannellum's config and commit to React.
      const cfg = viewerRef.current?.getConfig();
      const hs = (cfg?.hotSpots || []).find((h) => h.id === drag.key);
      if (hs) {
        setItems((xs) =>
          xs.map((x) => (x._key === drag.key ? { ...x, pitch: round(hs.pitch), yaw: round(hs.yaw) } : x))
        );
      }
      // Tell the click handler to skip the trailing synthetic click on the pin.
      drag.consumedClick = true;
      setTimeout(() => { draggingRef.current = null; }, 0);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, []);

  const onPinPress = (key, e) => {
    if (modeRef.current !== 'edit') return;
    e.preventDefault();
    e.stopPropagation();
    const p = e.touches ? e.touches[0] : e;
    draggingRef.current = { key, startX: p.clientX, startY: p.clientY, moved: false };
  };

  const removeItem = (key) => setItems((xs) => xs.filter((x) => x._key !== key));

  const changeTargetOf = (key, toSceneId) =>
    setItems((xs) => xs.map((x) => (x._key === key ? { ...x, toSceneId } : x)));

  // ── Save (diff baseline ↔ current, send one bulk request) ─────────────────
  const dirty = useMemo(() => {
    if (items.length !== baseline.length) return true;
    const byId = Object.fromEntries(baseline.map((h) => [h.id, h]));
    for (const it of items) {
      if (!it.id) return true; // new row
      const b = byId[it.id];
      if (!b) return true;
      if (b.pitch !== it.pitch || b.yaw !== it.yaw || b.toSceneId !== it.toSceneId) return true;
    }
    return false;
  }, [items, baseline]);

  const onSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const baseById = Object.fromEntries(baseline.map((h) => [h.id, h]));
      const keepIds = new Set(items.filter((i) => i.id).map((i) => i.id));

      const create = items
        .filter((i) => !i.id)
        .map((i) => ({ pitch: i.pitch, yaw: i.yaw, toSceneId: i.toSceneId }));
      const update = items
        .filter((i) => {
          if (!i.id) return false;
          const b = baseById[i.id];
          return b && (b.pitch !== i.pitch || b.yaw !== i.yaw || b.toSceneId !== i.toSceneId);
        })
        .map((i) => ({ id: i.id, pitch: i.pitch, yaw: i.yaw, toSceneId: i.toSceneId }));
      const del = baseline.filter((b) => !keepIds.has(b.id)).map((b) => b.id);

      const fresh = await api.bulkHotspots(scene.id, { create, update, delete: del });
      setItems(fresh.map((h) => ({ _key: h.id, id: h.id, pitch: h.pitch, yaw: h.yaw, toSceneId: h.toSceneId })));
      setMode('view');
      setAddArmed(false);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const onCancel = () => {
    setItems(baseline.map((h) => ({ _key: h.id, id: h.id, pitch: h.pitch, yaw: h.yaw, toSceneId: h.toSceneId })));
    setMode('view');
    setAddArmed(false);
    setSaveError(null);
  };

  if (siblings.length === 0) {
    return (
      <div className="admin__panel">
        <h2 className="admin__panel-title">Hotspots</h2>
        <div className="admin__empty">
          Hotspots link a scene to another scene. Add a second scene to this tour to enable them.
        </div>
      </div>
    );
  }

  return (
    <div className="admin__panel">
      <div className="admin__panel-header">
        <h2 className="admin__panel-title">Hotspots</h2>
        <div className="admin__list-actions">
          {mode === 'view' ? (
            <button type="button" className="btn btn--ghost" onClick={() => setMode('edit')}>
              Edit hotspots
            </button>
          ) : (
            <>
              <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={saving}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={onSave}
                disabled={saving || !dirty}
              >
                {saving ? 'Saving…' : 'Save hotspots'}
              </button>
            </>
          )}
        </div>
      </div>

      {mode === 'edit' && (
        <div className="hs-edit-bar">
          <label className="field" style={{ flex: '0 1 260px' }}>
            <span className="field__label">New hotspot links to</span>
            <select
              className="field__input"
              value={addTarget}
              onChange={(e) => setAddTarget(e.target.value)}
            >
              {siblings.map((s) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={`btn ${addArmed ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => setAddArmed((v) => !v)}
            disabled={!addTarget}
          >
            {addArmed ? 'Click pano to place…' : '+ Add hotspot'}
          </button>
        </div>
      )}

      {saveError && <div className="admin__error">{saveError}</div>}

      <div className={`hs-edit-stage ${mode === 'edit' ? 'is-editing' : ''} ${addArmed ? 'is-arming' : ''}`}>
        <div ref={containerRef} className="hs-edit-pano" />
      </div>

      {mode === 'edit' && items.length > 0 && (
        <ul className="hs-edit-list">
          {items.map((it, i) => (
            <li key={it._key} className="hs-edit-list__row">
              <span className="hs-edit-list__num">{i + 1}</span>
              <label className="field" style={{ flex: 1 }}>
                <span className="field__label">Target scene</span>
                <select
                  className="field__input"
                  value={it.toSceneId}
                  onChange={(e) => changeTargetOf(it._key, e.target.value)}
                >
                  {siblings.map((s) => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </select>
              </label>
              <span className="hs-edit-list__coord">
                p {Number(it.pitch).toFixed(1)}° · y {Number(it.yaw).toFixed(1)}°
              </span>
              <button
                type="button"
                className="btn btn--ghost btn--danger"
                onClick={() => removeItem(it._key)}
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
