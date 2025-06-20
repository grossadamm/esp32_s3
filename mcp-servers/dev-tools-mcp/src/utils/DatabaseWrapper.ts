import sqlite3 from 'sqlite3';
import { promisify } from 'util';

export interface DatabaseRow {
  [key: string]: any;
}

export class DatabaseWrapper {
  private db: sqlite3.Database;
  public all: (sql: string, params?: any[]) => Promise<DatabaseRow[]>;
  public get: (sql: string, params?: any[]) => Promise<DatabaseRow | undefined>;
  public run: (sql: string, params?: any[]) => Promise<void>;

  constructor(filename: string, mode?: number) {
    const dbMode = mode || (sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE);
    this.db = new sqlite3.Database(filename, dbMode, (err) => {
      if (err) {
        console.error(`Database connection error: ${err.message}`);
        console.error(`Full error:`, err);
      }
    });
    this.all = promisify(this.db.all.bind(this.db));
    this.get = promisify(this.db.get.bind(this.db));
    this.run = promisify(this.db.run.bind(this.db));
  }

  close(): void {
    this.db.close();
  }
} 