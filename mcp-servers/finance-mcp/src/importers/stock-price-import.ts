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

interface StockPriceData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

class StockPriceImporter {
  private db: DatabaseWrapper;

  constructor(dbPath: string = './finance.db') {
    this.db = new DatabaseWrapper(dbPath);
  }

  async createStockPricesTable(): Promise<void> {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS stock_prices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        date TEXT NOT NULL,
        open REAL NOT NULL,
        high REAL NOT NULL,
        low REAL NOT NULL,
        close REAL NOT NULL,
        volume INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(symbol, date)
      )
    `;
    
    await this.db.run(createTableQuery);
    console.log('✅ Stock prices table created/verified');
  }

  async loadNflxDataFromCsv(filename: string = 'nflx_sample_data.csv'): Promise<StockPriceData[]> {
    console.log(`📈 Loading Netflix data from CSV file: ${filename}`);
    
    try {
      const csvContent = fs.readFileSync(filename, 'utf-8');
      
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });
      
      const stockData: StockPriceData[] = records.map((record: any) => ({
        date: record.Date,
        open: parseFloat(record.Open),
        high: parseFloat(record.High),
        low: parseFloat(record.Low),
        close: parseFloat(record.Close),
        volume: parseInt(record.Volume)
      }));
      
      // Sort by date ascending
      stockData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      console.log(`📊 Loaded ${stockData.length} days of NFLX data from ${stockData[0]?.date} to ${stockData[stockData.length - 1]?.date}`);
      
      return stockData;
      
    } catch (error) {
      console.error('❌ Error loading CSV data:', error);
      throw error;
    }
  }

  async fetchNflxData(): Promise<StockPriceData[]> {
    console.log('📈 Fetching Netflix historical data from Alpha Vantage...');
    
    // Get free API key from Alpha Vantage
    const API_KEY = 'H7NU47N5NIPL94NY';
    const symbol = 'NFLX';
    
    // Fetch full historical data (20+ years)
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=full&apikey=${API_KEY}`;
    
    try {
      const response = await fetch(url);
      const data = await response.json() as any;
      
      if (data['Error Message']) {
        throw new Error(`API Error: ${data['Error Message']}`);
      }
      
      if (data['Note']) {
        throw new Error(`API Rate Limit: ${data['Note']}`);
      }
      
      const timeSeries = data['Time Series (Daily)'];
      if (!timeSeries) {
        throw new Error('No time series data found in API response');
      }
      
      const stockData: StockPriceData[] = [];
      
      // Filter data from October 2016 onwards (first option grants)
      const startDate = new Date('2016-10-01');
      
      for (const [date, values] of Object.entries(timeSeries)) {
        const priceDate = new Date(date);
        if (priceDate >= startDate) {
          const dayData = values as any;
          stockData.push({
            date: date,
            open: parseFloat(dayData['1. open']),
            high: parseFloat(dayData['2. high']),
            low: parseFloat(dayData['3. low']),
            close: parseFloat(dayData['4. close']),
            volume: parseInt(dayData['5. volume'])
          });
        }
      }
      
      // Sort by date ascending
      stockData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      console.log(`📊 Retrieved ${stockData.length} days of NFLX data from ${stockData[0]?.date} to ${stockData[stockData.length - 1]?.date}`);
      
      return stockData;
      
    } catch (error) {
      console.error('❌ Error fetching data:', error);
      throw error;
    }
  }

  async importStockData(stockData: StockPriceData[]): Promise<void> {
    console.log('💾 Importing stock price data into database...');
    
    const insertQuery = `
      INSERT OR REPLACE INTO stock_prices 
      (symbol, date, open, high, low, close, volume)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    let imported = 0;
    let skipped = 0;
    
    for (const data of stockData) {
      try {
        await this.db.run(insertQuery, [
          'NFLX',
          data.date,
          data.open,
          data.high,
          data.low,
          data.close,
          data.volume
        ]);
        imported++;
      } catch (error) {
        console.log(`⚠️  Skipped ${data.date}: ${error}`);
        skipped++;
      }
    }
    
    console.log(`✅ Import complete: ${imported} records imported, ${skipped} skipped`);
  }

  async getCurrentPrice(): Promise<number> {
    const priceRow = await this.db.get(
      'SELECT close FROM stock_prices WHERE symbol = ? ORDER BY date DESC LIMIT 1',
      ['NFLX']
    );
    
    return priceRow?.close || 0;
  }

  async updateOptionsValues(): Promise<void> {
    console.log('🔄 Updating option values with current stock price...');
    
    const currentPrice = await this.getCurrentPrice();
    if (currentPrice === 0) {
      console.log('⚠️  No stock price data found, skipping option value updates');
      return;
    }
    
    console.log(`📈 Current NFLX price: $${currentPrice.toFixed(2)}`);
    
    // First add current_price column if it doesn't exist
    try {
      await this.db.run('ALTER TABLE stock_options ADD COLUMN current_price REAL');
      console.log('✅ Added current_price column to stock_options table');
    } catch (error) {
      // Column probably already exists, that's fine
    }
    
    // Update options table with calculated values
    const updateQuery = `
      UPDATE stock_options 
      SET 
        current_price = ?,
        intrinsic_value = CASE 
          WHEN ? > exercise_price THEN (? - exercise_price) * quantity 
          ELSE 0 
        END,
        current_value = CASE 
          WHEN ? > exercise_price THEN (? - exercise_price) * quantity 
          ELSE 0 
        END
      WHERE symbol = 'NFLX'
    `;
    
    await this.db.run(updateQuery, [
      currentPrice, currentPrice, currentPrice, currentPrice, currentPrice
    ]);
    
    console.log('✅ Option values updated with current stock price');
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

async function main() {
  const importer = new StockPriceImporter();
  
  try {
    // Create table
    await importer.createStockPricesTable();
    
    // Fetch Netflix data from Alpha Vantage API
    const stockData = await importer.fetchNflxData();
    
    // Import into database
    await importer.importStockData(stockData);
    
    // Update option values with real stock prices
    await importer.updateOptionsValues();
    
    console.log('🎉 Stock price import complete!');
    
  } catch (error) {
    console.error('💥 Import failed:', error);
    process.exit(1);
  } finally {
    await importer.close();
  }
}

// Run if this file is executed directly
main();

export { StockPriceImporter }; 