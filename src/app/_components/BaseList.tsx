"use client";

import Link from "next/link";
import CreateBaseButton from "./CreateBaseButton";
import type { Base } from "../_types/base";

type BaseListProps = {
  bases: Base[];
};

export default function BaseList({ bases }: BaseListProps) {
  if (bases.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-12">
        <div className="flex flex-col items-center justify-center gap-2 text-center">
          <p className="font-medium text-gray-700">No bases</p>
          <p className="text-sm text-gray-500">
            Get started by creating a new base
          </p>
          <div className="mt-4">
            <CreateBaseButton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {bases.map((base) => (
        <Link
          key={base.id}
          href={`/base/${base.id}`}
          className="group flex flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-all hover:shadow-md"
        >
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded bg-blue-100 text-blue-600">
            {base.icon ? (
              <span>{base.icon}</span>
            ) : (
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
                <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" />
                <path d="M3 9V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4" />
                <line x1="3" x2="21" y1="14" y2="14" />
              </svg>
            )}
          </div>
          <h3 className="font-medium text-gray-900 group-hover:text-blue-600">
            {base.name}
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            Created {base.createdAt.toLocaleDateString()}
          </p>
        </Link>
      ))}

      {/* Create New Base Card */}
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 p-6 text-center">
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
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
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
        </div>
        <h3 className="font-medium text-gray-700">Create a new base</h3>
        <p className="mt-1 text-xs text-gray-500">Start organizing your data</p>
        <div className="mt-4">
          <CreateBaseButton />
        </div>
      </div>
    </div>
  );
}
