"use client";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
    title: string;
    householdName?: string;
    newHref: string;
}

export default function EntryHeader({ title, householdName, newHref }: Props) {
    return (
        <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold">
                {title} {householdName ? `· ${householdName}` : ""}
            </h1>
            <Link href={newHref}>
                <Button variant="ghost" size="icon" aria-label="New entry">
                    <Plus className="h-5 w-5" />
                </Button>
            </Link>
        </div>
    );
}