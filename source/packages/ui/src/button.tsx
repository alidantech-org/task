import { Slot } from "@radix-ui/react-slot";
import { cn } from "@task/ui/utils.ts";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, JSX } from "react";

const buttonStyles = cva(
  "inline-flex shrink-0 flex-row items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium leading-none transition-[background-color,color,border-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/95",
        secondary:
          "border border-border/70 bg-secondary/80 text-secondary-foreground hover:bg-secondary",
        outline:
          "border border-border bg-background hover:border-ring/50 hover:bg-accent hover:text-accent-foreground",
        ghost: "text-foreground hover:bg-accent hover:text-accent-foreground",
        destructive:
          "bg-destructive/10 text-destructive ring-1 ring-destructive/15 hover:bg-destructive hover:text-white",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3 text-xs",
        lg: "h-11 px-6",
        icon: "h-10 w-10 p-0 [&_svg]:pointer-events-none [&_svg]:shrink-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonStyles> {
  asChild?: boolean;
}

export function Button({
  asChild = false,
  className,
  size,
  variant,
  ...props
}: ButtonProps): JSX.Element {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      className={cn(buttonStyles({ className, size, variant }))}
      data-slot="button"
      data-variant={variant ?? "default"}
      data-size={size ?? "default"}
      {...props}
    />
  );
}
