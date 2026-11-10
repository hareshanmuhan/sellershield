"use client";
import { MotionConfig } from "motion/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

// reducedMotion="user" makes every motion animation honour prefers-reduced-motion.
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider delayDuration={150}>
        {children}
        <Toaster position="top-center" richColors closeButton />
      </TooltipProvider>
    </MotionConfig>
  );
}
