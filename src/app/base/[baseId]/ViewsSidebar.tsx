"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Search,
  LayoutGrid,
  Calendar,
  GridIcon,
  GalleryVerticalIcon as GalleryIcon,
  KanbanIcon,
  Clock,
  List,
  GanttChart,
  FileText,
  Loader2,
} from "lucide-react";
import { api } from "@/trpc/react";

interface ViewsSidebarProps {
  isOpen: boolean;
  tableId: string | null;
  activeViewId: string | null;
  onViewSelect: (viewId: string) => void;
}

export function ViewsSidebar({
  isOpen,
  tableId,
  activeViewId,
  onViewSelect,
}: ViewsSidebarProps) {
  const [isCreateExpanded, setIsCreateExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const utils = api.useUtils();

  const { data: views, isLoading: isLoadingViews } =
    api.view.getViewsForTable.useQuery(
      { tableId: tableId ?? "" },
      { enabled: !!tableId }
    );

  const createViewMutation = api.view.createView.useMutation({
    onSuccess: (newView) => {
      // Invalidate the views query to refresh the list
      void utils.view.getViewsForTable.invalidate({ tableId: tableId ?? "" });
      onViewSelect(newView.id);
    },
  });

  // Define view types with their specific colors
  const viewTypes = [
    {
      name: "Grid",
      icon: <GridIcon className="h-4 w-4 text-blue-600" />,
      type: "grid",
    },
    {
      name: "Calendar",
      icon: <Calendar className="h-4 w-4 text-orange-500" />,
      type: "calendar",
      team: true,
    },
    {
      name: "Gallery",
      icon: <GalleryIcon className="h-4 w-4 text-purple-600" />,
      type: "gallery",
      team: true,
    },
    {
      name: "Kanban",
      icon: <KanbanIcon className="h-4 w-4 text-green-600" />,
      type: "kanban",
      team: true,
    },
    {
      name: "Timeline",
      icon: <Clock className="h-4 w-4 text-red-500" />,
      type: "timeline",
      team: true,
    },
    {
      name: "List",
      icon: <List className="h-4 w-4 text-blue-600" />,
      type: "list",
      team: true,
    },
    {
      name: "Gantt",
      icon: <GanttChart className="h-4 w-4 text-teal-500" />,
      type: "gantt",
      team: true,
    },
    {
      name: "Form",
      icon: <FileText className="h-4 w-4 text-pink-500" />,
      type: "form",
      team: true,
    },
  ];

  const handleCreateView = async (type: string) => {
    if (!tableId) return;

    // Get the count of existing views of this type
    const existingViewsOfType = views?.filter((v) => v.type === type) ?? [];
    const viewNumber = existingViewsOfType.length + 1;

    await createViewMutation.mutateAsync({
      tableId,
      name: `${
        type.charAt(0).toUpperCase() + type.slice(1)
      } view ${viewNumber}`,
      type,
    });
  };

  const filteredViews = views?.filter((view) =>
    view.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      className={`absolute top-0 bottom-0 left-0 z-20 w-64 border-r border-gray-200 bg-white transition-all duration-300 ease-in-out ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex h-full flex-col pl-2">
        {/* Search input */}
        <div className="border-b border-gray-200 p-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Find a view"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Views list */}
        <div className="flex-1 overflow-y-auto p-1">
          {isLoadingViews ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : (
            filteredViews?.map((view) => (
              <div
                key={view.id}
                className={`mb-2 cursor-pointer rounded-md p-2 ${
                  activeViewId === view.id ? "bg-blue-50" : "hover:bg-gray-50"
                }`}
                onClick={() => onViewSelect(view.id)}
              >
                <div className="flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-gray-900">
                    {view.name}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Create section */}
        <div className="border-t border-gray-200">
          <div
            className="flex cursor-pointer items-center justify-between p-2 hover:bg-gray-50"
            onClick={() => setIsCreateExpanded(!isCreateExpanded)}
          >
            <span className="text-base font-medium text-gray-800">
              Create...
            </span>
            {isCreateExpanded ? (
              <ChevronUp className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            )}
          </div>

          {/* Expanded view options */}
          {isCreateExpanded && (
            <div>
              {viewTypes.map((viewType) => (
                <div
                  key={viewType.name}
                  className="flex cursor-pointer items-center justify-between px-2 py-2 hover:bg-gray-50"
                  onClick={() =>
                    !viewType.team && handleCreateView(viewType.type)
                  }
                >
                  <div className="flex items-center gap-2">
                    {viewType.icon}
                    <span className="text-sm text-gray-700">
                      {viewType.name}
                    </span>
                    {viewType.team && (
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">
                        Team
                      </span>
                    )}
                  </div>
                  <Plus className="h-4 w-4 text-gray-400" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
