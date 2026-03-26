import React from 'react';
import './Sidebar.css';

const TYPE_ICONS = {
  all: '🗂',
  note: '📝',
  idea: '💡',
  thought: '🌿',
};

export default function Sidebar({ activeType, setActiveType, tags, activeTag, setActiveTag, view, setView, itemCounts }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo">
          <span className="logo-icon">📚</span>
          <span className="logo-text">My Library</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section">
          <span className="nav-section-label">Browse</span>
          {['all', 'note', 'idea', 'thought'].map(type => (
            <button
              key={type}
              className={`nav-item ${view === 'library' && activeType === type && !activeTag ? 'active' : ''}`}
              onClick={() => { setActiveType(type); setView('library'); }}
            >
              <span className="nav-icon">{TYPE_ICONS[type]}</span>
              <span className="nav-label">{type === 'all' ? 'All Entries' : `${type.charAt(0).toUpperCase() + type.slice(1)}s`}</span>
              {itemCounts[type] > 0 && (
                <span className="nav-count">{itemCounts[type]}</span>
              )}
            </button>
          ))}

          <button
            className={`nav-item ${view === 'files' ? 'active' : ''}`}
            onClick={() => setView('files')}
          >
            <span className="nav-icon">📁</span>
            <span className="nav-label">File Vault</span>
          </button>
        </div>

        {tags.length > 0 && (
          <div className="nav-section">
            <span className="nav-section-label">Tags</span>
            {tags.map(tag => (
              <button
                key={tag}
                className={`nav-item tag-item ${activeTag === tag ? 'active' : ''}`}
                onClick={() => { setActiveTag(tag); setView('library'); }}
              >
                <span className="nav-icon tag-hash">#</span>
                <span className="nav-label">{tag}</span>
              </button>
            ))}
          </div>
        )}
      </nav>
    </aside>
  );
}
