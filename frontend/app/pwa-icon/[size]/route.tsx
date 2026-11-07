import { appIcon } from "@/lib/pwaIcon";

// The manifest's icons need fixed URLs, so they're plain routes rather than
// the hashed `icon` file convention. Not under /api: that goes to Laravel.
const SIZES = ["192", "512"];

export const dynamicParams = false;

export function generateStaticParams() {
  return SIZES.map((size) => ({ size }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;

  return appIcon(Number(size));
}
