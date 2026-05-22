import PageShell from '@/components/PageShell.jsx';
import { Skeleton, SkeletonText } from '@/components/Skeleton.jsx';

export default function LoginLoading() {
  return (
    <PageShell>
      <div className="auth-shell">
        <div className="auth-card">
          <SkeletonText width="40%" size={22} style={{ marginBottom: 6 }} />
          <SkeletonText width="80%" size={13} style={{ marginBottom: 22 }} />
          <Skeleton style={{ width: '100%', height: 44, borderRadius: 12 }} />
        </div>
      </div>
    </PageShell>
  );
}
