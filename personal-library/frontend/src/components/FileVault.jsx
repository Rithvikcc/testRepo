import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './FileVault.css';

function getFileIcon(mime) {
  if (!mime) return '📄';
  if (mime.startsWith('image/')) return '🖼';
  if (mime.startsWith('video/')) return '🎬';
  if (mime.startsWith('audio/')) return '🎵';
  if (mime.includes('pdf')) return '📕';
  if (mime.includes('zip') || mime.includes('tar')) return '📦';
  if (mime.includes('word') || mime.includes('document')) return '📄';
  if (mime.includes('sheet') || mime.includes('excel')) return '📊';
  if (mime.includes('text')) return '📃';
  return '📎';
}

function formatFileSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function FileVault({ API }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef();

  const fetchFiles = async () => {
    try {
      const res = await axios.get(`${API}/files`);
      setFiles(res.data);
    } catch (err) {
      console.error('Failed to fetch files:', err);
    }
  };

  useEffect(() => { fetchFiles(); }, []);

  const uploadFile = async (file) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await axios.post(`${API}/files/upload`, formData);
      await fetchFiles();
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleFileInput = async (e) => {
    const file = e.target.files[0];
    if (file) await uploadFile(file);
    fileInputRef.current.value = '';
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) await uploadFile(file);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this file?')) return;
    try {
      await axios.delete(`${API}/files/${id}`);
      setFiles(prev => prev.filter(f => f.id !== id));
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  return (
    <div className="file-vault">
      <div className="vault-header">
        <h2>📁 File Vault</h2>
        <p>Store and manage all your files in one place.</p>
      </div>

      <div
        className={`drop-zone ${dragOver ? 'drag-over' : ''} ${uploading ? 'uploading' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={handleFileInput}
        />
        <div className="drop-icon">{uploading ? '⏳' : '☁️'}</div>
        <div className="drop-text">
          {uploading ? 'Uploading...' : dragOver ? 'Drop it!' : 'Drop a file or click to upload'}
        </div>
        <div className="drop-subtext">Up to 50MB per file</div>
      </div>

      {files.length === 0 ? (
        <div className="vault-empty">
          <p>No files yet. Upload something!</p>
        </div>
      ) : (
        <div className="vault-grid">
          {files.map(file => (
            <div key={file.id} className="vault-file">
              <div className="vault-file-icon">{getFileIcon(file.mime_type)}</div>
              <div className="vault-file-info">
                <a
                  className="vault-file-name"
                  href={`${API}/files/download/${file.id}`}
                  target="_blank"
                  rel="noreferrer"
                  title={file.original_name}
                >
                  {file.original_name}
                </a>
                <div className="vault-file-meta">
                  <span>{formatFileSize(file.size)}</span>
                  <span className="meta-dot">·</span>
                  <span>{formatDate(file.created_at)}</span>
                </div>
              </div>
              <button
                className="vault-delete-btn"
                onClick={() => handleDelete(file.id)}
                title="Delete"
              >
                🗑
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
