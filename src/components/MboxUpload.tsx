import { useState, useRef, useCallback } from 'react'

interface MboxUploadProps {
  onFileUpload: (files: File[]) => void
  onError: (message: string) => void
}

export default function MboxUpload({ onFileUpload, onError }: MboxUploadProps) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback((fileList: FileList) => {
    const valid: File[] = []
    for (const file of Array.from(fileList)) {
      if (!file.name.endsWith('.mbox')) {
        onError(`Skipped "${file.name}" - only .mbox files are supported`)
        continue
      }
      valid.push(file)
    }
    if (valid.length > 0) onFileUpload(valid)
  }, [onFileUpload, onError])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files)
  }, [handleFiles])

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`flex items-center gap-3 px-7 py-4 bg-white text-gray-800 font-medium text-base hover:bg-gray-50 transition-all duration-200 shadow-lg shadow-black/20 border cursor-pointer active:scale-[0.98] ${
        dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
      }`}
    >
      <svg className="w-5 h-5 flex-shrink-0 text-gray-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13" />
      </svg>
      <span>
        {dragging ? 'Drop .mbox files' : 'Upload .mbox file(s)'}
      </span>
      <input
        ref={inputRef}
        type="file"
        accept=".mbox"
        multiple
        onChange={handleChange}
        className="hidden"
      />
    </div>
  )
}
