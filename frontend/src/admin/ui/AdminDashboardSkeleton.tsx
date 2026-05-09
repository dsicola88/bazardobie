export function AdminDashboardSkeleton() {
  return (
    <div className="ae-admin-skeleton-page" aria-busy="true" aria-label="A carregar painel">
      <div className="ae-admin-skeleton ae-admin-skeleton--title" />
      <div className="ae-admin-skeleton ae-admin-skeleton--line" />
      <div className="ae-admin-kpi-skeleton-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="ae-admin-skeleton ae-admin-skeleton--kpi" />
        ))}
      </div>
      <div className="ae-admin-skeleton ae-admin-skeleton--toolbar" />
      <div className="ae-admin-skeleton-metrics">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="ae-admin-skeleton ae-admin-skeleton--metric" />
        ))}
      </div>
    </div>
  );
}
