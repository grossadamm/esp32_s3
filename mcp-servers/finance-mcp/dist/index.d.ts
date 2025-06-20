#!/usr/bin/env node
interface DatabaseRow {
    [key: string]: any;
}
export declare class FinanceService {
    private db;
    private readonly API_KEY;
    constructor();
    queryDatabase(query: string, params?: any[]): Promise<{
        query: string;
        row_count: number;
        results: DatabaseRow[];
    }>;
    describeSchema(tableName?: string): Promise<{
        table: string;
        schema: DatabaseRow[];
        sample_data: DatabaseRow[];
        database?: undefined;
        tables?: undefined;
        usage_examples?: undefined;
    } | {
        database: string;
        tables: {
            name: string;
            row_count: number;
            create_sql: string;
        }[];
        usage_examples: string[];
        table?: undefined;
        schema?: undefined;
        sample_data?: undefined;
    }>;
    importStockData(symbol: string, startDate?: string, outputsize?: string): Promise<{
        success: boolean;
        symbol: string;
        start_date: string;
        data_points_fetched: number;
        data_points_imported: number;
        data_points_skipped: number;
        date_range: {
            earliest: string;
            latest: string;
        } | null;
        message: string;
    }>;
    syncMonarchData(token?: string): Promise<{
        success: boolean;
        duration_seconds: number;
        accounts_synced: any;
        transactions_synced: any;
        latest_transaction: DatabaseRow | null;
        message: string;
    }>;
    importAmazonData(dataPath?: string): Promise<{
        success: boolean;
        summary: {
            orders: {
                processed: number;
                imported: number;
            };
            returns: {
                processed: number;
                imported: number;
            };
            rentals: {
                processed: number;
                imported: number;
            };
            refunds: {
                processed: number;
                imported: number;
            };
            digital_orders: {
                processed: number;
                imported: number;
            };
            digital_refunds: {
                processed: number;
                imported: number;
            };
        };
        message: string;
    }>;
    listAmazonTransactions(transactionType?: string, daysBack?: number, statusFilter?: string): Promise<{
        transactions: any[];
        summary: {
            count: number;
            total_amount: number;
            date_range: {
                earliest: string;
                latest: string;
            } | null;
        };
    }>;
    private ensureStockPricesTable;
    private fetchStockData;
    private importStockDataToDb;
    close(): void;
}
export {};
//# sourceMappingURL=index.d.ts.map