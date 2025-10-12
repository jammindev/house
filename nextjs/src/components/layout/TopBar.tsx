// nextjs/src/components/layout/TopBar.tsx
import HouseholdDropdown from "./HouseholdDropdown";
import UserDropdown from "./UserDropdown";

export default function TopBar({
    user,
    households,
    selectedHouseholdId,
    currentHousehold,
    onSelectHousehold,
    onLogout,
    onChangePassword,
}: any) {
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