// nextjs/src/components/layout/HouseholdDropdown.tsx
import { useState } from "react";
import { ChevronDown, House, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/I18nProvider";

type HouseholdOption = {
  id: string;
  name: string;
};

type HouseholdDropdownProps = {
  households: HouseholdOption[];
  currentHousehold: HouseholdOption | null;
  selectedHouseholdId: string | null;
  onSelect: (id: string) => void;
};

export default function HouseholdDropdown({
  households,
  currentHousehold,
  selectedHouseholdId,
  onSelect,
}: HouseholdDropdownProps) {
    const [isOpen, setOpen] = useState(false);
    const router = useRouter();
    const { t } = useI18n();

    return (
        <div className="relative ml-2 mr-auto">
            <button
                onClick={() => setOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 text-sm border rounded-md hover:bg-gray-50"
            >
                <House className="h-4 w-4 text-primary-600" />
                <span className="truncate max-w-[180px]">
                    {currentHousehold ? currentHousehold.name : t("nav.selectHousehold")}
                </span>
                <ChevronDown className="h-4 w-4 text-gray-500" />
            </button>

            {isOpen && (
                <div className="absolute mt-2 w-64 bg-white rounded-md shadow-lg border z-50">
                    <div className="py-1 max-h-72 overflow-auto">
                        {households.map((household) => (
                            <button
                                key={household.id}
                                onClick={() => {
                                    onSelect(household.id);
                                    setOpen(false);
                                }}
                                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${selectedHouseholdId === household.id
                                        ? "bg-primary-50 text-primary-700"
                                        : "text-gray-700"
                                    }`}
                            >
                                {household.name}
                            </button>
                        ))}
                        <div className="my-1 border-t" />
                        <button
                            onClick={() => {
                                setOpen(false);
                                router.push("/app/households/new");
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        >
                            <Plus className="h-4 w-4 text-gray-400" />
                            {t("nav.createHousehold")}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
