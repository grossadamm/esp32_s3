export interface AmazonTransaction {
    transaction_id: string;
    transaction_type: string;
    date: string;
    status: string;
    product_name: string;
    amount: number;
    details: string;
}
export declare class AmazonDatabaseManager {
    private db;
    constructor(dbPath?: string);
    ensureTables(): Promise<void>;
    insertTransaction(transaction: AmazonTransaction): Promise<boolean>;
    logImport(fileName: string, processed: number, imported: number): Promise<void>;
    listTransactions(transactionType?: string, daysBack?: number, statusFilter?: string): Promise<{
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
    getMonthlySpendingSummary(monthsBack?: number): Promise<{
        monthly_summaries: Array<{
            month: string;
            total_spending: number;
            total_refunds: number;
            net_spending: number;
            transaction_counts: {
                orders: number;
                returns: number;
                refunds: number;
                digital_purchases: number;
                digital_refunds: number;
                rentals: number;
                concessions: number;
                total: number;
            };
        }>;
        overall_summary: {
            total_months: number;
            total_spending: number;
            total_refunds: number;
            net_spending: number;
            average_monthly_spending: number;
            date_range: {
                earliest: string;
                latest: string;
            } | null;
        };
    }>;
    queryOrders(): Promise<Array<{
        transaction_id: string;
        date: string;
    }>>;
    clearTables(): Promise<void>;
    close(): void;
}
//# sourceMappingURL=amazon-database-manager.d.ts.map