import { CalendarClock } from "lucide-react";
import CountBadge from "@/components/ui/CountBadge";

interface DueSoonBadgeProps {
    label: string;
}

export default function DueSoonBadge({ label }: DueSoonBadgeProps) {
    return (
        <CountBadge
            icon={<CalendarClock className="h-4 w-4" />}
            label={label}
            display="inline"
            tone="none"
            className="border-amber-200 bg-amber-100 text-amber-700"
        />
    );
}
