// nextjs/src/components/ui/mobile-optimized.tsx
import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// Mobile-optimized input with larger touch surface
export const MobileOptimizedInput = React.forwardRef<
    React.ElementRef<typeof Input>,
    React.ComponentPropsWithoutRef<typeof Input>
>(({ className, ...props }, ref) => (
    <Input
        ref={ref}
        className={cn("h-11 sm:h-9", className)}
        {...props}
    />
));
MobileOptimizedInput.displayName = "MobileOptimizedInput";
// Mobile-optimized textarea
// Textarea optimisée pour mobile
export const MobileOptimizedTextarea = React.forwardRef<
    React.ElementRef<typeof Textarea>,
    React.ComponentPropsWithoutRef<typeof Textarea>
>(({ className, ...props }, ref) => (
    <Textarea
        ref={ref}
        className={cn("min-h-[80px] resize-none sm:min-h-[60px]", className)}
        {...props}
    />
));
MobileOptimizedTextarea.displayName = "MobileOptimizedTextarea";

// Mobile-optimized button with larger touch surface
export const MobileOptimizedButton = React.forwardRef<
    React.ElementRef<typeof Button>,
    React.ComponentPropsWithoutRef<typeof Button>
>(({ className, ...props }, ref) => (
    <Button
        ref={ref}
        className={cn("h-11 sm:h-9", className)}
        {...props}
    />
));
MobileOptimizedButton.displayName = "MobileOptimizedButton";

// Mobile-optimized native HTML select
export const MobileOptimizedSelect = React.forwardRef<
    HTMLSelectElement,
    React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
    <select
        ref={ref}
        className={cn(
            "border rounded-md h-11 w-full px-3 text-sm bg-background sm:h-9",
            className
        )}
        {...props}
    />
));
MobileOptimizedSelect.displayName = "MobileOptimizedSelect";

// Mobile-first button container layout
type MobileButtonGroupProps = {
    children: React.ReactNode;
    className?: string;
    primaryFirst?: boolean; // Place primary button first on mobile
};

export function MobileButtonGroup({
    children,
    className,
    primaryFirst = true
}: MobileButtonGroupProps) {
    return (
        <div
            className={cn(
                "flex flex-col gap-3 pt-4 sm:flex-row sm:justify-end sm:gap-2",
                className
            )}
        >
            {React.Children.map(children, (child, index) => {
                if (React.isValidElement(child)) {
                    // Apply mobile-first ordering if primaryFirst is enabled
                    const orderClass = primaryFirst && index === 1
                        ? "order-1 sm:order-2"
                        : primaryFirst && index === 0
                            ? "order-2 sm:order-1"
                            : "";

                    return React.cloneElement(child, {
                        className: cn((child.props as any).className, orderClass)
                    } as any);
                }
                return child;
            })}
        </div>
    );
}