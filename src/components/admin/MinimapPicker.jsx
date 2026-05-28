'use client';

import { useRef } from 'react';
import Floorplan, { cropAspect } from '@/components/Floorplan.jsx';
import { clamp01, round } from '@/lib/num.js';

// Click-anywhere picker for a scene's minimap position.
//
// Props:
//   floorplan: { image, bgSize, bgPosition } — same shape as tours data
//   siblings: [{ id, title, minimapX, minimapY }] — other scenes in the tour, drawn dimmed
//   value: { x, y } | null — the currently-edited scene's dot
//   onChange({ x, y }): called when admin clicks; values are normalised 0..1
//   activeTitle: optional label for the active dot
export default function MinimapPicker({ floorplan, siblings = [], value, onChange, activeTitle }) {
  const innerRef = useRef(null);

  const onClick = (e) => {
    const rect = innerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = clamp01((e.clientX - rect.left) / rect.width);
    const y = clamp01((e.clientY - rect.top) / rect.height);
    onChange?.({ x: round(x), y: round(y) });
  };

  if (!floorplan?.image) {
    return (
      <div className="picker picker--empty">
        <span className="picker__hint">
          No floorplan set on this tour — add one in the tour's metadata to enable visual placement.
        </span>
        <CoordBadge value={value} />
      </div>
    );
  }

  const aspect = cropAspect(floorplan.crop);
  return (
    <div className="picker">
      <div
        ref={innerRef}
        className="picker__inner"
        style={{ aspectRatio: aspect }}
        onClick={onClick}
        role="application"
        aria-label="Click to place this scene on the floorplan"
      >
        <Floorplan floorplan={floorplan} className="picker__img" />
        {siblings.map((s) => (
          <span
            key={s.id}
            className="picker__dot picker__dot--ghost"
            style={{ left: `${s.minimapX * 100}%`, top: `${s.minimapY * 100}%` }}
            title={s.title}
          />
        ))}
        {value && (
          <span
            className="picker__dot picker__dot--active"
            style={{ left: `${value.x * 100}%`, top: `${value.y * 100}%` }}
            title={activeTitle || 'This scene'}
          />
        )}
      </div>
      <div className="picker__footer">
        <span className="picker__hint">Click the floorplan to set this scene's position.</span>
        <CoordBadge value={value} />
      </div>
    </div>
  );
}

function CoordBadge({ value }) {
  if (!value) return <span className="picker__coords">unset</span>;
  return (
    <span className="picker__coords">
      x {value.x.toFixed(3)} · y {value.y.toFixed(3)}
    </span>
  );
}

