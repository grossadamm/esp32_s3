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
        };
        message: string;
    }>;
    ensureTables(): Promise<void>;
    private importFile;
    private parseRow;
    private parseOrderRow;
    private parseReturnRow;
    private parseRentalRow;
    private parseDate;
    private parseAmount;
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
    close(): void;
}
//# sourceMappingURL=amazon-import.d.ts.map