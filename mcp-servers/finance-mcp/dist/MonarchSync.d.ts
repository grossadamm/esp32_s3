interface MonarchAccount {
    id: string;
    name: string;
    type: string;
    balance: number;
    currency: string;
}
interface MonarchTransaction {
    id: string;
    amount: number;
    date: string;
    description: string;
    category?: string;
    account: {
        id: string;
        name: string;
    };
}
declare class MonarchAPI {
    private token;
    constructor();
    private getValidToken;
    private graphqlRequest;
    getAccounts(): Promise<MonarchAccount[]>;
    getTransactions(limit?: number, offset?: number): Promise<MonarchTransaction[]>;
    getAllTransactions(): Promise<MonarchTransaction[]>;
}
declare class FinanceMonarchSync {
    private db;
    private monarch;
    constructor();
    private initializeDatabase;
    private categorizeTransaction;
    private syncAccounts;
    private syncTransactions;
    fullSync(): Promise<void>;
    close(): void;
}
export { MonarchAPI, FinanceMonarchSync };
//# sourceMappingURL=MonarchSync.d.ts.map