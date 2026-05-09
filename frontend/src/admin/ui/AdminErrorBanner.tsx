type Props = {
  message: string;
  onRetry?: () => void;
  title?: string;
};

export function AdminErrorBanner({ message, onRetry, title = "Não foi possível carregar os dados" }: Props) {
  return (
    <div className="ae-admin-error-banner" role="alert">
      <div className="ae-admin-error-banner__text">
        <strong className="ae-admin-error-banner__title">{title}</strong>
        <p className="ae-admin-error-banner__msg">{message}</p>
      </div>
      {onRetry ? (
        <button type="button" className="btn btn-primary ae-admin-error-banner__retry" onClick={onRetry}>
          Tentar novamente
        </button>
      ) : null}
    </div>
  );
}
