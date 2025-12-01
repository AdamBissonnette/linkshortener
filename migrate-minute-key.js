#!/usr/bin/env node
/**
 * Migration script to convert minute_key from generated column to regular column
 * Run this once on existing databases: node migrate-minute-key.js
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'app.db');
console.log(`Migrating database at: ${dbPath}`);

const db = new Database(dbPath);

try {
  console.log('Starting migration...');
  
  // Check if hits table exists
  const tableExists = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='hits'
  `).get();
  
  if (!tableExists) {
    console.log('No hits table found - nothing to migrate');
    process.exit(0);
  }
  
  // Check column info
  const columns = db.prepare(`PRAGMA table_info(hits)`).all();
  const minuteKeyCol = columns.find(c => c.name === 'minute_key');
  
  if (!minuteKeyCol) {
    console.log('minute_key column does not exist - nothing to migrate');
    process.exit(0);
  }
  
  console.log('Backing up hits table...');
  
  // Start transaction
  db.exec('BEGIN TRANSACTION');
  
  // Create new hits table with regular minute_key column
  db.exec(`
    CREATE TABLE hits_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      slug TEXT NOT NULL,
      ip TEXT,
      timestamp TEXT NOT NULL,
      user_agent TEXT,
      browser TEXT,
      os TEXT,
      device TEXT,
      referer TEXT,
      accept_language TEXT,
      query_params TEXT,
      session_id TEXT,
      visitor_id TEXT,
      extra TEXT,
      minute_key TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      UNIQUE(minute_key)
    )
  `);
  
  // Copy data from old table to new table
  // For existing rows, generate minute_key from timestamp
  console.log('Copying data...');
  db.exec(`
    INSERT INTO hits_new (
      id, type, slug, ip, timestamp, user_agent, browser, os, device,
      referer, accept_language, query_params, session_id, visitor_id, 
      extra, minute_key, created_at
    )
    SELECT 
      id, type, slug, ip, timestamp, user_agent, browser, os, device,
      referer, accept_language, query_params, session_id, visitor_id,
      extra,
      ip || '|' || slug || '|' || strftime('%Y-%m-%d %H:%M', timestamp) as minute_key,
      created_at
    FROM hits
  `);
  
  // Drop old table and rename new one
  console.log('Replacing old table...');
  db.exec('DROP TABLE hits');
  db.exec('ALTER TABLE hits_new RENAME TO hits');
  
  // Recreate indexes
  console.log('Recreating indexes...');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_hits_slug ON hits(slug);
    CREATE INDEX IF NOT EXISTS idx_hits_type ON hits(type);
    CREATE INDEX IF NOT EXISTS idx_hits_timestamp ON hits(timestamp);
    CREATE INDEX IF NOT EXISTS idx_hits_created_at ON hits(created_at);
    CREATE INDEX IF NOT EXISTS idx_hits_ip ON hits(ip);
    CREATE INDEX IF NOT EXISTS idx_hits_session ON hits(session_id);
    CREATE INDEX IF NOT EXISTS idx_hits_visitor ON hits(visitor_id);
    CREATE INDEX IF NOT EXISTS idx_hits_minute_key ON hits(minute_key);
  `);
  
  // Commit transaction
  db.exec('COMMIT');
  
  const rowCount = db.prepare('SELECT COUNT(*) as count FROM hits').get();
  console.log(`✓ Migration complete! ${rowCount.count} rows migrated.`);
  console.log('The minute_key column is now a regular column.');
  
} catch (error) {
  console.error('Migration failed:', error.message);
  try {
    db.exec('ROLLBACK');
    console.log('Changes rolled back.');
  } catch (e) {
    // Rollback might fail if no transaction is active
  }
  process.exit(1);
} finally {
  db.close();
}
