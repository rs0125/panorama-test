// Seed Postgres from the legacy src/data/tours.js module.
//
// Behavior:
//   - Idempotent: re-run safely. Tours upsert on slug; scenes upsert on
//     (tourId, slug); annotations/hotspots/overlays are wiped and re-created
//     each run so the source-of-truth is the JS file until the admin UI takes
//     over.
//   - Asset URLs are taken verbatim from tours.js. Existing assets live in
//     /public, so the seeded URLs are paths like '/panos/foo.jpg' — they will
//     still serve from Next's public dir. New uploads via the admin will write
//     to R2 and store full https URLs.

import { PrismaClient } from '@prisma/client';
import { tours } from '../src/data/tours.js';

const prisma = new PrismaClient();

function previewUrlFor(image) {
  // Matches the convention PanoViewer uses: /panos/foo.jpeg → /panos/previews/foo.jpg
  if (!image) return null;
  return image.replace('/panos/', '/panos/previews/').replace('.jpeg', '.jpg');
}

async function seedTour(t) {
  const tour = await prisma.tour.upsert({
    where: { slug: t.id },
    create: {
      slug: t.id,
      title: t.title,
      description: t.description ?? null,
      location: t.location ?? null,
      coverUrl: t.cover ?? null,
      floorplanUrl: t.floorplan?.image ?? null,
      floorplanBgSize: t.floorplan?.bgSize ?? 'cover',
      floorplanBgPosition: t.floorplan?.bgPosition ?? '50% 50%',
    },
    update: {
      title: t.title,
      description: t.description ?? null,
      location: t.location ?? null,
      coverUrl: t.cover ?? null,
      floorplanUrl: t.floorplan?.image ?? null,
      floorplanBgSize: t.floorplan?.bgSize ?? 'cover',
      floorplanBgPosition: t.floorplan?.bgPosition ?? '50% 50%',
    },
  });

  // Upsert scenes; collect the resulting id-per-slug map for hotspot wiring.
  const sceneIdBySlug = {};
  for (let i = 0; i < t.scenes.length; i++) {
    const s = t.scenes[i];
    const row = await prisma.scene.upsert({
      where: { tourId_slug: { tourId: tour.id, slug: s.id } },
      create: {
        tourId: tour.id,
        slug: s.id,
        title: s.title,
        imageUrl: s.image,
        previewUrl: previewUrlFor(s.image),
        audioUrl: s.audio ?? null,
        minimapX: s.minimap.x,
        minimapY: s.minimap.y,
        orderIndex: i,
      },
      update: {
        title: s.title,
        imageUrl: s.image,
        previewUrl: previewUrlFor(s.image),
        audioUrl: s.audio ?? null,
        minimapX: s.minimap.x,
        minimapY: s.minimap.y,
        orderIndex: i,
      },
    });
    sceneIdBySlug[s.id] = row.id;
  }

  // Rebuild dependent rows. Cheaper than diffing and keeps the seed authoritative.
  await prisma.annotation.deleteMany({ where: { scene: { tourId: tour.id } } });
  await prisma.hotspot.deleteMany({ where: { fromScene: { tourId: tour.id } } });
  await prisma.overlay.deleteMany({ where: { scene: { tourId: tour.id } } });

  for (const s of t.scenes) {
    const sceneId = sceneIdBySlug[s.id];
    if (s.annotations?.length) {
      await prisma.annotation.createMany({
        data: s.annotations.map((a, idx) => ({
          sceneId,
          title: a.title ?? null,
          body: a.body ?? null,
          orderIndex: idx,
        })),
      });
    }
    if (s.hotspots?.length) {
      for (const h of s.hotspots) {
        const toSceneId = sceneIdBySlug[h.to];
        if (!toSceneId) {
          console.warn(`  ! hotspot in ${s.id} references unknown scene "${h.to}", skipping`);
          continue;
        }
        await prisma.hotspot.create({
          data: {
            fromSceneId: sceneId,
            toSceneId,
            pitch: h.pitch,
            yaw: h.yaw,
          },
        });
      }
    }
  }

  console.log(`✓ seeded ${tour.slug} (${t.scenes.length} scenes)`);
}

async function main() {
  for (const t of tours) await seedTour(t);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
