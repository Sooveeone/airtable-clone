"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";

interface CreateBaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateBaseModal({ isOpen, onClose }: CreateBaseModalProps) {
  const [name, setName] = useState("");
  const router = useRouter();
  const utils = api.useUtils();

  const createBase = api.base.create.useMutation({
    onSuccess: (data) => {
      // Optimistically update the cache for getAll
      utils.base.getAll.setData(undefined, (old) => {
        return old ? [data, ...old] : [data];
      });

      setName("");
      onClose();
      router.push(`/base/${data.id}`);
    },
    onError: (err) => {
      console.error("Error creating base:", err);
      alert("Failed to create base. Please try again.");
    },
  });

  const isLoading = createBase.status === "pending";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert("Please enter a base name");
      return;
    }

    createBase.mutate({ name });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/10 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg bg-white">
        <div className="p-6">
          <h2 className="mb-2 text-xl font-semibold">Create New Base</h2>
          <p className="mb-4 text-gray-500">Enter a name for your new base.</p>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="name"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                  placeholder="Enter base name"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-gray-300 px-4 py-2"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                disabled={isLoading}
              >
                {isLoading ? "Creating..." : "Create Base"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
