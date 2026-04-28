import { useEffect, useRef, useState } from 'react';

export default function AudioButton({ src, ready }) {
  const audioRef = useRef(null);
  const [enabled, setEnabled] = useState(false);
  const [ended, setEnded] = useState(false);

  // Lazily create the audio element once.
  useEffect(() => {
    const a = new Audio();
    a.preload = 'auto';
    a.addEventListener('ended', () => setEnded(true));
    audioRef.current = a;
    return () => {
      a.pause();
      audioRef.current = null;
    };
  }, []);

  // Source change → load new track from start but DON'T auto-play yet.
  // Playback is deferred until the pano image is ready.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    setEnded(false);
    if (!src) {
      a.pause();
      a.removeAttribute('src');
      return;
    }
    a.src = src;
    a.currentTime = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // Auto-play once the panorama image has loaded (ready becomes true).
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !src || !ready || !enabled) return;
    a.play().catch(() => setEnabled(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Toggle enabled → play/pause from current position (do NOT reset).
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !src) return;
    if (enabled) {
      if (ended) {
        a.currentTime = 0;
        setEnded(false);
      }
      a.play().catch(() => setEnabled(false));
    } else {
      a.pause();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const replay = () => {
    const a = audioRef.current;
    if (!a || !src) return;
    a.currentTime = 0;
    setEnded(false);
    setEnabled(true);
    a.play().catch(() => setEnabled(false));
  };

  if (!src) return null;

  if (ended) {
    return (
      <button
        type="button"
        className="audio-btn audio-btn--replay"
        onClick={replay}
        aria-label="Replay audio"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path
            d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </button>
    );
  }

  return (
    <button
      type="button"
      className="audio-btn"
      onClick={() => setEnabled((e) => !e)}
      aria-label={enabled ? 'Mute audio' : 'Unmute audio'}
      aria-pressed={enabled}
    >
      {enabled ? (
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
          <path
            d="M16 8.5a4 4 0 0 1 0 7M18.5 6a7 7 0 0 1 0 12"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
          <path
            d="M17 9l5 6M22 9l-5 6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      )}
    </button>
  );
}
