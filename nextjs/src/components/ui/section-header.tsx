"use client";

import React from "react";
import { LucideIcon } from "lucide-react";

interface SectionHeaderProps {
    icon?: LucideIcon;
    title: string;
    description?: string;
    children?: React.ReactNode;
    className?: string;
}

export default function SectionHeader({
    icon: Icon,
    title,
    description,
    children,
    className = ""
}: SectionHeaderProps) {
    return (
        <div className={`space-y-2 ${className}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {Icon && (
                        <div className="p-2 rounded-lg bg-primary-50 text-primary-600">
                            <Icon className="h-5 w-5" />
                        </div>
                    )}
                    <div>
                        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
                        {description && (
                            <p className="text-sm text-muted-foreground">{description}</p>
                        )}
                    </div>
                </div>
                {children}
            </div>
        </div>
    );
}