import * as React from 'react'
import * as ToastPrimitives from '@radix-ui/react-toast'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { useToastStore } from '@/lib/toast'

const ToastProvider = ToastPrimitives.Provider

function ToastViewport({ className, ...props }: React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>) {
  return (
    <ToastPrimitives.Viewport
      className={cn(
        'fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:max-w-[420px]',
        className
      )}
      {...props}
    />
  )
}

const toastVariants = cva(
  'group pointer-events-auto relative flex w-full items-center justify-between gap-4 overflow-hidden rounded-md border p-4 pr-8 shadow-lg transition-all data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-bottom-full',
  {
    variants: {
      variant: {
        default: 'border bg-background text-foreground',
        destructive: 'border-destructive bg-destructive text-destructive-foreground',
        success: 'border-green-500/50 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

function Toast({
  className,
  variant,
  ...props
}: React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> & VariantProps<typeof toastVariants>) {
  return (
    <ToastPrimitives.Root
      className={cn(toastVariants({ variant }), className)}
      {...props}
    />
  )
}

function ToastClose({ className, ...props }: React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>) {
  return (
    <ToastPrimitives.Close
      className={cn(
        'absolute right-2 top-2 rounded-md p-1 opacity-0 transition-opacity hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100',
        className
      )}
      {...props}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </svg>
    </ToastPrimitives.Close>
  )
}

function ToastTitle({ className, ...props }: React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>) {
  return <ToastPrimitives.Title className={cn('text-sm font-semibold', className)} {...props} />
}

function ToastDescription({ className, ...props }: React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>) {
  return <ToastPrimitives.Description className={cn('text-sm opacity-90', className)} {...props} />
}

/** Portail global — à inclure une fois dans chaque arbre React (mount-*.tsx) */
export function Toaster() {
  const { toasts, dismiss } = useToastStore()
  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, variant, duration }) => (
        <Toast
          key={id}
          variant={variant}
          duration={duration ?? 4000}
          onOpenChange={(open) => { if (!open) dismiss(id) }}
        >
          <div className="flex flex-col gap-1">
            {title && <ToastTitle>{title}</ToastTitle>}
            {description && <ToastDescription>{description}</ToastDescription>}
          </div>
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  )
}

export { Toast, ToastClose, ToastTitle, ToastDescription, ToastViewport, ToastProvider }
