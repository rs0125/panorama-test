'use client';

import { useEffect, useRef, useState } from 'react';
import Floorplan, { cropAspect } from './Floorplan.jsx';

const EDIT_MODE =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has('edit');

export default function Minimap({ scenes, floorplan, currentSceneId, onSelect }) {
  const [collapsed, setCollapsed] = useState(false);
  const [coords, setCoords] = useState(() =>
    Object.fromEntries(scenes.map((s) => [s.id, { ...s.minimap }]))
  );
  const innerRef = useRef(null);
  const dragRef = useRef(null);

  // Reset dot positions whenever the active tour changes.
  useEffect(() => {
    setCoords(Object.fromEntries(scenes.map((s) => [s.id, { ...s.minimap }])));
  }, [scenes]);

  useEffect(() => {
    if (!EDIT_MODE) return;
    const onMove = (e) => {
      if (!dragRef.current || !innerRef.current) return;
      const rect = innerRef.current.getBoundingClientRect();
      const point = e.touches ? e.touches[0] : e;
      const x = Math.max(0, Math.min(1, (point.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (point.clientY - rect.top) / rect.height));
      setCoords((c) => ({ ...c, [dragRef.current]: { x: +x.toFixed(3), y: +y.toFixed(3) } }));
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, []);

  const startDrag = (id) => (e) => {
    if (!EDIT_MODE) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = id;
  };

  const dump = () => {
    const lines = scenes.map((s) => {
      const c = coords[s.id];
      return `  { id: '${s.id}', title: '${s.title}', image: '${s.image}', minimap: { x: ${c.x}, y: ${c.y} } },`;
    }).join('\n');
    const out = `export const scenes = [\n${lines}\n];`;
    console.log(out);
    if (navigator.clipboard) navigator.clipboard.writeText(out).catch(() => {});
    alert('Coords logged to console and copied to clipboard.');
  };

  // Container width is fixed (per CSS); height derives from the crop's aspect
  // so any rectangle shape works. We set both --minimap-aspect for size-driven
  // layout and a fallback aspectRatio for browsers that ignore the var.
  const aspect = cropAspect(floorplan?.crop);
  const shellStyle = collapsed
    ? undefined
    : { '--minimap-aspect': aspect, aspectRatio: aspect };

  return (
    <div
      className={`minimap ${collapsed ? 'minimap--collapsed' : ''}`}
      style={shellStyle}
    >
      <button
        className="minimap__toggle"
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? 'Expand minimap' : 'Collapse minimap'}
      >
        {collapsed ? (
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              d="M12 2.5c-3.59 0-6.5 2.91-6.5 6.5 0 4.78 6.5 12.5 6.5 12.5s6.5-7.72 6.5-12.5c0-3.59-2.91-6.5-6.5-6.5zm0 9a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"
              fill="currentColor"
            />
          </svg>
        ) : (
          '×'
        )}
      </button>
      {!collapsed && (
        <div className="minimap__inner" ref={innerRef}>
          <Floorplan floorplan={floorplan} className="minimap__img" />
          {scenes.map((s) => {
            const c = coords[s.id];
            return (
              <button
                key={s.id}
                type="button"
                className={`dot ${s.id === currentSceneId ? 'dot--active' : ''} ${EDIT_MODE ? 'dot--edit' : ''}`}
                style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }}
                onClick={() => !EDIT_MODE && onSelect(s.id)}
                onMouseDown={startDrag(s.id)}
                onTouchStart={startDrag(s.id)}
                title={EDIT_MODE ? `${s.title} (${c.x}, ${c.y})` : s.title}
                aria-label={s.title}
              />
            );
          })}
          {EDIT_MODE && (
            <button className="minimap__dump" onClick={dump} type="button">
              Copy coords
            </button>
          )}
        </div>
      )}
    </div>
  );
}
