import Link from "next/link";

export default function Loading() {
  return (
    <div className="flex h-screen flex-col">
      {/* Top Navigation Bar */}
      <header className="flex h-16 items-center justify-between border-b border-gray-200 px-2 md:px-4">
        <div className="flex items-center">
          <button className="mr-2 p-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-gray-600"
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
              className="h-8 w-auto"
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
            <div className="h-4 w-32 animate-pulse rounded bg-gray-200"></div>
            <span className="ml-auto hidden text-xs text-gray-400 md:inline">
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
          <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200"></div>
        </div>
      </header>

      {/* Main Content with Left Sidebar */}
      <div className="flex flex-1">
        {/* Left Sidebar */}
        <aside className="w-12 border-r border-gray-200 bg-white sm:w-16">
          <div className="flex flex-col items-center py-4">
            <div className="mb-4 h-8 w-8 animate-pulse rounded-md bg-gray-200 sm:h-10 sm:w-10"></div>
            <div className="mb-4 h-8 w-8 animate-pulse rounded-md bg-gray-200 sm:h-10 sm:w-10"></div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto bg-gray-50 p-4 sm:p-6 md:p-8">
          <div className="mb-4 flex flex-col justify-between gap-3 sm:mb-6 sm:flex-row sm:items-center sm:gap-0">
            <div className="h-6 w-32 animate-pulse rounded bg-gray-200 sm:h-7"></div>
            <div className="h-10 w-full animate-pulse rounded-md bg-blue-200 sm:w-36"></div>
          </div>

          {/* Loading skeleton for empty state */}
          <div className="rounded-lg border border-dashed border-gray-300 p-6 sm:p-8 md:p-12">
            <div className="flex flex-col items-center justify-center gap-2 text-center">
              <div className="h-6 w-24 animate-pulse rounded bg-gray-200"></div>
              <div className="mt-2 h-4 w-48 animate-pulse rounded bg-gray-200"></div>
              <div className="mt-4 h-10 w-36 animate-pulse rounded-md bg-blue-200"></div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
