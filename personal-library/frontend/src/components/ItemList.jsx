import React from 'react';
import './ItemList.css';

const TYPE_COLORS = {
  note: '#7c6af7',
  idea: '#f0a04b',
  thought: '#4caf88',
};

const TYPE_ICONS = { note: '📝', idea: '💡', thought: '🌿' };

function formatDate(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function ItemList({
  items, loading, searchQuery, setSearchQuery,
  selectedItem, setSelectedItem, onNew, onDelete, onPin, activeType
}) {
  return (
    <div className="item-list">
      <div className="list-header">
        <div className="search-bar">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search your library..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-search" onClick={() => setSearchQuery('')}>✕</button>
          )}
        </div>
        <button className="new-btn" onClick={onNew} title="New entry">
          +
        </button>
      </div>

      <div className="list-body">
        {loading ? (
          <div className="list-empty">
            <span className="loading-dots">Loading...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="list-empty">
            <p>{searchQuery ? 'No results found.' : 'Nothing here yet.'}</p>
            {!searchQuery && (
              <button className="btn-create" onClick={onNew}>Create your first entry</button>
            )}
          </div>
        ) : (
          items.map(item => (
            <div
              key={item.id}
              className={`list-item ${selectedItem?.id === item.id ? 'selected' : ''}`}
              onClick={() => setSelectedItem(item)}
            >
              <div className="item-header-row">
                <span
                  className="item-type-badge"
                  style={{ background: TYPE_COLORS[item.type] + '22', color: TYPE_COLORS[item.type] }}
                >
                  {TYPE_ICONS[item.type]} {item.type}
                </span>
                {item.pinned && <span className="pin-badge">📌</span>}
              </div>
              <div className="item-title">{item.title}</div>
              {item.content && (
                <div className="item-preview">
                  {item.content.replace(/\n/g, ' ').slice(0, 80)}{item.content.length > 80 ? '…' : ''}
                </div>
              )}
              <div className="item-footer">
                <span className="item-date">{formatDate(item.updated_at)}</span>
                {item.tags.length > 0 && (
                  <span className="item-tags">
                    {item.tags.slice(0, 2).map(t => (
                      <span key={t} className="tag-chip">#{t}</span>
                    ))}
                    {item.tags.length > 2 && <span className="tag-chip">+{item.tags.length - 2}</span>}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
