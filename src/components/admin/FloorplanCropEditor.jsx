'use client';

import { useEffect, useRef, useState } from 'react';

// Visual crop editor for the tour floorplan.
//
// Shows the full floorplan image at its natural aspect, with a draggable +
// resizable rectangle overlay. The rectangle defines BOTH what region the
// viewer's minimap shows AND the minimap's aspect ratio — so any rectangle
// shape (wide, tall, square) is valid.
//
// Props:
//   imageUrl: floorplan image URL (required to render anything useful)
//   value: { x, y, w, h } | null  — normalised 0..1 over the source image
//   onChange({ x, y, w, h }): called on every commit (drag end / resize end)
//
// The rectangle is rendered against the image's natural aspect ratio. We
// load the image once to read naturalWidth/Height so the overlay box exactly
// matches the image (no `object-fit: contain` letterbox guesswork).

const HANDLES = [
  { id: 'nw', cursor: 'nwse-resize', x: 0,   y: 0   },
  { id: 'n',  cursor: 'ns-resize',   x: 0.5, y: 0   },
  { id: 'ne', cursor: 'nesw-resize', x: 1,   y: 0   },
  { id: 'e',  cursor: 'ew-resize',   x: 1,   y: 0.5 },
  { id: 'se', cursor: 'nwse-resize', x: 1,   y: 1   },
  { id: 's',  cursor: 'ns-resize',   x: 0.5, y: 1   },
  { id: 'sw', cursor: 'nesw-resize', x: 0,   y: 1   },
  { id: 'w',  cursor: 'ew-resize',   x: 0,   y: 0.5 },
];

const MIN_SIZE = 0.05; // 5% of the image — anything smaller is unusable.

export default function FloorplanCropEditor({ imageUrl, value, onChange }) {
  const stageRef = useRef(null);
  const [imgAspect, setImgAspect] = useState(null);
  const [rect, setRect] = useState(() => normalise(value));
  const [drag, setDrag] = useState(null); // { mode: 'move'|'resize', handle?, startRect, startX, startY }

  // Keep local rect in sync if parent resets it (e.g. after a save / reload).
  useEffect(() => { setRect(normalise(value)); }, [value?.x, value?.y, value?.w, value?.h]);

  // Read natural image dimensions to size the stage. Without this we'd be
  // guessing at the aspect, and the crop rect would float in letterboxing.
  useEffect(() => {
    if (!imageUrl) { setImgAspect(null); return; }
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      setImgAspect(img.naturalWidth / img.naturalHeight);
    };
    img.src = imageUrl;
    return () => { cancelled = true; };
  }, [imageUrl]);

  useEffect(() => {
    if (!drag) return;
    const move = (e) => {
      const rectBox = stageRef.current?.getBoundingClientRect();
      if (!rectBox) return;
      if (e.cancelable) e.preventDefault();
      const p = e.touches ? e.touches[0] : e;
      const dx = (p.clientX - drag.startX) / rectBox.width;
      const dy = (p.clientY - drag.startY) / rectBox.height;
      setRect((r) => applyDrag(drag, dx, dy));
    };
    const end = () => {
      setDrag(null);
      // Commit on drop. Bubbling up only at end means the parent's
      // "dirty" check only flips once per gesture, not per pixel.
      setRect((r) => { onChange?.(r); return r; });
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', end);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', end);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', end);
    };
  }, [drag, onChange]);

  const startMove = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const p = e.touches ? e.touches[0] : e;
    setDrag({ mode: 'move', startRect: rect, startX: p.clientX, startY: p.clientY });
  };

  const startResize = (handle) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    const p = e.touches ? e.touches[0] : e;
    setDrag({ mode: 'resize', handle, startRect: rect, startX: p.clientX, startY: p.clientY });
  };

  const reset = () => {
    const next = { x: 0, y: 0, w: 1, h: 1 };
    setRect(next);
    onChange?.(next);
  };

  if (!imageUrl) {
    return (
      <div className="picker picker--empty">
        <span className="picker__hint">Upload a floorplan image to set the minimap crop.</span>
      </div>
    );
  }

  const aspectStyle = imgAspect ? { aspectRatio: imgAspect } : { aspectRatio: '16 / 10' };
  const cropAspect = (rect.w / rect.h).toFixed(2);

  return (
    <div className="crop-editor">
      <div
        ref={stageRef}
        className="crop-editor__stage"
        style={{ ...aspectStyle, backgroundImage: `url('${imageUrl}')` }}
      >
        <div
          className={`crop-editor__rect ${drag ? 'is-dragging' : ''}`}
          style={rectStyle(rect)}
          onMouseDown={startMove}
          onTouchStart={startMove}
          role="region"
          aria-label="Crop rectangle — drag to move"
        >
          {HANDLES.map((h) => (
            <span
              key={h.id}
              className={`crop-editor__handle crop-editor__handle--${h.id}`}
              style={{ cursor: h.cursor }}
              onMouseDown={startResize(h.id)}
              onTouchStart={startResize(h.id)}
            />
          ))}
        </div>
      </div>
      <div className="crop-editor__footer">
        <span className="picker__hint">
          Drag the rectangle to move; drag a corner/edge to resize. The minimap matches this shape.
        </span>
        <span className="picker__coords">
          {rect.w.toFixed(2)}×{rect.h.toFixed(2)} · aspect {cropAspect}
        </span>
        <button type="button" className="btn btn--ghost" onClick={reset}>
          Reset
        </button>
      </div>
    </div>
  );
}

function normalise(v) {
  if (!v || v.x == null || v.y == null || v.w == null || v.h == null) {
    return { x: 0, y: 0, w: 1, h: 1 };
  }
  return clampRect(v);
}

function rectStyle(r) {
  return {
    left: `${r.x * 100}%`,
    top: `${r.y * 100}%`,
    width: `${r.w * 100}%`,
    height: `${r.h * 100}%`,
  };
}

function applyDrag(drag, dx, dy) {
  const { startRect, mode, handle } = drag;
  if (mode === 'move') {
    return clampRect({
      x: startRect.x + dx,
      y: startRect.y + dy,
      w: startRect.w,
      h: startRect.h,
    });
  }
  // Resize: each handle moves one or two edges. We work with edges (left,
  // right, top, bottom) then re-derive x/y/w/h, clamping to bounds + min size.
  let left   = startRect.x;
  let right  = startRect.x + startRect.w;
  let top    = startRect.y;
  let bottom = startRect.y + startRect.h;

  if (handle.includes('w')) left   = startRect.x + dx;
  if (handle.includes('e')) right  = startRect.x + startRect.w + dx;
  if (handle.includes('n')) top    = startRect.y + dy;
  if (handle.includes('s')) bottom = startRect.y + startRect.h + dy;

  // Honour MIN_SIZE by pushing the moving edge back if it would invert/crush.
  if (right - left < MIN_SIZE) {
    if (handle.includes('w')) left = right - MIN_SIZE;
    else right = left + MIN_SIZE;
  }
  if (bottom - top < MIN_SIZE) {
    if (handle.includes('n')) top = bottom - MIN_SIZE;
    else bottom = top + MIN_SIZE;
  }

  return clampRect({
    x: left,
    y: top,
    w: right - left,
    h: bottom - top,
  });
}

function clampRect(r) {
  const w = clamp(r.w, MIN_SIZE, 1);
  const h = clamp(r.h, MIN_SIZE, 1);
  const x = clamp(r.x, 0, 1 - w);
  const y = clamp(r.y, 0, 1 - h);
  return {
    x: round(x),
    y: round(y),
    w: round(w),
    h: round(h),
  };
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function round(v) { return Math.round(v * 1000) / 1000; }
