// Shape Prisma rows into the structure the viewer components expect.
//
// Why a separate layer: PanoViewer, Minimap, etc. were written against the
// legacy tours.js shape (scene.image, scene.minimap.x, hotspots[].to as slug).
// Rather than touch every component when the DB landed, we adapt at the page
// boundary. This is also where we translate hotspot foreign keys (cuids) back
// into scene slugs, since Pannellum uses the slug as its scene key.

export function serializeTour(tour) {
  // Build a slug lookup so hotspot.toSceneId → toScene.slug.
  const slugById = Object.fromEntries(tour.scenes.map((s) => [s.id, s.slug]));

  const scenes = [...tour.scenes]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((s) => ({
      id: s.slug,
      title: s.title,
      image: s.imageUrl,
      preview: s.previewUrl || null,
      audio: s.audioUrl || null,
      minimap: { x: s.minimapX, y: s.minimapY },
      annotations: [...(s.annotations || [])]
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((a) => ({ title: a.title, body: a.body })),
      hotspots: (s.hotspotsFrom || [])
        .map((h) => ({
          to: slugById[h.toSceneId],
          pitch: h.pitch,
          yaw: h.yaw,
        }))
        .filter((h) => Boolean(h.to)),
      overlays: (s.overlays || []).map((o) => ({
        pitch: o.pitch,
        yaw: o.yaw,
        title: o.title,
        body: o.body,
      })),
    }));

  return {
    id: tour.slug,
    title: tour.title,
    description: tour.description,
    location: tour.location,
    cover: tour.coverUrl,
    floorplan: tour.floorplanUrl
      ? {
          image: tour.floorplanUrl,
          crop: serializeCrop(tour),
        }
      : null,
    scenes,
  };
}

function serializeCrop(tour) {
  const x = tour.floorplanCropX;
  const y = tour.floorplanCropY;
  const w = tour.floorplanCropW;
  const h = tour.floorplanCropH;
  if (x == null || y == null || w == null || h == null) {
    return { x: 0, y: 0, w: 1, h: 1 };
  }
  return { x, y, w, h };
}

// Cheap version for the homepage cards — skips scenes' annotations/hotspots.
// `cover` falls back to the first scene's image so newly-created tours that
// haven't been given a coverUrl yet still show *something* on the card.
export function serializeTourSummary(tour) {
  const firstScene = tour.scenes?.[0];
  const fallback = firstScene?.previewUrl || firstScene?.imageUrl || null;
  return {
    id: tour.slug,
    title: tour.title,
    description: tour.description,
    location: tour.location,
    cover: tour.coverUrl || fallback,
    sceneCount: tour._count?.scenes ?? tour.scenes?.length ?? 0,
  };
}
