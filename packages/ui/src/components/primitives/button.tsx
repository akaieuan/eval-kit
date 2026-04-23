import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn.js";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-md font-normal tracking-tight transition-colors focus-visible:focus-ring disabled:pointer-events-none disabled:opacity-50 select-none",
  {
    variants: {
      variant: {
        default:
          "border border-border bg-bg-elev text-fg hover:border-border-strong hover:bg-bg-elev-2",
        primary:
          "bg-fg-strong text-bg hover:bg-fg",
        ghost:
          "text-fg-muted hover:bg-bg-elev-2 hover:text-fg",
        outline:
          "border border-border text-fg-muted hover:border-border-strong hover:text-fg",
        danger:
          "border border-danger/30 text-danger hover:bg-danger/8",
      },
      size: {
        sm: "h-6 px-2 text-xs",
        md: "h-8 px-3 text-[13px]",
        lg: "h-9 px-4 text-[13px]",
        icon: "h-8 w-8",
        "icon-sm": "h-6 w-6",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
