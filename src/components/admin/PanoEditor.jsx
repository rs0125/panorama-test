'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/apiClient.js';
import { round as roundN } from '@/lib/num.js';
import { waitForPannellum } from '@/lib/pannellum.js';
import PannellumLoader from '@/components/PannellumLoader.jsx';
import {
  overlayHotspots,
  drawLineOverlays,
  removeLineLayer,
  pannellumIdsForOverlay,
} from '@/lib/overlayRendering.js';

// Unified in-pano editor — navigation hotspots + text labels + dimension
// lines, all on a single Pannellum viewer. Previously these were two separate
// panels (HotspotEditor + OverlayEditor) each mounting their own render of the
// same image; merging halves the viewer cost and lets the admin place every
// kind of marker against one shared view.
//
// Everything saves immediately/optimistically — there's no view/edit toggle.
// Three placement gestures, armed from the toolbar:
//   + Add hotspot → click once to drop a navigation pin (target picked first).
//   + Add text    → click once to drop a text label.
//   + Add line    → click twice (start, end) to draw a dimension line.
//
// Hotspots are driven by a state→Pannellum rebuild (so the pins keep their
// running numbers); text/line overlays keep the in-place optimistic approach.
// The two never collide because their Pannellum hotspot ids are namespaced
// (`hs-*` vs `ovl-*`).

const SCENE_KEY = 'pano-editor'; // single-scene viewer, fixed scene id.

const round = (v) => roundN(v, 2);
const fmtAngle = (v) => (v == null ? '—' : `${Number(v).toFixed(1)}°`);

// Pannellum invokes this with the hotspot's DOM container — we own everything
// inside. Drag is handled by delegation on the pano container (the pill
// carries data-hotspot-id), so we don't wire per-pin mousedown here.
function buildPin(div, args) {
  div.classList.add('hs-edit');
  const pill = document.createElement('div');
  pill.className = 'hs-edit__pill';
  pill.dataset.editable = '1';
  pill.dataset.hotspotId = args.hotspotId;

  const num = document.createElement('span');
  num.className = 'hs-edit__num';
  num.textContent = args.num;
  pill.appendChild(num);

  const label = document.createElement('span');
  label.className = 'hs-edit__label';
  label.textContent = args.label;
  pill.appendChild(label);

  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'hs-edit__del';
  del.setAttribute('aria-label', 'Delete hotspot');
  del.textContent = '×';
  del.addEventListener('mousedown', (e) => e.stopPropagation()); // don't start a drag
  del.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    args.onDelete();
  });
  pill.appendChild(del);

  div.appendChild(pill);
}

// Build Pannellum hotspot configs for the navigation pins.
function hotspotPins(hotspots, titleById, onDelete) {
  return hotspots.map((h, i) => ({
    id: `hs-${h.id}`,
    pitch: h.pitch,
    yaw: h.yaw,
    cssClass: 'hs-edit-wrap',
    createTooltipFunc: buildPin,
    createTooltipArgs: {
      hotspotId: h.id,
      num: i + 1,
      label: titleById[h.toSceneId] || '(unknown)',
      onDelete: () => onDelete(h.id),
    },
  }));
}

export default function PanoEditor({ scene, siblings = [], initialHotspots = [], initialOverlays = [] }) {
  const sceneId = scene.id;
  const imageUrl = scene.imageUrl;

  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const ready = useRef(false);

  // Lookup for target-scene titles; titles are stable, build once.
  const titleById = useMemo(
    () => Object.fromEntries(siblings.map((s) => [s.id, s.title])),
    [siblings]
  );

  const [hotspots, setHotspots] = useState(() =>
    initialHotspots.map((h) => ({ id: h.id, pitch: h.pitch, yaw: h.yaw, toSceneId: h.toSceneId }))
  );
  const [overlays, setOverlays] = useState(initialOverlays);

  // arm: null | 'hotspot' | 'text' | 'line-first' | 'line-second'
  const [arm, setArm] = useState(null);
  const [addTarget, setAddTarget] = useState(siblings[0]?.id || '');
  const [pendingLineStart, setPendingLineStart] = useState(null);
  const [error, setError] = useState(null);
  const [viewerReady, setViewerReady] = useState(false);

  // Refs mirror state so DOM-attached handlers (bound once at mount) read
  // current values instead of the stale ones captured at attach time.
  const armRef = useRef(arm);
  const addTargetRef = useRef(addTarget);
  const pendingRef = useRef(pendingLineStart);
  const cursorRef = useRef({ x: 0, y: 0, visible: false });
  const consumeClickRef = useRef(false);
  const overlaysRef = useRef(overlays);
  const hotspotsRef = useRef(hotspots);
  useEffect(() => { armRef.current = arm; }, [arm]);
  useEffect(() => { addTargetRef.current = addTarget; }, [addTarget]);
  useEffect(() => { pendingRef.current = pendingLineStart; }, [pendingLineStart]);
  useEffect(() => { overlaysRef.current = overlays; }, [overlays]);
  useEffect(() => { hotspotsRef.current = hotspots; }, [hotspots]);

  // ── Initial-view capture ──────────────────────────────────────────────────
  // Lives here (rather than SceneFormAdmin) because we already have a live
  // viewer to read pitch/yaw/hfov from. PATCHes straight to /api/scenes/[id].
  const [initialView, setInitialView] = useState({
    pitch: scene.initialPitch ?? null,
    yaw: scene.initialYaw ?? null,
    hfov: scene.initialHfov ?? null,
  });
  useEffect(() => {
    setInitialView({
      pitch: scene.initialPitch ?? null,
      yaw: scene.initialYaw ?? null,
      hfov: scene.initialHfov ?? null,
    });
  }, [scene.initialPitch, scene.initialYaw, scene.initialHfov]);
  const [ivSaving, setIvSaving] = useState(false);
  const [ivError, setIvError] = useState(null);
  const [ivStatus, setIvStatus] = useState(null);

  const captureInitialView = async () => {
    const v = viewerRef.current;
    if (!v) return;
    let next;
    try {
      next = { pitch: round(v.getPitch()), yaw: round(v.getYaw()), hfov: round(v.getHfov()) };
    } catch {
      setIvError('Viewer not ready yet.');
      return;
    }
    setIvSaving(true);
    setIvError(null);
    try {
      await api.updateScene(sceneId, {
        initialPitch: next.pitch,
        initialYaw: next.yaw,
        initialHfov: next.hfov,
      });
      setInitialView(next);
      setIvStatus('saved');
      setTimeout(() => setIvStatus(null), 1500);
    } catch (err) {
      setIvError(err.message);
    } finally {
      setIvSaving(false);
    }
  };

  const resetInitialView = async () => {
    setIvSaving(true);
    setIvError(null);
    try {
      await api.updateScene(sceneId, { initialPitch: null, initialYaw: null, initialHfov: null });
      setInitialView({ pitch: null, yaw: null, hfov: null });
      setIvStatus('saved');
      setTimeout(() => setIvStatus(null), 1500);
    } catch (err) {
      setIvError(err.message);
    } finally {
      setIvSaving(false);
    }
  };

  const ivIsSet = initialView.pitch != null || initialView.yaw != null || initialView.hfov != null;

  // Force a Pannellum re-render of hotspot DOM positions. setYaw(getYaw())
  // short-circuits (eps check at 1e-6), so nudge by 0.0001° — above eps, below
  // anything visible — to make Pannellum reschedule renderHotSpots.
  const forceRender = () => {
    try {
      const v = viewerRef.current;
      const y = v.getYaw();
      v.setYaw(y + 0.0001, 0);
      v.setYaw(y, 0);
    } catch {}
  };

  // ── Mount Pannellum once ────────────────────────────────────────────────────
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
            // Bake the text overlays in at init; pins are added by the sync
            // effect once the viewer fires 'load'.
            hotSpots: overlayHotspots(initialOverlays, { editable: true }),
          },
        },
      });
      ready.current = true;
      viewerRef.current.on('load', () => setViewerReady(true));

      // Distinguish a real click from a drag-pan: without this, releasing a
      // long pan over the pano would register as a click and drop a marker.
      const onDownPlace = (e) => {
        const q = e.touches ? e.touches[0] : e;
        downX = q.clientX;
        downY = q.clientY;
        downAt = Date.now();
      };
      const onClick = (e) => {
        // Drag/resize gestures on existing markers consume their trailing click.
        if (consumeClickRef.current) return;
        const mode = armRef.current;
        if (!mode) return;
        const dx = Math.abs(e.clientX - downX);
        const dy = Math.abs(e.clientY - downY);
        const dt = Date.now() - downAt;
        // Generous thresholds so jittery hands / trackpad taps still register.
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

        if (mode === 'hotspot') {
          const target = addTargetRef.current;
          if (!target) return;
          armRef.current = null;
          setArm(null);
          createHotspot({ pitch, yaw, toSceneId: target });
        } else if (mode === 'text') {
          // Disarm immediately (ref + state) so a follow-up click landing
          // before the API responds doesn't trigger another create.
          armRef.current = null;
          setArm(null);
          createOverlay({ type: 'text', pitch, yaw, title: 'Label' });
        } else if (mode === 'line-first') {
          setPendingLineStart({ pitch, yaw });
          setArm('line-second');
        } else if (mode === 'line-second') {
          const start = pendingRef.current;
          if (!start) { setArm(null); return; }
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
        const q = e.touches ? e.touches[0] : e;
        const r = containerRef.current?.getBoundingClientRect();
        if (!r) return;
        cursorRef.current = { x: q.clientX - r.left, y: q.clientY - r.top, visible: true };
      };
      const onLeave = () => { cursorRef.current.visible = false; };

      const el = containerRef.current;
      el.addEventListener('mousedown', onDownPlace);
      el.addEventListener('touchstart', onDownPlace, { passive: true });
      el.addEventListener('click', onClick);
      el.addEventListener('mousemove', onMove);
      el.addEventListener('mouseleave', onLeave);
      viewerRef.current.__cleanup = () => {
        el.removeEventListener('mousedown', onDownPlace);
        el.removeEventListener('touchstart', onDownPlace);
        el.removeEventListener('click', onClick);
        el.removeEventListener('mousemove', onMove);
        el.removeEventListener('mouseleave', onLeave);
      };

      // rAF loop driving the line layer. We project endpoints ourselves using
      // the viewer's current pitch/yaw/hfov — no DOM-reading.
      const tick = () => {
        if (cancelled) return;
        try {
          const v = viewerRef.current;
          if (v) {
            const pending = pendingRef.current;
            const cur = cursorRef.current;
            const lines = overlaysRef.current.filter((o) => o.type === 'line');
            const havePreview = armRef.current === 'line-second' && pending && cur.visible;
            if (lines.length > 0 || havePreview) {
              const preview = havePreview
                ? { startPitch: pending.pitch, startYaw: pending.yaw, cursorX: cur.x, cursorY: cur.y }
                : null;
              drawLineOverlays(containerRef.current, lines, {
                view: { pitch: v.getPitch(), yaw: v.getYaw(), hfov: v.getHfov() },
                preview,
                interactive: true,
              });
            }
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
      setViewerReady(false);
    };
    // Viewer is initialised once with the server baseline, then mutated in
    // place — don't re-init on overlay/hotspot changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl]);

  // ── Sync hotspot pins → Pannellum ───────────────────────────────────────────
  // Rebuild the `hs-*` pins whenever the list changes (add/remove/target swap)
  // or the viewer becomes ready. Drag moves bypass this by mutating Pannellum's
  // config directly, so we don't churn DOM every mousemove frame. Only `hs-*`
  // hotspots are touched; the `ovl-*` text hotspots are left alone.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !viewerReady) return;
    const cfg = viewer.getConfig();
    [...(cfg.hotSpots || [])]
      .filter((h) => typeof h.id === 'string' && h.id.startsWith('hs-'))
      .forEach((h) => {
        try { viewer.removeHotSpot(h.id, SCENE_KEY); } catch {}
      });
    hotspotPins(hotspots, titleById, removeHotspot).forEach((pin) => {
      try { viewer.addHotSpot(pin, SCENE_KEY); } catch {}
    });
    forceRender();
    // removeHotspot is stable enough — it only reads refs + setState.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotspots, titleById, viewerReady]);

  // ── Drag / resize delegation on the pano container ───────────────────────────
  // One mousedown handler picks a gesture from the target:
  //   corner [data-handle]  → uniform scale (text)
  //   edge   [data-handle]  → stretch one box dimension (text)
  //   [data-endpoint]       → drag a line endpoint
  //   .hs-edit__pill        → drag a navigation pin
  //   .ovl-text__card       → free-drag a text card (projected on release)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let active = null;

    const findOverlay = (id) => overlaysRef.current.find((o) => o.id === id);

    const cardTransform = (scaleN, dx = 0, dy = 0) =>
      `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${scaleN})`;

    const onDown = (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;

      // Resize handle — corner = uniform scale, edge = box stretch.
      const handleEl = target.closest('[data-handle]');
      if (handleEl) {
        const handle = handleEl.dataset.handle;
        const overlayId = handleEl.dataset.overlayId;
        const overlay = findOverlay(overlayId);
        const card = handleEl.closest('.ovl-text__card');
        if (!overlay || !card || !handle) return;
        const cardRect = card.getBoundingClientRect();
        const cx = cardRect.left + cardRect.width / 2;
        const cy = cardRect.top + cardRect.height / 2;
        const q = e.touches ? e.touches[0] : e;
        const isCorner = handle.length === 2; // nw/ne/se/sw
        e.preventDefault();
        e.stopPropagation();
        if (isCorner) {
          const startDist = Math.hypot(q.clientX - cx, q.clientY - cy);
          if (startDist < 4) return;
          active = {
            type: 'text-resize-corner',
            overlayId,
            centerX: cx,
            centerY: cy,
            startDist,
            startScale: overlay.scale ?? 1,
            card,
          };
        } else {
          const scale = overlay.scale ?? 1;
          active = {
            type: 'text-resize-edge',
            overlayId,
            edge: handle,
            card,
            cardScale: scale,
            startWidth: cardRect.width / scale,
            startHeight: cardRect.height / scale,
            startCursorX: q.clientX,
            startCursorY: q.clientY,
            centerX: cx,
            centerY: cy,
          };
        }
        consumeClickRef.current = true;
        document.body.style.cursor = 'grabbing';
        return;
      }

      // Line endpoint dot.
      if (target.dataset && target.dataset.endpoint && target.dataset.overlayId) {
        e.preventDefault();
        e.stopPropagation();
        active = {
          type: 'line-endpoint',
          overlayId: target.dataset.overlayId,
          endpoint: target.dataset.endpoint === '1' ? 1 : 2,
        };
        consumeClickRef.current = true;
        document.body.style.cursor = 'grabbing';
        return;
      }

      // Navigation pin — drag to reposition.
      const pinEl = target.closest('.hs-edit__pill[data-hotspot-id]');
      if (pinEl) {
        e.preventDefault();
        e.stopPropagation();
        active = { type: 'hotspot-drag', overlayId: pinEl.dataset.hotspotId, moved: false };
        consumeClickRef.current = true;
        document.body.style.cursor = 'grabbing';
        return;
      }

      // Text overlay card body — free drag.
      const cardEl = target.closest('.ovl-text__card[data-overlay-id]');
      if (cardEl) {
        const overlayId = cardEl.dataset.overlayId;
        const overlay = findOverlay(overlayId);
        if (!overlay) return;
        const q = e.touches ? e.touches[0] : e;
        e.preventDefault();
        e.stopPropagation();
        active = {
          type: 'text-drag',
          overlayId,
          card: cardEl,
          scaleN: overlay.scale ?? 1,
          startX: q.clientX,
          startY: q.clientY,
          lastX: q.clientX,
          lastY: q.clientY,
        };
        consumeClickRef.current = true;
        document.body.style.cursor = 'grabbing';
      }
    };

    const onMove = (e) => {
      if (!active || !viewerRef.current) return;
      if (e.cancelable) e.preventDefault();
      const q = e.touches ? e.touches[0] : e;

      if (active.type === 'text-resize-corner') {
        const dist = Math.hypot(q.clientX - active.centerX, q.clientY - active.centerY);
        const ratio = dist / active.startDist;
        const scale = Math.max(0.4, Math.min(3, active.startScale * ratio));
        active.card.style.transform = cardTransform(scale);
        active.currentScale = scale;
        return;
      }

      if (active.type === 'text-resize-edge') {
        const isHorizontal = active.edge === 'e' || active.edge === 'w';
        const sign = (active.edge === 'e' || active.edge === 's') ? 1 : -1;
        const cursorDelta = isHorizontal
          ? (q.clientX - active.startCursorX) * sign
          : (q.clientY - active.startCursorY) * sign;
        const delta = (cursorDelta * 2) / active.cardScale;
        if (isHorizontal) {
          const newWidth = Math.max(40, active.startWidth + delta);
          active.card.style.width = `${newWidth}px`;
          active.card.style.maxWidth = `${newWidth}px`;
          active.currentBoxWidth = newWidth;
        } else {
          const newHeight = Math.max(20, active.startHeight + delta);
          active.card.style.height = `${newHeight}px`;
          active.card.style.overflow = 'hidden';
          active.currentBoxHeight = newHeight;
        }
        return;
      }

      if (active.type === 'text-drag') {
        const dx = q.clientX - active.startX;
        const dy = q.clientY - active.startY;
        active.card.style.transform = cardTransform(active.scaleN, dx, dy);
        active.lastX = q.clientX;
        active.lastY = q.clientY;
        return;
      }

      if (active.type === 'hotspot-drag') {
        let pitch, yaw;
        try {
          [pitch, yaw] = viewerRef.current.mouseEventToCoords(e);
        } catch { return; }
        // Mutate Pannellum's live config — the pin follows on the next render.
        const cfg = viewerRef.current.getConfig();
        const hs = (cfg.hotSpots || []).find((h) => h.id === `hs-${active.overlayId}`);
        if (hs) {
          hs.pitch = pitch;
          hs.yaw = yaw;
          active.moved = true;
          forceRender();
        }
        return;
      }

      if (active.type === 'line-endpoint') {
        let pitch, yaw;
        try {
          [pitch, yaw] = viewerRef.current.mouseEventToCoords(e);
        } catch { return; }
        const patch = active.endpoint === 1 ? { pitch, yaw } : { pitch2: pitch, yaw2: yaw };
        setOverlays((all) => all.map((o) => (o.id === active.overlayId ? { ...o, ...patch } : o)));
        active.currentPatch = patch;
      }
    };

    const onUp = async () => {
      if (!active) return;
      const a = active;
      active = null;
      document.body.style.cursor = '';
      setTimeout(() => { consumeClickRef.current = false; }, 0);

      if (a.type === 'hotspot-drag') {
        if (!a.moved) return;
        const cfg = viewerRef.current?.getConfig();
        const hs = (cfg?.hotSpots || []).find((h) => h.id === `hs-${a.overlayId}`);
        if (!hs) return;
        const pitch = round(hs.pitch);
        const yaw = round(hs.yaw);
        const prev = hotspotsRef.current.find((h) => h.id === a.overlayId);
        if (!prev || (prev.pitch === pitch && prev.yaw === yaw)) return;
        setHotspots((all) => all.map((h) => (h.id === a.overlayId ? { ...h, pitch, yaw } : h)));
        if (String(a.overlayId).startsWith('tmp-')) return;
        try {
          await api.updateHotspot(a.overlayId, { pitch, yaw });
          setError(null);
        } catch (err) {
          setHotspots((all) => all.map((h) => (h.id === a.overlayId ? prev : h)));
          setError(err.message);
        }
        return;
      }

      const overlay = findOverlay(a.overlayId);
      if (!overlay) return;

      if (a.type === 'text-resize-corner') {
        if (a.currentScale == null) return;
        const newScale = round(a.currentScale);
        if (newScale === (overlay.scale ?? 1)) return;
        setOverlays((all) => all.map((o) => (o.id === a.overlayId ? { ...o, scale: newScale } : o)));
        try {
          await api.updateOverlay(a.overlayId, { scale: newScale });
          setError(null);
        } catch (err) {
          setOverlays((all) => all.map((o) => (o.id === a.overlayId ? overlay : o)));
          if (a.card) a.card.style.transform = cardTransform(overlay.scale ?? 1);
          setError(err.message);
        }
        return;
      }

      if (a.type === 'text-resize-edge') {
        const patch = {};
        if (a.currentBoxWidth != null) patch.boxWidth = round(a.currentBoxWidth);
        if (a.currentBoxHeight != null) patch.boxHeight = round(a.currentBoxHeight);
        if (!Object.keys(patch).length) return;
        if (patch.boxWidth === overlay.boxWidth && patch.boxHeight === overlay.boxHeight) return;
        setOverlays((all) => all.map((o) => (o.id === a.overlayId ? { ...o, ...patch } : o)));
        try {
          await api.updateOverlay(a.overlayId, patch);
          setError(null);
        } catch (err) {
          setOverlays((all) => all.map((o) => (o.id === a.overlayId ? overlay : o)));
          if (a.card) {
            if (overlay.boxWidth != null) {
              a.card.style.width = `${overlay.boxWidth}px`;
              a.card.style.maxWidth = `${overlay.boxWidth}px`;
            } else {
              a.card.style.width = '';
              a.card.style.maxWidth = '';
            }
            if (overlay.boxHeight != null) {
              a.card.style.height = `${overlay.boxHeight}px`;
              a.card.style.overflow = 'hidden';
            } else {
              a.card.style.height = '';
              a.card.style.overflow = '';
            }
          }
          setError(err.message);
        }
        return;
      }

      if (a.type === 'text-drag') {
        if (a.lastX == null) return;
        let pitch, yaw;
        try {
          [pitch, yaw] = viewerRef.current.mouseEventToCoords({ clientX: a.lastX, clientY: a.lastY });
        } catch {
          a.card.style.transform = cardTransform(a.scaleN);
          return;
        }
        pitch = round(pitch);
        yaw = round(yaw);

        const cfg = viewerRef.current.getConfig();
        const hs = (cfg.hotSpots || []).find((h) => h.id === `ovl-${a.overlayId}-text`);
        if (hs) {
          hs.pitch = pitch;
          hs.yaw = yaw;
        }
        const cardEl = a.card;
        const scaleN = a.scaleN;
        forceRender();
        // Clear the drag offset on the next frame — Pannellum's own rAF runs
        // first and repositions the outer hotspot div, then this resets the
        // card transform. Both land in one paint, no flicker.
        requestAnimationFrame(() => {
          cardEl.style.transform = cardTransform(scaleN);
        });

        if (pitch === overlay.pitch && yaw === overlay.yaw) return;
        setOverlays((all) => all.map((o) => (o.id === a.overlayId ? { ...o, pitch, yaw } : o)));
        try {
          await api.updateOverlay(a.overlayId, { pitch, yaw });
          setError(null);
        } catch (err) {
          setOverlays((all) => all.map((o) => (o.id === a.overlayId ? overlay : o)));
          if (hs) {
            hs.pitch = overlay.pitch;
            hs.yaw = overlay.yaw;
            forceRender();
          }
          setError(err.message);
        }
        return;
      }

      if (a.type === 'line-endpoint') {
        if (!a.currentPatch) return;
        const patch = {};
        for (const k of Object.keys(a.currentPatch)) patch[k] = round(a.currentPatch[k]);
        try {
          await api.updateOverlay(a.overlayId, patch);
          setError(null);
        } catch (err) {
          setOverlays((all) => all.map((o) => (o.id === a.overlayId ? overlay : o)));
          setError(err.message);
        }
      }
    };

    container.addEventListener('mousedown', onDown);
    container.addEventListener('touchstart', onDown, { passive: false });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    return () => {
      container.removeEventListener('mousedown', onDown);
      container.removeEventListener('touchstart', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
      document.body.style.cursor = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Hotspot CRUD (immediate / optimistic) ────────────────────────────────────
  const createHotspot = async ({ pitch, yaw, toSceneId }) => {
    const tempId = `tmp-${Math.random().toString(36).slice(2, 10)}`;
    setHotspots((all) => [...all, { id: tempId, pitch, yaw, toSceneId }]);
    try {
      const created = await api.createHotspot(sceneId, { pitch, yaw, toSceneId });
      setHotspots((all) =>
        all.map((h) =>
          h.id === tempId
            ? { id: created.id, pitch: created.pitch, yaw: created.yaw, toSceneId: created.toSceneId }
            : h
        )
      );
      setError(null);
    } catch (err) {
      setHotspots((all) => all.filter((h) => h.id !== tempId));
      setError(err.message);
    }
  };

  const changeHotspotTarget = async (id, toSceneId) => {
    const prev = hotspotsRef.current.find((h) => h.id === id);
    if (!prev || prev.toSceneId === toSceneId) return;
    setHotspots((all) => all.map((h) => (h.id === id ? { ...h, toSceneId } : h)));
    if (String(id).startsWith('tmp-')) return;
    try {
      await api.updateHotspot(id, { toSceneId });
      setError(null);
    } catch (err) {
      setHotspots((all) => all.map((h) => (h.id === id ? prev : h)));
      setError(err.message);
    }
  };

  const removeHotspot = async (id) => {
    const target = hotspotsRef.current.find((h) => h.id === id);
    if (!target) return;
    if (!confirm('Delete this hotspot?')) return;
    const index = hotspotsRef.current.findIndex((h) => h.id === id);
    setHotspots((all) => all.filter((h) => h.id !== id));
    if (String(id).startsWith('tmp-')) return;
    try {
      await api.deleteHotspot(id);
      setError(null);
    } catch (err) {
      setHotspots((all) => {
        const next = [...all];
        next.splice(index, 0, target);
        return next;
      });
      setError(err.message);
    }
  };

  // ── Overlay CRUD (immediate / optimistic) ────────────────────────────────────
  const createOverlay = async (body) => {
    const tempId = `tmp-${Math.random().toString(36).slice(2, 10)}`;
    const optimistic = { id: tempId, ...body };
    setOverlays((all) => [...all, optimistic]);
    overlayHotspots([optimistic], { editable: true }).forEach((h) => {
      try { viewerRef.current?.addHotSpot(h, SCENE_KEY); } catch {}
    });
    try {
      const created = await api.createOverlay(sceneId, body);
      pannellumIdsForOverlay(optimistic).forEach((hid) => {
        try { viewerRef.current?.removeHotSpot(hid, SCENE_KEY); } catch {}
      });
      overlayHotspots([created], { editable: true }).forEach((h) => {
        try { viewerRef.current?.addHotSpot(h, SCENE_KEY); } catch {}
      });
      setOverlays((all) => all.map((o) => (o.id === tempId ? created : o)));
      setError(null);
    } catch (err) {
      pannellumIdsForOverlay(optimistic).forEach((hid) => {
        try { viewerRef.current?.removeHotSpot(hid, SCENE_KEY); } catch {}
      });
      setOverlays((all) => all.filter((o) => o.id !== tempId));
      setError(err.message);
    }
  };

  const patchOverlay = async (id, patch) => {
    const prev = overlays.find((o) => o.id === id);
    if (!prev) return;
    const next = { ...prev, ...patch };
    setOverlays((all) => all.map((o) => (o.id === id ? next : o)));
    if (next.type !== 'line') {
      pannellumIdsForOverlay(prev).forEach((hid) => {
        try { viewerRef.current?.removeHotSpot(hid, SCENE_KEY); } catch {}
      });
      overlayHotspots([next], { editable: true }).forEach((h) => {
        try { viewerRef.current?.addHotSpot(h, SCENE_KEY); } catch {}
      });
    }
    try {
      await api.updateOverlay(id, patch);
      setError(null);
    } catch (err) {
      setOverlays((all) => all.map((o) => (o.id === id ? prev : o)));
      if (next.type !== 'line') {
        pannellumIdsForOverlay(next).forEach((hid) => {
          try { viewerRef.current?.removeHotSpot(hid, SCENE_KEY); } catch {}
        });
        overlayHotspots([prev], { editable: true }).forEach((h) => {
          try { viewerRef.current?.addHotSpot(h, SCENE_KEY); } catch {}
        });
      }
      setError(err.message);
    }
  };

  const removeOverlay = async (id) => {
    const target = overlays.find((o) => o.id === id);
    if (!target) return;
    if (!confirm('Delete this overlay?')) return;
    const index = overlays.findIndex((o) => o.id === id);
    setOverlays((all) => all.filter((o) => o.id !== id));
    pannellumIdsForOverlay(target).forEach((hid) => {
      try { viewerRef.current?.removeHotSpot(hid, SCENE_KEY); } catch {}
    });
    if (String(id).startsWith('tmp-')) return;
    try {
      await api.deleteOverlay(id);
      setError(null);
    } catch (err) {
      setOverlays((all) => {
        const next = [...all];
        next.splice(index, 0, target);
        return next;
      });
      overlayHotspots([target], { editable: true }).forEach((h) => {
        try { viewerRef.current?.addHotSpot(h, SCENE_KEY); } catch {}
      });
      setError(err.message);
    }
  };

  // ── Toolbar arming ───────────────────────────────────────────────────────────
  const noSiblings = siblings.length === 0;
  const armHotspot = () => {
    setPendingLineStart(null);
    setArm(arm === 'hotspot' ? null : 'hotspot');
  };
  const armText = () => {
    setPendingLineStart(null);
    setArm(arm === 'text' ? null : 'text');
  };
  const armLine = () => {
    setPendingLineStart(null);
    setArm(arm?.startsWith('line') ? null : 'line-first');
  };

  const armHotspotLabel = arm === 'hotspot' ? 'Click pano to place…' : '+ Add hotspot';
  const armTextLabel = arm === 'text' ? 'Click pano to place…' : '+ Add text';
  const armLineLabel =
    arm === 'line-first' ? 'Click START point…' :
    arm === 'line-second' ? 'Click END point…' : '+ Add line';

  return (
    <div className="admin__panel">
      <PannellumLoader />
      <div className="admin__panel-header">
        <h2 className="admin__panel-title">Panoramic editing</h2>
        <div className="admin__list-actions">
          <button
            type="button"
            className={`btn ${arm === 'hotspot' ? 'btn--primary' : 'btn--ghost'}`}
            onClick={armHotspot}
            disabled={noSiblings}
            title={noSiblings ? 'Add a second scene to this tour to enable hotspots.' : ''}
          >
            {armHotspotLabel}
          </button>
          <button
            type="button"
            className={`btn ${arm === 'text' ? 'btn--primary' : 'btn--ghost'}`}
            onClick={armText}
          >
            {armTextLabel}
          </button>
          <button
            type="button"
            className={`btn ${arm?.startsWith('line') ? 'btn--primary' : 'btn--ghost'}`}
            onClick={armLine}
          >
            {armLineLabel}
          </button>
        </div>
      </div>

      {arm === 'hotspot' && (
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
        </div>
      )}

      {error && <div className="admin__error">{error}</div>}

      <div className="initial-view">
        <div className="initial-view__label">
          <strong>Initial view</strong>
          {ivIsSet ? (
            <span className="picker__hint">
              pitch {fmtAngle(initialView.pitch)} · yaw {fmtAngle(initialView.yaw)} · hfov {fmtAngle(initialView.hfov)}
            </span>
          ) : (
            <span className="picker__hint">Not set — uses tour default.</span>
          )}
        </div>
        <div className="initial-view__actions">
          {ivStatus === 'saved' && <span className="picker__hint">Saved ✓</span>}
          <button
            type="button"
            className="btn btn--ghost"
            onClick={captureInitialView}
            disabled={!viewerReady || ivSaving}
            title="Pan/zoom the pano below, then click here to lock that view as the entry point."
          >
            {ivSaving ? 'Saving…' : 'Use current view'}
          </button>
          {ivIsSet && (
            <button
              type="button"
              className="btn btn--ghost btn--danger"
              onClick={resetInitialView}
              disabled={ivSaving}
            >
              Reset
            </button>
          )}
        </div>
      </div>
      {ivError && <div className="admin__error">{ivError}</div>}

      <div className={`hs-edit-stage is-editing ${arm ? 'is-arming' : ''}`}>
        <div ref={containerRef} className="hs-edit-pano" />
      </div>

      {hotspots.length === 0 && overlays.length === 0 ? (
        <div className="admin__empty">
          Use “+ Add hotspot” to link to another scene, “+ Add text” to drop a label, or
          “+ Add line” to mark a width/height (click two points).
        </div>
      ) : (
        <>
          {hotspots.length > 0 && (
            <ul className="hs-edit-list">
              {hotspots.map((h, i) => (
                <li key={h.id} className="hs-edit-list__row">
                  <span className="hs-edit-list__num">{i + 1}</span>
                  <span className="picker__coords" style={{ minWidth: 56 }}>hotspot</span>
                  <label className="field" style={{ flex: 1 }}>
                    <span className="field__label">Target scene</span>
                    <select
                      className="field__input"
                      value={h.toSceneId}
                      onChange={(e) => changeHotspotTarget(h.id, e.target.value)}
                    >
                      {siblings.map((s) => (
                        <option key={s.id} value={s.id}>{s.title}</option>
                      ))}
                    </select>
                  </label>
                  <span className="hs-edit-list__coord">
                    p {Number(h.pitch).toFixed(1)}° · y {Number(h.yaw).toFixed(1)}°
                  </span>
                  <button
                    type="button"
                    className="btn btn--ghost btn--danger"
                    onClick={() => removeHotspot(h.id)}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}

          {overlays.length > 0 && (
            <ul className="hs-edit-list">
              {overlays.map((o, i) => (
                <li key={o.id} className="hs-edit-list__row">
                  <span className="hs-edit-list__num">{i + 1}</span>
                  <span className="picker__coords" style={{ minWidth: 56 }}>
                    {o.type === 'line' ? 'line' : 'text'}
                  </span>
                  {o.type === 'line' ? (
                    <OverlayLabelInput
                      value={o.label}
                      placeholder="Dimension (e.g. 15m)"
                      onCommit={(next) => {
                        if (next !== (o.label || null)) patchOverlay(o.id, { label: next });
                      }}
                    />
                  ) : (
                    <OverlayLabelInput
                      value={o.title || o.label}
                      placeholder="Label text"
                      onCommit={(next) => {
                        if (next !== (o.title || null)) patchOverlay(o.id, { title: next });
                      }}
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
        </>
      )}
    </div>
  );
}

// Controlled input that keeps an internal draft until blur/Enter. Re-syncs from
// `value` whenever the persisted prop changes — so a failed PATCH that rolls
// overlays state back also rolls the input back.
function OverlayLabelInput({ value, placeholder, onCommit }) {
  const persisted = value || '';
  const [draft, setDraft] = useState(persisted);
  useEffect(() => { setDraft(persisted); }, [persisted]);
  return (
    <input
      className="field__input"
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onCommit(draft.trim() || null)}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      style={{ flex: 1 }}
    />
  );
}
