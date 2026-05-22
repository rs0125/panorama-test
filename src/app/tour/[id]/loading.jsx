// Pano viewer is full-screen, no PageShell. Show a centered spinner with
// the brand accent — same vibe as Pannellum's own load state.
export default function TourLoading() {
  return (
    <div className="tour-loading" role="status" aria-label="Loading panorama">
      <div className="tour-loading__spinner" aria-hidden="true" />
      <span>Loading tour…</span>
    </div>
  );
}
