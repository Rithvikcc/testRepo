import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Sidebar from './components/Sidebar';
import ItemList from './components/ItemList';
import ItemEditor from './components/ItemEditor';
import FileVault from './components/FileVault';
import './styles/App.css';

const API = '/api';

export default function App() {
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [activeType, setActiveType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState('');
  const [tags, setTags] = useState([]);
  const [view, setView] = useState('library'); // 'library' | 'files'
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    try {
      const params = {};
      if (searchQuery) params.search = searchQuery;
      if (activeType !== 'all') params.type = activeType;
      if (activeTag) params.tag = activeTag;
      const res = await axios.get(`${API}/items`, { params });
      setItems(res.data);
    } catch (err) {
      console.error('Failed to fetch items:', err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, activeType, activeTag]);

  const fetchTags = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/items/meta/tags`);
      setTags(res.data);
    } catch (err) {
      console.error('Failed to fetch tags:', err);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags, items]);

  const handleSave = async (data) => {
    try {
      if (data.id) {
        const res = await axios.put(`${API}/items/${data.id}`, data);
        setItems(prev => prev.map(i => i.id === data.id ? res.data : i));
        setSelectedItem(res.data);
      } else {
        const res = await axios.post(`${API}/items`, data);
        setItems(prev => [res.data, ...prev]);
        setSelectedItem(res.data);
        setIsCreating(false);
      }
    } catch (err) {
      console.error('Failed to save item:', err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API}/items/${id}`);
      setItems(prev => prev.filter(i => i.id !== id));
      if (selectedItem?.id === id) {
        setSelectedItem(null);
        setIsCreating(false);
      }
    } catch (err) {
      console.error('Failed to delete item:', err);
    }
  };

  const handlePin = async (item) => {
    await handleSave({ ...item, pinned: !item.pinned });
  };

  const handleNewItem = (type = 'note') => {
    setSelectedItem(null);
    setIsCreating(true);
    setView('library');
  };

  return (
    <div className="app">
      <Sidebar
        activeType={activeType}
        setActiveType={(t) => { setActiveType(t); setActiveTag(''); setSelectedItem(null); setIsCreating(false); }}
        tags={tags}
        activeTag={activeTag}
        setActiveTag={(t) => { setActiveTag(t); setActiveType('all'); setSelectedItem(null); setIsCreating(false); }}
        view={view}
        setView={(v) => { setView(v); setSelectedItem(null); setIsCreating(false); }}
        itemCounts={{
          all: items.length,
          note: items.filter(i => i.type === 'note').length,
          idea: items.filter(i => i.type === 'idea').length,
          thought: items.filter(i => i.type === 'thought').length,
        }}
      />

      <main className="main-content">
        {view === 'files' ? (
          <FileVault API={API} />
        ) : (
          <>
            <ItemList
              items={items}
              loading={loading}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              selectedItem={selectedItem}
              setSelectedItem={(item) => { setSelectedItem(item); setIsCreating(false); }}
              onNew={handleNewItem}
              onDelete={handleDelete}
              onPin={handlePin}
              activeType={activeType}
            />
            <div className="editor-pane">
              {(selectedItem || isCreating) ? (
                <ItemEditor
                  item={isCreating ? null : selectedItem}
                  onSave={handleSave}
                  onDelete={handleDelete}
                  onCancel={() => { setSelectedItem(null); setIsCreating(false); }}
                  API={API}
                />
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">📚</div>
                  <h2>Your Personal Library</h2>
                  <p>Select an item to view or edit it,<br />or create something new.</p>
                  <button className="btn-primary" onClick={() => setIsCreating(true)}>
                    + New Entry
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
