#!/usr/bin/env node

// Finance MCP Server
// Provides financial analysis tools and database access via MCP protocol

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  CallToolRequest,
} from '@modelcontextprotocol/sdk/types.js';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import { MonarchAPI, FinanceMonarchSync } from './MonarchSync.js';
import { SimpleAmazonImporter } from './importers/amazon-import.js';
import { DatabaseWrapper, DatabaseRow } from './utils/DatabaseWrapper.js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

interface StockPriceData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Shared service class for business logic
export class FinanceService {
  private db: DatabaseWrapper;
  private readonly API_KEY = 'H7NU47N5NIPL94NY'; // Alpha Vantage API key

  constructor() {
    // Database path for Docker container (/app/data/finance.db)
    const dbPath = '/app/data/finance.db';
    this.db = new DatabaseWrapper(dbPath);
  }

  async queryDatabase(query: string, params: any[] = []) {
    // Safety check: only allow SELECT statements
    if (!query.trim().toLowerCase().startsWith('select')) {
      throw new Error('Only SELECT queries are allowed for safety');
    }

    const results = await this.db.all(query, params);
    return {
      query: query,
      row_count: results.length,
      results: results,
    };
  }

  async describeSchema(tableName?: string) {
    if (tableName) {
      // Describe specific table
      const schema = await this.db.all(`PRAGMA table_info(${tableName})`);
      const sampleRows = await this.db.all(`SELECT * FROM ${tableName} LIMIT 3`);
      
      return {
        table: tableName,
        schema: schema,
        sample_data: sampleRows,
      };
    } else {
      // List all tables
      const tables = await this.db.all(`
        SELECT name, sql 
        FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `);

      // Get row counts for each table
      const tableInfo: Array<{name: string, row_count: number, create_sql: string}> = [];
      for (const table of tables) {
        const countResult = await this.db.get(`SELECT COUNT(*) as count FROM ${table.name}`);
        tableInfo.push({
          name: table.name,
          row_count: countResult?.count || 0,
          create_sql: table.sql,
        });
      }

      return {
        database: 'finance.db',
        tables: tableInfo,
        usage_examples: [
          "SELECT * FROM accounts WHERE balance > 1000",
          "SELECT * FROM stock_options WHERE expiration_date < '2028-01-01'",
          "SELECT date, close FROM stock_prices WHERE symbol = 'NFLX' ORDER BY date DESC LIMIT 10",
          "SELECT * FROM transactions WHERE category = 'Food' AND date >= '2024-01-01'",
          "SELECT * FROM amazon_transactions WHERE transaction_type = 'order' AND date >= '2024-01-01'",
          "SELECT SUM(amount) as net_amazon_spending FROM amazon_transactions WHERE date >= '2024-01-01'",
        ],
      };
    }
  }

  async importStockData(symbol: string, startDate: string = '2007-01-01', outputsize: string = 'full') {
    if (!symbol) {
      throw new Error('Stock symbol is required');
    }

    const symbolUpper = symbol.toUpperCase();
    
    // First ensure the stock_prices table exists
    await this.ensureStockPricesTable();
    
    // Fetch data from Alpha Vantage
    const stockData = await this.fetchStockData(symbolUpper, outputsize);
    
    // Filter by start_date if provided
    const filteredData = stockData.filter(data => data.date >= startDate);
    
    // Import into database
    const importResult = await this.importStockDataToDb(symbolUpper, filteredData);
    
    return {
      success: true,
      symbol: symbolUpper,
      start_date: startDate,
      data_points_fetched: stockData.length,
      data_points_imported: importResult.imported,
      data_points_skipped: importResult.skipped,
      date_range: filteredData.length > 0 ? {
        earliest: filteredData[0].date,
        latest: filteredData[filteredData.length - 1].date
      } : null,
      message: `Successfully imported ${importResult.imported} data points for ${symbolUpper}`
    };
  }

  async syncMonarchData(token?: string) {
    // Check if token is provided in args, otherwise use environment variable
    const monarchToken = token || process.env.MONARCH_TOKEN;
    
    if (!monarchToken) {
      throw new Error('Monarch token is required. Provide as parameter or set MONARCH_TOKEN environment variable.');
    }
    
    // Temporarily set the token in environment for the sync
    const originalToken = process.env.MONARCH_TOKEN;
    process.env.MONARCH_TOKEN = monarchToken;
    
    try {
      const sync = new FinanceMonarchSync();
      const startTime = Date.now();
      
      await sync.fullSync();
      
      const duration = (Date.now() - startTime) / 1000;
      
      // Get updated statistics
      const accountCount = await this.db.get('SELECT COUNT(*) as count FROM accounts');
      const transactionCount = await this.db.get('SELECT COUNT(*) as count FROM transactions');
      const latestTransaction = await this.db.get('SELECT date, description, amount FROM transactions ORDER BY date DESC LIMIT 1');
      
      sync.close();
      
      return {
        success: true,
        duration_seconds: Number(duration.toFixed(2)),
        accounts_synced: accountCount?.count || 0,
        transactions_synced: transactionCount?.count || 0,
        latest_transaction: latestTransaction || null,
        message: `Successfully synced Monarch Money data in ${duration.toFixed(2)}s`
      };
    } finally {
      // Restore original token
      if (originalToken !== undefined) {
        process.env.MONARCH_TOKEN = originalToken;
      }
    }
  }

  async importAmazonData(dataPath: string = '~/Downloads/Your Orders') {
    const importer = new SimpleAmazonImporter();
    
    try {
      const result = await importer.importAmazonData(dataPath);
      return result;
    } finally {
      importer.close();
    }
  }

  async listAmazonTransactions(
    transactionType: string = 'all',
    daysBack: number = 7,
    statusFilter?: string
  ) {
    // Validate days_back limit at service level
    if (daysBack > 35) {
      throw new Error(`days_back cannot exceed 35 days (requested: ${daysBack}). Use get_amazon_spending_summary for broader analysis.`);
    }
    if (daysBack < 1) {
      throw new Error(`days_back must be at least 1 day (requested: ${daysBack})`);
    }

    const importer = new SimpleAmazonImporter();
    
    try {
      const result = await importer.listAmazonTransactions(transactionType, daysBack, statusFilter);
      return result;
    } finally {
      importer.close();
    }
  }

  async getAmazonSpendingSummary(monthsBack: number = 12) {
    const importer = new SimpleAmazonImporter();
    
    try {
      const result = await importer.getAmazonSpendingSummary(monthsBack);
      return result;
    } finally {
      importer.close();
    }
  }

  private async ensureStockPricesTable(): Promise<void> {
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
  }

  private async fetchStockData(symbol: string, outputsize: string): Promise<StockPriceData[]> {
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=${outputsize}&apikey=${this.API_KEY}`;
    
    const response = await fetch(url);
    const data: any = await response.json();
    
    if (data['Error Message']) {
      throw new Error(`API Error: ${data['Error Message']}`);
    }
    
    if (data['Note']) {
      throw new Error(`API Rate Limit: ${data['Note']}`);
    }
    
    const timeSeries = data['Time Series (Daily)'];
    if (!timeSeries) {
      throw new Error('No time series data found in API response. Check symbol validity.');
    }
    
    const stockData: StockPriceData[] = [];
    
    for (const [date, values] of Object.entries(timeSeries)) {
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
    
    // Sort by date ascending
    stockData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    return stockData;
  }

  private async importStockDataToDb(symbol: string, stockData: StockPriceData[]): Promise<{ imported: number, skipped: number }> {
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
          symbol,
          data.date,
          data.open,
          data.high,
          data.low,
          data.close,
          data.volume
        ]);
        imported++;
      } catch (error) {
        skipped++;
      }
    }
    
    return { imported, skipped };
  }

  close() {
    this.db.close();
  }
}

class FinanceMCPServer {
  private server: Server;
  private service: FinanceService;

  constructor(service: FinanceService) {
    this.service = service;
    this.server = new Server(
      {
        name: 'finance-analysis-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'query_finance_database',
            description: 'Execute SQL queries on the finance database. Can query transactions, accounts, stock_options, stock_prices, sp500_prices, amazon_transactions, and amazon_import_log tables.',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'SQL query to execute (SELECT statements only for safety)',
                },
                params: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Optional parameters for parameterized queries',
                  default: [],
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'describe_database_schema',
            description: 'Get information about available database tables and their schemas',
            inputSchema: {
              type: 'object',
              properties: {
                table_name: {
                  type: 'string',
                  description: 'Optional: specific table name to describe. If omitted, lists all tables.',
                },
              },
              required: [],
            },
          },
          {
            name: 'import_stock_data',
            description: 'Fetch and import historical stock data for any symbol using Alpha Vantage API. Stores data in stock_prices table.',
            inputSchema: {
              type: 'object',
              properties: {
                symbol: {
                  type: 'string',
                  description: 'Stock ticker symbol (e.g., SPY, AAPL, MSFT)',
                },
                start_date: {
                  type: 'string',
                  description: 'Optional: Start date for data import (YYYY-MM-DD). Defaults to 2007-01-01 for full historical data.',
                  default: '2007-01-01',
                },
                outputsize: {
                  type: 'string',
                  description: 'Data size: "compact" (last 100 days) or "full" (20+ years)',
                  enum: ['compact', 'full'],
                  default: 'full',
                },
              },
              required: ['symbol'],
            },
          },
          {
            name: 'sync_monarch_data',
            description: 'Sync the latest data from Monarch Money including accounts and transactions. Uses bearer token from environment or parameter.',
            inputSchema: {
              type: 'object',
              properties: {
                token: {
                  type: 'string',
                  description: 'Optional: Monarch Money bearer token. If not provided, uses MONARCH_TOKEN environment variable.',
                },
              },
              required: [],
            },
          },
          {
            name: 'import_amazon_data',
            description: 'Import all Amazon transaction data (orders, returns, rentals) from CSV files in the Your Orders directory.',
            inputSchema: {
              type: 'object',
              properties: {
                data_path: {
                  type: 'string',
                  description: 'Path to Your Orders directory',
                  default: '~/Downloads/Your Orders',
                },
              },
              required: [],
            },
          },
          {
            name: 'list_amazon_transactions',
            description: 'List recent Amazon transactions by type. IMPORTANT: Always uses small date ranges (7-30 days) to avoid token limits. For broader analysis, use get_amazon_spending_summary tool instead.',
            inputSchema: {
              type: 'object',
              properties: {
                transaction_type: {
                  type: 'string',
                  description: 'Type of transactions to retrieve',
                  enum: ['order', 'return', 'rental', 'refund', 'digital_purchase', 'digital_refund', 'concession', 'all'],
                  default: 'all',
                },
                days_back: {
                  type: 'number',
                  description: 'Number of days back to search (default: 7, maximum: 35 to avoid token limits)',
                  default: 7,
                  minimum: 1,
                  maximum: 35,
                },
                status_filter: {
                  type: 'string',
                  description: 'Optional: filter by status (e.g., "Shipped", "Closed", "Completed")',
                },
              },
              required: [],
            },
          },
          {
            name: 'get_amazon_spending_summary',
            description: 'Get monthly Amazon spending summaries and totals. Use this for questions about total spending, spending trends, or monthly analysis. Much more efficient than list_amazon_transactions for broad queries.',
            inputSchema: {
              type: 'object',
              properties: {
                months_back: {
                  type: 'number',
                  description: 'Number of months back to analyze (default: 12 months)',
                  default: 12,
                  minimum: 1,
                  maximum: 60,
                },
              },
              required: [],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
      switch (request.params.name) {
        case 'query_finance_database':
          return this.handleDatabaseQuery(request.params.arguments);
        case 'describe_database_schema':
          return this.handleSchemaDescription(request.params.arguments);
        case 'import_stock_data':
          return this.handleStockDataImport(request.params.arguments);
        case 'sync_monarch_data':
          return this.handleMonarchDataSync(request.params.arguments);
        case 'import_amazon_data':
          return this.handleAmazonDataImport(request.params.arguments);
        case 'list_amazon_transactions':
          return this.handleListAmazonTransactions(request.params.arguments);
        case 'get_amazon_spending_summary':
          return this.handleGetAmazonSpendingSummary(request.params.arguments);
        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    });
  }

  private async handleDatabaseQuery(args: any) {
    try {
      const { query, params = [] } = args;
      const result = await this.service.queryDatabase(query, params);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error executing query: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleSchemaDescription(args: any) {
    try {
      const { table_name } = args;
      const result = await this.service.describeSchema(table_name);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error describing schema: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleStockDataImport(args: any) {
    try {
      const { symbol, start_date = '2007-01-01', outputsize = 'full' } = args;
      const result = await this.service.importStockData(symbol, start_date, outputsize);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error),
              message: 'Failed to import stock data'
            }, null, 2),
          },
        ],
        isError: true,
      };
    }
  }

  private async handleMonarchDataSync(args: any) {
    try {
      const { token } = args;
      const result = await this.service.syncMonarchData(token);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error),
              message: 'Failed to sync Monarch data'
            }, null, 2),
          },
        ],
        isError: true,
      };
    }
  }

  private async handleAmazonDataImport(args: any) {
    try {
      const { data_path = '~/Downloads/Your Orders' } = args;
      const result = await this.service.importAmazonData(data_path);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error),
              message: 'Failed to import Amazon data'
            }, null, 2),
          },
        ],
        isError: true,
      };
    }
  }

  private async handleListAmazonTransactions(args: any) {
    try {
      const { 
        transaction_type = 'all', 
        days_back = 7, 
        status_filter 
      } = args;
      
      // Validate days_back limit
      if (days_back > 35) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: `days_back cannot exceed 35 days (requested: ${days_back})`,
                message: 'For queries beyond 35 days, use get_amazon_spending_summary tool instead to avoid token limits.',
                suggestion: 'Try using get_amazon_spending_summary for broader analysis'
              }, null, 2),
            },
          ],
          isError: true,
        };
      }

      if (days_back < 1) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: `days_back must be at least 1 day (requested: ${days_back})`,
                message: 'Please specify a valid number of days (1-35)'
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
      
      const result = await this.service.listAmazonTransactions(
        transaction_type,
        days_back,
        status_filter
      );
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error),
              message: 'Failed to list Amazon transactions'
            }, null, 2),
          },
        ],
        isError: true,
      };
    }
  }

  private async handleGetAmazonSpendingSummary(args: any) {
    try {
      const { months_back = 12 } = args;
      
      const result = await this.service.getAmazonSpendingSummary(months_back);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error),
              message: 'Failed to get Amazon spending summary'
            }, null, 2),
          },
        ],
        isError: true,
      };
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Finance MCP server running on stdio');
  }

  async close() {
    this.service.close();
  }
}

// Initialize and run the server
const service = new FinanceService();
const server = new FinanceMCPServer(service);

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.error('Shutting down Finance MCP server...');
  await server.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error('Shutting down Finance MCP server...');
  await server.close();
  process.exit(0);
});

// Start the server
server.run().catch((error) => {
  console.error('Failed to start Finance MCP server:', error);
  process.exit(1);
}); 