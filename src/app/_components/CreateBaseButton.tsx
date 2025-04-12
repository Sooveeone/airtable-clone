"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { CreateBaseModal } from "./CreateBaseModal";
import { CreateBaseLoadingPage } from "./CreateBaseLoadingPage";

export function CreateBaseButton() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  if (isCreating) {
    return <CreateBaseLoadingPage />;
  }

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 shadow-sm transition hover:border-gray-300 hover:bg-gray-50"
      >
        <Plus className="h-5 w-5" />
        <span>Create new base</span>
      </button>

      <CreateBaseModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setIsCreating(false);
        }}
      />
    </>
  );
}
