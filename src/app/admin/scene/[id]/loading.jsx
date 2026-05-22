import PageShell from '@/components/PageShell.jsx';
import { Skeleton, SkeletonPanel, SkeletonText } from '@/components/Skeleton.jsx';

export default function AdminSceneLoading() {
  return (
    <PageShell>
      <div className="admin">
        <header className="admin__header">
          <SkeletonText width={220} size={12} style={{ marginBottom: 8 }} />
          <SkeletonText width="35%" size={28} style={{ marginBottom: 6 }} />
          <SkeletonText width="25%" size={13} />
        </header>

        {/* Scene metadata + uploads */}
        <SkeletonPanel>
          <SkeletonText width={140} size={16} />
          <div style={{ display: 'flex', gap: 12 }}>
            <Skeleton style={{ flex: 1, height: 60, borderRadius: 10 }} />
            <Skeleton style={{ flex: 1, height: 60, borderRadius: 10 }} />
          </div>
          <Skeleton style={{ aspectRatio: '16 / 10', width: '100%', maxWidth: 480, borderRadius: 12 }} />
          <Skeleton style={{ height: 88, borderRadius: 12 }} />
          <Skeleton style={{ height: 88, borderRadius: 12 }} />
        </SkeletonPanel>

        {/* Hotspot editor */}
        <SkeletonPanel>
          <SkeletonText width={100} size={16} />
          <Skeleton style={{ aspectRatio: '16 / 9', width: '100%', borderRadius: 12 }} />
        </SkeletonPanel>

        {/* Annotations */}
        <SkeletonPanel>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <SkeletonText width={100} size={16} />
            <Skeleton style={{ width: 120, height: 32, borderRadius: 999 }} />
          </div>
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} style={{ height: 96, borderRadius: 12 }} />
          ))}
        </SkeletonPanel>
      </div>
    </PageShell>
  );
}
