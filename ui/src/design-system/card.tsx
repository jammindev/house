import * as React from "react"

import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-2xl border border-2 bg-card text-card-foreground shadow-sm",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-3", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

/** Detects a leading emoji in a string and splits it from the rest.
 *  Handles ZWJ sequences (e.g. \uD83D\uDC68\u200D\uD83C\uDF73), skin-tone modifiers (e.g. \uD83D\uDC4D\uD83C\uDFFC) and
 *  the variation selector VS16 used to force emoji presentation. */
function splitLeadingEmoji(text: string): [string | null, string] {
  const EMOJI_RE = /^(\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?)*)\s*/u;
  const match = text.match(EMOJI_RE);
  if (!match) return [null, text];
  return [match[1], text.slice(match[0].length)];
}

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const [emoji, text] =
      typeof children === "string" ? splitLeadingEmoji(children) : [null, null];

    return (
      <div
        ref={ref}
        className={cn("flex min-w-0 items-center gap-1.5 text-sm font-medium text-foreground", className)}
        {...props}
      >
        {emoji ? (
          <span className="inline-block shrink-0 select-none">{emoji}</span>
        ) : null}
        <span className="min-w-0 truncate">{text ?? children}</span>
      </div>
    );
  }
)
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
