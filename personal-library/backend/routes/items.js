const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

// Get all items (with optional search/filter)
router.get('/', (req, res) => {
  const { search, type, tag } = req.query;
  let query = 'SELECT * FROM items';
  const params = [];
  const conditions = [];

  if (search) {
    conditions.push("(title LIKE ? OR content LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }
  if (type && type !== 'all') {
    conditions.push("type = ?");
    params.push(type);
  }
  if (tag) {
    conditions.push("tags LIKE ?");
    params.push(`%"${tag}"%`);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY pinned DESC, updated_at DESC';

  const items = db.prepare(query).all(...params);
  const result = items.map(item => ({
    ...item,
    tags: JSON.parse(item.tags || '[]'),
    pinned: item.pinned === 1
  }));
  res.json(result);
});

// Get single item with its files
router.get('/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  const files = db.prepare('SELECT * FROM files WHERE item_id = ?').all(req.params.id);
  res.json({
    ...item,
    tags: JSON.parse(item.tags || '[]'),
    pinned: item.pinned === 1,
    files
  });
});

// Create item
router.post('/', (req, res) => {
  const { title, content, type, tags, pinned } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO items (id, title, content, type, tags, pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, title, content || '', type || 'note', JSON.stringify(tags || []), pinned ? 1 : 0, now, now);

  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
  res.status(201).json({ ...item, tags: JSON.parse(item.tags), pinned: item.pinned === 1 });
});

// Update item
router.put('/:id', (req, res) => {
  const { title, content, type, tags, pinned } = req.body;
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Item not found' });

  db.prepare(
    'UPDATE items SET title=?, content=?, type=?, tags=?, pinned=?, updated_at=? WHERE id=?'
  ).run(
    title ?? existing.title,
    content ?? existing.content,
    type ?? existing.type,
    JSON.stringify(tags ?? JSON.parse(existing.tags)),
    pinned !== undefined ? (pinned ? 1 : 0) : existing.pinned,
    now,
    req.params.id
  );

  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  res.json({ ...item, tags: JSON.parse(item.tags), pinned: item.pinned === 1 });
});

// Delete item
router.delete('/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  db.prepare('DELETE FROM items WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Get all unique tags
router.get('/meta/tags', (req, res) => {
  const items = db.prepare('SELECT tags FROM items').all();
  const allTags = new Set();
  items.forEach(item => {
    try {
      JSON.parse(item.tags).forEach(tag => allTags.add(tag));
    } catch {}
  });
  res.json([...allTags]);
});

module.exports = router;
