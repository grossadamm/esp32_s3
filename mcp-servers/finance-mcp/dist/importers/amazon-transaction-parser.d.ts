import { AmazonTransaction } from './amazon-database-manager.js';
import { TransactionType } from './amazon-constants.js';
export declare class AmazonTransactionParser {
    parseRow(row: any, transactionType: TransactionType, orderDateLookup?: Map<string, string>): AmazonTransaction | null;
    private parseOrderRow;
    private parseReturnRow;
    parseRentalRow(row: any): AmazonTransaction;
    parseRefundRow(row: any): AmazonTransaction;
    parseDigitalMonetaryRow(monetary: any, order?: any): AmazonTransaction;
    private parseDigitalRefundRow;
    private parseConcessionRow;
}
//# sourceMappingURL=amazon-transaction-parser.d.ts.map