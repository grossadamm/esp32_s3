import axios from 'axios';

interface Tool {
  name: string;
  description: string;
  input_schema: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
}

export class MCPClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.FINANCE_MCP_URL || 'http://localhost:3000';
  }

  async getAvailableTools(): Promise<Tool[]> {
    try {
      return [
        {
          name: 'query_finance_database',
          description: 'Execute SQL queries on the finance database to get account balances, transactions, spending analysis, etc.',
          input_schema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'SQL query to execute'
              },
              params: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional parameters for parameterized queries'
              }
            },
            required: ['query']
          }
        },
        {
          name: 'get_database_schema',
          description: 'Get information about available database tables and their structure',
          input_schema: {
            type: 'object',
            properties: {
              table_name: {
                type: 'string',
                description: 'Optional: specific table name to describe'
              }
            }
          }
        },
        {
          name: 'get_account_balances',
          description: 'Get all account balances and total net worth',
          input_schema: {
            type: 'object',
            properties: {}
          }
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
            }
          }
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
            }
          }
        },
        {
          name: 'get_large_expenses',
          description: 'Get large expenses above a threshold for analysis',
          input_schema: {
            type: 'object',
            properties: {
              threshold: {
                type: 'number',
                description: 'Minimum expense amount to include (default: 100)',
                default: 100
              },
              days: {
                type: 'number',
                description: 'Number of days to look back (default: 30)',
                default: 30
              }
            }
          }
        },
        {
          name: 'get_cash_flow',
          description: 'Get income vs expenses analysis for specified period',
          input_schema: {
            type: 'object',
            properties: {
              days: {
                type: 'number',
                description: 'Number of days to analyze (default: 30)',
                default: 30
              }
            }
          }
        },
        {
          name: 'get_stock_options',
          description: 'Get comprehensive stock options portfolio analysis including expiring grants',
          input_schema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'get_retirement_analysis',
          description: 'Get comprehensive tax-aware retirement analysis including scenarios and recommendations',
          input_schema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'house_affordability_analysis',
          description: 'Get comprehensive house affordability analysis based on current financial situation',
          input_schema: {
            type: 'object',
            properties: {}
          }
        }
      ];
    } catch (error) {
      console.error('Failed to get tools from finance server:', error);
      throw error;
    }
  }

  async executeTool(name: string, params: any = {}): Promise<any> {
    try {
      switch (name) {
        case 'query_finance_database':
          const queryResponse = await axios.post(`${this.baseUrl}/api/query`, {
            query: params.query,
            params: params.params || []
          });
          return queryResponse.data;
        
        case 'get_database_schema':
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
        
        case 'get_large_expenses':
          const expensesResponse = await axios.get(`${this.baseUrl}/api/large-expenses`, {
            params: { 
              threshold: params.threshold || 100,
              days: params.days || 30
            }
          });
          return expensesResponse.data;
        
        case 'get_cash_flow':
          const cashFlowResponse = await axios.get(`${this.baseUrl}/api/cash-flow`, {
            params: { days: params.days || 30 }
          });
          return cashFlowResponse.data;
        
        case 'get_stock_options':
          const optionsResponse = await axios.get(`${this.baseUrl}/api/options`);
          return optionsResponse.data;
        
        case 'get_retirement_analysis':
          const retirementResponse = await axios.get(`${this.baseUrl}/api/retirement`);
          return retirementResponse.data;
        
        case 'house_affordability_analysis':
          const affordabilityResponse = await axios.get(`${this.baseUrl}/api/house-affordability`);
          return affordabilityResponse.data;
        
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      console.error(`Failed to execute tool ${name}:`, error);
      throw error;
    }
  }
} 