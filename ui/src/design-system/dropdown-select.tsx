import * as React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from './dropdown-menu';

export interface DropdownSelectOption {
  value: string;
  label: string;
}

interface DropdownSelectProps {
  value: string;
  options: DropdownSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  align?: 'start' | 'center' | 'end';
  children: React.ReactNode;
}

export function DropdownSelect({
  value,
  options,
  onChange,
  disabled,
  align = 'start',
  children,
}: DropdownSelectProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align}>
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          {options.map((opt) => (
            <DropdownMenuRadioItem key={opt.value} value={opt.value}>
              {opt.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
