'use client';

import { useEffect, useRef, useState } from 'react';
import Floorplan, { cropAspect } from './Floorplan.jsx';

export default function Minimap({ scenes, floorplan, currentSceneId, onSelect }) {
  const [collapsed, setCollapsed] = useState(false);
  const [coords, setCoords] = useState(() =>
    Object.fromEntries(scenes.map((s) => [s.id, { ...s.minimap }]))
  );
  const innerRef = useRef(null);

  // Reset dot positions whenever the active tour changes.
  useEffect(() => {
    setCoords(Object.fromEntries(scenes.map((s) => [s.id, { ...s.minimap }])));
  }, [scenes]);

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
                className={`dot ${s.id === currentSceneId ? 'dot--active' : ''}`}
                style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }}
                onClick={() => onSelect(s.id)}
                title={s.title}
                aria-label={s.title}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
