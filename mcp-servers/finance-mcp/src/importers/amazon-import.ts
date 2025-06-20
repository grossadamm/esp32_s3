import fs from 'fs';
import { AmazonDatabaseManager } from './amazon-database-manager.js';
import { AmazonFileImporter } from './amazon-file-importer.js';
import { 
  FILE_PATHS, 
  TRANSACTION_TYPES, 
  CONSOLE_ICONS
} from './amazon-constants.js';

export class SimpleAmazonImporter {
  private dbManager: AmazonDatabaseManager;
  private fileImporter: AmazonFileImporter;

  constructor(dbPath?: string) {
    this.dbManager = new AmazonDatabaseManager(dbPath);
    this.fileImporter = new AmazonFileImporter(this.dbManager);
  }

  async importAmazonData(dataPath: string = '~/Downloads/Your Orders'): Promise<{
    success: boolean;
    summary: {
      orders: { processed: number; imported: number };
      returns: { processed: number; imported: number };
      rentals: { processed: number; imported: number };
      refunds: { processed: number; imported: number };
      digital_orders: { processed: number; imported: number };
      digital_refunds: { processed: number; imported: number };
      concessions: { processed: number; imported: number };
    };
    message: string;
  }> {
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
  async listAmazonTransactions(
    transactionType: string = 'all',
    daysBack: number = 7,
    statusFilter?: string
  ): Promise<{
    transactions: any[];
    summary: {
      count: number;
      total_amount: number;
      date_range: { earliest: string; latest: string } | null;
    };
  }> {
    // Validate days_back limit
    if (daysBack > 35) {
      throw new Error(`days_back cannot exceed 35 days (requested: ${daysBack}). Use get_amazon_spending_summary for broader analysis.`);
    }
    if (daysBack < 1) {
      throw new Error(`days_back must be at least 1 day (requested: ${daysBack})`);
    }

    // Ensure tables exist before querying
    await this.dbManager.ensureTables();
    return await this.dbManager.listTransactions(transactionType, daysBack, statusFilter);
  }

  // Delegate to database manager for monthly spending summary
  async getAmazonSpendingSummary(monthsBack: number = 12): Promise<{
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
      date_range: { earliest: string; latest: string } | null;
    };
  }> {
    // Ensure tables exist before querying
    await this.dbManager.ensureTables();
    return await this.dbManager.getMonthlySpendingSummary(monthsBack);
  }

  // Delegate to database manager for clearing tables
  async clearTables(): Promise<void> {
    await this.dbManager.clearTables();
  }

  // Delegate to database manager for closing connection
  close(): void {
    this.dbManager.close();
  }
} 