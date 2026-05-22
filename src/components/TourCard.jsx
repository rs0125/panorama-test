import Link from 'next/link';

export default function TourCard({ tour, href }) {
  const sceneCount = tour.sceneCount ?? tour.scenes?.length ?? 0;
  return (
    <Link href={href} className="tour-card">
      <div
        className="tour-card__cover"
        style={tour.cover ? { backgroundImage: `url('${tour.cover}')` } : undefined}
        aria-hidden="true"
      />
      <div className="tour-card__body">
        <div className="tour-card__title">{tour.title}</div>
        {tour.location && <div className="tour-card__meta">{tour.location}</div>}
        {tour.description && <div className="tour-card__desc">{tour.description}</div>}
        <div className="tour-card__footer">
          <span className="tour-card__chip">{sceneCount} scenes</span>
          <span className="tour-card__cta">View tour →</span>
        </div>
      </div>
    </Link>
  );
}
