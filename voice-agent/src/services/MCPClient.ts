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
      // Since the finance server doesn't have a /tools endpoint,
      // we'll return a predefined list of available tools based on
      // the actual API endpoints the server provides
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
        
        case 'house_affordability_analysis':
          // For now, we'll simulate this with a database query
          // In the future, this could be a dedicated endpoint
          const affordabilityQuery = `
            SELECT 
              (SELECT SUM(balance) FROM accounts WHERE type = 'checking' OR type = 'savings') as liquid_assets,
              (SELECT SUM(balance) FROM accounts) as total_net_worth,
              (SELECT SUM(current_value) FROM stock_options) as stock_options_value,
              (SELECT SUM(amount) FROM transactions WHERE amount > 0 AND date >= date('now', '-30 days')) as monthly_income
          `;
          const affordabilityResponse = await axios.post(`${this.baseUrl}/api/query`, {
            query: affordabilityQuery
          });
          return {
            analysis_type: 'house_affordability',
            data: affordabilityResponse.data
          };
        
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      console.error(`Failed to execute tool ${name}:`, error);
      throw error;
    }
  }
} 