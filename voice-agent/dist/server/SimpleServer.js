import { createServer } from 'http';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
class DatabaseWrapper {
    db;
    all;
    get;
    constructor(filename) {
        this.db = new sqlite3.Database(filename);
        this.all = promisify(this.db.all.bind(this.db));
        this.get = promisify(this.db.get.bind(this.db));
    }
    close() {
        this.db.close();
    }
}
export class FinanceHTTPServer {
    db;
    server;
    constructor() {
        // Update database path for monorepo structure
        const dbPath = path.join(process.cwd(), 'data', 'finance.db');
        this.db = new DatabaseWrapper(dbPath);
        this.server = createServer(this.handleRequest.bind(this));
    }
    async handleRequest(req, res) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        // Handle preflight requests
        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }
        res.setHeader('Content-Type', 'application/json');
        try {
            const url = new URL(req.url || '', 'http://localhost');
            const path = url.pathname;
            let result;
            switch (path) {
                case '/api/query':
                    if (req.method === 'POST') {
                        const body = await this.getRequestBody(req);
                        const data = JSON.parse(body);
                        result = await this.executeQuery(data.query, data.params || []);
                    }
                    else {
                        throw new Error('Method not allowed');
                    }
                    break;
                case '/api/schema':
                    result = await this.getSchema();
                    break;
                case '/health':
                    result = { status: 'ok', service: 'finance-http-server' };
                    break;
                default:
                    res.statusCode = 404;
                    result = { error: 'Not found' };
            }
            res.end(JSON.stringify(result, null, 2));
        }
        catch (error) {
            res.statusCode = 500;
            res.end(JSON.stringify({
                error: error instanceof Error ? error.message : 'Unknown error'
            }));
        }
    }
    async getRequestBody(req) {
        return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                resolve(body);
            });
            req.on('error', reject);
        });
    }
    async executeQuery(query, params = []) {
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
    async getSchema() {
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
    start(port = 3000) {
        this.server.listen(port, () => {
            console.log(`🚀 Finance HTTP API server running on http://localhost:${port}`);
            console.log('Available endpoints:');
            console.log('  POST /api/query - Execute database queries');
            console.log('  GET /api/schema - Get database schema');
            console.log('  GET /health - Health check');
        });
    }
    close() {
        this.db.close();
        this.server.close();
    }
}
//# sourceMappingURL=SimpleServer.js.map