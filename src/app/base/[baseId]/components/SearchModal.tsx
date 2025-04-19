import { useRef, useEffect } from "react";
import { X } from "lucide-react";

interface SearchModalProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onClose: () => void;
}

export function SearchModal({ searchQuery, setSearchQuery, onClose }: SearchModalProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);
  
  return (
    <div className="absolute top-full right-0 z-50 mt-1 w-96 rounded-md border border-gray-200 bg-gray-50 shadow-md">
      <div className="flex items-center justify-between p-3">
        <div className="flex-1">
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Find in view"
            className="w-full bg-transparent text-lg text-gray-700 outline-none"
          />
        </div>
        <div
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="cursor-pointer rounded-full p-1 text-gray-500 hover:bg-gray-200"
        >
          <X className="h-4 w-4" />
        </div>
      </div>
      <div className="bg-[#f2f2f2] p-3">
        <p className="text-sm text-gray-600">
          Use advanced search options in the{" "}
          <span className="inline-flex cursor-pointer items-center text-blue-600">
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
              className="mr-1 text-blue-600"
            >
              <rect
                width="18"
                height="18"
                x="3"
                y="3"
                rx="2"
                ry="2"
              ></rect>
              <path d="M9 3v18"></path>
              <path d="M3 9h18"></path>
            </svg>
            search extension
          </span>
        </p>
        <p className="mt-2 text-gray-600">.</p>
      </div>
    </div>
  );
} 