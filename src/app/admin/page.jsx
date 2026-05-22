import PageShell from '@/components/PageShell.jsx';
import TourListAdmin from '@/components/admin/TourListAdmin.jsx';
import { prisma } from '@/lib/db.js';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Admin · Wareongo',
};

export default async function AdminHomePage() {
  const tours = await prisma.tour.findMany({
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { scenes: true } } },
  });

  return (
    <PageShell>
      <div className="admin">
        <header className="admin__header">
          <h1 className="admin__title">Tours</h1>
          <p className="admin__subtitle">
            Manage panoramic tours, scenes, captions, and audio.
          </p>
        </header>
        <TourListAdmin initialTours={tours} />
      </div>
    </PageShell>
  );
}
