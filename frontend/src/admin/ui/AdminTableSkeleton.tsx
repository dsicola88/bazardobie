type Props = { rows?: number; cols?: number };

export function AdminTableSkeleton({ rows = 8, cols = 6 }: Props) {
  return (
    <div
      className="ae-admin-table-skel"
      aria-busy="true"
      aria-label="A carregar tabela"
      style={{ ["--ae-admin-skel-cols" as string]: String(cols) }}
    >
      <div className="ae-admin-table-skel__head">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="ae-admin-skeleton ae-admin-skeleton--th" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="ae-admin-table-skel__row">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="ae-admin-skeleton ae-admin-skeleton--td" />
          ))}
        </div>
      ))}
    </div>
  );
}
