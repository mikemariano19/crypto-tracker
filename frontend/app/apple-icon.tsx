import { appIcon } from "@/lib/pwaIcon";

// The icon an iPhone uses when the app is added to the Home Screen.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return appIcon(size.width);
}
