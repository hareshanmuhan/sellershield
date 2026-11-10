"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

const KEY = "sellershield.banner.dismissed";

const steps = [
  { title: "Sell as usual", body: "Your PayPal orders show up here on their own." },
  { title: "We spot money at risk", body: "Missing tracking, unhappy buyers and disputes get flagged early." },
  { title: "You approve each fix", body: "The AI drafts the fix. Nothing happens until you say yes." },
];

export function WelcomeBanner() {
  // null = not known yet. Render nothing until we know, so the banner neither flashes
  // for sellers who closed it nor slides in late and pushes the page down.
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      setOpen(localStorage.getItem(KEY) !== "1");
    } catch {
      setOpen(true);
    }
  }, []);

  function dismiss() {
    setOpen(false);
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
  }

  if (open === null) return null;
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.section
          key="banner"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
          className="overflow-hidden"
          aria-label="About SellerShield"
        >
          <div className="relative rounded-2xl bg-pine text-white p-6 sm:p-7 mb-8">
            <Button
              variant="ghost"
              size="icon"
              onClick={dismiss}
              aria-label="Close this introduction"
              className="absolute right-3 top-3 text-white/70 hover:text-white hover:bg-white/10"
            >
              <X />
            </Button>
            <p className="font-heading text-2xl sm:text-3xl font-bold max-w-2xl text-balance pr-8">
              Small sellers lose money to PayPal holds and disputes they never saw coming.
            </p>
            <p className="mt-2 text-white/75 max-w-xl">
              SellerShield watches your account and tells you what to do next, in plain words.
            </p>
            <ol className="mt-6 grid gap-4 sm:grid-cols-3">
              {steps.map((s, i) => (
                <li key={s.title} className="flex gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-marigold text-pine font-heading font-bold">
                    {i + 1}
                  </span>
                  <div>
                    <div className="font-bold">{s.title}</div>
                    <div className="text-sm text-white/75">{s.body}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
