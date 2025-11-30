// nextjs/src/app/loading.tsx

import { Spinner } from "@/components/ui/spinner";

const brandColor = "var(--color-primary-500)";

export default function Loading() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-primary-50/70 via-white/50 to-secondary-50/70 backdrop-blur-xl transition-all">
      <Spinner />
    </div>
  );
}
