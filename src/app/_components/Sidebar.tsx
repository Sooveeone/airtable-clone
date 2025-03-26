"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-16 flex-col border-r border-gray-200 bg-gray-50">
      <div className="flex flex-col items-center py-4">
        <Link
          href="/"
          className={`mb-2 flex h-10 w-10 items-center justify-center rounded-md ${
            pathname === "/"
              ? "bg-blue-100 text-blue-600"
              : "text-gray-600 hover:bg-gray-200"
          }`}
          title="Home"
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
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </Link>

        <Link
          href="/workspaces"
          className={`mb-2 flex h-10 w-10 items-center justify-center rounded-md ${
            pathname.startsWith("/workspaces")
              ? "bg-blue-100 text-blue-600"
              : "text-gray-600 hover:bg-gray-200"
          }`}
          title="Workspaces"
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
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </Link>

        <Link
          href="/explore"
          className={`mb-2 flex h-10 w-10 items-center justify-center rounded-md ${
            pathname.startsWith("/explore")
              ? "bg-blue-100 text-blue-600"
              : "text-gray-600 hover:bg-gray-200"
          }`}
          title="Explore"
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
            <circle cx="12" cy="12" r="10" />
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
