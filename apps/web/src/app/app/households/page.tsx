import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function HouseholdsIndex() {
  return (
    <div className="max-w-3xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Households</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">Create or manage your households.</p>
          <Link href="/app/households/new">
            <Button className="bg-primary-600 text-white hover:bg-primary-700">New Household</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

