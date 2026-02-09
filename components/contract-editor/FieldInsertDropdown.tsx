'use client'

import React, { useCallback } from 'react'
import { Editor } from '@tiptap/core'
import { Square, Calendar, Hash, PenTool, ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface FieldInsertDropdownProps {
  editor: Editor | null
}

const fieldTypes = [
  { 
    value: 'text', 
    label: 'Text Field', 
    icon: Square,
    description: 'Single-line text input'
  },
  { 
    value: 'date', 
    label: 'Date Field', 
    icon: Calendar,
    description: 'Date picker'
  },
  { 
    value: 'number', 
    label: 'Number Field', 
    icon: Hash,
    description: 'Numeric input'
  },
  { 
    value: 'signature', 
    label: 'Signature Field', 
    icon: PenTool,
    description: 'Signature placeholder'
  },
] as const

export default function FieldInsertDropdown({ editor }: FieldInsertDropdownProps) {
  const handleInsertField = useCallback(
    (fieldType: string) => {
      if (!editor) return
      
      const fieldId = `field-${Date.now()}`
      editor.chain().focus().insertField({
        id: fieldId,
        type: fieldType,
        label: '',
        value: '',
      }).run()
    },
    [editor]
  )

  if (!editor) {
    return null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="p-2 rounded hover:bg-gray-100 transition-colors flex items-center gap-1"
          title="Insert Fillable Field"
        >
          <Square className="w-4 h-4" />
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Insert Field</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {fieldTypes.map((fieldType) => {
          const Icon = fieldType.icon
          return (
            <DropdownMenuItem
              key={fieldType.value}
              onClick={() => handleInsertField(fieldType.value)}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Icon className="w-4 h-4" />
              <div className="flex flex-col">
                <span>{fieldType.label}</span>
                <span className="text-xs text-gray-500">{fieldType.description}</span>
              </div>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
