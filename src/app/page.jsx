import PageShell from '@/components/PageShell.jsx';
import TourCard from '@/components/TourCard.jsx';
import { prisma } from '@/lib/db.js';
import { serializeTourSummary } from '@/lib/serializeTour.js';

export const metadata = {
  title: 'Panoramic tours · Wareongo',
};

// Re-fetch on every request — homepage should reflect admin edits immediately.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const rows = await prisma.tour.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      _count: { select: { scenes: true } },
      // First scene's image — used as the card's fallback cover when the
      // tour itself has no coverUrl set. Pulled via the same query, not a
      // separate round-trip.
      scenes: {
        orderBy: { orderIndex: 'asc' },
        take: 1,
        select: { previewUrl: true, imageUrl: true },
      },
    },
  });
  const tours = rows.map(serializeTourSummary);

  return (
    <PageShell>
      <div className="home">
        <header className="home__header">
          <div className="home__brand">Wareongo</div>
          <h1 className="home__title">Panoramic tours</h1>
          <p className="home__subtitle">
            Explore properties in 360°. Tap a card to step inside.
          </p>
        </header>
        {tours.length === 0 ? (
          <div className="home__empty">
            No tours yet. <a href="/admin">Create one in the admin panel →</a>
          </div>
        ) : (
          <div className="home__grid">
            {tours.map((t) => (
              <TourCard key={t.id} tour={t} href={`/tour/${t.id}`} />
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
