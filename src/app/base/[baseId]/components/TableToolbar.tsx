import { type RefObject } from "react";
import {
  Menu,
  LayoutGrid,
  SquareStack,
  ChevronDown,
  Eye,
  Filter,
  ArrowUpDown,
  FolderKanban,
  Palette,
  AlignJustify,
  Share2,
  Search,
} from "lucide-react";
import { FilterPopover } from "../FilterPopover";
import { SortPopover } from "../SortPopover";
import { HideFieldsPopover } from "../HideFieldsPopover";
import type { FilterType, SortType } from "../types";
import type { Column } from "@/app/_types/base";
import { SearchModal } from "./SearchModal";

interface TableToolbarProps {
  isViewsSidebarOpen: boolean;
  setIsViewsSidebarOpen: (isOpen: boolean) => void;
  hiddenColumns: Set<string>;
  isHideFieldsOpen: boolean;
  setIsHideFieldsOpen: (isOpen: boolean) => void;
  hideFieldsRef: RefObject<HTMLDivElement>;
  onToggleColumn: (columnName: string) => void;
  isFilterModalOpen: boolean;
  setIsFilterModalOpen: (isOpen: boolean) => void;
  filterPopoverRef: RefObject<HTMLDivElement>;
  activeFilter?: FilterType;
  setActiveFilter: (filter?: FilterType) => void;
  isSortModalOpen: boolean;
  setIsSortModalOpen: (isOpen: boolean) => void;
  sortPopoverRef: RefObject<HTMLDivElement>;
  activeSort?: SortType;
  setActiveSort: (sort?: SortType) => void;
  isSearchModalOpen: boolean;
  setIsSearchModalOpen: (isOpen: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchModalRef: RefObject<HTMLDivElement>;
  tableData?: { columns?: Column[] };
}

export function TableToolbar({
  isViewsSidebarOpen,
  setIsViewsSidebarOpen,
  hiddenColumns,
  isHideFieldsOpen,
  setIsHideFieldsOpen,
  hideFieldsRef,
  onToggleColumn,
  isFilterModalOpen,
  setIsFilterModalOpen,
  filterPopoverRef,
  activeFilter,
  setActiveFilter,
  isSortModalOpen,
  setIsSortModalOpen,
  sortPopoverRef,
  activeSort,
  setActiveSort,
  isSearchModalOpen,
  setIsSearchModalOpen,
  searchQuery,
  setSearchQuery,
  searchModalRef,
  tableData,
}: TableToolbarProps) {
  return (
    <div className="flex items-center border-b border-gray-300 bg-white px-4 py-2 text-sm shadow-sm">
      <div className="flex items-center gap-1">
        <button
          className="flex items-center gap-1.5 rounded px-2 py-1 hover:bg-gray-100 cursor-pointer"
          onClick={() => setIsViewsSidebarOpen(!isViewsSidebarOpen)}
        >
          <Menu className="h-4 w-4" />
          <span>Views</span>
        </button>
        <div className="mx-1 h-4 w-px bg-gray-300" />
        <button className="flex items-center gap-1.5 rounded px-2 py-1 hover:bg-gray-100 cursor-pointer">
          <LayoutGrid className="h-4 w-4" />
          <span>Grid view</span>
          <SquareStack className="ml-1 h-3.5 w-3.5" />
          <ChevronDown className="h-3 w-3" />
        </button>
        <div className="relative">
          <button
            className="flex items-center gap-1.5 rounded px-2 py-1 hover:bg-gray-100 cursor-pointer"
            onClick={() => setIsHideFieldsOpen(!isHideFieldsOpen)}
          >
            <Eye className="h-4 w-4" />
            <span>
              Hide fields
              {hiddenColumns.size > 0 && (
                <span className="ml-1 text-xs text-gray-500">
                  ({hiddenColumns.size})
                </span>
              )}
            </span>
          </button>
          {isHideFieldsOpen && tableData?.columns && (
            <div ref={hideFieldsRef}>
              <HideFieldsPopover
                columns={tableData.columns}
                hiddenColumns={hiddenColumns}
                onToggleColumn={onToggleColumn}
                onClose={() => setIsHideFieldsOpen(false)}
              />
            </div>
          )}
        </div>
        <div className="relative">
          <button
            className={`flex items-center gap-1.5 rounded px-2 py-1 cursor-pointer ${
              activeFilter
                ? "bg-green-100 hover:bg-green-200"
                : "hover:bg-gray-100"
            }`}
            onClick={() => setIsFilterModalOpen(!isFilterModalOpen)}
          >
            <Filter className="h-4 w-4" />
            <span>
              {activeFilter
                ? `Filtered by ${activeFilter.columnName}`
                : "Filter"}
            </span>
          </button>
          {isFilterModalOpen && tableData?.columns && (
            <div ref={filterPopoverRef}>
              <FilterPopover
                columns={tableData.columns}
                onApplyFilter={(filter) => {
                  setActiveFilter(filter);
                  setIsFilterModalOpen(false);
                }}
                onClose={() => setIsFilterModalOpen(false)}
                activeFilter={activeFilter}
                onClearFilter={() => {
                  setActiveFilter(undefined);
                  setIsFilterModalOpen(false);
                }}
              />
            </div>
          )}
        </div>
        <div className="relative">
          <button
            className={`flex items-center gap-1.5 rounded px-2 py-1 cursor-pointer ${
              activeSort
                ? "bg-[#fff2ea] hover:bg-orange-100"
                : "hover:bg-gray-100"
            }`}
            onClick={() => setIsSortModalOpen(!isSortModalOpen)}
          >
            <ArrowUpDown className="h-4 w-4" />
            <span>
              {activeSort ? `Sorted by ${activeSort.columnName}` : "Sort"}
            </span>
          </button>
          {isSortModalOpen && tableData?.columns && (
            <div ref={sortPopoverRef}>
              <SortPopover
                columns={tableData.columns}
                onApplySort={(sort) => {
                  setActiveSort(sort);
                  setIsSortModalOpen(false);
                }}
                onClose={() => setIsSortModalOpen(false)}
                activeSort={activeSort}
                onClearSort={() => {
                  setActiveSort(undefined);
                  setIsSortModalOpen(false);
                }}
              />
            </div>
          )}
        </div>
        <button className="flex items-center gap-1.5 rounded px-2 py-1 hover:bg-gray-100 cursor-pointer">
          <FolderKanban className="h-4 w-4" />
          <span>Group</span>
        </button>
        <button className="flex items-center gap-1.5 rounded px-2 py-1 hover:bg-gray-100 cursor-pointer">
          <Palette className="h-4 w-4" />
          <span>Color</span>
        </button>
        <button className="flex items-center gap-1.5 rounded px-2 py-1 hover:bg-gray-100 cursor-pointer">
          <AlignJustify className="h-4 w-4" />
        </button>
        <button className="flex items-center gap-1.5 rounded px-2 py-1 hover:bg-gray-100 cursor-pointer">
          <Share2 className="h-4 w-4" />
          <span>Share and sync</span>
        </button>
      </div>
      <div className="relative ml-auto">
        <button
          className="flex items-center gap-1.5 rounded px-2 py-1 hover:bg-gray-100 cursor-pointer"
          onClick={() => setIsSearchModalOpen(!isSearchModalOpen)}
        >
          <Search className="h-4 w-4" />
        </button>
        {isSearchModalOpen && (
          <div ref={searchModalRef}>
            <SearchModal
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onClose={() => {
                setIsSearchModalOpen(false);
                setSearchQuery("");
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
} 