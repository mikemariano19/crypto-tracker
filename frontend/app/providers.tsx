"use client";

import { useLayoutEffect, useState } from "react";
import { SWRConfig, useSWRConfig } from "swr";
import {
  createPersistentCache,
  loadPersistedEntries,
  type PersistedEntry,
} from "@/lib/persistentCache";

function RestorePersistedCache({
  markRestored,
}: {
  markRestored: (key: string, entry: PersistedEntry) => void;
}) {
  const { mutate } = useSWRConfig();

  // Restore after hydration (so server and client markup match) but before
  // the data hooks below mount: sibling layout effects run in order, so the
  // hooks see cached data and then revalidate it in the background.
  useLayoutEffect(() => {
    for (const [key, entry] of Object.entries(loadPersistedEntries())) {
      markRestored(key, entry);
      mutate(key, entry.data, { revalidate: false });
    }
  }, [mutate, markRestored]);

  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [{ cache, markRestored }] = useState(createPersistentCache);

  return (
    <SWRConfig value={{ provider: () => cache }}>
      <RestorePersistedCache markRestored={markRestored} />
      {children}
    </SWRConfig>
  );
}
