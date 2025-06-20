import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import { parse } from 'csv-parse/sync';

interface DatabaseRow {
  [key: string]: any;
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

interface AmazonTransaction {
  transaction_id: string;
  transaction_type: string;
  date: string;
  status: string;
  product_name: string;
  amount: number;
  details: string;
}

export class SimpleAmazonImporter {
  private db: DatabaseWrapper;

  constructor(dbPath?: string) {
    const finalDbPath = dbPath || path.join(process.cwd(), '..', '..', 'data', 'finance.db');
    this.db = new DatabaseWrapper(finalDbPath);
  }

  async importAmazonData(dataPath: string = '~/Downloads/Your Orders'): Promise<{
    success: boolean;
    summary: {
      orders: { processed: number; imported: number };
      returns: { processed: number; imported: number };
      rentals: { processed: number; imported: number };
    };
    message: string;
  }> {
    console.log('🛍️  Starting Amazon data import...');
    
    // Ensure tables exist
    await this.ensureTables();
    
    // Expand tilde path
    const expandedPath = dataPath.replace(/^~/, process.env.HOME || '');
    
    if (!fs.existsSync(expandedPath)) {
      throw new Error(`Amazon data directory not found: ${expandedPath}`);
    }

    const summary = {
      orders: { processed: 0, imported: 0 },
      returns: { processed: 0, imported: 0 },
      rentals: { processed: 0, imported: 0 }
    };

    // Import orders
    const ordersPath = path.join(expandedPath, 'Retail.OrderHistory.1', 'Retail.OrderHistory.1.csv');
    if (fs.existsSync(ordersPath)) {
      const orderResult = await this.importFile(ordersPath, 'order');
      summary.orders = orderResult;
      console.log(`  📦 Orders: ${orderResult.imported}/${orderResult.processed} imported`);
    }

    // Import returns
    const returnsPath = path.join(expandedPath, 'Retail.OrdersReturned.1', 'Retail.OrdersReturned.1.csv');
    if (fs.existsSync(returnsPath)) {
      const returnResult = await this.importFile(returnsPath, 'return');
      summary.returns = returnResult;
      console.log(`  🔄 Returns: ${returnResult.imported}/${returnResult.processed} imported`);
    }

    // Import rentals
    const rentalsPath = path.join(expandedPath, 'Retail.AmazonRentals', 'datasets', 'Retail.AmazonRentals.rental_contracts', 'Retail.AmazonRentals.rental_contracts.csv');
    if (fs.existsSync(rentalsPath)) {
      const rentalResult = await this.importFile(rentalsPath, 'rental');
      summary.rentals = rentalResult;
      console.log(`  🏠 Rentals: ${rentalResult.imported}/${rentalResult.processed} imported`);
    }

    const totalImported = summary.orders.imported + summary.returns.imported + summary.rentals.imported;
    
    console.log(`✅ Amazon import complete! Total imported: ${totalImported} transactions`);
    
    return {
      success: true,
      summary,
      message: `Successfully imported ${totalImported} Amazon transactions`
    };
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

  private async importFile(filePath: string, transactionType: string): Promise<{ processed: number; imported: number }> {
    console.log(`📂 Reading ${transactionType} file: ${path.basename(filePath)}`);
    
    const csvContent = fs.readFileSync(filePath, 'utf-8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      escape: '"'
    });

    console.log(`📊 Found ${records.length} ${transactionType} records`);

    let processed = 0;
    let imported = 0;

    for (const row of records) {
      processed++;
      
      try {
        const transaction = this.parseRow(row, transactionType);
        if (transaction) {
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
            imported++;
          }
        }
      } catch (error) {
        console.error(`❌ Error processing ${transactionType} record ${processed}:`, error);
        console.error('Row data:', row);
      }
    }

    // Log import
    await this.db.run(`
      INSERT INTO amazon_import_log (file_name, records_processed, records_imported)
      VALUES (?, ?, ?)
    `, [path.basename(filePath), processed, imported]);

    return { processed, imported };
  }

  private parseRow(row: any, transactionType: string): AmazonTransaction | null {
    try {
      switch (transactionType) {
        case 'order':
          return this.parseOrderRow(row);
        case 'return':
          return this.parseReturnRow(row);
        case 'rental':
          return this.parseRentalRow(row);
        default:
          throw new Error(`Unknown transaction type: ${transactionType}`);
      }
    } catch (error) {
      console.error(`Error parsing ${transactionType} row:`, error);
      return null;
    }
  }

  private parseOrderRow(row: any): AmazonTransaction {
    const orderId = row['Order ID'];
    const orderDate = this.parseDate(row['Order Date']);
    const totalOwed = this.parseAmount(row['Total Owed']);
    
    if (!orderId || !orderDate) {
      throw new Error('Missing required order fields');
    }

    return {
      transaction_id: orderId,
      transaction_type: 'order',
      date: orderDate,
      status: row['Order Status'] || 'Unknown',
      product_name: row['Product Name'] || 'Unknown Product',
      amount: -Math.abs(totalOwed), // Orders are negative (money out)
      details: JSON.stringify({
        shipment_status: row['Shipment Status'],
        ship_date: this.parseDate(row['Ship Date']),
        carrier: row['Carrier Name & Tracking Number'],
        quantity: row['Quantity'],
        list_price: this.parseAmount(row['List Price Per Unit']),
        purchase_price: this.parseAmount(row['Purchase Price Per Unit'])
      })
    };
  }

  private parseReturnRow(row: any): AmazonTransaction {
    const returnId = row['ReversalID'] || row['OrderID'];
    const returnDate = this.parseDate(row['CreationDate']);
    const refundAmount = this.parseAmount(row['DirectDebitRefundAmount']);
    
    if (!returnId || !returnDate) {
      throw new Error('Missing required return fields');
    }

    return {
      transaction_id: returnId,
      transaction_type: 'return',
      date: returnDate,
      status: row['ReversalStatus'] || 'Unknown',
      product_name: `Return: ${row['ReversalReason'] || 'Unknown reason'}`,
      amount: Math.abs(refundAmount), // Returns are positive (money in)
      details: JSON.stringify({
        original_order_id: row['OrderID'],
        reversal_reason: row['ReversalReason'],
        currency: row['Currency'],
        quantity: row['Quantity'],
        reversal_amount_state: row['ReversalAmountState']
      })
    };
  }

  parseRentalRow(row: any): AmazonTransaction {
    // Handle BOM character in CSV - first key might have UTF-8 BOM prefix
    const keys = Object.keys(row);
    const rentalIdKey = keys.find(key => key.endsWith('rental_id')) || 'rental_id';
    
    const rentalId = row[rentalIdKey];
    const startDate = this.parseDate(row['creation_date']);
    const rentalPrice = this.parseAmount(row['initial_rental_price_amount']);
    
    if (!rentalId || !startDate) {
      throw new Error('Missing required rental fields');
    }

    return {
      transaction_id: rentalId,
      transaction_type: 'rental',
      date: startDate,
      status: 'Rental Contract',
      product_name: `Rental: ${rentalId}`,
      amount: -Math.abs(rentalPrice), // Rentals are negative (money out)
      details: JSON.stringify({
        rental_full_value: this.parseAmount(row['rental_full_value']),
        currency: row['currency'],
        creation_date: row['creation_date']
      })
    };
  }

  parseDate(dateStr: string): string | null {
    if (!dateStr || dateStr === 'Not Available') {
      return null;
    }

    try {
      // Handle ISO format: "2025-06-18T01:50:18Z" -> "2025-06-18"
      if (dateStr.includes('T')) {
        return dateStr.split('T')[0];
      }
      
      // Handle other date formats
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        return null;
      }
      
      return date.toISOString().split('T')[0];
    } catch {
      return null;
    }
  }

  parseAmount(amountStr: string): number {
    if (!amountStr || amountStr === 'Not Available' || amountStr === '') {
      return 0;
    }

    try {
      // Clean up Amazon's complex amount formats
      // Examples: "14.52", "'14.52'", "'-0.7'", "$14.52"
      let cleaned = amountStr
        .replace(/["']/g, '') // Remove quotes
        .replace(/[$,]/g, '')  // Remove dollar signs and commas
        .trim();

      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    } catch {
      return 0;
    }
  }

  async listAmazonTransactions(
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
    // Ensure tables exist before querying
    await this.ensureTables();
    
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

  close(): void {
    this.db.close();
  }
} 