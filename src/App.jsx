import { useEffect, useState } from 'react';
import PanoViewer from './PanoViewer.jsx';
import Minimap from './Minimap.jsx';
import InfoPanel from './InfoPanel.jsx';
import AudioButton from './AudioButton.jsx';
import { scenes } from './scenes.js';

export default function App() {
  const [currentSceneId, setCurrentSceneId] = useState(scenes[0].id);
  const [fsSupported, setFsSupported] = useState(false);
  const current = scenes.find((s) => s.id === currentSceneId);

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
      <PanoViewer currentSceneId={currentSceneId} onSceneChange={setCurrentSceneId} />

      <InfoPanel annotations={current.annotations} audioSrc={current.audio} sceneId={current.id} />

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

      <Minimap currentSceneId={currentSceneId} onSelect={setCurrentSceneId} />
    </div>
  );
}
