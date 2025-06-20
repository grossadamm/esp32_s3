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
    clearTables(): Promise<void>;
    close(): void;
}
//# sourceMappingURL=amazon-database-manager.d.ts.map