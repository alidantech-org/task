import type { HTMLAttributes, JSX } from "react";
import { cn } from "@task/ui/utils.tsx";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return <section className={cn("rounded-xl border bg-card text-card-foreground", className)} {...props} />;
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return <div className={cn("flex flex-col gap-1.5 p-5", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>): JSX.Element {
  return <h2 className={cn("font-semibold leading-none tracking-tight", className)} {...props} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>): JSX.Element {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return <div className={cn("p-5 pt-0", className)} {...props} />;
}
