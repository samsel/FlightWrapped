import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Flight } from './types'

interface FlightWrappedDB extends DBSchema {
  sync: {
    key: string
    value: SyncData
  }
}

export interface SyncData {
  flights: Flight[]
  lastImportAt: string // ISO timestamp
}

const DB_NAME = 'flightwrapped'
const DB_VERSION = 1
const STORE_KEY = 'default'

let dbPromise: Promise<IDBPDatabase<FlightWrappedDB>> | null = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<FlightWrappedDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore('sync')
      },
    })
  }
  return dbPromise
}

export async function loadCachedData(): Promise<SyncData | null> {
  try {
    const db = await getDB()
    const data = await db.get('sync', STORE_KEY)
    return data ?? null
  } catch {
    return null
  }
}

export async function saveSyncData(data: SyncData): Promise<void> {
  const db = await getDB()
  await db.put('sync', data, STORE_KEY)
}

export async function clearAllData(): Promise<void> {
  const db = await getDB()
  await db.clear('sync')
}
