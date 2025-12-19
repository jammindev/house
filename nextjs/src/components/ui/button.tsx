import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-semibold ring-offset-background transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 disabled:saturate-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98] shadow-sm hover:shadow-md",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-br from-primary-500 to-primary-600 text-white hover:from-primary-600 hover:to-primary-700 shadow-primary-500/20 hover:shadow-primary-600/30 backdrop-blur-xl ",
        destructive:
          "bg-gradient-to-br from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 shadow-red-500/20 hover:shadow-red-600/30 backdrop-blur-xl border border-red-400/20 hover:border-red-300/30",
        outline:
          "border-2 border-border/40 bg-background/60 backdrop-blur-xl hover:bg-background/80 hover:border-border/60 text-foreground shadow-sm hover:shadow-md",
        secondary:
          "bg-gradient-to-br from-secondary/80 to-secondary/90 backdrop-blur-xl text-secondary-foreground hover:from-secondary hover:to-secondary border border-secondary/30 hover:border-secondary/50",
        ghost: 
          "hover:bg-accent/60 hover:text-accent-foreground backdrop-blur-sm hover:backdrop-blur-md shadow-none hover:shadow-sm",
        link: 
          "text-primary underline-offset-4 hover:underline shadow-none hover:shadow-none",
        glass:
          "bg-white/10 backdrop-blur-xl border border-white/20 hover:bg-white/20 hover:border-white/30 text-foreground shadow-lg hover:shadow-xl",
      },
      size: {
        default: "h-10 px-5 py-2.5",
        sm: "h-9 px-4 py-2",
        lg: "h-12 px-8 py-3 text-base",
        icon: "h-14 w-14 rounded-full bg-glass",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
