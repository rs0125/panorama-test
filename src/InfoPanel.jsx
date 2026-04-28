import { useState } from 'react';
import AudioButton from './AudioButton.jsx';

export default function InfoPanel({ annotations = [], audioSrc, sceneId, panoReady }) {
  const [open, setOpen] = useState(false);
  const hasAny = annotations.length > 0;

  return (
    <div className={`info ${open ? 'info--open' : ''}`}>
      <div className="info__buttons">
      <button
        type="button"
        className="info__btn"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close info' : 'Open info'}
        aria-expanded={open}
        disabled={!hasAny}
      >
        {open ? (
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="12" cy="8" r="1.2" fill="currentColor" />
            <path d="M12 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
      </button>
      <AudioButton src={audioSrc} ready={panoReady} />
      </div>

      {open && hasAny && (
        <div className="info__list" role="region" aria-label="Scene details">
          {annotations.map((a, i) => (
            <div className="info__card" key={i}>
              {a.title && <div className="info__card-title">{a.title}</div>}
              {a.body && <div className="info__card-body">{a.body}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
