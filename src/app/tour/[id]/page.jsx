import { cache } from 'react';
import { notFound } from 'next/navigation';
import TourView from '@/components/TourView.jsx';
import { prisma } from '@/lib/db.js';
import { serializeTour } from '@/lib/serializeTour.js';

export const dynamic = 'force-dynamic';

// React.cache memoizes the result for the duration of a single server
// request. generateMetadata() and the page component both ask for the tour
// — without this they'd issue two identical Prisma queries per page load.
const fetchTourBySlug = cache(async (slug) => {
  return prisma.tour.findUnique({
    where: { slug },
    include: {
      scenes: {
        include: {
          annotations: true,
          hotspotsFrom: true,
          overlays: true,
        },
      },
    },
  });
});

export async function generateMetadata({ params }) {
  const { id } = await params;
  const tour = await fetchTourBySlug(id);
  if (!tour) return { title: 'Tour not found' };
  return {
    title: `${tour.title} · Wareongo`,
    description: tour.description ?? undefined,
  };
}

export default async function TourPage({ params }) {
  const { id } = await params;
  const tour = await fetchTourBySlug(id);
  if (!tour) notFound();
  return <TourView tour={serializeTour(tour)} />;
}
