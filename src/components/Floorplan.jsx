// Floorplan background layer — shared by the viewer Minimap, the admin
// MinimapPicker, and the admin TourMinimapEditor. Renders the floorplan image
// at the right bgSize/bgPosition so only the crop region is visible.
// Positioning + child dots belong to the caller's container.
//
// Pass `floorplan` from the serialised tour: { image, crop: { x, y, w, h } }
// where the crop rect is normalised 0..1 over the source image. An unset
// crop is interpreted as the whole image.

export default function Floorplan({ floorplan, className = 'floorplan__img' }) {
  if (!floorplan?.image) return null;
  const { bgSize, bgPosition } = cropToCss(floorplan.crop);
  return (
    <div
      className={className}
      role="img"
      aria-label="Floor plan"
      style={{
        backgroundImage: `url('${floorplan.image}')`,
        backgroundSize: bgSize,
        backgroundPosition: bgPosition,
      }}
    />
  );
}

// crop {x, y, w, h} → CSS background-size + background-position so that the
// crop rectangle exactly fills the container (assuming container aspect ratio
// matches w/h — see cropAspect()).
//
// width  = 100% / w  (image's full width rendered as `1/w` of container width)
// position uses the (-x/-y) offset formula: an image of total width 1/w needs
// to shift left by x/w of container width to land the crop's left edge at 0.
// CSS background-position percent maps 0%=left,100%=right of *the slack*
// (containerW - imageW), i.e. the slack is (1/w - 1) of containerW. So:
//   posX% = (x / w) / (1/w - 1) * 100 = x / (1 - w) * 100
// With w == 1 there is no slack and any position works; we send 0%.
export function cropToCss(crop) {
  const c = normalizeCrop(crop);
  const bgSizeX = (100 / c.w).toFixed(4);
  const bgSizeY = (100 / c.h).toFixed(4);
  const posX = c.w >= 1 ? 0 : (c.x / (1 - c.w)) * 100;
  const posY = c.h >= 1 ? 0 : (c.y / (1 - c.h)) * 100;
  return {
    bgSize: `${bgSizeX}% ${bgSizeY}%`,
    bgPosition: `${clamp(posX, 0, 100).toFixed(4)}% ${clamp(posY, 0, 100).toFixed(4)}%`,
  };
}

// Aspect ratio (width / height) of the crop region. Used by Minimap to set
// its container's CSS `aspect-ratio`.
export function cropAspect(crop) {
  const c = normalizeCrop(crop);
  return c.w / c.h;
}

function normalizeCrop(crop) {
  if (!crop) return { x: 0, y: 0, w: 1, h: 1 };
  const w = clamp(crop.w ?? 1, 0.01, 1);
  const h = clamp(crop.h ?? 1, 0.01, 1);
  const x = clamp(crop.x ?? 0, 0, 1 - w);
  const y = clamp(crop.y ?? 0, 0, 1 - h);
  return { x, y, w, h };
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
