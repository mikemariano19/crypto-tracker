"use client";

import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import Modal from "@/components/portfolio/Modal";
import ProviderNameField from "@/components/portfolio/ProviderNameField";
import { useWalletProviders } from "@/hooks/useWalletProviders";
import { matchProvider, type WalletProvider } from "@/lib/wallet/providers";
import { WALLET_NAME_MAX, WALLET_NOTE_MAX, type Wallet } from "@/lib/wallet/schema";
import { walletNameError, walletNoteError } from "@/lib/wallet/validate";
import type { WalletInput } from "@/lib/wallet/actions";

export type WalletFormTarget = { kind: "create" } | { kind: "rename"; wallet: Wallet };

/**
 * Create a wallet or rename one: name (unique, ≤40) and an optional note.
 */
export default function WalletForm({
  target,
  wallets,
  onClose,
  onSubmit,
}: {
  target: WalletFormTarget | null;
  wallets: readonly Wallet[];
  onClose: () => void;
  /** Returns an error message, or null when saved. */
  onSubmit: (target: WalletFormTarget, input: WalletInput) => string | null;
}) {
  // While the suggestion list is open, Escape closes the list, not the dialog.
  const listOpenRef = useRef(false);

  return (
    <Modal
      open={target !== null}
      onOpenChange={(open) => !open && onClose()}
      onEscapeKeyDown={(event) => {
        if (listOpenRef.current) event.preventDefault();
      }}
      title={target?.kind === "rename" ? "Edit wallet" : "New wallet"}
      description="A name for where these coins are held, e.g. Binance or Ledger."
    >
      {target && (
        <WalletFormBody
          key={target.kind === "rename" ? target.wallet.id : "create"}
          target={target}
          wallets={wallets}
          onClose={onClose}
          onSubmit={onSubmit}
          listOpenRef={listOpenRef}
        />
      )}
    </Modal>
  );
}

function WalletFormBody({
  target,
  wallets,
  onClose,
  onSubmit,
  listOpenRef,
}: {
  target: WalletFormTarget;
  wallets: readonly Wallet[];
  onClose: () => void;
  onSubmit: (target: WalletFormTarget, input: WalletInput) => string | null;
  listOpenRef: React.RefObject<boolean>;
}) {
  const current = target.kind === "rename" ? target.wallet : null;
  const [name, setName] = useState(current?.name ?? "");
  const [pickedId, setPickedId] = useState<string | null>(current?.provider ?? null);
  const { providers, byId } = useWalletProviders();

  // The logo follows the name: a picked provider stays while the name still
  // mentions it ("Coinbase Exchange" → "Coinbase"); otherwise a typed name
  // that starts with a provider's name gets that provider ("Binance 2").
  const picked = pickedId ? byId.get(pickedId) : undefined;
  const pickedStillNamed =
    picked && name.toLowerCase().includes(picked.name.toLowerCase().split(/\s+/)[0]) ? picked : null;
  const provider: WalletProvider | null = pickedStillNamed ?? matchProvider(providers, name);
  // Before the list has loaded, keep whatever the wallet already had.
  const providerId = providers.length > 0 ? (provider?.id ?? null) : pickedId;
  const [note, setNote] = useState(current?.note ?? "");
  const [submitted, setSubmitted] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const id = useId();

  const nameError = walletNameError(name, wallets, current?.id);
  const noteError = note ? walletNoteError(note) : null;
  // Show name problems once typed (except "empty", which waits for submit).
  const shownNameError = submitted || name.trim() ? nameError : null;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (nameError || noteError) return;

    const failure = onSubmit(target, { name, note, provider: providerId });
    if (failure) return setSaveError(failure);
    onClose();
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div>
        <label htmlFor={`${id}-name`} className="mb-1.5 block text-sm font-medium text-gray-800">
          Name
        </label>
        <ProviderNameField
          id={`${id}-name`}
          value={name}
          onChange={(next) => {
            setName(next);
            setSaveError(null);
          }}
          providers={providers}
          provider={provider}
          onPick={(choice) => {
            setPickedId(choice.id);
            // Keep a longer typed name ("Binance savings"), else use the provider's.
            if (!name.toLowerCase().startsWith(choice.name.toLowerCase())) setName(choice.name);
            setSaveError(null);
          }}
          onOpenChange={(open) => (listOpenRef.current = open)}
          invalid={Boolean(shownNameError)}
          describedBy={`${id}-name-hint`}
        />
        <p id={`${id}-name-hint`} className={`mt-1.5 text-sm ${shownNameError ? "text-red-700" : "text-gray-500"}`}>
          {shownNameError ?? `${name.trim().length}/${WALLET_NAME_MAX}`}
        </p>
      </div>

      <div>
        <label htmlFor={`${id}-note`} className="mb-1.5 block text-sm font-medium text-gray-800">
          Note <span className="font-normal text-gray-500">(optional)</span>
        </label>
        <input
          id={`${id}-note`}
          autoComplete="off"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          aria-invalid={Boolean(noteError)}
          aria-describedby={`${id}-note-hint`}
          placeholder="Long-term holdings"
          className="h-10 w-full rounded-lg border bg-white px-3 text-sm outline-none focus-visible:border-gray-400 focus-visible:ring-3 focus-visible:ring-gray-200 aria-invalid:border-red-400"
        />
        <p id={`${id}-note-hint`} className={`mt-1.5 text-sm ${noteError ? "text-red-700" : "text-gray-500"}`}>
          {noteError ?? `${note.trim().length}/${WALLET_NOTE_MAX}`}
        </p>
      </div>

      {saveError && (
        <p role="alert" className="text-sm text-red-700">
          {saveError}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="lg" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" size="lg">
          {current ? "Save" : "Create wallet"}
        </Button>
      </div>
    </form>
  );
}
