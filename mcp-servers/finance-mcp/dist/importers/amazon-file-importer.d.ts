import { AmazonDatabaseManager } from './amazon-database-manager.js';
import { TransactionType } from './amazon-constants.js';
export declare class AmazonFileImporter {
    private dbManager;
    private parser;
    constructor(dbManager: AmazonDatabaseManager);
    importFile(filePath: string, transactionType: TransactionType): Promise<{
        processed: number;
        imported: number;
    }>;
    importDigitalOrders(dataPath: string): Promise<{
        processed: number;
        imported: number;
    }>;
    importSingleFileType(dataPath: string, relativeFilePath: string, transactionType: TransactionType): Promise<{
        processed: number;
        imported: number;
    }>;
    private getIconForTransactionType;
    private getDisplayNameForTransactionType;
}
//# sourceMappingURL=amazon-file-importer.d.ts.map