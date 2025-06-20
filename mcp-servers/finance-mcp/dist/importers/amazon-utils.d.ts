/**
 * Utility functions for Amazon CSV parsing
 */
export declare class AmazonParsingUtils {
    /**
     * Find CSV field key handling BOM characters and case variations
     */
    static findDynamicKey(row: any, patterns: string[]): string;
    /**
     * Parse Amazon date formats with fallback handling
     */
    static parseDate(dateStr: string): string | null;
    /**
     * Parse Amazon amount formats with complex quote/currency handling
     */
    static parseAmount(amountStr: string): number;
    /**
     * Get safe field value with fallback
     */
    static getSafeValue(row: any, fieldName: string, fallback?: string): string;
    /**
     * Create unique transaction ID with collision avoidance
     */
    static createUniqueTransactionId(baseId: string, additionalId?: string, timestamp?: boolean): string;
    /**
     * Generate current date string for records without dates
     */
    static getCurrentDateString(): string;
    /**
     * Validate required fields are present
     */
    static validateRequiredFields(row: any, requiredFields: string[]): string[];
    /**
     * Create JSON details object safely
     */
    static createDetailsJson(data: Record<string, any>): string;
    /**
     * Log parsing error with context
     */
    static logParsingError(transactionType: string, row: any, error: Error, rowIndex?: number): void;
}
//# sourceMappingURL=amazon-utils.d.ts.map