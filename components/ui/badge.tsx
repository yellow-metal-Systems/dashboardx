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
          "border-transparent bg-success-solid font-bold text-white hover:bg-success-solid/90",
        destructive:
          "border-transparent bg-error-solid font-bold text-white hover:bg-error-solid/90",
        grey: "border-transparent bg-grey-solid font-bold text-white hover:bg-grey-solid/90",
        secondary:
          "rounded-sm border-transparent bg-secondary-container font-extrabold text-on-secondary-container",
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
