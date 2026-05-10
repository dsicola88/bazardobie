/** Placeholder neutro para foto em falta (cartões, vitrines, categorias). */
export function MediaPlaceholder({
  variant = "card",
  className,
}: {
  variant?: "card" | "tile" | "category";
  className?: string;
}) {
  return (
    <div
      className={["ae-media-ph", `ae-media-ph--${variant}`, className].filter(Boolean).join(" ")}
      aria-hidden
    >
      <svg className="ae-media-ph__svg" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M12 20a4 4 0 014-4h28a4 4 0 014 4v26a4 4 0 01-4 4H16a4 4 0 01-4-4V20z"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinejoin="round"
        />
        <circle cx="24.5" cy="27.5" r="3.25" fill="currentColor" />
        <path
          d="M14.5 43.5 26.5 30l8 9.5L42.5 34l13 13"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
