import * as SQLite from 'expo-sqlite';

export interface CachedLocationRow {
  id: string;
  name: string;
  streetContext: string;
  accessLevel: string;
  lat: number;
  lng: number;
  payloadJson: string;
  cachedAt: string;
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDb() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('campuspulse_dundee.db');
  }
  const db = await dbPromise;
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS campus_locations (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      streetContext TEXT NOT NULL,
      accessLevel TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      payloadJson TEXT NOT NULL,
      cachedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS offline_queue (
      id TEXT PRIMARY KEY NOT NULL,
      endpoint TEXT NOT NULL,
      payloadJson TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
  `);
  return db;
}

export async function cacheLocationsSqlite(locations: CachedLocationRow[]): Promise<void> {
  const db = await getDb();
  for (const loc of locations) {
    await db.runAsync(
      `INSERT OR REPLACE INTO campus_locations (id, name, streetContext, accessLevel, lat, lng, payloadJson, cachedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [loc.id, loc.name, loc.streetContext, loc.accessLevel, loc.lat, loc.lng, loc.payloadJson, loc.cachedAt]
    );
  }
}

export async function getCachedLocationsSqlite(): Promise<CachedLocationRow[]> {
  const db = await getDb();
  return db.getAllAsync<CachedLocationRow>('SELECT * FROM campus_locations ORDER BY name ASC');
}
