import { notFound } from 'next/navigation';
import Link from 'next/link';
import PageShell from '@/components/PageShell.jsx';
import SceneFormAdmin from '@/components/admin/SceneFormAdmin.jsx';
import AnnotationListAdmin from '@/components/admin/AnnotationListAdmin.jsx';
import HotspotEditor from '@/components/admin/HotspotEditor.jsx';
import OverlayEditor from '@/components/admin/OverlayEditor.jsx';
import { prisma } from '@/lib/db.js';

export const dynamic = 'force-dynamic';

export default async function AdminScenePage({ params }) {
  const { id } = await params;

  // Fetch the scene, its tour (for floorplan), and every sibling on the tour
  // in a single round-trip. Sibling positions feed the MinimapPicker so the
  // admin sees spatial context while placing this scene's dot.
  const scene = await prisma.scene.findUnique({
    where: { id },
    include: {
      annotations: { orderBy: { orderIndex: 'asc' } },
      hotspotsFrom: { select: { id: true, pitch: true, yaw: true, toSceneId: true } },
      overlays: { orderBy: { createdAt: 'asc' } },
      tour: {
        select: {
          id: true,
          slug: true,
          title: true,
          floorplanUrl: true,
          floorplanCropX: true,
          floorplanCropY: true,
          floorplanCropW: true,
          floorplanCropH: true,
          scenes: {
            select: { id: true, title: true, minimapX: true, minimapY: true },
            orderBy: { orderIndex: 'asc' },
          },
        },
      },
    },
  });
  if (!scene) notFound();

  const siblings = scene.tour.scenes.filter((s) => s.id !== scene.id);

  return (
    <PageShell>
      <div className="admin">
        <header className="admin__header">
          <div className="admin__crumbs">
            <Link href="/admin">Tours</Link>
            <span> / </span>
            <Link href={`/admin/tour/${scene.tour.id}`}>{scene.tour.title}</Link>
            <span> / </span>
            <span>{scene.title}</span>
          </div>
          <h1 className="admin__title">{scene.title}</h1>
          <p className="admin__subtitle">/{scene.tour.slug}/{scene.slug}</p>
        </header>

        <SceneFormAdmin initialScene={scene} siblings={siblings} />
        <HotspotEditor scene={scene} siblings={siblings} initialHotspots={scene.hotspotsFrom} />
        <OverlayEditor
          sceneId={scene.id}
          imageUrl={scene.imageUrl}
          initialOverlays={scene.overlays}
        />
        <AnnotationListAdmin sceneId={scene.id} initialAnnotations={scene.annotations} />
      </div>
    </PageShell>
  );
}
