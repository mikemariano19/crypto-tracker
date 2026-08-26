"use client";

import CryptoTable from "@/components/CryptoTable";



export default function Home() {
  return (
    <div className="mx-auto max-w-5xl p-2">
      <div className="grid grid-cols-1 lg:grid-cols-3 md:gap-x-4">
        <div className="hidden lg:block">
          <CryptoTable />
        </div>
      </div>
    </div>
  );
}