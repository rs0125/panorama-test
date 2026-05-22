import PageShell from '@/components/PageShell.jsx';
import { SkeletonCard, SkeletonText } from '@/components/Skeleton.jsx';

export default function HomeLoading() {
  return (
    <PageShell>
      <div className="home">
        <header className="home__header">
          <SkeletonText width={90} size={13} style={{ marginBottom: 10 }} />
          <SkeletonText width="60%" size={36} style={{ marginBottom: 10 }} />
          <SkeletonText width="40%" size={15} />
        </header>
        <div className="home__grid">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    </PageShell>
  );
}
