import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { AmazonDatabaseManager } from './amazon-database-manager.js';
import { AmazonTransactionParser } from './amazon-transaction-parser.js';
import { AmazonParsingUtils } from './amazon-utils.js';
import { 
  FILE_PATHS, 
  TRANSACTION_TYPES, 
  CONSOLE_ICONS,
  TransactionType 
} from './amazon-constants.js';

export class AmazonFileImporter {
  private dbManager: AmazonDatabaseManager;
  private parser: AmazonTransactionParser;

  constructor(dbManager: AmazonDatabaseManager) {
    this.dbManager = dbManager;
    this.parser = new AmazonTransactionParser();
  }

  async importFile(filePath: string, transactionType: TransactionType): Promise<{ processed: number; imported: number }> {
    console.log(`${CONSOLE_ICONS.FOLDER} Reading ${transactionType} file: ${path.basename(filePath)}`);
    
    const csvContent = fs.readFileSync(filePath, 'utf-8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      escape: '"'
    });

    console.log(`${CONSOLE_ICONS.CHART} Found ${records.length} ${transactionType} records`);

    let processed = 0;
    let imported = 0;

    for (const row of records) {
      processed++;
      
      try {
        const transaction = this.parser.parseRow(row, transactionType);
        if (transaction) {
          const wasInserted = await this.dbManager.insertTransaction(transaction);
          if (wasInserted) {
            imported++;
          } else if (transactionType === TRANSACTION_TYPES.REFUND) {
            console.log(`${CONSOLE_ICONS.WARNING} Refund ${transaction.transaction_id} already exists, skipping`);
          }
        } else if (transactionType === TRANSACTION_TYPES.REFUND) {
          console.log(`${CONSOLE_ICONS.WARNING} Refund row ${processed} failed to parse`);
        }
      } catch (error) {
        AmazonParsingUtils.logParsingError(transactionType, row, error as Error, processed);
      }
    }

    // Log import
    await this.dbManager.logImport(path.basename(filePath), processed, imported);

    return { processed, imported };
  }

  async importDigitalOrders(dataPath: string): Promise<{ processed: number; imported: number }> {
    const ordersPath = path.join(dataPath, FILE_PATHS.DIGITAL_ORDERS);
    const monetaryPath = path.join(dataPath, FILE_PATHS.DIGITAL_MONETARY);
    
    if (!fs.existsSync(ordersPath) || !fs.existsSync(monetaryPath)) {
      console.log(`  ${CONSOLE_ICONS.PHONE} Digital order files not found, skipping`);
      return { processed: 0, imported: 0 };
    }

    console.log(`${CONSOLE_ICONS.FOLDER} Reading digital orders: ${path.basename(ordersPath)} + ${path.basename(monetaryPath)}`);
    
    // Read both files
    const ordersContent = fs.readFileSync(ordersPath, 'utf-8');
    const monetaryContent = fs.readFileSync(monetaryPath, 'utf-8');
    
    const ordersRecords = parse(ordersContent, {
      columns: true, skip_empty_lines: true, trim: true, relax_quotes: true, escape: '"'
    });
    
    const monetaryRecords = parse(monetaryContent, {
      columns: true, skip_empty_lines: true, trim: true, relax_quotes: true, escape: '"'
    });

    // Create lookup for orders by DeliveryPacketId
    const ordersByPacket = new Map<string, any>();
    for (const order of ordersRecords) {
      if (order.DeliveryPacketId) {
        ordersByPacket.set(order.DeliveryPacketId, order);
      }
    }

    let processed = 0;
    let imported = 0;

    // Process monetary records directly (they contain the actual transactions)
    for (const monetary of monetaryRecords) {
      processed++;
      
      try {
        const order = ordersByPacket.get(monetary.DeliveryPacketId);
        const transaction = this.parser.parseDigitalMonetaryRow(monetary, order);
        
        if (transaction) {
          const wasInserted = await this.dbManager.insertTransaction(transaction);
          if (wasInserted) {
            imported++;
          }
        }
      } catch (error) {
        AmazonParsingUtils.logParsingError('digital_monetary', monetary, error as Error, processed);
      }
    }

    console.log(`${CONSOLE_ICONS.CHART} Found ${ordersRecords.length} digital orders with ${monetaryRecords.length} monetary transactions`);
    return { processed, imported };
  }

  async importSingleFileType(dataPath: string, relativeFilePath: string, transactionType: TransactionType): Promise<{ processed: number; imported: number }> {
    const fullPath = path.join(dataPath, relativeFilePath);
    
    if (!fs.existsSync(fullPath)) {
      const icon = this.getIconForTransactionType(transactionType);
      console.log(`  ${icon} ${this.getDisplayNameForTransactionType(transactionType)} file not found, skipping`);
      return { processed: 0, imported: 0 };
    }

    return await this.importFile(fullPath, transactionType);
  }

  private getIconForTransactionType(transactionType: TransactionType): string {
    switch (transactionType) {
      case TRANSACTION_TYPES.ORDER: return CONSOLE_ICONS.PACKAGE;
      case TRANSACTION_TYPES.RETURN: return CONSOLE_ICONS.RETURN;
      case TRANSACTION_TYPES.RENTAL: return CONSOLE_ICONS.HOUSE;
      case TRANSACTION_TYPES.REFUND: return CONSOLE_ICONS.MONEY;
      case TRANSACTION_TYPES.DIGITAL_PURCHASE: return CONSOLE_ICONS.PHONE;
      case TRANSACTION_TYPES.DIGITAL_REFUND: return CONSOLE_ICONS.CREDIT_CARD;
      case TRANSACTION_TYPES.CONCESSION: return CONSOLE_ICONS.GIFT;
      default: return CONSOLE_ICONS.FOLDER;
    }
  }

  private getDisplayNameForTransactionType(transactionType: TransactionType): string {
    switch (transactionType) {
      case TRANSACTION_TYPES.ORDER: return 'Orders';
      case TRANSACTION_TYPES.RETURN: return 'Returns';
      case TRANSACTION_TYPES.RENTAL: return 'Rentals';
      case TRANSACTION_TYPES.REFUND: return 'Refunds';
      case TRANSACTION_TYPES.DIGITAL_PURCHASE: return 'Digital Orders';
      case TRANSACTION_TYPES.DIGITAL_REFUND: return 'Digital Refunds';
      case TRANSACTION_TYPES.CONCESSION: return 'Concessions';
      default: return 'Unknown';
    }
  }
} 