import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

interface MonarchAccount {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
}

interface MonarchTransaction {
  id: string;
  amount: number;
  date: string;
  description: string;
  category?: string;
  account: {
    id: string;
    name: string;
  };
}

class MonarchAPI {
  private token: string;

  constructor() {
    this.token = process.env.MONARCH_TOKEN || '';
    
    if (!this.token) {
      throw new Error('MONARCH_TOKEN environment variable is required');
    }
  }

  private async getValidToken(): Promise<string> {
    return this.token;
  }

  private async graphqlRequest(query: string, variables?: any): Promise<any> {
    const token = await this.getValidToken();

    try {
      const response = await axios.post('https://api.monarchmoney.com/graphql', {
        query,
        variables
      }, {
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json',
          'Accept': '*/*',
          'Origin': 'https://app.monarchmoney.com',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
          'client-platform': 'web',
          'device-uuid': 'f37a8ae6-b19c-479b-9120-91c620de241f'
        }
      });

      if (response.data.errors) {
        console.error('GraphQL errors:', JSON.stringify(response.data.errors, null, 2));
        throw new Error(`GraphQL error: ${response.data.errors[0].message}`);
      }

      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data) {
        console.error('API Error Response:', JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    }
  }

  async getAccounts(): Promise<MonarchAccount[]> {
    console.log('📊 Fetching accounts from Monarch...');
    
    const query = `
      query {
        accounts {
          id
          displayName
          type {
            name
            __typename
          }
          isHidden
          isAsset
          currentBalance
          __typename
        }
      }
    `;

    const data = await this.graphqlRequest(query);
    
    return data.accounts
      .filter((account: any) => !account.isHidden)
      .map((account: any) => ({
        id: account.id,
        name: account.displayName,
        type: account.type.name,
        balance: account.currentBalance || 0,
        currency: 'USD'
      }));
  }

  async getTransactions(limit: number = 1000, offset: number = 0): Promise<MonarchTransaction[]> {
    console.log(`📋 Fetching transactions from Monarch (limit: ${limit}, offset: ${offset})...`);
    
    const query = {
      "operationName": "Web_GetTransactionsList",
      "variables": {
        "orderBy": "date",
        "limit": limit,
        "offset": offset,
        "filters": {}
      },
      "query": `query Web_GetTransactionsList($offset: Int, $limit: Int, $filters: TransactionFilterInput, $orderBy: TransactionOrdering) {
        allTransactions(filters: $filters) {
          totalCount
          totalSelectableCount
          results(offset: $offset, limit: $limit, orderBy: $orderBy) {
            id
            ...TransactionOverviewFields
            __typename
          }
          __typename
        }
      }

      fragment TransactionOverviewFields on Transaction {
        id
        amount
        pending
        date
        hideFromReports
        plaidName
        notes
        isRecurring
        reviewStatus
        needsReview
        isSplitTransaction
        dataProviderDescription
        category {
          id
          name
          icon
          group {
            id
            type
            __typename
          }
          __typename
        }
        account {
          id
          displayName
          icon
          logoUrl
          __typename
        }
        __typename
      }`
    };

    const response = await axios.post('https://api.monarchmoney.com/graphql', query, {
      headers: {
        'Authorization': `Token ${this.token}`,
        'Content-Type': 'application/json',
        'Accept': '*/*',
        'Origin': 'https://app.monarchmoney.com',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
        'client-platform': 'web',
        'device-uuid': 'f37a8ae6-b19c-479b-9120-91c620de241f'
      }
    });

    if (response.data.errors) {
      console.error('GraphQL errors:', JSON.stringify(response.data.errors, null, 2));
      throw new Error(`GraphQL error: ${response.data.errors[0].message}`);
    }

    const data = response.data.data;
    
    return data.allTransactions.results.map((tx: any) => ({
      id: tx.id,
      amount: tx.amount,
      date: tx.date,
      description: tx.plaidName || tx.dataProviderDescription || 'Unknown',
      category: tx.category?.name,
      account: {
        id: tx.account.id,
        name: tx.account.displayName
      }
    }));
  }

  async getAllTransactions(): Promise<MonarchTransaction[]> {
    const allTransactions: MonarchTransaction[] = [];
    let offset = 0;
    const limit = 1000;

    while (true) {
      const transactions = await this.getTransactions(limit, offset);
      
      if (transactions.length === 0) {
        break;
      }

      allTransactions.push(...transactions);
      offset += limit;

      console.log(`  📈 Downloaded ${allTransactions.length} transactions so far...`);

      if (offset > 50000) {
        console.log('⚠️  Reached safety limit of 50,000 transactions');
        break;
      }
    }

    return allTransactions;
  }
}

// Database integration
import sqlite3 from 'sqlite3';
import { promisify } from 'util';

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

class FinanceMonarchSync {
  private db: DatabaseWrapper;
  private monarch: MonarchAPI;

  constructor() {
    // Update database path for monorepo structure - match http-server.ts path
    const dbPath = path.join(process.cwd(), '..', '..', 'data', 'finance.db');
    this.db = new DatabaseWrapper(dbPath);
    this.monarch = new MonarchAPI();
    this.initializeDatabase();
  }

  private async initializeDatabase(): Promise<void> {
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        enrollment_id TEXT,
        name TEXT,
        type TEXT,
        subtype TEXT,
        status TEXT,
        currency TEXT,
        balance REAL,
        available_balance REAL,
        last_four TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await this.db.run(`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        account_id TEXT,
        amount REAL,
        date DATE,
        description TEXT,
        category TEXT,
        processing_status TEXT,
        running_balance REAL,
        status TEXT,
        type TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES accounts (id)
      )
    `);

    await this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    `);

    await this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
    `);
  }

  private categorizeTransaction(description: string): string {
    const desc = description.toLowerCase();
    
    if (desc.includes('grocery') || desc.includes('market') || desc.includes('food')) {
      return 'groceries';
    }
    if (desc.includes('gas') || desc.includes('fuel') || desc.includes('station')) {
      return 'gas';
    }
    if (desc.includes('restaurant') || desc.includes('dining') || desc.includes('coffee')) {
      return 'dining';
    }
    if (desc.includes('amazon') || desc.includes('walmart') || desc.includes('target')) {
      return 'shopping';
    }
    if (desc.includes('utility') || desc.includes('electric') || desc.includes('water')) {
      return 'utilities';
    }
    if (desc.includes('rent') || desc.includes('mortgage')) {
      return 'housing';
    }
    if (desc.includes('insurance')) {
      return 'insurance';
    }
    if (desc.includes('pharmacy') || desc.includes('medical') || desc.includes('doctor')) {
      return 'healthcare';
    }
    if (desc.includes('transfer') || desc.includes('payment')) {
      return 'transfer';
    }
    if (desc.includes('deposit') || desc.includes('salary') || desc.includes('payroll')) {
      return 'income';
    }
    
    return 'other';
  }

  private async syncAccounts(): Promise<void> {
    console.log('🔄 Syncing accounts from Monarch...');
    
    try {
      const accounts = await this.monarch.getAccounts();
      
      for (const account of accounts) {
        await this.db.run(`
          INSERT OR REPLACE INTO accounts 
          (id, enrollment_id, name, type, subtype, status, currency, balance, available_balance, last_four, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
          account.id,
          null,
          account.name,
          account.type,
          null,
          'active',
          account.currency,
          account.balance,
          account.balance,
          null,
        ]);
      }
      
      console.log(`✅ Synced ${accounts.length} accounts`);
    } catch (error) {
      console.error('❌ Failed to sync accounts:', error);
      throw error;
    }
  }

  private async syncTransactions(): Promise<void> {
    console.log('🔄 Syncing transactions from Monarch...');
    
    try {
      const transactions = await this.monarch.getAllTransactions();
      let syncedCount = 0;
      
      for (const transaction of transactions) {
        const category = transaction.category || 
                       this.categorizeTransaction(transaction.description);
        
        await this.db.run(`
          INSERT OR IGNORE INTO transactions 
          (id, account_id, amount, date, description, category, processing_status, running_balance, status, type)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          transaction.id,
          transaction.account.id,
          transaction.amount,
          transaction.date,
          transaction.description,
          category,
          'posted',
          null,
          'posted',
          transaction.amount > 0 ? 'credit' : 'debit',
        ]);
        
        syncedCount++;
      }
      
      console.log(`✅ Synced ${syncedCount} transactions`);
    } catch (error) {
      console.error('❌ Failed to sync transactions:', error);
      throw error;
    }
  }

  public async fullSync(): Promise<void> {
    console.log('🚀 Starting Monarch Money sync...');
    const startTime = Date.now();
    
    try {
      await this.syncAccounts();
      await this.syncTransactions();
      
      const duration = (Date.now() - startTime) / 1000;
      console.log(`🎉 Monarch sync completed successfully in ${duration.toFixed(2)}s`);
    } catch (error) {
      console.error('❌ Monarch sync failed:', error);
      throw error;
    }
  }

  public close(): void {
    this.db.close();
  }
}

// CLI usage
async function main() {
  try {
    const sync = new FinanceMonarchSync();
    
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down...');
      sync.close();
      process.exit(0);
    });

    await sync.fullSync();
    sync.close();
  } catch (error) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { MonarchAPI, FinanceMonarchSync }; 