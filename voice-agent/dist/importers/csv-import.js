import fs from 'fs';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import { parse } from 'csv-parse/sync';
class DatabaseWrapper {
    db;
    all;
    get;
    run;
    constructor(filename) {
        this.db = new sqlite3.Database(filename);
        this.all = promisify(this.db.all.bind(this.db));
        this.get = promisify(this.db.get.bind(this.db));
        this.run = promisify(this.db.run.bind(this.db));
    }
    close() {
        this.db.close();
    }
}
class CSVImporter {
    db;
    constructor() {
        this.db = new DatabaseWrapper('finance.db');
    }
    parseDate(dateStr) {
        // Convert "8/10/2019" to "2019-08-10"
        const [month, day, year] = dateStr.split('/');
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    generateTransactionId(csvRow, index) {
        // Generate a unique ID for CSV transactions
        const date = this.parseDate(csvRow.Date);
        const amount = Math.abs(parseFloat(csvRow.Amount));
        return `csv_${date}_${amount}_${index}`.replace(/[^a-zA-Z0-9_]/g, '_');
    }
    async ensureAccountExists(accountName) {
        // Check if account already exists
        const existing = await this.db.get('SELECT id FROM accounts WHERE name = ?', [accountName]);
        if (existing) {
            return existing.id;
        }
        // Create a new account for CSV data
        const accountId = `csv_account_${accountName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
        await this.db.run(`
      INSERT OR IGNORE INTO accounts 
      (id, enrollment_id, name, type, subtype, status, currency, balance, available_balance, last_four, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [
            accountId,
            null,
            accountName,
            'historical', // Mark as historical account
            null,
            'closed', // Assume historical accounts are closed
            'USD',
            0, // No current balance for historical accounts
            0,
            null
        ]);
        console.log(`  📝 Created account: ${accountName}`);
        return accountId;
    }
    normalizeCategory(category) {
        // Map common category variations to standardized names
        const categoryMap = {
            'Food & Dining': 'Restaurants & Bars',
            'Fast Food': 'Restaurants & Bars',
            'Restaurants': 'Restaurants & Bars',
            'Coffee Shops': 'Coffee Shops',
            'Groceries': 'Groceries',
            'Gas & Fuel': 'Gas',
            'Auto & Transport': 'Transportation',
            'Shopping': 'Shopping',
            'Clothing': 'Shopping',
            'Entertainment': 'Entertainment & Recreation',
            'Movies & DVDs': 'Entertainment & Recreation',
            'Mobile Phone': 'Phone',
            'Phone': 'Phone',
            'Utilities': 'Utilities',
            'Internet': 'Utilities',
            'Cable': 'Utilities',
            'Electric': 'Utilities',
            'Health & Fitness': 'Healthcare',
            'Personal Care': 'Personal',
            'Income': 'Income',
            'Paycheck': 'Income',
            'Deposit': 'Income',
            'Transfer': 'Transfer',
            'Credit Card Payment': 'Transfer',
            'Fees & Charges': 'Fees',
            'Service Fee': 'Fees'
        };
        return categoryMap[category] || category || 'other';
    }
    async importCSV(filename) {
        console.log('📂 Reading CSV file...');
        const csvContent = fs.readFileSync(filename, 'utf-8');
        const records = parse(csvContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true
        });
        console.log(`📊 Found ${records.length} transactions in CSV`);
        console.log('🔄 Starting import...');
        let importedCount = 0;
        let skippedCount = 0;
        for (let i = 0; i < records.length; i++) {
            const row = records[i];
            try {
                // Generate unique transaction ID
                const transactionId = this.generateTransactionId(row, i);
                // Check if transaction already exists
                const existing = await this.db.get('SELECT id FROM transactions WHERE id = ?', [transactionId]);
                if (existing) {
                    skippedCount++;
                    continue;
                }
                // Ensure account exists
                const accountId = await this.ensureAccountExists(row['Account Name']);
                // Parse amount (debit transactions should be negative)
                let amount = parseFloat(row.Amount);
                if (row['Transaction Type'] === 'debit' && amount > 0) {
                    amount = -amount;
                }
                // Parse date
                const date = this.parseDate(row.Date);
                // Normalize category
                const category = this.normalizeCategory(row.Category);
                // Use description or original description
                const description = row.Description || row['Original Description'] || 'Unknown';
                // Insert transaction
                await this.db.run(`
          INSERT OR IGNORE INTO transactions 
          (id, account_id, amount, date, description, category, processing_status, running_balance, status, type, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
                    transactionId,
                    accountId,
                    amount,
                    date,
                    description,
                    category,
                    'posted',
                    null,
                    'posted',
                    row['Transaction Type'] === 'credit' ? 'credit' : 'debit'
                ]);
                importedCount++;
                if (importedCount % 1000 === 0) {
                    console.log(`  📈 Imported ${importedCount} transactions...`);
                }
            }
            catch (error) {
                console.error(`❌ Error importing transaction ${i}:`, error);
                console.error('Row data:', row);
            }
        }
        console.log(`✅ Import complete!`);
        console.log(`  📊 Imported: ${importedCount} transactions`);
        console.log(`  ⏭️  Skipped: ${skippedCount} duplicates`);
        // Show updated totals
        const total = await this.db.get('SELECT COUNT(*) as count FROM transactions');
        const dateRange = await this.db.get('SELECT MIN(date) as min_date, MAX(date) as max_date FROM transactions');
        console.log(`\n📈 Database now contains:`);
        console.log(`  💰 Total transactions: ${total?.count || 0}`);
        console.log(`  📅 Date range: ${dateRange?.min_date || 'N/A'} to ${dateRange?.max_date || 'N/A'}`);
    }
    close() {
        this.db.close();
    }
}
// CLI usage
async function main() {
    const importer = new CSVImporter();
    try {
        await importer.importCSV('transactions.csv');
    }
    catch (error) {
        console.error('💥 Import failed:', error);
        process.exit(1);
    }
    finally {
        importer.close();
    }
}
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
//# sourceMappingURL=csv-import.js.map