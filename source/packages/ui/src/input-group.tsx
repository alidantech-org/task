import { cn } from "@task/ui/utils.ts";
import type { HTMLAttributes, InputHTMLAttributes, JSX } from "react";

export function InputGroup({ className, ...props }: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return (
    <div
      className={cn(
        "flex h-10 items-center gap-2 rounded-xl border border-input bg-background px-3 text-muted-foreground transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30",
        className,
      )}
      {...props}
    />
  );
}

export function InputGroupInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>): JSX.Element {
  return (
    <input
      className={cn(
        "h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-foreground outline-none ring-0 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0",
        className,
      )}
      {...props}
    />
  );
}
