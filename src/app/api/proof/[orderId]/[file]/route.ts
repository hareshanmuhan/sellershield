import { promises as fs } from "fs";
import { proofPath } from "@/lib/proof";
import { fail } from "@/lib/api";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

// Serves a saved packing photo. proofPath() rejects anything that isn't a plain id/file name.
export async function GET(_req: Request, { params }: { params: Promise<{ orderId: string; file: string }> }) {
  try {
    const { orderId, file } = await params;
    const data = await fs.readFile(proofPath(orderId, file));
    return new Response(new Uint8Array(data), {
      headers: { "Content-Type": TYPES[file.split(".").pop() || ""] || "application/octet-stream", "Cache-Control": "private, max-age=3600" },
    });
  } catch {
    return fail("Photo not found", 404);
  }
}
