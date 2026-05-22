'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import PanoViewer from './PanoViewer.jsx';
import Minimap from './Minimap.jsx';
import InfoPanel from './InfoPanel.jsx';

export default function TourView({ tour }) {
  const scenes = tour.scenes;
  const [currentSceneId, setCurrentSceneId] = useState(scenes[0].id);
  const [fsSupported, setFsSupported] = useState(false);
  const [panoReady, setPanoReady] = useState(false);
  const current = scenes.find((s) => s.id === currentSceneId) || scenes[0];

  useEffect(() => {
    setCurrentSceneId(scenes[0].id);
    setPanoReady(false);
  }, [tour.id]);

  useEffect(() => {
    const el = document.documentElement;
    setFsSupported(Boolean(el.requestFullscreen || el.webkitRequestFullscreen));
  }, []);

  const goFullscreen = () => {
    const el = document.documentElement;
    const isFs = document.fullscreenElement || document.webkitFullscreenElement;
    if (isFs) {
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
    } else {
      (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
    }
  };

  const idx = scenes.findIndex((s) => s.id === currentSceneId);
  const next = scenes[(idx + 1) % scenes.length];

  return (
    <div className="app">
      <PanoViewer
        scenes={scenes}
        currentSceneId={currentSceneId}
        onSceneChange={setCurrentSceneId}
        onLoadingChange={(l) => setPanoReady(!l)}
      />

      <InfoPanel
        annotations={current.annotations}
        audioSrc={current.audio}
        sceneId={current.id}
        panoReady={panoReady}
      />

      <Link href="/" className="back-btn" aria-label="Back to tours">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path
            d="M15 6l-6 6 6 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </Link>

      <div className="title-chip">{current.title}</div>

      {fsSupported && (
        <button className="fs-btn" onClick={goFullscreen} aria-label="Toggle fullscreen">
          ⛶
        </button>
      )}

      <button
        className="next-btn"
        onClick={() => setCurrentSceneId(next.id)}
        aria-label={`Go to ${next.title}`}
      >
        Next: {next.title} →
      </button>

      <Minimap
        scenes={scenes}
        floorplan={tour.floorplan}
        currentSceneId={currentSceneId}
        onSelect={setCurrentSceneId}
      />
    </div>
  );
}
