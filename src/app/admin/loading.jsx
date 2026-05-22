import PageShell from '@/components/PageShell.jsx';
import { Skeleton, SkeletonPanel, SkeletonRow, SkeletonText } from '@/components/Skeleton.jsx';

export default function AdminLoading() {
  return (
    <PageShell>
      <div className="admin">
        <header className="admin__header">
          <SkeletonText width={120} size={28} style={{ marginBottom: 6 }} />
          <SkeletonText width="45%" size={14} />
        </header>
        <SkeletonPanel>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Skeleton style={{ width: 100, height: 32, borderRadius: 999 }} />
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </SkeletonPanel>
      </div>
    </PageShell>
  );
}
