import { SPECIAL_VALUES, FALLBACK_VALUES } from './amazon-constants.js';

/**
 * Utility functions for Amazon CSV parsing
 */
export class AmazonParsingUtils {
  
  /**
   * Find CSV field key handling BOM characters and case variations
   */
  static findDynamicKey(row: any, patterns: string[]): string {
    const keys = Object.keys(row);
    
    for (const pattern of patterns) {
      // Try exact match first
      if (keys.includes(pattern)) {
        return pattern;
      }
      
      // Try partial match (handles BOM characters)
      const foundKey = keys.find(key => 
        key.includes(pattern) || 
        key.endsWith(pattern) ||
        pattern.includes(key.trim())
      );
      
      if (foundKey) {
        return foundKey;
      }
    }
    
    return patterns[0]; // Fallback to first pattern
  }

  /**
   * Parse Amazon date formats with fallback handling
   */
  static parseDate(dateStr: string): string | null {
    if (!dateStr || 
        dateStr === SPECIAL_VALUES.NOT_AVAILABLE || 
        dateStr === SPECIAL_VALUES.NOT_APPLICABLE) {
      return null;
    }

    try {
      // Handle ISO format: "2025-06-18T01:50:18Z" -> "2025-06-18"
      if (dateStr.includes('T')) {
        return dateStr.split('T')[0];
      }
      
      // Handle other date formats
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        return null;
      }
      
      return date.toISOString().split('T')[0];
    } catch {
      return null;
    }
  }

  /**
   * Parse Amazon amount formats with complex quote/currency handling
   */
  static parseAmount(amountStr: string): number {
    if (!amountStr || 
        amountStr === SPECIAL_VALUES.NOT_AVAILABLE || 
        amountStr === SPECIAL_VALUES.NOT_APPLICABLE || 
        amountStr === '') {
      return 0;
    }

    try {
      // Clean up Amazon's complex amount formats
      // Examples: "14.52", "'14.52'", "'-0.7'", "$14.52"
      let cleaned = amountStr
        .replace(/["']/g, '') // Remove quotes
        .replace(/[$,]/g, '')  // Remove dollar signs and commas
        .trim();

      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    } catch {
      return 0;
    }
  }

  /**
   * Get safe field value with fallback
   */
  static getSafeValue(row: any, fieldName: string, fallback: string = ''): string {
    const value = row[fieldName];
    if (!value || 
        value === SPECIAL_VALUES.NOT_AVAILABLE || 
        value === SPECIAL_VALUES.NOT_APPLICABLE) {
      return fallback;
    }
    return value;
  }

  /**
   * Create unique transaction ID with collision avoidance
   */
  static createUniqueTransactionId(baseId: string, additionalId?: string, timestamp?: boolean): string {
    let transactionId = baseId;
    
    if (additionalId) {
      transactionId += `_${additionalId}`;
    }
    
    if (timestamp) {
      transactionId += `_${Date.now()}`;
    }
    
    return transactionId;
  }

  /**
   * Generate current date string for records without dates
   */
  static getCurrentDateString(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Validate required fields are present
   */
  static validateRequiredFields(row: any, requiredFields: string[]): string[] {
    const missing: string[] = [];
    
    for (const field of requiredFields) {
      const value = row[field];
      if (!value || 
          value === SPECIAL_VALUES.NOT_AVAILABLE || 
          value === SPECIAL_VALUES.NOT_APPLICABLE) {
        missing.push(field);
      }
    }
    
    return missing;
  }

  /**
   * Create JSON details object safely
   */
  static createDetailsJson(data: Record<string, any>): string {
    try {
      // Filter out undefined/null values
      const cleanData = Object.fromEntries(
        Object.entries(data).filter(([_, value]) => value !== undefined && value !== null)
      );
      return JSON.stringify(cleanData);
    } catch {
      return JSON.stringify({});
    }
  }

  /**
   * Log parsing error with context
   */
  static logParsingError(transactionType: string, row: any, error: Error, rowIndex?: number): void {
    const rowInfo = {
      type: transactionType,
      row: rowIndex,
      error: error.message,
      keys: Object.keys(row).slice(0, 5), // First 5 fields for debugging
      sampleData: Object.fromEntries(
        Object.entries(row).slice(0, 3).map(([k, v]) => [k, String(v).slice(0, 50)])
      )
    };
    
    console.error('❌ Parsing error:', rowInfo);
  }
} 