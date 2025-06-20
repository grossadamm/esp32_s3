interface AmazonTransaction {
    transaction_id: string;
    transaction_type: string;
    date: string;
    status: string;
    product_name: string;
    amount: number;
    details: string;
}
export declare class SimpleAmazonImporter {
    private db;
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
        };
        message: string;
    }>;
    ensureTables(): Promise<void>;
    private importFile;
    private parseRow;
    private parseOrderRow;
    private parseReturnRow;
    parseRentalRow(row: any): AmazonTransaction;
    parseRefundRow(row: any): AmazonTransaction;
    parseDate(dateStr: string): string | null;
    parseAmount(amountStr: string): number;
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
    importDigitalOrders(dataPath: string): Promise<{
        processed: number;
        imported: number;
    }>;
    importDigitalRefunds(dataPath: string): Promise<{
        processed: number;
        imported: number;
    }>;
    private parseDigitalOrderRow;
    private parseDigitalRefundRow;
    clearTables(): Promise<void>;
    close(): void;
}
export {};
//# sourceMappingURL=amazon-import.d.ts.map