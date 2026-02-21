import { useState, useRef } from 'react'
import { Upload, FileText, CheckCircle, Loader } from 'lucide-react'
import { api } from '../api/client'

interface FileUploadProps {
  worldId: string
  onUploadComplete: () => void
}

export default function FileUpload({ worldId, onUploadComplete }: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setSuccess(false)
    }
  }

  const handleUpload = async () => {
    if (!file) return

    setUploading(true)
    try {
      await api.uploadManuscript(worldId, file)
      setSuccess(true)
      onUploadComplete()
    } catch (error) {
      console.error('Upload error:', error)
      alert('Failed to upload file. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-bold mb-2">Upload Your Manuscript</h3>
        <p className="text-slate-400">
          Upload your .docx or .txt file to start analyzing your world-building rules
        </p>
      </div>

      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-slate-700 hover:border-purple-500 rounded-lg p-12 text-center cursor-pointer transition-colors"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".docx,.txt"
          onChange={handleFileSelect}
          className="hidden"
        />

        {file ? (
          <div className="flex flex-col items-center space-y-4">
            <FileText className="w-16 h-16 text-purple-400" />
            <div>
              <p className="font-medium text-white">{file.name}</p>
              <p className="text-sm text-slate-400">
                {(file.size / 1024).toFixed(2)} KB
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-4">
            <Upload className="w-16 h-16 text-slate-600" />
            <div>
              <p className="font-medium text-slate-400">Click to upload</p>
              <p className="text-sm text-slate-500">Supports .docx and .txt files</p>
            </div>
          </div>
        )}
      </div>

      {file && (
        <div className="flex justify-center">
          <button
            onClick={handleUpload}
            disabled={uploading || success}
            className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all flex items-center space-x-2"
          >
            {uploading ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                <span>Processing...</span>
              </>
            ) : success ? (
              <>
                <CheckCircle className="w-5 h-5" />
                <span>Upload Complete</span>
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                <span>Upload & Process</span>
              </>
            )}
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
          <p className="text-green-400 text-center">
            Your manuscript is being processed. Check other tabs for results!
          </p>
        </div>
      )}
    </div>
  )
}
