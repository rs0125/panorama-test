import { useEffect, useRef, useState } from 'react';
import { scenes as defaultScenes } from './scenes.js';

const EDIT_MODE = new URLSearchParams(window.location.search).has('edit');

export default function Minimap({ currentSceneId, onSelect }) {
  const [collapsed, setCollapsed] = useState(
    typeof window !== 'undefined' && window.matchMedia('(max-width: 600px)').matches
  );
  const [coords, setCoords] = useState(() =>
    Object.fromEntries(defaultScenes.map((s) => [s.id, { ...s.minimap }]))
  );
  const innerRef = useRef(null);
  const dragRef = useRef(null);

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
    const lines = defaultScenes.map((s) => {
      const c = coords[s.id];
      return `  { id: '${s.id}', title: '${s.title}', image: '${s.image}', minimap: { x: ${c.x}, y: ${c.y} } },`;
    }).join('\n');
    const out = `export const scenes = [\n${lines}\n];`;
    console.log(out);
    if (navigator.clipboard) navigator.clipboard.writeText(out).catch(() => {});
    alert('Coords logged to console and copied to clipboard.');
  };

  return (
    <div className={`minimap ${collapsed ? 'minimap--collapsed' : ''}`}>
      <button
        className="minimap__toggle"
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? 'Expand minimap' : 'Collapse minimap'}
      >
        {collapsed ? '🗺' : '×'}
      </button>
      {!collapsed && (
        <div className="minimap__inner" ref={innerRef}>
          <div className="minimap__img" role="img" aria-label="Floor plan" />
          {defaultScenes.map((s) => {
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
