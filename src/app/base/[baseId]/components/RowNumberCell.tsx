import { useState, useRef, useEffect } from "react";
import { MoreHorizontal } from "lucide-react";
import { createPortal } from "react-dom";

interface RowNumberCellProps {
  index: number;
  onDeleteRow: () => void;
}

export function RowNumberCell({ index, onDeleteRow }: RowNumberCellProps) {
  const [open, setOpen] = useState(false);
  const [popupPos, setPopupPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPopupPos({ top: rect.top, left: rect.left });
    }
    setOpen(!open);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [open]);

  return (
    <div className="relative flex h-full w-full items-center px-2">
      {/* Number centered */}
      <div className="flex-1 text-center text-gray-500">{index + 1}</div>

      {/* Triple dot menu aligned to the right */}
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="text-gray-400 hover:text-gray-600"
      >
        <MoreHorizontal size={16} />
      </button>

      {open &&
        popupPos &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-50 w-28 rounded border bg-white shadow-md"
            style={{
              left: popupPos.left,
              top: popupPos.top - 45,
            }}
          >
            <button
              className="block w-full cursor-pointer px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
              onClick={() => {
                onDeleteRow();
                setOpen(false);
              }}
            >
              Delete row
            </button>
          </div>,
          document.body
        )}
    </div>
  );
} 