const { createServer } = require('http');
const sqlite3 = require('sqlite3').verbose();
const { promisify } = require('util');
const path = require('path');

class DatabaseWrapper {
    constructor(filename) {
        this.db = new sqlite3.Database(filename);
        this.all = promisify(this.db.all.bind(this.db));
        this.get = promisify(this.db.get.bind(this.db));
    }

    close() {
        this.db.close();
    }
}

class FinanceHTTPServer {
    constructor() {
        const dbPath = path.join(process.cwd(), 'data', 'finance.db');
        console.log(`Connecting to database at: ${dbPath}`);
        this.db = new DatabaseWrapper(dbPath);
        this.server = createServer(this.handleRequest.bind(this));
    }

    async handleRequest(req, res) {
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
                error: error.message || 'Unknown error' 
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

server.start(3000);
