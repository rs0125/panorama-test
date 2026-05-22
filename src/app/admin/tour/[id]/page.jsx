import { notFound } from 'next/navigation';
import Link from 'next/link';
import PageShell from '@/components/PageShell.jsx';
import TourFormAdmin from '@/components/admin/TourFormAdmin.jsx';
import TourMinimapEditor from '@/components/admin/TourMinimapEditor.jsx';
import SceneListAdmin from '@/components/admin/SceneListAdmin.jsx';
import { prisma } from '@/lib/db.js';

export const dynamic = 'force-dynamic';

export default async function AdminTourPage({ params }) {
  const { id } = await params;
  const tour = await prisma.tour.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    include: {
      scenes: {
        orderBy: { orderIndex: 'asc' },
        include: { _count: { select: { annotations: true } } },
      },
    },
  });
  if (!tour) notFound();

  return (
    <PageShell>
      <div className="admin">
        <header className="admin__header">
          <div className="admin__crumbs">
            <Link href="/admin">Tours</Link>
            <span> / </span>
            <span>{tour.title}</span>
          </div>
          <h1 className="admin__title">{tour.title}</h1>
          <p className="admin__subtitle">/{tour.slug}</p>
        </header>

        <TourFormAdmin initialTour={tour} />
        <TourMinimapEditor tour={tour} scenes={tour.scenes} />
        <SceneListAdmin tourId={tour.id} initialScenes={tour.scenes} />
      </div>
    </PageShell>
  );
}
