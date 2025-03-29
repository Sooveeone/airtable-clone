"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

interface CreateBaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateBaseModal({ isOpen, onClose }: CreateBaseModalProps) {
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { userId } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert("Please enter a base name");
      return;
    }

    try {
      setIsLoading(true);

      // Create the base using the API
      const response = await fetch("/api/bases", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        throw new Error("Failed to create base");
      }

      const data = await response.json();

      // Reset form
      setName("");

      // Close modal
      onClose();

      // Refresh the data
      router.refresh();

      // Redirect to the base page
      router.push(`/base/${data.id}`);
    } catch (error) {
      console.error("Error creating base:", error);
      alert("Failed to create base. Please try again.");
    } finally {
      setIsLoading(false);
    }
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
                  placeholder="My Awesome Base"
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
