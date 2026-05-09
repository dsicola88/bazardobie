import type { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function AdminEmptyState({ title, description, action }: Props) {
  return (
    <div className="ae-admin-empty-state">
      <div className="ae-admin-empty-state__icon" aria-hidden>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M9 12h6M12 9v6M4 21h16a2 2 0 002-2V7l-8-4-8 4v12a2 2 0 002 2z" />
        </svg>
      </div>
      <h3 className="ae-admin-empty-state__title">{title}</h3>
      {description ? <p className="ae-admin-empty-state__desc">{description}</p> : null}
      {action ? <div className="ae-admin-empty-state__action">{action}</div> : null}
    </div>
  );
}
