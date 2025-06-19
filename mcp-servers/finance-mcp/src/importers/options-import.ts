import fs from 'fs';
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

interface OptionsRow {
  'Record Type': string;
  'Symbol': string;
  'Grant Date': string;
  'Granted Qty.': string;
  'Exercise Price': string;
  'Exercisable Qty.': string;
  'Est. Market Value': string;
  'Grant Number': string;
  'Expiration Date': string;
}

class OptionsImporter {
  private db: DatabaseWrapper;

  constructor() {
    this.db = new DatabaseWrapper('finance.db');
    this.initializeDatabase();
  }

  private async initializeDatabase(): Promise<void> {
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS stock_options (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        grant_number TEXT,
        symbol TEXT,
        grant_date DATE,
        expiration_date DATE,
        exercise_price REAL,
        quantity INTEGER,
        current_value REAL,
        intrinsic_value REAL,
        exercise_cost REAL,
        record_type TEXT,
        account_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_options_symbol ON stock_options(symbol);
    `);

    await this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_options_expiration ON stock_options(expiration_date);
    `);
  }

  private parseDate(dateStr: string): string {
    if (!dateStr || dateStr.trim() === '') return '';
    
    // Handle format like "03-OCT-2016"
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const day = parts[0];
      const monthMap: Record<string, string> = {
        'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04',
        'MAY': '05', 'JUN': '06', 'JUL': '07', 'AUG': '08',
        'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12'
      };
      const month = monthMap[parts[1]] || '01';
      const year = parts[2];
      return `${year}-${month}-${day.padStart(2, '0')}`;
    }
    
    return dateStr;
  }

  private parsePrice(priceStr: string): number {
    if (!priceStr) return 0;
    // Remove $ and spaces, parse as float
    return parseFloat(priceStr.replace(/[$,\s]/g, '')) || 0;
  }

  private parseQuantity(qtyStr: string): number {
    if (!qtyStr) return 0;
    return parseInt(qtyStr.replace(/[,\s]/g, '')) || 0;
  }

  private calculateExpirationDate(grantDate: string): string {
    if (!grantDate) return '';
    
    // Add 10 years to grant date
    const date = new Date(grantDate);
    date.setFullYear(date.getFullYear() + 10);
    return date.toISOString().split('T')[0];
  }

  async importOptions(filename: string): Promise<void> {
    console.log('📊 Reading options CSV file...');
    
    const csvContent = fs.readFileSync(filename, 'utf-8');
    
    // Skip the first line "Table 1" and parse from the second line
    const lines = csvContent.split('\n');
    const dataLines = lines.slice(1); // Skip first line
    const cleanedCsv = dataLines.join('\n');
    
    const records: OptionsRow[] = parse(cleanedCsv, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    console.log(`🔍 Found ${records.length} rows in CSV`);

    // Filter to only Grant records (skip Vest Schedule and Totals)
    const grantRecords = records.filter(row => row['Record Type'] === 'Grant');
    console.log(`📈 Processing ${grantRecords.length} option grants`);

    let importedCount = 0;
    let skippedCount = 0;

    for (const row of grantRecords) {
      try {
        const grantNumber = row['Grant Number'];
        
        // Check if grant already exists
        const existing = await this.db.get(
          'SELECT id FROM stock_options WHERE grant_number = ?',
          [grantNumber]
        );
        
        if (existing) {
          skippedCount++;
          continue;
        }

        const symbol = row['Symbol'];
        const grantDate = this.parseDate(row['Grant Date']);
        const expirationDate = this.calculateExpirationDate(grantDate);
        const exercisePrice = this.parsePrice(row['Exercise Price']);
        const quantity = this.parseQuantity(row['Granted Qty.']);
        const currentValue = this.parsePrice(row['Est. Market Value']);
        
        // Calculate intrinsic value and exercise cost
        const currentStockPrice = quantity > 0 ? currentValue / quantity : 0;
        const intrinsicValue = Math.max(0, currentStockPrice - exercisePrice) * quantity;
        const exerciseCost = exercisePrice * quantity;

        await this.db.run(`
          INSERT INTO stock_options 
          (grant_number, symbol, grant_date, expiration_date, exercise_price, 
           quantity, current_value, intrinsic_value, exercise_cost, record_type, account_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          grantNumber,
          symbol,
          grantDate,
          expirationDate,
          exercisePrice,
          quantity,
          currentValue,
          intrinsicValue,
          exerciseCost,
          'Grant',
          'etrade_options'
        ]);

        importedCount++;

        if (importedCount % 10 === 0) {
          console.log(`  📊 Imported ${importedCount} grants...`);
        }

      } catch (error) {
        console.error(`❌ Error importing grant:`, error);
        console.error('Row data:', row);
      }
    }

    console.log(`✅ Import complete!`);
    console.log(`  📊 Imported: ${importedCount} option grants`);
    console.log(`  ⏭️  Skipped: ${skippedCount} duplicates`);

    // Show summary statistics
    const summary = await this.db.get(`
      SELECT 
        COUNT(*) as total_grants,
        SUM(current_value) as total_value,
        SUM(exercise_cost) as total_exercise_cost,
        MIN(expiration_date) as earliest_expiration,
        MAX(expiration_date) as latest_expiration
      FROM stock_options
    `);

    console.log(`\n📈 Options Portfolio Summary:`);
    console.log(`  🎯 Total Grants: ${summary?.total_grants || 0}`);
    console.log(`  💰 Total Value: $${(summary?.total_value || 0).toLocaleString()}`);
    console.log(`  💸 Exercise Cost: $${(summary?.total_exercise_cost || 0).toLocaleString()}`);
    console.log(`  📅 Expiration Range: ${summary?.earliest_expiration} to ${summary?.latest_expiration}`);

    // Show expiring soon
    const expiringSoon = await this.db.all(`
      SELECT COUNT(*) as count, SUM(current_value) as value
      FROM stock_options 
      WHERE expiration_date <= date('now', '+2 years')
    `);

    if (expiringSoon[0]?.count > 0) {
      console.log(`\n⚠️  Expiring within 2 years:`);
      console.log(`  📊 ${expiringSoon[0].count} grants worth $${(expiringSoon[0].value || 0).toLocaleString()}`);
    }
  }

  close(): void {
    this.db.close();
  }
}

// CLI usage
async function main() {
  const importer = new OptionsImporter();
  
  try {
    await importer.importOptions('ByBenefitType_expanded.csv');
  } catch (error) {
    console.error('💥 Import failed:', error);
    process.exit(1);
  } finally {
    importer.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { OptionsImporter }; 