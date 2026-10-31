import type { HTMLAttributes, JSX } from "react";
import { cn } from "@task/ui/utils.ts";

export function Separator({ className, ...props }: HTMLAttributes<HTMLHRElement>): JSX.Element {
  return <hr className={cn("border-0 border-t border-border", className)} {...props} />;
}
