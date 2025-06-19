import { createServer, IncomingMessage, ServerResponse } from 'http';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import { HouseAffordabilityCalculator } from './analysis/house-affordability-calculator';
import { TaxAwareRetirementCalculator } from './analysis/retirement-calculator';

interface DatabaseRow {
    [key: string]: any;
}

class DatabaseWrapper {
    private db: sqlite3.Database;
    public all: (sql: string, params?: any[]) => Promise<DatabaseRow[]>;
    public get: (sql: string, params?: any[]) => Promise<DatabaseRow | undefined>;

    constructor(filename: string, mode?: number) {
        const dbMode = mode || (sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE);
        this.db = new sqlite3.Database(filename, dbMode);
        this.all = promisify(this.db.all.bind(this.db));
        this.get = promisify(this.db.get.bind(this.db));
    }

    close(): void {
        this.db.close();
    }
}

class FinanceHTTPServer {
    private db: DatabaseWrapper;
    private server: any;

    constructor() {
        // Fix path for running from finance-mcp directory  
        const dbPath = path.join(process.cwd(), '..', '..', 'data', 'finance.db');
        console.log(`Connecting to database at: ${dbPath}`);
        this.db = new DatabaseWrapper(dbPath, sqlite3.OPEN_READONLY);
        this.server = createServer(this.handleRequest.bind(this));
    }

    async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        
        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        res.setHeader('Content-Type', 'application/json');

        try {
            const url = new URL(req.url || '', 'http://localhost');
            const pathname = url.pathname;

            let result;

            switch (pathname) {
                case '/api/query':
                    if (req.method === 'POST') {
                        const body = await this.getRequestBody(req);
                        const data = JSON.parse(body);
                        result = await this.executeQuery(data.query, data.params || []);
                    } else {
                        throw new Error('Method not allowed');
                    }
                    break;
                case '/api/schema':
                    result = await this.getSchema();
                    break;
                case '/api/accounts':
                    result = await this.getAccountBalances();
                    break;
                case '/api/spending':
                    const months = parseInt(url.searchParams.get('months') || '1');
                    result = await this.getMonthlySpending(months);
                    break;
                case '/api/transactions':
                    const days = parseInt(url.searchParams.get('days') || '7');
                    const limit = parseInt(url.searchParams.get('limit') || '20');
                    result = await this.getRecentTransactions(days, limit);
                    break;
                case '/api/large-expenses':
                    const threshold = parseInt(url.searchParams.get('threshold') || '100');
                    const expenseDays = parseInt(url.searchParams.get('days') || '30');
                    result = await this.getLargeExpenses(threshold, expenseDays);
                    break;
                case '/api/cash-flow':
                    const flowDays = parseInt(url.searchParams.get('days') || '30');
                    result = await this.getCashFlow(flowDays);
                    break;
                case '/api/options':
                    result = await this.getOptions();
                    break;
                case '/api/retirement':
                    result = await this.getRetirementAnalysis();
                    break;
                case '/api/house-affordability':
                    if (req.method === 'GET') {
                        const calculator = new HouseAffordabilityCalculator();
                        result = await calculator.calculateAffordability();
                    } else {
                        throw new Error('Method not allowed');
                    }
                    break;
                case '/health':
                    result = { status: 'ok', service: 'finance-http-server' };
                    break;
                default:
                    res.statusCode = 404;
                    result = { error: 'Not found' };
            }

            res.end(JSON.stringify(result, null, 2));
        } catch (error) {
            console.error('Finance server error:', error);
            res.statusCode = 500;
            res.end(JSON.stringify({ 
                error: error instanceof Error ? error.message : 'Unknown error' 
            }));
        }
    }

    async getRequestBody(req: IncomingMessage): Promise<string> {
        return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', (chunk: Buffer) => {
                body += chunk.toString();
            });
            req.on('end', () => {
                resolve(body);
            });
            req.on('error', reject);
        });
    }

    async executeQuery(query: string, params: any[] = []): Promise<any> {
        console.log('Executing query:', query);
        
        // Safety check: only allow SELECT statements
        if (!query.trim().toLowerCase().startsWith('select')) {
            throw new Error('Only SELECT queries are allowed for safety');
        }

        const results = await this.db.all(query, params);
        console.log(`Query returned ${results.length} rows`);
        
        return {
            query: query,
            row_count: results.length,
            results: results,
        };
    }

    async getSchema() {
        const tables = await this.db.all(`
            SELECT name, sql 
            FROM sqlite_master 
            WHERE type='table' AND name NOT LIKE 'sqlite_%'
            ORDER BY name
        `);

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
        };
    }

    async getAccountBalances(): Promise<any> {
        const rows = await this.db.all('SELECT name, type, balance FROM accounts WHERE balance IS NOT NULL');
        
        const accounts: { [key: string]: any } = {};
        let total = 0;

        for (const row of rows) {
            accounts[row.name] = {
                name: row.name,
                type: row.type,
                balance: row.balance,
            };
            total += row.balance;
        }

        return { accounts, total };
    }

    async getMonthlySpending(months: number): Promise<any> {
        const daysBack = months * 30;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysBack);

        const rows = await this.db.all(
            `SELECT category, SUM(ABS(amount)) as total
             FROM transactions 
             WHERE date >= ? AND amount < 0
             GROUP BY category
             ORDER BY total DESC`,
            [cutoffDate.toISOString().split('T')[0]]
        );

        const spending: { [key: string]: any } = {};
        for (const row of rows) {
            spending[row.category || 'uncategorized'] = row.total;
        }

        return spending;
    }

    async getRecentTransactions(days: number, limit: number): Promise<any> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        const rows = await this.db.all(
            `SELECT date, description, amount, category
             FROM transactions 
             WHERE date >= ?
             ORDER BY date DESC
             LIMIT ?`,
            [cutoffDate.toISOString().split('T')[0], limit]
        );

        return rows.map(row => ({
            date: row.date,
            description: row.description,
            amount: row.amount,
            category: row.category || 'uncategorized',
        }));
    }

    async getLargeExpenses(threshold: number, days: number): Promise<any> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        const rows = await this.db.all(
            `SELECT date, description, amount, category
             FROM transactions 
             WHERE date >= ? AND amount < ? AND amount < 0
             ORDER BY amount ASC`,
            [cutoffDate.toISOString().split('T')[0], -threshold]
        );

        return rows.map(row => ({
            date: row.date,
            description: row.description,
            amount: Math.abs(row.amount),
            category: row.category || 'uncategorized',
        }));
    }

    async getCashFlow(days: number): Promise<any> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        const cutoff = cutoffDate.toISOString().split('T')[0];

        const incomeRow = await this.db.get(
            'SELECT SUM(amount) as total FROM transactions WHERE date >= ? AND amount > 0',
            [cutoff]
        );

        const expenseRow = await this.db.get(
            'SELECT SUM(amount) as total FROM transactions WHERE date >= ? AND amount < 0',
            [cutoff]
        );

        const income = incomeRow?.total || 0;
        const expenses = expenseRow?.total || 0;

        return {
            income,
            expenses: Math.abs(expenses),
            net: income + expenses,
            period_days: days,
        };
    }

    async getOptions() {
        // Get all stock options
        const options = await this.db.all(`
            SELECT grant_number, symbol, grant_date, expiration_date, 
                   exercise_price, quantity, current_value, intrinsic_value, exercise_cost
            FROM stock_options 
            ORDER BY expiration_date ASC
        `);

        // Calculate summary statistics
        const summary = await this.db.get(`
            SELECT 
                COUNT(*) as total_grants,
                SUM(current_value) as total_value,
                SUM(exercise_cost) as total_exercise_cost,
                SUM(intrinsic_value) as total_intrinsic_value
            FROM stock_options
        `);

        // Get options expiring within 2 years
        const expiringSoon = await this.db.all(`
            SELECT grant_number, grant_date, expiration_date, current_value, exercise_cost
            FROM stock_options 
            WHERE expiration_date <= date('now', '+2 years')
            ORDER BY expiration_date ASC
        `);

        // Get options by year for analysis
        const byYear = await this.db.all(`
            SELECT 
                substr(grant_date, 1, 4) as year,
                COUNT(*) as grant_count,
                SUM(current_value) as year_value,
                SUM(exercise_cost) as year_exercise_cost
            FROM stock_options 
            GROUP BY substr(grant_date, 1, 4)
            ORDER BY year
        `);

        return {
            summary: {
                total_grants: summary?.total_grants || 0,
                total_value: summary?.total_value || 0,
                total_exercise_cost: summary?.total_exercise_cost || 0,
                total_intrinsic_value: summary?.total_intrinsic_value || 0,
                net_value: (summary?.total_value || 0) - (summary?.total_exercise_cost || 0)
            },
            expiring_soon: {
                count: expiringSoon.length,
                grants: expiringSoon
            },
            by_year: byYear,
            all_grants: options
        };
    }

    async getRetirementAnalysis() {
        const calculator = new TaxAwareRetirementCalculator();
        try {
            const analysis = await calculator.calculateRetirement();
            return analysis;
        } finally {
            calculator.close();
        }
    }

    start(port = 3000) {
        this.server.listen(port, () => {
            console.log(`🚀 Finance HTTP API server running on http://localhost:${port}`);
            console.log('Available endpoints:');
            console.log('  POST /api/query - Execute database queries');
            console.log('  GET /api/schema - Get database schema');
            console.log('  GET /api/accounts - Account balances');
            console.log('  GET /api/spending?months=1 - Monthly spending by category');
            console.log('  GET /api/transactions?days=7&limit=20 - Recent transactions');
            console.log('  GET /api/large-expenses?threshold=100&days=30 - Large expenses');
            console.log('  GET /api/cash-flow?days=30 - Income vs expenses');
            console.log('  GET /api/options - Stock options portfolio');
            console.log('  GET /api/retirement - Tax-aware retirement analysis');
            console.log('  GET /api/house-affordability - Comprehensive house affordability analysis');
            console.log('  GET /health - Health check');
        });
    }

    close() {
        this.db.close();
        this.server.close();
    }
}

const server = new FinanceHTTPServer();

process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down Finance HTTP server...');
    server.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down Finance HTTP server...');
    server.close();
    process.exit(0);
});

server.start(parseInt(process.env.PORT || '3000'));
