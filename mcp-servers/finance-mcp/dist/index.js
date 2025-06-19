#!/usr/bin/env node
// Finance MCP Server - Placeholder
// TODO: Extract finance functionality from voice-agent/src/services/MCPClient.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import { FinanceMonarchSync } from './MonarchSync.js';
import dotenv from 'dotenv';
import path from 'path';
// Load environment variables
dotenv.config();
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
// Shared service class for business logic
class FinanceService {
    db;
    API_KEY = 'H7NU47N5NIPL94NY'; // Alpha Vantage API key
    constructor() {
        // Update database path for monorepo structure
        const dbPath = path.join(process.cwd(), '..', '..', 'data', 'finance.db');
        this.db = new DatabaseWrapper(dbPath);
    }
    async queryDatabase(query, params = []) {
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
    async describeSchema(tableName) {
        if (tableName) {
            // Describe specific table
            const schema = await this.db.all(`PRAGMA table_info(${tableName})`);
            const sampleRows = await this.db.all(`SELECT * FROM ${tableName} LIMIT 3`);
            return {
                table: tableName,
                schema: schema,
                sample_data: sampleRows,
            };
        }
        else {
            // List all tables
            const tables = await this.db.all(`
        SELECT name, sql 
        FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `);
            // Get row counts for each table
            const tableInfo = [];
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
                ],
            };
        }
    }
    async importStockData(symbol, startDate = '2007-01-01', outputsize = 'full') {
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
    async syncMonarchData(token) {
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
        }
        finally {
            // Restore original token
            if (originalToken !== undefined) {
                process.env.MONARCH_TOKEN = originalToken;
            }
        }
    }
    async ensureStockPricesTable() {
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
    async fetchStockData(symbol, outputsize) {
        const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=${outputsize}&apikey=${this.API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();
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
        const stockData = [];
        for (const [date, values] of Object.entries(timeSeries)) {
            const dayData = values;
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
    async importStockDataToDb(symbol, stockData) {
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
            }
            catch (error) {
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
    server;
    service;
    constructor(service) {
        this.service = service;
        this.server = new Server({
            name: 'finance-analysis-server',
            version: '0.1.0',
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.setupToolHandlers();
    }
    setupToolHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: 'query_finance_database',
                        description: 'Execute SQL queries on the finance database. Can query transactions, accounts, stock_options, stock_prices, and sp500_prices tables.',
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
                ],
            };
        });
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            switch (request.params.name) {
                case 'query_finance_database':
                    return this.handleDatabaseQuery(request.params.arguments);
                case 'describe_database_schema':
                    return this.handleSchemaDescription(request.params.arguments);
                case 'import_stock_data':
                    return this.handleStockDataImport(request.params.arguments);
                case 'sync_monarch_data':
                    return this.handleMonarchDataSync(request.params.arguments);
                default:
                    throw new Error(`Unknown tool: ${request.params.name}`);
            }
        });
    }
    async handleDatabaseQuery(args) {
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
        }
        catch (error) {
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
    async handleSchemaDescription(args) {
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
        }
        catch (error) {
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
    async handleStockDataImport(args) {
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
        }
        catch (error) {
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
    async handleMonarchDataSync(args) {
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
        }
        catch (error) {
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
//# sourceMappingURL=index.js.map