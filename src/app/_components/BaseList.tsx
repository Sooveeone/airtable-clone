"use client";

import Link from "next/link";
import { Loader2, Trash2 } from "lucide-react";
import { api } from "@/trpc/react";

export function BaseList() {
  const utils = api.useUtils();
  const { data: bases, isLoading } = api.base.getAll.useQuery();

  const deleteMutation = api.base.delete.useMutation({
    onSuccess: () => {
      utils.base.getAll.invalidate();
    },
  });

  const handleDelete = (id: string) => {
    const confirmed = confirm("Are you sure you want to delete this base?");
    if (!confirmed) return;
    deleteMutation.mutate({ baseId: id });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="text-primary h-10 w-10 animate-spin" />
      </div>
    );
  }

  if (!bases || bases.length === 0) {
    return (
      <div className="py-10 text-center">
        <h3 className="text-lg font-medium">No bases found</h3>
        <p className="text-muted-foreground mt-2">
          Create your first base to get started
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {bases.map((base) => (
        <Link
          href={`/base/${base.id}`}
          key={base.id}
          className="group relative flex flex-col rounded-lg border bg-white shadow-sm transition hover:border-blue-500 hover:shadow-md"
        >
          <div className="p-6">
            <h3 className="text-lg font-medium group-hover:text-blue-600">
              {base.name}
            </h3>
            <button
              onClick={(e) => {
                e.preventDefault();
                handleDelete(base.id);
              }}
              className="absolute top-3 right-3 text-red-500 hover:text-red-700"
              title="Delete base"
            >
              <Trash2 size={16} />
            </button>
          </div>
          <div className="mt-auto p-6 pt-0">
            <span className="block text-center text-sm text-gray-500">
              Created at: {new Date(base.createdAt).toLocaleString()}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}

export default BaseList;
