"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function ShieldMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <path d="M16 2.5 4.5 7v8.2c0 7.3 4.9 12.4 11.5 14.3 6.6-1.9 11.5-7 11.5-14.3V7L16 2.5Z" fill="var(--shield)" />
      <path d="M10.5 16.2l3.8 3.8 7.4-8" fill="none" stroke="var(--marigold)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const links = [
  { href: "/", label: "My shop" },
  { href: "/store", label: "Demo store" },
];

export function SiteHeader() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 font-heading text-lg sm:text-xl font-bold text-pine">
          <ShieldMark className="size-7 sm:size-8" />
          SellerShield
        </Link>
        <nav className="flex gap-1 rounded-full bg-card p-1 border text-sm font-bold">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={path === l.href ? "page" : undefined}
              className={cn(
                "rounded-full px-3 sm:px-4 py-1.5 whitespace-nowrap transition-colors",
                path === l.href ? "bg-pine text-white" : "text-muted-foreground hover:text-pine"
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
