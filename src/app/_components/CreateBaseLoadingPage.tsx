"use client";

import { Loader2 } from "lucide-react";

export function CreateBaseLoadingPage() {
  return (
    <div className="fixed inset-0 z-50 flex min-h-screen w-full items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-gray-900" />
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">Creating your base</h2>
          <p className="mt-1 text-sm text-gray-500">This will only take a moment...</p>
        </div>
      </div>
    </div>
  );
} 