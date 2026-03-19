import * as React from "react"

import { cn } from "@/lib/utils"
import { fieldBase } from "./field-styles"

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps extends React.ComponentProps<"select"> {
  options?: SelectOption[]
  placeholder?: string
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options = [], placeholder, children, required, ...props }, ref) => {
    const hasPlaceholder = Boolean(placeholder)

    return (
      <div className="relative w-full">
        <select
          ref={ref}
          required={required}
          className={cn(
            fieldBase,
            "h-10 appearance-none items-center justify-between pr-10",
            className
          )}
          {...props}
        >
          {hasPlaceholder ? (
            <option value="" disabled={required}>
              {placeholder}
            </option>
          ) : null}

          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}

          {children}
        </select>

        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground" aria-hidden="true">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </div>
    )
  }
)
Select.displayName = "Select"

export { Select }
