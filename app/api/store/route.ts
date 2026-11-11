import { mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";
import type { StoreData } from "@/lib/useStore";

// Everything lives in one JSON file in the project folder, so your history stays on your
// computer and survives clearing the browser.
const DIR = path.join(process.cwd(), "data");
const FILE = path.join(DIR, "store.json");

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(JSON.parse(await readFile(FILE, "utf8")));
  } catch {
    return Response.json({ transactions: [], imports: [] } satisfies StoreData);
  }
}

export async function PUT(req: Request) {
  const data = (await req.json()) as StoreData;
  if (!Array.isArray(data?.transactions) || !Array.isArray(data?.imports)) {
    return Response.json({ error: "Invalid data" }, { status: 400 });
  }
  await mkdir(DIR, { recursive: true });
  // Write to a temporary file and then rename it, so a crash mid-save can't leave a half-written store.
  await writeFile(FILE + ".tmp", JSON.stringify(data, null, 1));
  await rename(FILE + ".tmp", FILE);
  return Response.json({ ok: true });
}
