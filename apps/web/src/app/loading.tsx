// nextjs/src/app/loading.tsx

const brandColor = "var(--color-primary-500)";

export default function Loading() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-secondary-50">
      <div
        className="relative flex flex-col items-center gap-6 text-secondary-700"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <span className="sr-only">Chargement de House</span>

        <div className="relative flex h-28 w-28 items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-primary-100 animate-ping" aria-hidden="true" />
          <div className="absolute inset-3 rounded-full border border-primary-200 opacity-70" aria-hidden="true" />
          <div
            className="absolute inset-0 rounded-full blur-3xl"
            style={{ background: brandColor, opacity: 0.35 }}
            aria-hidden="true"
          />

          <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-xl shadow-primary-500/20">
            <svg
              viewBox="0 0 64 64"
              className="h-12 w-12 text-primary-600 animate-pulse"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 30L32 14l20 16" />
              <path d="M20 30v18h24V30" />
              <path d="M28 48V38h8v10" />
            </svg>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-base font-semibold text-secondary-800">House se prépare pour vous</p>
          <div className="flex items-center gap-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <span
                key={index}
                className="h-2 w-8 rounded-full bg-primary-500/70 animate-bounce"
                style={{ animationDelay: `${index * 0.18}s` }}
                aria-hidden="true"
              />
            ))}
          </div>
          <p className="text-sm text-secondary-600">Synchronisation des zones et interactions…</p>
        </div>
      </div>
    </div>
  );
}
