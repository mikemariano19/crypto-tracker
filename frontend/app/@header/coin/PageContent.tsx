"use client";

import { usePathname } from "next/navigation";

export default function PageContent({
  children,
  profile,
}: {
  children: React.ReactNode;
  profile: React.ReactNode;
}) {
  const pathname = usePathname();
  const isProfilePage = pathname.startsWith("/coin/");

  return isProfilePage ? profile : children;
}