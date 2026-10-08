import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex h-6 items-center rounded-full border px-2.5 text-label-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-black-solid font-bold text-white hover:bg-black-solid/90",
        success:
          "border-transparent bg-success-soft font-bold text-on-success-soft hover:bg-success-soft",
        destructive:
          "border-transparent bg-error-soft font-bold text-on-error-soft hover:bg-error-soft",
        grey: "border-transparent bg-secondary-container font-bold text-on-secondary-container hover:bg-secondary-container",
        secondary:
          "border-transparent bg-secondary-container font-extrabold text-on-secondary-container",
        // Soft amber pill, as in a "Building" status badge; pair with `dot`.
        pending: "border-transparent bg-pending-soft font-bold text-on-pending-soft hover:bg-pending-soft",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  /** A small solid dot before the text — a status indicator. */
  dot?: boolean
}

function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), dot && "gap-1.5", className)} {...props}>
      {dot && (
        <span
          aria-hidden="true"
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            variant === "pending" ? "bg-warning" : variant === "success" ? "bg-success-solid" : "bg-current"
          )}
        />
      )}
      {children}
    </div>
  )
}

export { Badge, badgeVariants }
