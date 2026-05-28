// Read a tour row's `floorplanCropX/Y/W/H` columns into the normalised
// { x, y, w, h } shape that Floorplan.jsx + MinimapPicker + TourMinimapEditor
// consume. An unset crop (any field null) collapses to the whole image.
export function cropFromTour(tour) {
  const { floorplanCropX: x, floorplanCropY: y, floorplanCropW: w, floorplanCropH: h } = tour;
  if (x == null || y == null || w == null || h == null) return { x: 0, y: 0, w: 1, h: 1 };
  return { x, y, w, h };
}
