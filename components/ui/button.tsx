import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm leading-5 font-extrabold transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Light raised (Draft 3) — chosen over a flat black fill.
        default: "bg-gradient-to-b from-[#fefdfc] to-[#f5f4f1] text-on-surface shadow-button hover:to-[#eeece8]",
        // Solid dark, for the one strongest action on a screen.
        dark: "bg-gradient-to-b from-[#2b2b29] to-[#161615] text-white shadow-button hover:to-[#000000]",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "bg-raised text-on-surface shadow-button hover:bg-surface-container-low",
        secondary: "bg-secondary text-on-secondary hover:bg-secondary/80",
        white:
          "bg-raised text-on-surface shadow-button hover:bg-surface-container-low",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "font-semibold text-link underline-offset-4 hover:text-link-hover hover:underline",
      },
      size: {
        default: "h-11 px-6 py-[9px] md:h-9",
        xs: "h-10 px-4 md:h-7",
        sm: "h-8 px-4 text-xs",
        lg: "h-10 px-8",
        icon: "h-9 w-9",
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
