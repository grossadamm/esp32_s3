export declare class SimpleAmazonImporter {
    private dbManager;
    private fileImporter;
    constructor(dbPath?: string);
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
            concessions: {
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
    getAmazonSpendingSummary(monthsBack?: number): Promise<{
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
    clearTables(): Promise<void>;
    close(): void;
}
//# sourceMappingURL=amazon-import.d.ts.map