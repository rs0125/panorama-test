// Reusable skeleton primitive — a block with a moving sheen. Use `.skeleton`
// for the base look and pass any size via the `style` prop (or className).
//
// Pre-built variants below match common shapes used across the app so route
// loading.jsx files can compose them instead of redefining sizes inline.

export function Skeleton({ className = '', style }) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}

export function SkeletonText({ width = '100%', size = 14, style, className = '' }) {
  return (
    <Skeleton
      className={`skeleton--text ${className}`}
      style={{ width, height: size, ...style }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <Skeleton className="skeleton-card__cover" />
      <div className="skeleton-card__body">
        <SkeletonText width="70%" size={16} />
        <SkeletonText width="40%" size={11} />
        <SkeletonText width="100%" size={13} />
        <SkeletonText width="85%" size={13} />
        <div className="skeleton-card__footer">
          <SkeletonText width={60} size={11} />
          <SkeletonText width={70} size={13} />
        </div>
      </div>
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="skeleton-row">
      <Skeleton className="skeleton-row__thumb" />
      <div className="skeleton-row__main">
        <SkeletonText width="40%" size={14} />
        <SkeletonText width="22%" size={11} />
      </div>
      <Skeleton className="skeleton-row__btn" />
    </div>
  );
}

export function SkeletonPanel({ children }) {
  return <div className="skeleton-panel">{children}</div>;
}
