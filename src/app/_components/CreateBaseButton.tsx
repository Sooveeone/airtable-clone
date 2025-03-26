"use client";

import { useState } from "react";

export default function CreateBaseButton() {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      className={`flex items-center gap-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition ${isHovered ? "bg-blue-700" : ""}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => {
        // TODO: Implement base creation functionality
        console.log("Creating new base...");
      }}
    >
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
  );
}
