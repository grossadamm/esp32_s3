import axios from 'axios';
export class MCPClient {
    baseUrl;
    constructor() {
        this.baseUrl = process.env.FINANCE_MCP_URL || 'http://localhost:3003';
    }
    async getAvailableTools() {
        try {
            // Return tools that match the actual finance HTTP server capabilities
            return [
                {
                    name: 'query_finance_database',
                    description: 'Execute SQL queries on the finance database. Can query transactions, accounts, stock_options, stock_prices, and sp500_prices tables.',
                    input_schema: {
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
                    input_schema: {
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
                    name: 'get_stock_options',
                    description: 'Get comprehensive stock options portfolio analysis including expiring grants and total value',
                    input_schema: {
                        type: 'object',
                        properties: {},
                        required: [],
                    },
                },
                {
                    name: 'get_account_balances',
                    description: 'Get all account balances and total net worth',
                    input_schema: {
                        type: 'object',
                        properties: {},
                        required: [],
                    },
                },
                {
                    name: 'get_monthly_spending',
                    description: 'Get spending breakdown by category for specified time period',
                    input_schema: {
                        type: 'object',
                        properties: {
                            months: {
                                type: 'number',
                                description: 'Number of months to analyze (default: 1)',
                                default: 1
                            }
                        },
                        required: [],
                    },
                },
                {
                    name: 'get_recent_transactions',
                    description: 'Get recent transactions with optional filters',
                    input_schema: {
                        type: 'object',
                        properties: {
                            days: {
                                type: 'number',
                                description: 'Number of days to look back (default: 7)',
                                default: 7
                            },
                            limit: {
                                type: 'number',
                                description: 'Maximum number of transactions to return (default: 20)',
                                default: 20
                            }
                        },
                        required: [],
                    },
                }
            ];
        }
        catch (error) {
            console.error('Failed to get tools from finance server:', error);
            throw error;
        }
    }
    async executeTool(name, params = {}) {
        try {
            switch (name) {
                case 'query_finance_database':
                    const queryResponse = await axios.post(`${this.baseUrl}/api/query`, {
                        query: params.query,
                        params: params.params || []
                    });
                    return queryResponse.data;
                case 'describe_database_schema':
                    const schemaUrl = params.table_name
                        ? `${this.baseUrl}/api/schema/${params.table_name}`
                        : `${this.baseUrl}/api/schema`;
                    const schemaResponse = await axios.get(schemaUrl);
                    return schemaResponse.data;
                case 'get_account_balances':
                    const accountsResponse = await axios.get(`${this.baseUrl}/api/accounts`);
                    return accountsResponse.data;
                case 'get_monthly_spending':
                    const spendingResponse = await axios.get(`${this.baseUrl}/api/spending`, {
                        params: { months: params.months || 1 }
                    });
                    return spendingResponse.data;
                case 'get_recent_transactions':
                    const transactionsResponse = await axios.get(`${this.baseUrl}/api/transactions`, {
                        params: {
                            days: params.days || 7,
                            limit: params.limit || 20
                        }
                    });
                    return transactionsResponse.data;
                case 'get_stock_options':
                    const optionsResponse = await axios.get(`${this.baseUrl}/api/options`);
                    return optionsResponse.data;
                default:
                    throw new Error(`Unknown tool: ${name}`);
            }
        }
        catch (error) {
            console.error(`Failed to execute tool ${name}:`, error);
            throw error;
        }
    }
    async close() {
        // Nothing to clean up for HTTP client
    }
}
//# sourceMappingURL=MCPClient.js.map