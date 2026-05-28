'use client';

import { useEffect, useRef, useState } from 'react';
import {
  overlayHotspots,
  drawLineOverlays,
  removeLineLayer,
} from '@/lib/overlayRendering.js';
import { waitForPannellum } from '@/lib/pannellum.js';
import PannellumLoader from './PannellumLoader.jsx';

function buildHotspotTooltip(hotDiv, args) {
  hotDiv.classList.add('hs');
  const pill = document.createElement('div');
  pill.className = 'hs__pill';
  pill.innerHTML = `
    <span class="hs__label">${args.label}</span>
    <span class="hs__icon-wrap">
      <svg class="hs__icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2.5c-3.59 0-6.5 2.91-6.5 6.5 0 4.78 6.5 12.5 6.5 12.5s6.5-7.72 6.5-12.5c0-3.59-2.91-6.5-6.5-6.5zm0 9a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" fill="currentColor"/>
      </svg>
    </span>
  `;
  hotDiv.appendChild(pill);
}

// Nadir patch — a white disk anchored to the south pole of the sphere so it
// hides whatever was directly below the camera (tripod / photographer's feet).
//
// Pannellum positions a hotspot div by its TOP-LEFT corner at the sphere
// point. To centre a fixed-size disk on the pole we need a child element with
// its own translate(-50%, -50%) — same pattern as the navigation pills.
//
// Pitch -89 instead of -90 sidesteps Pannellum's pole-singularity glitches.
function buildNadirPatch(hotDiv) {
  hotDiv.classList.add('nadir-patch');
  const disk = document.createElement('div');
  disk.className = 'nadir-patch__disk';
  hotDiv.appendChild(disk);
}

const NADIR_PATCH = Object.freeze({
  // -89.95 lands the hotspot effectively on the south pole — close enough that
  // it visually centres on the actual nadir, far enough to dodge the
  // pole-singularity rendering glitches Pannellum has at exactly -90.
  pitch: -89.95,
  yaw: 0,
  type: 'info',
  cssClass: 'nadir-patch',
  createTooltipFunc: buildNadirPatch,
  createTooltipArgs: {},
});

// Overlay rendering helpers live in src/lib/overlayRendering.js so both the
// public PanoViewer and the admin OverlayEditor share the same code.

export default function PanoViewer({ scenes, currentSceneId, onSceneChange, onLoadingChange }) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let ro;
    const sceneById = Object.fromEntries(scenes.map((s) => [s.id, s]));
    waitForPannellum().then((pannellum) => {
      if (cancelled || !containerRef.current) return;
      const isNarrow = window.innerWidth < 600;
      const initialHfov = isNarrow ? 75 : 100;
      const sceneMap = {};
      scenes.forEach((s) => {
        const hotSpots = (s.hotspots || []).map((h) => {
          const target = sceneById[h.to];
          return {
            pitch: h.pitch,
            yaw: h.yaw,
            type: 'scene',
            sceneId: h.to,
            cssClass: 'hs',
            createTooltipFunc: buildHotspotTooltip,
            createTooltipArgs: { label: target?.title || h.to },
          };
        });
        // Append overlay hotspots: text overlays render directly here, line
        // overlays contribute two invisible endpoint hotspots that the SVG
        // layer reads back on each frame.
        overlayHotspots(s.overlays).forEach((h) => hotSpots.push(h));
        // Every scene gets the nadir patch — appended last so it stacks above
        // navigation hotspots if any happen to be in the south-pole region.
        hotSpots.push({ ...NADIR_PATCH });
        const previewSrc = s.image.replace('/panos/', '/panos/previews/').replace('.jpeg', '.jpg');
        // Per-scene initial view overrides the tour default when set in admin.
        // Pannellum ignores undefined keys, so we only spread the ones we have.
        const iv = s.initialView || {};
        const initialOverrides = {};
        if (iv.pitch != null) initialOverrides.pitch = iv.pitch;
        if (iv.yaw != null) initialOverrides.yaw = iv.yaw;
        sceneMap[s.id] = {
          type: 'equirectangular',
          panorama: s.image,
          preview: previewSrc,
          autoLoad: true,
          hfov: iv.hfov != null ? iv.hfov : initialHfov,
          showControls: false,
          hotSpots,
          ...initialOverrides,
        };
      });
      viewerRef.current = pannellum.viewer(containerRef.current, {
        default: {
          firstScene: currentSceneId,
          sceneFadeDuration: 600,
          autoLoad: true,
          showControls: false,
          hfov: initialHfov,
          minHfov: 40,
          maxHfov: 120,
        },
        scenes: sceneMap,
      });

      viewerRef.current.on('scenechange', (sceneId) => {
        if (cancelled) return;
        setLoading(true);
        onLoadingChange?.(true);
        onSceneChange?.(sceneId);
      });
      viewerRef.current.on('load', () => {
        if (cancelled) return;
        setLoading(false);
        onLoadingChange?.(false);
      });


      const doResize = () => {
        try { viewerRef.current?.resize(); } catch {}
      };
      ro = new ResizeObserver(doResize);
      ro.observe(containerRef.current);
      window.addEventListener('orientationchange', doResize);
      window.addEventListener('resize', doResize);
      viewerRef.current.__cleanupResize = () => {
        window.removeEventListener('orientationchange', doResize);
        window.removeEventListener('resize', doResize);
      };

      // Line-overlay refresh loop. We do the projection ourselves using
      // Pannellum's exposed view state (pitch/yaw/hfov) — this gives us a
      // clean Z value per endpoint and correct near-plane culling, which is
      // what we couldn't get from the previous DOM-reading approach.
      let rafId = 0;
      const tick = () => {
        if (cancelled) return;
        try {
          const v = viewerRef.current;
          if (v) {
            const sceneKey = v.getScene?.();
            const scene = sceneKey ? sceneById[sceneKey] : null;
            const lines = (scene?.overlays || []).filter((o) => o.type === 'line');
            // Skip the work when nothing's on screen. The rAF schedule itself
            // is cheap; the expensive part is the Pannellum getters + SVG
            // projection. Tours without dimension lines pay nothing per frame.
            if (lines.length > 0) {
              drawLineOverlays(containerRef.current, lines, {
                view: { pitch: v.getPitch(), yaw: v.getYaw(), hfov: v.getHfov() },
              });
            }
          }
        } catch {}
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
      viewerRef.current.__cleanupOverlays = () => {
        cancelAnimationFrame(rafId);
        removeLineLayer(containerRef.current);
      };
    });
    return () => {
      cancelled = true;
      ro?.disconnect();
      if (viewerRef.current) {
        try { viewerRef.current.__cleanupResize?.(); } catch {}
        try { viewerRef.current.__cleanupOverlays?.(); } catch {}
        try { viewerRef.current.destroy(); } catch {}
        viewerRef.current = null;
      }
    };
    // Rebuild viewer when the tour's scenes change (different tour selected).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenes]);

  useEffect(() => {
    if (viewerRef.current && currentSceneId) {
      try {
        if (viewerRef.current.getScene && viewerRef.current.getScene() !== currentSceneId) {
          viewerRef.current.loadScene(currentSceneId);
        }
      } catch {}
    }
  }, [currentSceneId]);

  return (
    <>
      <PannellumLoader />
      <div ref={containerRef} className={`pano-container ${loading ? 'is-loading' : ''}`} />
    </>
  );
}
