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
      <div>
        <h3 style={{
          fontSize: '1.25rem',
          fontWeight: 600,
          marginBottom: '0.5rem',
          color: 'var(--color-ink)'
        }}>upload your manuscript</h3>
        <p style={{
          color: 'var(--color-ink-light)',
          fontSize: '0.95rem',
          lineHeight: '1.5'
        }}>
          upload your .docx or .txt file to start analyzing your world-building rules
        </p>
      </div>

      <div
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: '2px dashed var(--color-border)',
          borderRadius: '2px',
          padding: '3rem',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s',
          background: 'var(--color-parchment)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-forest)'
          e.currentTarget.style.background = 'var(--color-paper)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-border)'
          e.currentTarget.style.background = 'var(--color-parchment)'
        }}
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
            <FileText style={{ color: 'var(--color-forest)' }} className="w-16 h-16" />
            <div>
              <p style={{ 
                fontWeight: 500,
                color: 'var(--color-ink)',
                marginBottom: '0.25rem'
              }}>{file.name}</p>
              <p style={{ 
                fontSize: '0.875rem',
                color: 'var(--color-ink-light)'
              }}>
                {(file.size / 1024).toFixed(2)} kb
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-4">
            <Upload style={{ color: 'var(--color-ink-light)' }} className="w-16 h-16" />
            <div>
              <p style={{ 
                fontWeight: 500,
                color: 'var(--color-ink)',
                marginBottom: '0.25rem'
              }}>click to upload</p>
              <p style={{ 
                fontSize: '0.875rem',
                color: 'var(--color-ink-light)'
              }}>supports .docx and .txt files</p>
            </div>
          </div>
        )}
      </div>

      {file && (
        <div className="flex justify-center">
          <button
            onClick={handleUpload}
            disabled={uploading || success}
            style={{
              padding: '0.75rem 2rem',
              background: uploading || success ? 'var(--color-border)' : 'var(--color-forest)',
              color: uploading || success ? 'var(--color-ink-light)' : 'var(--color-paper)',
              fontWeight: 500,
              borderRadius: '2px',
              border: 'none',
              cursor: uploading || success ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              fontSize: '0.95rem'
            }}
            className="flex items-center space-x-2"
            onMouseEnter={(e) => {
              if (!uploading && !success) e.currentTarget.style.background = 'var(--color-forest-light)'
            }}
            onMouseLeave={(e) => {
              if (!uploading && !success) e.currentTarget.style.background = 'var(--color-forest)'
            }}
          >
            {uploading ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                <span>processing...</span>
              </>
            ) : success ? (
              <>
                <CheckCircle className="w-5 h-5" />
                <span>upload complete</span>
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                <span>upload & process</span>
              </>
            )}
          </button>
        </div>
      )}

      {success && (
        <div style={{
          background: 'rgba(45, 80, 22, 0.1)',
          border: '1px solid var(--color-forest)',
          borderRadius: '2px',
          padding: '1rem'
        }}>
          <p style={{ 
            color: 'var(--color-forest)',
            textAlign: 'center',
            fontSize: '0.95rem'
          }}>
            your manuscript is being processed. check other tabs for results!
          </p>
        </div>
      )}
    </div>
  )
}
