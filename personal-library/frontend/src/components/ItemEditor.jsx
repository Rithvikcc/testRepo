import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './ItemEditor.css';

const TYPE_OPTIONS = [
  { value: 'note', label: '📝 Note', color: '#7c6af7' },
  { value: 'idea', label: '💡 Idea', color: '#f0a04b' },
  { value: 'thought', label: '🌿 Thought', color: '#4caf88' },
];

export default function ItemEditor({ item, onSave, onDelete, onCancel, API }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState('note');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [pinned, setPinned] = useState(false);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef();
  const titleRef = useRef();

  useEffect(() => {
    if (item) {
      setTitle(item.title || '');
      setContent(item.content || '');
      setType(item.type || 'note');
      setTags(item.tags || []);
      setPinned(item.pinned || false);
      fetchFiles(item.id);
    } else {
      setTitle('');
      setContent('');
      setType('note');
      setTags([]);
      setPinned(false);
      setFiles([]);
      setTimeout(() => titleRef.current?.focus(), 50);
    }
    setSaved(false);
  }, [item?.id]);

  const fetchFiles = async (id) => {
    try {
      const res = await axios.get(`${API}/items/${id}`);
      setFiles(res.data.files || []);
    } catch {}
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    await onSave({ id: item?.id, title: title.trim(), content, type, tags, pinned });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
  };

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase().replace(/\s+/g, '-');
    if (tag && !tags.includes(tag)) {
      setTags(prev => [...prev, tag]);
    }
    setTagInput('');
  };

  const removeTag = (tag) => setTags(prev => prev.filter(t => t !== tag));

  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !item?.id) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('item_id', item.id);
      await axios.post(`${API}/files/upload`, formData);
      await fetchFiles(item.id);
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
      fileInputRef.current.value = '';
    }
  };

  const handleDeleteFile = async (fileId) => {
    try {
      await axios.delete(`${API}/files/${fileId}`);
      setFiles(prev => prev.filter(f => f.id !== fileId));
    } catch (err) {
      console.error('Delete file failed:', err);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const typeColor = TYPE_OPTIONS.find(t => t.value === type)?.color || '#7c6af7';

  return (
    <div className="editor" onKeyDown={handleKeyDown}>
      <div className="editor-toolbar">
        <div className="type-selector">
          {TYPE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`type-btn ${type === opt.value ? 'active' : ''}`}
              style={type === opt.value ? { borderColor: opt.color, color: opt.color } : {}}
              onClick={() => setType(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="toolbar-actions">
          <button
            className={`pin-btn ${pinned ? 'pinned' : ''}`}
            onClick={() => setPinned(!pinned)}
            title={pinned ? 'Unpin' : 'Pin'}
          >
            📌
          </button>
          {item && (
            <button
              className="delete-btn"
              onClick={() => { if (window.confirm('Delete this entry?')) onDelete(item.id); }}
              title="Delete"
            >
              🗑
            </button>
          )}
          <button className="cancel-btn" onClick={onCancel}>✕</button>
        </div>
      </div>

      <div className="editor-body">
        <input
          ref={titleRef}
          className="title-input"
          placeholder="Title..."
          value={title}
          onChange={e => setTitle(e.target.value)}
          style={{ borderBottomColor: typeColor + '44' }}
        />

        <textarea
          className="content-input"
          placeholder="Start writing your thoughts, ideas, notes..."
          value={content}
          onChange={e => setContent(e.target.value)}
        />

        <div className="tags-section">
          <div className="tags-list">
            {tags.map(tag => (
              <span key={tag} className="editor-tag">
                #{tag}
                <button onClick={() => removeTag(tag)}>✕</button>
              </span>
            ))}
          </div>
          <div className="tag-input-row">
            <input
              type="text"
              placeholder="Add tag... (press Enter)"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              onBlur={addTag}
              className="tag-input"
            />
          </div>
        </div>

        {item && (
          <div className="files-section">
            <div className="files-header">
              <span>Attachments ({files.length})</span>
              <button
                className="attach-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? 'Uploading...' : '+ Attach file'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
            </div>
            {files.length > 0 && (
              <div className="files-list">
                {files.map(file => (
                  <div key={file.id} className="file-item">
                    <span className="file-icon">{getFileIcon(file.mime_type)}</span>
                    <div className="file-info">
                      <a
                        href={`${API}/files/download/${file.id}`}
                        className="file-name"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {file.original_name}
                      </a>
                      <span className="file-size">{formatFileSize(file.size)}</span>
                    </div>
                    <button
                      className="file-delete"
                      onClick={() => handleDeleteFile(file.id)}
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!item && (
          <div className="new-note-hint">
            💡 Save first to attach files
          </div>
        )}
      </div>

      <div className="editor-footer">
        <span className="save-hint">Ctrl+S to save</span>
        <div className="footer-btns">
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button
            className={`btn-save ${saved ? 'saved' : ''}`}
            onClick={handleSave}
            disabled={!title.trim()}
          >
            {saved ? '✓ Saved' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function getFileIcon(mime) {
  if (!mime) return '📄';
  if (mime.startsWith('image/')) return '🖼';
  if (mime.startsWith('video/')) return '🎬';
  if (mime.startsWith('audio/')) return '🎵';
  if (mime.includes('pdf')) return '📕';
  if (mime.includes('zip') || mime.includes('tar') || mime.includes('gzip')) return '📦';
  if (mime.includes('word') || mime.includes('document')) return '📄';
  if (mime.includes('sheet') || mime.includes('excel')) return '📊';
  if (mime.includes('text')) return '📃';
  return '📎';
}
