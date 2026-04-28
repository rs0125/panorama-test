import { useEffect, useRef, useState } from 'react';

export default function AudioButton({ src }) {
  const audioRef = useRef(null);
  const [enabled, setEnabled] = useState(false);

  // Lazily create the audio element once.
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.preload = 'auto';
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  // Whenever the source or enabled state changes, restart playback from 0.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (enabled && src) {
      if (a.src !== window.location.origin + src && !a.src.endsWith(src)) {
        a.src = src;
      }
      a.currentTime = 0;
      a.play().catch(() => {
        // Autoplay blocked or src missing — flip back to muted state.
        setEnabled(false);
      });
    } else {
      a.pause();
    }
  }, [enabled, src]);

  if (!src) return null;

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
          <path
            d="M4 9v6h4l5 4V5L8 9H4z"
            fill="currentColor"
          />
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
          <path
            d="M4 9v6h4l5 4V5L8 9H4z"
            fill="currentColor"
          />
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
