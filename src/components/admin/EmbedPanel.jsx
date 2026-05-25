'use client';

import { useEffect, useMemo, useState } from 'react';

// Embed snippet generator + live preview for a tour.
//
// Renders client-side because `window.location.origin` is the simplest way to
// build a snippet that "just works" in dev, staging, and prod without needing
// a NEXT_PUBLIC_SITE_URL env var. If you later add a custom-domain feature,
// swap origin for the tour's configured domain.

export default function EmbedPanel({ tourSlug }) {
  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState(false);
  // Iframe sizing controls — these affect the snippet, not how we display the
  // preview. Sensible defaults for a landscape pano viewer.
  const [width, setWidth] = useState('100%');
  const [height, setHeight] = useState(600);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const url = origin ? `${origin}/tour/${tourSlug}?embed=1` : '';

  const snippet = useMemo(() => {
    if (!url) return '';
    return [
      `<iframe`,
      `  src="${url}"`,
      `  width="${width}"`,
      `  height="${height}"`,
      `  style="border:0;border-radius:12px;display:block;max-width:100%"`,
      `  allow="fullscreen; xr-spatial-tracking; gyroscope; accelerometer; autoplay"`,
      `  loading="lazy"`,
      `  title="Virtual tour"`,
      `></iframe>`,
    ].join('\n');
  }, [url, width, height]);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API fails on insecure origins / restrictive perms — fall
      // back to the textarea, which is already selected on click.
    }
  };

  return (
    <div className="admin__panel">
      <div className="admin__panel-header">
        <h2 className="admin__panel-title">Embed</h2>
        <div className="admin__list-actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onCopy}
            disabled={!snippet}
          >
            {copied ? 'Copied ✓' : 'Copy snippet'}
          </button>
        </div>
      </div>

      <div className="field-row">
        <label className="field">
          <span className="field__label">Width</span>
          <input
            className="field__input"
            value={width}
            onChange={(e) => setWidth(e.target.value)}
            placeholder='e.g. 100% or 800'
          />
        </label>
        <label className="field">
          <span className="field__label">Height (px)</span>
          <input
            className="field__input"
            type="number"
            value={height}
            min={200}
            max={2000}
            onChange={(e) => setHeight(Number(e.target.value) || 600)}
          />
        </label>
      </div>

      <textarea
        className="field__input field__input--multiline embed-snippet"
        value={snippet}
        readOnly
        rows={6}
        onClick={(e) => e.target.select()}
      />
      <span className="field__hint">
        Paste into any HTML page or website builder. The tour stays
        interactive — pan, zoom, hotspots, audio, fullscreen all work inside
        the iframe.
      </span>

      {url && (
        <div className="embed-preview">
          <span className="picker__hint">Preview</span>
          <iframe
            key={url + width + height}
            src={url}
            width="100%"
            height={Math.min(Number(height) || 600, 500)}
            style={{ border: 0, borderRadius: 12, display: 'block' }}
            allow="fullscreen; xr-spatial-tracking; gyroscope; accelerometer; autoplay"
            loading="lazy"
            title="Embed preview"
          />
        </div>
      )}
    </div>
  );
}
