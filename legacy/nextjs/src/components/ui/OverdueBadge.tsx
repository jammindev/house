import { TriangleAlert } from "lucide-react";
import CountBadge from "@/components/ui/CountBadge";

interface OverdueBadgeProps {
    label: string;
}

export default function OverdueBadge({ label }: OverdueBadgeProps) {
    return (
        <CountBadge
            icon={<TriangleAlert className="h-4 w-4" />}
            label={label}
            display="inline"
            tone="none"
            className="border-rose-200 bg-rose-100 text-rose-600"
        />
    );
}
