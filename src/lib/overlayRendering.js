// Shared overlay rendering for both PanoViewer (public) and OverlayEditor
// (admin). Two surfaces:
//
//   1) Pannellum hotspots — TEXT overlays only. Pannellum projects a single
//      point correctly and sets visibility:hidden when behind the camera,
//      which is fine for a single annotation card.
//
//   2) HTML overlay layer (`.pano-line-layer`) — for LINE overlays we own
//      the projection end-to-end. Both endpoint dots AND the connecting bar
//      are computed by `projectPitchYaw` below, using Pannellum's view state
//      (pitch, yaw, hfov) but NOT its hotspot DOM positions. This is the
//      only correct way to do Z-divide and near-plane culling — using DOM
//      positions broke down for points just-barely-in-front-of-camera where
//      Z is very small and perspective division explodes the screen coords.
//
// The layer is refreshed every animation frame by the caller (PanoViewer or
// OverlayEditor's rAF tick) which passes the current view state in opts.

const TEXT_HANDLE_POSITIONS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

function buildOverlayText(div, args) {
  div.classList.add('ovl-text');
  const card = document.createElement('div');
  card.className = 'ovl-text__card';
  if (args.editable) card.classList.add('ovl-text__card--editable');
  if (args.overlayId) card.dataset.overlayId = args.overlayId;
  if (args.title) {
    const t = document.createElement('div');
    t.className = 'ovl-text__title';
    t.textContent = args.title;
    card.appendChild(t);
  }
  if (args.body) {
    const b = document.createElement('div');
    b.className = 'ovl-text__body';
    b.textContent = args.body;
    card.appendChild(b);
  }
  if (!args.title && !args.body && args.label) {
    const l = document.createElement('div');
    l.className = 'ovl-text__title';
    l.textContent = args.label;
    card.appendChild(l);
  }
  // Apply persisted uniform scale via inline transform (overrides the CSS
  // default `translate(-50%, -50%)`). Scale 1 leaves the CSS rule alone so we
  // don't pay the inline-style write on every public viewer hotspot.
  const scale = args.scale ?? 1;
  if (scale !== 1) {
    card.style.transform = `translate(-50%, -50%) scale(${scale})`;
  }
  // Explicit box dimensions override the CSS max-width default. Null fields
  // fall through to auto-sizing. Both are logical (pre-scale) pixels.
  if (args.boxWidth != null) {
    card.style.width = `${args.boxWidth}px`;
    card.style.maxWidth = `${args.boxWidth}px`;
  }
  if (args.boxHeight != null) {
    card.style.height = `${args.boxHeight}px`;
    card.style.overflow = 'hidden';
  }
  if (args.editable) {
    TEXT_HANDLE_POSITIONS.forEach((pos) => {
      const h = document.createElement('span');
      h.className = `ovl-text__handle ovl-text__handle--${pos}`;
      h.dataset.handle = pos;
      if (args.overlayId) h.dataset.overlayId = args.overlayId;
      card.appendChild(h);
    });
  }
  div.appendChild(card);
}

// Line overlays no longer get Pannellum hotspots — we project them ourselves
// in the line layer. Only text overlays get Pannellum hotspots.
//
// opts.editable=true marks the card draggable + adds 8 resize handles. The
// admin uses event delegation on the pano container to wire drag/resize.
export function overlayHotspots(overlays, opts = {}) {
  const out = [];
  (overlays || []).forEach((o) => {
    if (o.type === 'line') return; // handled by the line layer
    out.push({
      id: `ovl-${o.id}-text`,
      pitch: o.pitch,
      yaw: o.yaw,
      type: 'info',
      cssClass: 'ovl-text',
      createTooltipFunc: buildOverlayText,
      createTooltipArgs: {
        title: o.title,
        body: o.body,
        label: o.label,
        scale: o.scale ?? 1,
        boxWidth: o.boxWidth ?? null,
        boxHeight: o.boxHeight ?? null,
        editable: !!opts.editable,
        overlayId: o.id,
      },
    });
  });
  return out;
}

export function pannellumIdsForOverlay(o) {
  if (o.type === 'line') return []; // no Pannellum hotspots for lines
  return [`ovl-${o.id}-text`];
}

// ─── Projection ─────────────────────────────────────────────────────────────
//
// Convert a (pitch, yaw) on the panorama sphere to a screen position inside
// the pano container, given the current camera view (pitch, yaw, hfov) and
// the container dimensions. Returns { x, y, z, visible }:
//   - visible=false when the point is behind the camera or too close to the
//     near plane (Z very small → perspective division explodes).
//   - x, y are in container-local pixels when visible=true.
//
// Math:
//   world unit vector: (cos(p)·sin(y), sin(p), cos(p)·cos(y))
//   camera basis in world space:
//     forward = (cos(vp)·sin(vy), sin(vp), cos(vp)·cos(vy))
//     right   = (cos(vy),         0,       -sin(vy))           [yaw-only, horizontal]
//     up      = forward × right
//   camera-space coords: (right·W, up·W, forward·W)
//   perspective: screenX = w/2 + (camX/camZ)·focal,
//                screenY = h/2 - (camY/camZ)·focal   [y flipped for screen]
//   focal     = (w/2) / tan(hfov/2)
// Z threshold below which we treat a point as "effectively behind" the
// camera. At Z=0.1 the point is ~84° away from the view direction. We don't
// go any lower because below that, 1/Z magnifies the projected position to
// many viewport-widths off-screen — the classic "phantom line slicing across
// the viewport" failure mode.
const NEAR_PLANE = 0.1;

export function projectPitchYaw(pitch, yaw, view, w, h) {
  const p = (pitch * Math.PI) / 180;
  const y = (yaw * Math.PI) / 180;
  const vp = (view.pitch * Math.PI) / 180;
  const vy = (view.yaw * Math.PI) / 180;

  // World direction (unit sphere).
  const wx = Math.cos(p) * Math.sin(y);
  const wy = Math.sin(p);
  const wz = Math.cos(p) * Math.cos(y);

  // Camera basis. Right stays horizontal (no roll), forward is the look
  // direction, up is derived to keep the frame orthonormal.
  const rx = Math.cos(vy);
  const ry = 0;
  const rz = -Math.sin(vy);
  const fx = Math.cos(vp) * Math.sin(vy);
  const fy = Math.sin(vp);
  const fz = Math.cos(vp) * Math.cos(vy);
  // up = forward × right
  const ux = fy * rz - fz * ry;
  const uy = fz * rx - fx * rz;
  const uz = fx * ry - fy * rx;

  // Camera-space position.
  const cx = wx * rx + wy * ry + wz * rz;
  const cy = wx * ux + wy * uy + wz * uz;
  const cz = wx * fx + wy * fy + wz * fz;

  // Z-divide cull: anything at or behind the near plane gets dropped.
  if (cz <= NEAR_PLANE) return { x: 0, y: 0, z: cz, visible: false };

  const halfHfov = (view.hfov * Math.PI) / 180 / 2;
  const focal = w / 2 / Math.tan(halfHfov);

  return {
    x: w / 2 + (cx / cz) * focal,
    y: h / 2 - (cy / cz) * focal,
    z: cz,
    visible: true,
  };
}

// Walk up from the endpoint dot to its .pnlm-hotspot ancestor and ask
// Pannellum's own visibility flag. Pannellum toggles inline
// style.visibility = 'hidden' on hotspots whose (pitch, yaw) is behind the
// camera, since their projected screen position is meaningless in that case.
function isHotspotHidden(dotEl) {
  const parent = dotEl.closest('.pnlm-hotspot');
  if (!parent) return false;
  if (parent.style.visibility === 'hidden') return true;
  // Belt-and-braces — getComputedStyle catches stylesheet-driven hides too.
  return getComputedStyle(parent).visibility === 'hidden';
}

function ensureLineLayer(container) {
  let layer = container.querySelector(':scope > .pano-line-layer');
  if (layer) return layer;
  layer = document.createElement('div');
  layer.className = 'pano-line-layer';
  // Inline styles so the layer always works even if the project's CSS hasn't
  // loaded yet. position:absolute fills the parent (which Pannellum keeps at
  // the pano dimensions). pointer-events:none so clicks still hit the canvas.
  // overflow:hidden so a stray phantom line can never paint past the pano's
  // bounding box (belt-and-braces against the viewport-edge bail in
  // drawCommittedLines).
  layer.style.cssText =
    'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5;overflow:hidden';
  container.appendChild(layer);
  return layer;
}

export function removeLineLayer(container) {
  const layer = container?.querySelector(':scope > .pano-line-layer');
  if (layer) layer.remove();
}

// drawLineOverlays(container, lines, opts)
//
//   container : the pano viewer's outer div.
//   lines     : committed line overlays (type='line') with both endpoints.
//   opts      : {
//                 view: { pitch, yaw, hfov },   // REQUIRED — Pannellum view
//                 preview: {                    // optional pen-tool preview
//                   startPitch, startYaw,
//                   cursorX, cursorY,
//                 },
//               }
//
// Endpoints are projected via projectPitchYaw using the current view, so
// near-plane culling is exact: any point with Z ≤ NEAR_PLANE is dropped,
// which kills the "phantom line across the viewport" bug that the DOM-
// reading approach couldn't catch.
export function drawLineOverlays(container, lineOverlays, opts = {}) {
  if (!container) return;
  const layer = ensureLineLayer(container);
  layer.innerHTML = '';
  if (!opts.view) return;
  const rect = container.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;

  (lineOverlays || []).forEach((o) => {
    if (o.pitch2 == null || o.yaw2 == null) return;
    const a = projectPitchYaw(o.pitch, o.yaw, opts.view, rect.width, rect.height);
    const b = projectPitchYaw(o.pitch2, o.yaw2, opts.view, rect.width, rect.height);
    // Both endpoints must clear the near plane. If either is behind the
    // camera the line would be visually meaningless — drop it.
    if (!a.visible || !b.visible) return;
    const interactiveA = opts.interactive ? { overlayId: o.id, endpoint: 1 } : null;
    const interactiveB = opts.interactive ? { overlayId: o.id, endpoint: 2 } : null;
    drawEndpointDot(layer, a.x, a.y, interactiveA);
    drawEndpointDot(layer, b.x, b.y, interactiveB);
    drawLineBar(layer, a.x, a.y, b.x, b.y, o.label);
  });

  if (opts.preview) {
    const s = projectPitchYaw(
      opts.preview.startPitch,
      opts.preview.startYaw,
      opts.view,
      rect.width,
      rect.height
    );
    if (s.visible) {
      drawEndpointDot(layer, s.x, s.y);
      drawPreviewBar(layer, s.x, s.y, opts.preview.cursorX, opts.preview.cursorY);
    }
  }
}

function drawEndpointDot(layer, x, y, interactive) {
  const dot = document.createElement('div');
  dot.className = 'pano-line__dot';
  if (interactive) {
    dot.dataset.overlayId = interactive.overlayId;
    dot.dataset.endpoint = String(interactive.endpoint);
  }
  // Endpoint hit-targets bump from 12 → 16px when interactive so the cursor
  // can land on them at typical drag speeds. Non-interactive (public viewer)
  // keeps the smaller, less-busy size.
  const size = interactive ? 16 : 12;
  dot.style.cssText = `
    position:absolute;
    left:${x}px;
    top:${y}px;
    width:${size}px;
    height:${size}px;
    background:#ffae5c;
    border:2px solid #fff;
    border-radius:50%;
    transform:translate(-50%, -50%);
    box-shadow:0 0 0 1px rgba(0,0,0,0.4), 0 2px 6px rgba(0,0,0,0.45);
    pointer-events:${interactive ? 'auto' : 'none'};
    ${interactive ? 'cursor:grab;' : ''}
  `;
  layer.appendChild(dot);
}

function drawLineBar(layer, ax, ay, bx, by, label) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const midX = (ax + bx) / 2;
  const midY = (ay + by) / 2;

  const line = document.createElement('div');
  line.style.cssText = `
    position:absolute;
    left:${midX}px;
    top:${midY}px;
    width:${len}px;
    height:3px;
    background:#ffae5c;
    transform:translate(-50%, -50%) rotate(${angle}deg);
    transform-origin:center;
    pointer-events:none;
    box-shadow:0 1px 4px rgba(0,0,0,0.5);
  `;
  layer.appendChild(line);
  layer.appendChild(makeArrowhead(ax, ay, angle + 180));
  layer.appendChild(makeArrowhead(bx, by, angle));

  if (label) {
    const pill = document.createElement('div');
    pill.textContent = label;
    pill.style.cssText = `
      position:absolute;
      left:${midX}px;
      top:${midY}px;
      transform:translate(-50%, -50%);
      background:rgba(20,22,26,0.92);
      color:#fff;
      font:600 13px/1 ui-sans-serif, system-ui, sans-serif;
      padding:5px 10px;
      border-radius:7px;
      border:1px solid rgba(255,174,92,0.6);
      white-space:nowrap;
      pointer-events:none;
      box-shadow:0 2px 8px rgba(0,0,0,0.4);
    `;
    layer.appendChild(pill);
  }
}

function drawPreviewBar(layer, sx, sy, ex, ey) {
  const dx = ex - sx;
  const dy = ey - sy;
  const len = Math.hypot(dx, dy);
  if (len < 2) return;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const midX = (sx + ex) / 2;
  const midY = (sy + ey) / 2;

  const line = document.createElement('div');
  line.style.cssText = `
    position:absolute;
    left:${midX}px;
    top:${midY}px;
    width:${len}px;
    height:2px;
    background:repeating-linear-gradient(to right, #ffae5c 0 6px, transparent 6px 12px);
    transform:translate(-50%, -50%) rotate(${angle}deg);
    transform-origin:center;
    pointer-events:none;
    opacity:0.9;
  `;
  layer.appendChild(line);

  const ring = document.createElement('div');
  ring.style.cssText = `
    position:absolute;
    left:${ex}px;
    top:${ey}px;
    width:14px;
    height:14px;
    border:2px solid #ffae5c;
    background:rgba(255,174,92,0.18);
    border-radius:50%;
    transform:translate(-50%, -50%);
    pointer-events:none;
    box-shadow:0 0 0 1px rgba(0,0,0,0.35);
  `;
  layer.appendChild(ring);
}

function makeArrowhead(x, y, angleDeg) {
  // Triangle pointing outward along the line direction.
  const a = document.createElement('div');
  a.className = 'pano-line__arrow';
  a.style.cssText = `
    position:absolute;
    left:${x}px;
    top:${y}px;
    width:0;
    height:0;
    border-left:10px solid #ffae5c;
    border-top:6px solid transparent;
    border-bottom:6px solid transparent;
    transform:translate(-50%, -50%) rotate(${angleDeg}deg);
    transform-origin:center;
    pointer-events:none;
    filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5));
  `;
  return a;
}

// Legacy helpers removed — drawPreviewLine (DOM-position version) and
// isHotspotHidden (DOM visibility hack) were replaced by projectPitchYaw +
// drawPreviewBar above.
