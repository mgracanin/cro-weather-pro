import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
export function Card({className, ...rest}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("glass-panel rounded-[24px]", className)} {...rest}/>;
}
