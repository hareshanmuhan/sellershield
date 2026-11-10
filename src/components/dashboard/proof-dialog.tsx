"use client";
import { useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Camera, CheckCircle2, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { type Order } from "./shared";

const MAX = 3;
type Photo = NonNullable<Order["proof"]>[number];

/** Shrink to at most 1600px on the long side as JPEG, so uploads stay small and fast. */
async function toJpeg(file: File): Promise<{ mimeType: string; base64: string }> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL("image/jpeg", 0.85);
  return { mimeType: "image/jpeg", base64: url.split(",")[1] };
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={cn("flex items-center gap-1.5", ok ? "text-shield" : "text-muted-foreground")}>
      {ok ? <CheckCircle2 className="size-4" /> : <span className="size-4 rounded-full border-2 border-current inline-block" />}
      {label}
    </li>
  );
}

export function ProofDialog({ order, open, onOpenChange, onDone }: { order?: Order; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  if (!order) return null;
  const photos: Photo[] = order.proof || [];
  const good = photos.filter((p) => p.good) as (Photo & { checks?: { itemMatches: boolean; labelVisible: boolean; boxSealed: boolean } })[];
  const has = (k: "itemMatches" | "labelVisible" | "boxSealed") => good.some((p) => p.checks?.[k]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const list = [...files].slice(0, MAX - photos.length);
    if (!list.length) return toast.error(`Up to ${MAX} photos per order. Delete one first.`);
    setBusy(true);
    try {
      const images = await Promise.all(list.map(toJpeg));
      const r = await fetch(`/api/proof/${order!.orderId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ images }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      const fresh: Photo[] = d.slice(photos.length);
      const goodNew = fresh.filter((p) => p.good).length;
      if (goodNew === fresh.length) toast.success(`${goodNew} photo${goodNew === 1 ? "" : "s"} saved as proof`);
      else toast.warning(`${fresh.length - goodNew} photo${fresh.length - goodNew === 1 ? " needs" : "s need"} a retake`);
      onDone();
    } catch (e: any) {
      toast.error("Couldn't save the photos", { description: e.message });
    }
    setBusy(false);
  }

  async function remove(file: string) {
    await fetch(`/api/proof/${order!.orderId}?file=${encodeURIComponent(file)}`, { method: "DELETE" });
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">Packing photos</DialogTitle>
          <DialogDescription>
            {order.item}. Take {MAX} quick photos before you ship: the item, its label or size, and the sealed box. If the buyer
            opens a dispute, SellerShield attaches them as proof.
          </DialogDescription>
        </DialogHeader>

        <ul className="grid grid-cols-3 gap-2 text-sm">
          <Check ok={has("itemMatches")} label="Right item" />
          <Check ok={has("labelVisible")} label="Label or size" />
          <Check ok={has("boxSealed")} label="Sealed box" />
        </ul>

        {photos.length > 0 && (
          <ul className="grid grid-cols-3 gap-3">
            {photos.map((p) => (
              <motion.li key={p.file} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col gap-1.5">
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/proof/${order.orderId}/${p.file}`} alt={p.feedback} className={cn("aspect-square w-full rounded-lg object-cover border-2", p.good ? "border-shield" : "border-marigold")} />
                  <button
                    onClick={() => remove(p.file)}
                    aria-label="Delete this photo"
                    className="absolute right-1 top-1 rounded-full bg-card/90 p-1 text-muted-foreground hover:text-coral"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <p className={cn("text-xs leading-snug", p.good ? "text-shield" : "text-marigold-ink")}>
                  {p.good ? "✅ " : <RotateCcw className="inline size-3 mr-0.5" />}
                  {p.feedback}
                </p>
                <p className="text-[11px] text-muted-foreground">{new Date(p.at).toLocaleString()}</p>
              </motion.li>
            ))}
          </ul>
        )}

        {photos.length < MAX && (
          <Button asChild disabled={busy} className="self-start">
            <label className={cn("cursor-pointer", busy && "pointer-events-none opacity-60")}>
              <Camera /> {busy ? "Checking photos…" : photos.length ? "Add another photo" : "Add packing photos"}
              <input type="file" accept="image/*" multiple className="sr-only" disabled={busy} onChange={(e) => upload(e.target.files)} />
            </label>
          </Button>
        )}
        <p className="text-xs text-muted-foreground">Photos are saved with the time they were added. The AI check is a helper, not a promise PayPal will accept them.</p>
      </DialogContent>
    </Dialog>
  );
}
