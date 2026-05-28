import { cropFromTour } from './floorplan.js';

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
      initialView: {
        pitch: s.initialPitch ?? null,
        yaw: s.initialYaw ?? null,
        hfov: s.initialHfov ?? null,
      },
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
        id: o.id,
        type: o.type || 'text',
        pitch: o.pitch,
        yaw: o.yaw,
        pitch2: o.pitch2 ?? null,
        yaw2: o.yaw2 ?? null,
        label: o.label || null,
        title: o.title || null,
        body: o.body || null,
        scale: o.scale ?? 1,
        boxWidth: o.boxWidth ?? null,
        boxHeight: o.boxHeight ?? null,
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
          crop: cropFromTour(tour),
        }
      : null,
    scenes,
  };
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
