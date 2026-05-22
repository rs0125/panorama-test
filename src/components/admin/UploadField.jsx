'use client';

import { useRef, useState } from 'react';
import { uploadFileToR2 } from '@/lib/uploadClient.js';

// Generic single-file upload field. Calls onUploaded(url) when the file has
// finished landing in R2; the parent decides what DB field to write it to.
//
// Props:
//   label, kind ('pano' | 'preview' | 'audio' | 'cover' | 'floorplan'),
//   accept (MIME or extension filter for the file input), value (current URL),
//   onUploaded(url), onClear() optional, disabled
export default function UploadField({
  label,
  kind,
  accept,
  value,
  onUploaded,
  onClear,
  disabled,
}) {
  const inputRef = useRef(null);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);

  const pick = () => inputRef.current?.click();

  const onChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    setError(null);
    setProgress(0);
    try {
      const url = await uploadFileToR2(file, { kind, onProgress: setProgress });
      onUploaded(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setProgress(null);
    }
  };

  const isAudio = kind === 'audio';
  const isImage = !isAudio;

  return (
    <div className="upload">
      <div className="upload__row">
        <span className="upload__label">{label}</span>
        <div className="upload__actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={pick}
            disabled={disabled || progress != null}
          >
            {value ? 'Replace' : 'Upload'}
          </button>
          {value && onClear && (
            <button
              type="button"
              className="btn btn--ghost btn--danger"
              onClick={onClear}
              disabled={disabled || progress != null}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {progress != null && (
        <div className="upload__progress">
          <div className="upload__progress-bar" style={{ width: `${Math.round(progress * 100)}%` }} />
          <span className="upload__progress-label">{Math.round(progress * 100)}%</span>
        </div>
      )}
      {error && <div className="upload__error">{error}</div>}

      {value && !progress && (
        <div className="upload__preview">
          {isImage ? (
            <img src={value} alt="" className="upload__thumb" />
          ) : (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <audio controls src={value} className="upload__audio" />
          )}
          <a className="upload__url" href={value} target="_blank" rel="noreferrer">
            {value}
          </a>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={onChange}
        style={{ display: 'none' }}
      />
    </div>
  );
}
