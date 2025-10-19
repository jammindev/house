// nextjs/src/components/layout/TopBar.tsx
import HouseholdDropdown from "./HouseholdDropdown";
import UserDropdown from "./UserDropdown";
import type { Household, User } from "@/lib/context/GlobalContext";

type TopBarProps = {
  user: User | null;
  households: Household[];
  selectedHouseholdId: string | null;
  currentHousehold: Household | null;
  onSelectHousehold: (id: string) => void;
  onLogout: () => void;
  onChangePassword: () => void;
};

export default function TopBar({
  user,
  households,
  selectedHouseholdId,
  currentHousehold,
  onSelectHousehold,
  onLogout,
  onChangePassword,
}: TopBarProps) {
    return (
        <div className="lg:pl-64 hidden lg:flex items-center justify-between h-16 bg-white shadow-sm px-4">
            {households && households.length > 0 && (
                <HouseholdDropdown
                    households={households}
                    currentHousehold={currentHousehold}
                    selectedHouseholdId={selectedHouseholdId}
                    onSelect={onSelectHousehold}
                />
            )}
            <UserDropdown user={user} onLogout={onLogout} onChangePassword={onChangePassword} />
        </div>
    );
}
