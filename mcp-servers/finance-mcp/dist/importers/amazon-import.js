import fs from 'fs';
import { AmazonDatabaseManager } from './amazon-database-manager.js';
import { AmazonFileImporter } from './amazon-file-importer.js';
import { FILE_PATHS, TRANSACTION_TYPES, CONSOLE_ICONS } from './amazon-constants.js';
export class SimpleAmazonImporter {
    dbManager;
    fileImporter;
    constructor(dbPath) {
        this.dbManager = new AmazonDatabaseManager(dbPath);
        this.fileImporter = new AmazonFileImporter(this.dbManager);
    }
    async importAmazonData(dataPath = '~/Downloads/Your Orders') {
        console.log(`${CONSOLE_ICONS.SHOPPING} Starting Amazon data import...`);
        // Ensure tables exist
        await this.dbManager.ensureTables();
        // Expand tilde path
        const expandedPath = dataPath.replace(/^~/, process.env.HOME || '');
        if (!fs.existsSync(expandedPath)) {
            throw new Error(`Amazon data directory not found: ${expandedPath}`);
        }
        const summary = {
            orders: { processed: 0, imported: 0 },
            returns: { processed: 0, imported: 0 },
            rentals: { processed: 0, imported: 0 },
            refunds: { processed: 0, imported: 0 },
            digital_orders: { processed: 0, imported: 0 },
            digital_refunds: { processed: 0, imported: 0 },
            concessions: { processed: 0, imported: 0 }
        };
        // Import all file types using the organized structure
        summary.orders = await this.fileImporter.importSingleFileType(expandedPath, FILE_PATHS.ORDERS, TRANSACTION_TYPES.ORDER);
        console.log(`  ${CONSOLE_ICONS.PACKAGE} Orders: ${summary.orders.imported}/${summary.orders.processed} imported`);
        summary.returns = await this.fileImporter.importSingleFileType(expandedPath, FILE_PATHS.RETURNS, TRANSACTION_TYPES.RETURN);
        console.log(`  ${CONSOLE_ICONS.RETURN} Returns: ${summary.returns.imported}/${summary.returns.processed} imported`);
        summary.rentals = await this.fileImporter.importSingleFileType(expandedPath, FILE_PATHS.RENTALS, TRANSACTION_TYPES.RENTAL);
        console.log(`  ${CONSOLE_ICONS.HOUSE} Rentals: ${summary.rentals.imported}/${summary.rentals.processed} imported`);
        summary.refunds = await this.fileImporter.importSingleFileType(expandedPath, FILE_PATHS.REFUNDS, TRANSACTION_TYPES.REFUND);
        console.log(`  ${CONSOLE_ICONS.MONEY} Refunds: ${summary.refunds.imported}/${summary.refunds.processed} imported`);
        summary.digital_orders = await this.fileImporter.importDigitalOrders(expandedPath);
        console.log(`  ${CONSOLE_ICONS.PHONE} Digital Orders: ${summary.digital_orders.imported}/${summary.digital_orders.processed} imported`);
        summary.digital_refunds = await this.fileImporter.importSingleFileType(expandedPath, FILE_PATHS.DIGITAL_REFUNDS, TRANSACTION_TYPES.DIGITAL_REFUND);
        console.log(`  ${CONSOLE_ICONS.CREDIT_CARD} Digital Refunds: ${summary.digital_refunds.imported}/${summary.digital_refunds.processed} imported`);
        summary.concessions = await this.fileImporter.importSingleFileType(expandedPath, FILE_PATHS.CONCESSIONS, TRANSACTION_TYPES.CONCESSION);
        console.log(`  ${CONSOLE_ICONS.GIFT} Concessions: ${summary.concessions.imported}/${summary.concessions.processed} imported`);
        const totalImported = summary.orders.imported + summary.returns.imported + summary.rentals.imported + summary.refunds.imported + summary.digital_orders.imported + summary.digital_refunds.imported + summary.concessions.imported;
        console.log(`${CONSOLE_ICONS.SUCCESS} Amazon import complete! Total imported: ${totalImported} transactions`);
        return {
            success: true,
            summary,
            message: `Successfully imported ${totalImported} Amazon transactions`
        };
    }
    // Delegate to database manager for transaction listing
    async listAmazonTransactions(transactionType = 'all', daysBack = 30, statusFilter) {
        // Ensure tables exist before querying
        await this.dbManager.ensureTables();
        return await this.dbManager.listTransactions(transactionType, daysBack, statusFilter);
    }
    // Delegate to database manager for clearing tables
    async clearTables() {
        await this.dbManager.clearTables();
    }
    // Delegate to database manager for closing connection
    close() {
        this.dbManager.close();
    }
}
//# sourceMappingURL=amazon-import.js.map