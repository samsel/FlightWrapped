import { useState, useCallback, useRef } from 'react'

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void
}

export default function FileUpload({ onFilesSelected }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)

      const files = Array.from(e.dataTransfer.files).filter(
        (f) =>
          f.name.toLowerCase().endsWith('.mbox') || f.name.toLowerCase().endsWith('.eml'),
      )

      if (files.length > 0) {
        onFilesSelected(files)
      }
    },
    [onFilesSelected],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? Array.from(e.target.files) : []
      if (files.length > 0) {
        onFilesSelected(files)
      }
    },
    [onFilesSelected],
  )

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
        isDragging
          ? 'border-blue-400 bg-blue-400/10'
          : 'border-gray-600 hover:border-gray-400'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".mbox,.eml"
        multiple
        onChange={handleFileInput}
        className="hidden"
      />
      <div className="text-4xl mb-3">📁</div>
      <p className="text-lg font-medium text-gray-200 mb-1">
        Drop .mbox or .eml files here
      </p>
      <p className="text-sm text-gray-400">or click to browse</p>
    </div>
  )
}
