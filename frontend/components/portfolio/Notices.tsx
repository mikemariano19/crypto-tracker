import { AlertTriangle, HardDriveDownload, ShieldCheck, X } from "lucide-react";
import type { Persistence } from "@/lib/wallet/storage";

export function PrivacyNotice() {
  return (
    <p className="flex items-center gap-2 text-xs text-muted-foreground">
      <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      Your data is stored only in this browser. Clearing browser data deletes it. Use Export to back up.
    </p>
  );
}

function Banner({ children, onDismiss }: { children: React.ReactNode; onDismiss?: () => void }) {
  return (
    <div role="status" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">{children}</div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="rounded p-0.5 hover:bg-amber-100">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export function StalePricesBanner({ updatedAt }: { updatedAt: number | null }) {
  return (
    <Banner>
      Prices may be outdated
      {updatedAt !== null && <> (last updated {formatClock(updatedAt)})</>}. We&apos;ll keep trying.
    </Banner>
  );
}

/** Saving turned off, storage full, or saved data that couldn't be read. */
export function StorageNotice({
  persistence,
  recoveredFrom,
  onDismissRecovery,
}: {
  persistence: Persistence;
  recoveredFrom: string | null;
  onDismissRecovery: () => void;
}) {
  return (
    <>
      {persistence === "memory" && (
        <Banner>
          Saving is turned off in this browser; your data will be lost when you close the tab.
        </Banner>
      )}
      {persistence === "full" && (
        <Banner>
          <span className="inline-flex items-center gap-1">
            <HardDriveDownload className="h-4 w-4" aria-hidden="true" />
            Browser storage is full, so recent changes aren&apos;t saved.
          </span>{" "}
          Export a backup and remove wallets you no longer use.
        </Banner>
      )}
      {recoveredFrom && (
        <Banner onDismiss={onDismissRecovery}>
          Your saved wallets couldn&apos;t be read, so the tracker started fresh. A copy of the old data was kept in
          this browser under <code className="text-xs">{recoveredFrom}</code>.
        </Banner>
      )}
    </>
  );
}

export function formatClock(ms: number): string {
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(ms);
}
