import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';

interface DatabaseRow {
  [key: string]: any;
}

export interface AmazonTransaction {
  transaction_id: string;
  transaction_type: string;
  date: string;
  status: string;
  product_name: string;
  amount: number;
  details: string;
}

class DatabaseWrapper {
  private db: sqlite3.Database;
  public all: (sql: string, params?: any[]) => Promise<DatabaseRow[]>;
  public get: (sql: string, params?: any[]) => Promise<DatabaseRow | undefined>;
  public run: (sql: string, params?: any[]) => Promise<void>;

  constructor(filename: string) {
    this.db = new sqlite3.Database(filename);
    this.all = promisify(this.db.all.bind(this.db));
    this.get = promisify(this.db.get.bind(this.db));
    this.run = promisify(this.db.run.bind(this.db));
  }

  close(): void {
    this.db.close();
  }
}

export class AmazonDatabaseManager {
  private db: DatabaseWrapper;

  constructor(dbPath?: string) {
    const finalDbPath = dbPath || path.join(process.cwd(), '..', '..', 'data', 'finance.db');
    this.db = new DatabaseWrapper(finalDbPath);
  }

  async ensureTables(): Promise<void> {
    // Create amazon_transactions table
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS amazon_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_id TEXT UNIQUE,
        transaction_type TEXT NOT NULL,
        date TEXT NOT NULL,
        status TEXT,
        product_name TEXT,
        amount REAL NOT NULL,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create amazon_import_log table
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS amazon_import_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        import_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        file_name TEXT NOT NULL,
        records_processed INTEGER NOT NULL,
        records_imported INTEGER NOT NULL
      )
    `);

    console.log('📋 Database tables ensured');
  }

  async insertTransaction(transaction: AmazonTransaction): Promise<boolean> {
    try {
      // Check if already exists
      const existing = await this.db.get(
        'SELECT id FROM amazon_transactions WHERE transaction_id = ?',
        [transaction.transaction_id]
      );

      if (!existing) {
        await this.db.run(`
          INSERT INTO amazon_transactions 
          (transaction_id, transaction_type, date, status, product_name, amount, details)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          transaction.transaction_id,
          transaction.transaction_type,
          transaction.date,
          transaction.status,
          transaction.product_name,
          transaction.amount,
          transaction.details
        ]);
        return true;
      }
      return false; // Already exists
    } catch (error) {
      console.error('❌ Error inserting transaction:', error);
      throw error;
    }
  }

  async logImport(fileName: string, processed: number, imported: number): Promise<void> {
    await this.db.run(`
      INSERT INTO amazon_import_log (file_name, records_processed, records_imported)
      VALUES (?, ?, ?)
    `, [fileName, processed, imported]);
  }

  async listTransactions(
    transactionType: string = 'all',
    daysBack: number = 30,
    statusFilter?: string
  ): Promise<{
    transactions: any[];
    summary: {
      count: number;
      total_amount: number;
      date_range: { earliest: string; latest: string } | null;
    };
  }> {
    let whereClause = 'WHERE date >= date("now", "-" || ? || " days")';
    const params: any[] = [daysBack];

    if (transactionType !== 'all') {
      whereClause += ' AND transaction_type = ?';
      params.push(transactionType);
    }

    if (statusFilter) {
      whereClause += ' AND status LIKE ?';
      params.push(`%${statusFilter}%`);
    }

    const transactions = await this.db.all(`
      SELECT 
        transaction_id,
        transaction_type,
        date,
        status,
        product_name,
        amount,
        details
      FROM amazon_transactions 
      ${whereClause}
      ORDER BY date DESC, transaction_id
    `, params);

    // Get summary statistics
    const summary = await this.db.get(`
      SELECT 
        COUNT(*) as count,
        SUM(amount) as total_amount,
        MIN(date) as earliest,
        MAX(date) as latest
      FROM amazon_transactions 
      ${whereClause}
    `, params);

    return {
      transactions: transactions.map(t => ({
        ...t,
        details: t.details ? JSON.parse(t.details) : {}
      })),
      summary: {
        count: summary?.count || 0,
        total_amount: summary?.total_amount || 0,
        date_range: summary?.earliest ? {
          earliest: summary.earliest,
          latest: summary.latest
        } : null
      }
    };
  }

  async clearTables(): Promise<void> {
    await this.db.run('DELETE FROM amazon_transactions');
    await this.db.run('DELETE FROM amazon_import_log');
  }

  close(): void {
    this.db.close();
  }
} 