import { useEffect, useRef, useState } from 'react';
import { scenes, sceneById } from './scenes.js';

const EDIT_MODE = new URLSearchParams(window.location.search).has('edit');

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

function waitForPannellum() {
  return new Promise((resolve) => {
    if (window.pannellum) return resolve(window.pannellum);
    const id = setInterval(() => {
      if (window.pannellum) {
        clearInterval(id);
        resolve(window.pannellum);
      }
    }, 30);
  });
}

export default function PanoViewer({ currentSceneId, onSceneChange }) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState(
    () => scenes.find((s) => s.id !== currentSceneId)?.id || scenes[0].id
  );
  const editTargetRef = useRef(editTarget);
  useEffect(() => { editTargetRef.current = editTarget; }, [editTarget]);

  useEffect(() => {
    let cancelled = false;
    let ro;
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
        const previewSrc = s.image.replace('/panos/', '/panos/previews/').replace('.jpeg', '.jpg');
        sceneMap[s.id] = {
          type: 'equirectangular',
          panorama: s.image,
          preview: previewSrc,
          autoLoad: true,
          hfov: initialHfov,
          showControls: false,
          hotSpots,
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
        onSceneChange?.(sceneId);
      });
      viewerRef.current.on('load', () => {
        if (cancelled) return;
        setLoading(false);
      });


      if (EDIT_MODE) {
        const onClick = (e) => {
          if (!viewerRef.current) return;
          try {
            const [pitch, yaw] = viewerRef.current.mouseEventToCoords(e);
            const from = viewerRef.current.getScene();
            const to = editTargetRef.current;
            const entry = {
              from,
              to,
              pitch: +pitch.toFixed(2),
              yaw: +yaw.toFixed(2),
            };
            const line = `{ from: '${entry.from}', to: '${entry.to}', pitch: ${entry.pitch}, yaw: ${entry.yaw} },`;
            console.log(line, entry);
            navigator.clipboard?.writeText(line).catch(() => {});
          } catch (err) {
            console.warn('Failed to capture click coords', err);
          }
        };
        containerRef.current.addEventListener('click', onClick);
        viewerRef.current.__cleanupEdit = () => {
          containerRef.current?.removeEventListener('click', onClick);
        };
      }
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
    });
    return () => {
      cancelled = true;
      ro?.disconnect();
      if (viewerRef.current) {
        try { viewerRef.current.__cleanupResize?.(); } catch {}
        try { viewerRef.current.__cleanupEdit?.(); } catch {}
        try { viewerRef.current.destroy(); } catch {}
        viewerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <div ref={containerRef} className={`pano-container ${loading ? 'is-loading' : ''}`} />
      {EDIT_MODE && (
        <div className="edit-bar">
          <span className="edit-bar__label">Hotspot target →</span>
          <select
            className="edit-bar__select"
            value={editTarget}
            onChange={(e) => setEditTarget(e.target.value)}
          >
            {scenes
              .filter((s) => s.id !== currentSceneId)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
          </select>
          <span className="edit-bar__hint">click pano to log coords</span>
        </div>
      )}
    </>
  );
}
