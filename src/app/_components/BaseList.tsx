"use client"

import Link from "next/link"
import { Loader2, MoreVertical } from "lucide-react"
import { api } from "@/trpc/react"
import { useState, useRef, useEffect } from "react"

export function BaseList() {
  const utils = api.useUtils()
  const { data: bases, isLoading } = api.base.getAll.useQuery()
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const deleteMutation = api.base.delete.useMutation({
    onSuccess: () => {
      void utils.base.getAll.invalidate()
      showToast("Base deleted", "Your base has been successfully deleted.")
    },
  })

  const handleDelete = (id: string) => {
    deleteMutation.mutate({ baseId: id })
    setOpenMenuId(null)
  }

  // Custom toast implementation
  const [toast, setToast] = useState<{ visible: boolean; title: string; message: string }>({
    visible: false,
    title: "",
    message: "",
  })

  const showToast = (title: string, message: string) => {
    setToast({ visible: true, title, message })
    setTimeout(() => {
      setToast({ visible: false, title: "", message: "" })
    }, 3000)
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    )
  }

  if (!bases || bases.length === 0) {
    return (
      <div className="py-10 text-center">
        <h3 className="text-lg font-medium">No bases found</h3>
        <p className="mt-2 text-gray-500">Create your first base to get started</p>
      </div>
    )
  }

  return (
    <>
      {/* Custom toast notification */}
      {toast.visible && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-white p-4 shadow-lg">
          <h4 className="font-medium">{toast.title}</h4>
          <p className="text-sm text-gray-500">{toast.message}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 max-w-6xl mx-auto">
        {bases.map((base) => (
          <Link
            href={`/base/${base.id}`}
            key={base.id}
            className="group relative flex flex-col rounded-lg border border-gray-200 bg-white shadow-sm transition hover:border-gray-400"
            onMouseEnter={() => setHoveredId(base.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            {hoveredId === base.id && (
              <div className="absolute right-3 top-3 z-10" ref={menuRef}>
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    setOpenMenuId(openMenuId === base.id ? null : base.id)
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
                >
                  <MoreVertical size={16} />
                </button>

                {openMenuId === base.id && (
                  <div className="absolute right-0 mt-1 w-36 rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5">
                    <button
                      className="block w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-gray-100"
                      onClick={(e) => {
                        e.preventDefault()
                        handleDelete(base.id)
                      }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )}
            <div className="flex items-center gap-3 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded bg-gray-600 text-white">
                {base.name.substring(0, 2) || "Un"}
              </div>
              <div>
                <h3 className="font-medium">{base.name || "Untitled Base"}</h3>
                <p className="text-sm text-gray-500">Base</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  )
}

export default BaseList
