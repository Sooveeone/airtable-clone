import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { getBases } from "./_actions/base";
import type { Base } from "./_types/base";

export default async function HomePage() {
  const { userId } = await auth();

  // Redirect if user is NOT authenticated
  if (!userId) {
    redirect("/sign-in");
  }

  // Fetch bases for the current user
  let bases: Base[] = [];
  try {
    bases = (await getBases()) as Base[];
  } catch (error) {
    console.error("Error fetching bases:", error);
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Top Navigation Bar */}
      <header className="flex h-14 items-center justify-between border-b border-gray-200 px-2 md:px-4">
        <div className="flex items-center">
          <button className="mr-1 pr-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-gray-400"
            >
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <Link href="/" className="flex items-center">
            <img
              src="/airtable-vector-logo-2022.svg"
              alt="Airtable"
              className="h-28 w-auto sm:h-28"
            />
          </Link>
        </div>

        <div className="relative mx-2 hidden max-w-xl flex-grow sm:mx-4 sm:flex md:mx-8">
          <div className="flex w-full items-center rounded-full border border-gray-300 bg-white px-3 py-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-2 text-gray-400"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search..."
              className="flex-grow bg-transparent text-sm focus:outline-none"
            />
            <span className="hidden text-xs text-gray-400 md:inline">
              ctrl K
            </span>
          </div>
        </div>

        {/* Mobile search button */}
        <button className="rounded-full p-2 text-gray-600 hover:bg-gray-100 sm:hidden">
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
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>

        <div className="flex items-center gap-2 md:gap-4">
          <button className="hidden rounded-full p-2 text-gray-600 hover:bg-gray-100 sm:block">
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
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <path d="M12 17h.01" />
            </svg>
          </button>
          <button className="hidden rounded-full p-2 text-gray-600 hover:bg-gray-100 sm:block">
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
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </button>
          <UserButton />
        </div>
      </header>

      {/* Main Content with Left Sidebar */}
      <div className="flex flex-1">
        {/* Left Sidebar */}
        <aside className="w-12 border-r border-gray-200 bg-white sm:w-12">
          <div className="flex flex-col items-center py-4">
            <Link
              href="/"
              className="mb-4 flex h-8 w-8 items-center justify-center rounded-md bg-gray-100 text-black hover:bg-gray-200 sm:h-10 sm:w-10"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
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
              className="mb-4 flex h-8 w-8 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 sm:h-10 sm:w-10"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </Link>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto bg-gray-50 p-4 sm:p-6 md:p-8">
          <div className="mb-4 flex flex-col justify-between gap-3 sm:mb-6 sm:flex-row sm:items-center sm:gap-0">
            <h1 className="text-lg font-semibold sm:text-xl">Home</h1>
            <button className="flex w-full items-center justify-center gap-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 sm:w-auto sm:justify-start sm:px-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
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
              <span>Create new base</span>
            </button>
          </div>

          {/* Empty State */}
          <div className="rounded-lg border border-dashed border-gray-300 p-6 sm:p-8 md:p-12">
            <div className="flex flex-col items-center justify-center gap-2 text-center">
              <p className="font-medium text-gray-700">No bases</p>
              <p className="text-sm text-gray-500">
                Get started by creating a new base
              </p>
              <button className="mt-4 flex items-center gap-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
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
                Create new base
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
