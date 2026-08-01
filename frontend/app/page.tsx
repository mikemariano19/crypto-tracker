"use client";
import CryptoTable from "@/components/CryptoTable";

export default function Home() {
  return (
    <div className="sm:mx-2 md:mx-4">
      <div className="mx-auto max-w-5xl p-2">
        <CryptoTable />
      </div>
    </div>
  );
}
