"use client";

import { useId, useState } from "react";
import { FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import Modal from "@/components/portfolio/Modal";
import type { WalletActions } from "@/hooks/useWalletStore";
import { MAX_BACKUP_BYTES, readBackup, type BackupPreview } from "@/lib/wallet/backup";

/**
 * Restore from an Export file: pick it, see what's inside, then Replace
 * or Merge. Nothing changes until one of those is clicked, and an invalid
 * file changes nothing at all.
 */
export default function ImportDialog({
  open,
  onOpenChange,
  currentWallets,
  importState,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentWallets: number;
  importState: WalletActions["importState"];
  onImported: (message: string) => void;
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Import backup" description="Choose a file made with Export.">
      {open && (
        <ImportBody
          currentWallets={currentWallets}
          importState={importState}
          onDone={(message) => {
            onImported(message);
            onOpenChange(false);
          }}
          onCancel={() => onOpenChange(false)}
        />
      )}
    </Modal>
  );
}

function ImportBody({
  currentWallets,
  importState,
  onDone,
  onCancel,
}: {
  currentWallets: number;
  importState: WalletActions["importState"];
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();

  const choose = async (file: File | undefined) => {
    setPreview(null);
    setError(null);
    setFileName(file?.name ?? null);
    if (!file) return;

    if (file.size > MAX_BACKUP_BYTES) return setError("That file is too large to be a wallet backup.");

    const result = readBackup(await file.text());
    if (result.ok) setPreview(result.preview);
    else setError(result.error);
  };

  const apply = (mode: "replace" | "merge") => {
    if (!preview) return;

    const failure = importState(preview.state, mode);
    if (failure) return setError(failure);

    onDone(mode === "replace" ? `Restored ${describe(preview)} from the backup.` : `Merged ${describe(preview)} into your wallets.`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label
          htmlFor={inputId}
          className="flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center text-sm text-gray-600 hover:bg-gray-50 has-focus-visible:border-gray-400"
        >
          <FileUp className="h-5 w-5 text-gray-500" aria-hidden="true" />
          <span className="font-medium text-gray-900">{fileName ?? "Choose backup file"}</span>
          <span className="text-xs">.json from Export</span>
        </label>
        <input
          id={inputId}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={(event) => void choose(event.target.files?.[0])}
        />
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error} Nothing was changed.
        </p>
      )}

      {preview && (
        <div className="rounded-lg bg-gray-50 px-3 py-2.5 text-sm" role="status">
          <p className="font-semibold text-gray-900">This backup has {describe(preview)}.</p>
          <ul className="mt-1 space-y-0.5 text-gray-600">
            <li>
              <span className="font-medium text-gray-800">Replace</span>: your {currentWallets}{" "}
              {currentWallets === 1 ? "wallet is" : "wallets are"} swapped for the backup.
            </li>
            <li>
              <span className="font-medium text-gray-800">Merge</span>: new wallets are added; for wallets with the same
              name, each coin keeps its most recently updated amount.
            </li>
          </ul>
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" size="lg" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" variant="outline" size="lg" disabled={!preview} onClick={() => apply("merge")}>
          Merge
        </Button>
        <Button type="button" size="lg" disabled={!preview} onClick={() => apply("replace")}>
          Replace
        </Button>
      </div>
    </div>
  );
}

function describe(preview: BackupPreview): string {
  const wallets = `${preview.wallets} ${preview.wallets === 1 ? "wallet" : "wallets"}`;
  const coins = `${preview.coins} ${preview.coins === 1 ? "coin" : "coins"}`;
  return `${wallets}, ${coins}`;
}
