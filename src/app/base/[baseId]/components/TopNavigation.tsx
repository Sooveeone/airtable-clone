import { ChevronDown, History, CircleHelp, Users, Bell } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";

// Client-side only UserButton wrapper
const ClientUserButton = dynamic(
  () => import("@clerk/nextjs").then((mod) => mod.UserButton),
  { ssr: false }
);

interface TopNavigationProps {
  baseName: string;
  isLoading: boolean;
  onSaveAllPendingChanges: () => Promise<boolean>;
}

export function TopNavigation({
  baseName,
  isLoading,
  onSaveAllPendingChanges,
}: TopNavigationProps) {
  return (
    <div
      style={{ backgroundColor: "#535965" }}
      className="flex items-center justify-between px-4 py-3 text-sm shadow-sm"
    >
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded">
            <Link
              href="/"
              onClick={async (e) => {
                e.preventDefault();
                const saved = await onSaveAllPendingChanges();
                if (saved) {
                  window.location.href = "/";
                } else {
                  alert("Failed to save some changes. Please try again.");
                }
              }}
            >
              <Image
                src="/airtable-svgrepo-com.svg"
                alt="Airtable Logo"
                width={20}
                height={20}
                className="object-contain"
              />
            </Link>
          </div>
          <h1 className="flex items-center gap-1 text-lg font-bold text-gray-100 hover:text-white">
            {isLoading ? "Loading..." : baseName ?? "Untitled Base 2"}
            <ChevronDown size={16} className="text-gray-100" />
          </h1>
        </div>
        <div className="flex gap-6">
          <button className="cursor-pointer font-light text-gray-100 hover:text-white">
            Data
          </button>
          <button className="cursor-pointer font-light text-gray-100 hover:text-white">
            Automations
          </button>
          <button className="cursor-pointer font-light text-gray-100 hover:text-white">
            Interfaces
          </button>
          <div className="mx-2 h-5 w-px bg-gray-500"></div>
          <button className="cursor-pointer font-light text-gray-100 hover:text-white">
            Forms
          </button>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button className="cursor-pointer rounded-full p-1">
          <History className="w-5 stroke-1 text-gray-100" />
        </button>
        <button className="flex cursor-pointer items-center gap-1 rounded-full p-1">
          <CircleHelp className="mr-1 h-5 stroke-1 text-gray-100" />
          <span className="cursor-pointer font-light text-gray-100 hover:text-white">
            Help
          </span>
        </button>
        <button className="flex cursor-pointer items-center gap-1 rounded-full bg-white px-4 py-1.5 font-light shadow-sm hover:bg-gray-50">
          <Users className="mr-1 h-4 w-4" />
          <span>Share</span>
        </button>
        <button className="cursor-pointer rounded-full border border-white bg-white p-1.5">
          <Bell className="h-4 w-4 text-black" />
        </button>
        <div className="flex h-8 w-8 items-center justify-center">
          <ClientUserButton />
        </div>
      </div>
    </div>
  );
} 