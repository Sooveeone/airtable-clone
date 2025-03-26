"use client";

import { useState } from "react";

interface CreateBaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateBase: (name: string) => Promise<void>;
  error?: string | null;
}

export default function CreateBaseModal({
  isOpen,
  onClose,
  onCreateBase,
  error,
}: CreateBaseModalProps) {
  const [baseName, setBaseName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!baseName.trim()) return;

    setIsLoading(true);
    try {
      await onCreateBase(baseName);
      setBaseName("");
      onClose();
    } catch (error) {
      console.error("Error creating base:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Create a new base</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-gray-100"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="baseName"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Base name
            </label>
            <input
              type="text"
              id="baseName"
              value={baseName}
              onChange={(e) => setBaseName(e.target.value)}
              placeholder="My new base"
              className="w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              required
              autoFocus
            />
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              disabled={isLoading || !baseName.trim()}
            >
              {isLoading ? "Creating..." : "Create base"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
