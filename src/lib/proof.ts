// Proof Vault: packing photos per order, checked by Gemini vision, saved under data/proof/<orderId>/.
import { promises as fs } from "fs";
import path from "path";
import { askJSON } from "./gemini";
import { updateOrder, type Order, type ProofPhoto } from "./store";

export const MAX_PHOTOS = 3;
const MAX_BYTES = 8 * 1024 * 1024; // PayPal accepts evidence files up to 10 MB each
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const ROOT = path.join(process.cwd(), "data", "proof");

/** Only plain ids and generated file names, so a request can never point outside data/proof. */
const SAFE = /^[A-Za-z0-9_-]+(\.[a-z]+)?$/;

export function proofPath(orderId: string, file: string) {
  if (!SAFE.test(orderId) || !SAFE.test(file)) throw new Error("Bad photo path");
  return path.join(ROOT, orderId, file);
}

type Vision = {
  shows: string;
  itemVisible: boolean;
  itemMatches: boolean | null;
  labelVisible: boolean;
  boxSealed: boolean;
  usable: boolean;
  retakeReason: string;
};

async function checkPhoto(o: Order, mimeType: string, base64: string): Promise<Pick<ProofPhoto, "good" | "feedback" | "checks">> {
  const v = await askJSON<Vision>(
    `You check a small seller's packing photo, which they'll use as proof in a PayPal dispute.
The order is: "${o.item}" (paid $${o.amount}).
Look at the photo and answer honestly:
- itemVisible: is a product visible?
- itemMatches: does the visible product match "${o.item}"? null if no product is visible.
- labelVisible: is a shipping label, address label, size or product label readable?
- boxSealed: is a closed, taped/sealed package visible?
- usable: is it a real, sharp, well-lit photo that could serve as evidence?
- retakeReason: if it isn't good proof, one short instruction to fix it, e.g. "Show the wallet next to the open box".
Return JSON: {"shows":"what the photo shows in under 12 words","itemVisible":bool,"itemMatches":bool|null,"labelVisible":bool,"boxSealed":bool,"usable":bool,"retakeReason":"..."}`,
    { mimeType, base64 }
  );
  // A closed box shows no item at all; that's "unknown", not "wrong item".
  const matches = v.itemVisible ? v.itemMatches : null;
  const checks = { itemMatches: matches === true, labelVisible: !!v.labelVisible, boxSealed: !!v.boxSealed };
  // Code decides: a wrong item or an unclear photo is never good proof; otherwise it must show at least one useful thing.
  const good = !!v.usable && matches !== false && (checks.itemMatches || checks.labelVisible || checks.boxSealed);
  const feedback = good
    ? `Good proof: ${v.shows}`
    : `Retake: ${matches === false ? `this doesn't look like ${o.item}. ` : ""}${v.retakeReason || "make the item, label or sealed box clearly visible"}`;
  return { good, feedback, checks };
}

export async function addProof(o: Order, images: { mimeType: string; base64: string }[]) {
  const existing = o.proof || [];
  if (!images.length) throw new Error("Add at least one photo");
  if (existing.length + images.length > MAX_PHOTOS) throw new Error(`Up to ${MAX_PHOTOS} photos per order. Delete one first.`);
  await fs.mkdir(path.join(ROOT, o.orderId), { recursive: true });

  const added: ProofPhoto[] = [];
  for (const [i, img] of images.entries()) {
    const ext = TYPES[img.mimeType];
    if (!ext) throw new Error("Photos must be JPG, PNG or WebP");
    const buf = Buffer.from(img.base64, "base64");
    if (buf.length > MAX_BYTES) throw new Error("Each photo must be under 8 MB");
    const at = new Date().toISOString();
    const file = `${at.replace(/[:.]/g, "-")}-${i + 1}.${ext}`;
    await fs.writeFile(proofPath(o.orderId, file), buf);
    let result: Pick<ProofPhoto, "good" | "feedback" | "checks">;
    try {
      result = await checkPhoto(o, img.mimeType, img.base64);
    } catch (e) {
      console.error("photo check failed", e);
      result = { good: false, feedback: "Retake: the AI couldn't check this photo, try again" };
    }
    added.push({ file, at, mimeType: img.mimeType, ...result });
  }
  const proof = [...existing, ...added];
  await updateOrder(o.orderId, { proof });
  return proof;
}

export async function removeProof(o: Order, file: string) {
  await fs.rm(proofPath(o.orderId, file), { force: true });
  const proof = (o.proof || []).filter((p) => p.file !== file);
  await updateOrder(o.orderId, { proof });
  return proof;
}

/** What the set of photos proves together. */
export function proofSummary(o: Order) {
  const good = (o.proof || []).filter((p) => p.good);
  return {
    goodCount: good.length,
    itemShown: good.some((p) => p.checks?.itemMatches),
    labelShown: good.some((p) => p.checks?.labelVisible),
    sealedShown: good.some((p) => p.checks?.boxSealed),
    photos: good,
  };
}

export async function readProofFiles(o: Order) {
  const { photos } = proofSummary(o);
  return Promise.all(photos.map(async (p) => ({ name: p.file, mimeType: p.mimeType, data: await fs.readFile(proofPath(o.orderId, p.file)), at: p.at })));
}
