import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
const variants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:opacity-50 disabled:pointer-events-none", {
  variants: {
    variant: { default: "bg-sky-500 text-white shadow-lg shadow-sky-500/20 hover:bg-sky-400", secondary: "bg-white/10 text-current border border-white/15 hover:bg-white/20", ghost: "hover:bg-white/10" },
    size: { default: "h-10 px-4 py-2", sm: "h-9 px-3", icon: "h-10 w-10" },
  }, defaultVariants: { variant: "default", size: "default" },
});
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof variants> { asChild?: boolean }
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button({className, variant, size, asChild = false, ...props}, ref) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(variants({ variant, size }), className)} ref={ref} {...props} />;
});
