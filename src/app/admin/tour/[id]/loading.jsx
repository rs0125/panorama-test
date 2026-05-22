import PageShell from '@/components/PageShell.jsx';
import { Skeleton, SkeletonPanel, SkeletonRow, SkeletonText } from '@/components/Skeleton.jsx';

export default function AdminTourLoading() {
  return (
    <PageShell>
      <div className="admin">
        <header className="admin__header">
          <SkeletonText width={140} size={12} style={{ marginBottom: 8 }} />
          <SkeletonText width="40%" size={28} style={{ marginBottom: 6 }} />
          <SkeletonText width="20%" size={13} />
        </header>

        {/* Tour metadata form */}
        <SkeletonPanel>
          <SkeletonText width={140} size={16} />
          <div style={{ display: 'flex', gap: 12 }}>
            <Skeleton style={{ flex: 1, height: 60, borderRadius: 10 }} />
            <Skeleton style={{ flex: 1, height: 60, borderRadius: 10 }} />
          </div>
          <Skeleton style={{ height: 60, borderRadius: 10 }} />
          <Skeleton style={{ height: 80, borderRadius: 10 }} />
        </SkeletonPanel>

        {/* Minimap panel */}
        <SkeletonPanel>
          <SkeletonText width={100} size={16} />
          <Skeleton style={{ aspectRatio: '16 / 10', width: '100%', maxWidth: 720, borderRadius: 12 }} />
        </SkeletonPanel>

        {/* Scenes list */}
        <SkeletonPanel>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <SkeletonText width={100} size={16} />
            <Skeleton style={{ width: 110, height: 32, borderRadius: 999 }} />
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </SkeletonPanel>
      </div>
    </PageShell>
  );
}
