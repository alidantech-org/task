import { cn } from "@task/ui/utils.ts";
import type { HTMLAttributes, JSX } from "react";

export function Separator({ className, ...props }: HTMLAttributes<HTMLHRElement>): JSX.Element {
  return <hr className={cn("border-0 border-t border-border", className)} {...props} />;
}
