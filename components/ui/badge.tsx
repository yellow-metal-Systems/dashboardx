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
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
