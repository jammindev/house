import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export type StepperStep = {
    title: string;
    description?: string;
};

interface StepperProps {
    steps: StepperStep[];
    currentStep: number;
    className?: string;
}

export default function Stepper({ steps, currentStep, className }: StepperProps) {
    return (
        <div className={cn("flex flex-col gap-2", className)} aria-label="progress">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                {steps.map((step, index) => {
                    const state = index < currentStep ? "complete" : index === currentStep ? "active" : "upcoming";
                    return (
                        <div key={step.title} className="flex items-center gap-2">
                            <div
                                className={cn(
                                    "h-1.5 w-6 rounded-full transition",
                                    state === "complete" && "bg-primary-400",
                                    state === "active" && "bg-primary-500",
                                    state === "upcoming" && "bg-slate-200"
                                )}
                            />
                            {index < steps.length - 1 ? <div className="h-px w-4 bg-slate-200" /> : null}
                        </div>
                    );
                })}
                <span className="ml-auto text-slate-600">
                    {steps[currentStep]?.title ?? ""} ({currentStep + 1}/{steps.length})
                </span>
            </div>
        </div>
    );
}
