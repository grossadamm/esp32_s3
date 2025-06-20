#!/usr/bin/env node

import { SimpleAmazonImporter } from './dist/importers/amazon-import.js';
import path from 'path';

async function clearAmazonTables() {
  console.log('🧹 Clearing Amazon tables...\n');
  
  const dbPath = path.join(process.cwd(), '..', '..', 'data', 'finance.db');
  const importer = new SimpleAmazonImporter(dbPath);
  
  try {
    // Check current counts
    console.log('📊 Before clearing:');
    const before = await importer.listAmazonTransactions('all', 3650);
    console.log(`  Amazon transactions: ${before.summary.count}`);
    console.log(`  Total amount: $${before.summary.total_amount.toFixed(2)}`);
    
    // Clear the tables
    console.log('\n🧹 Clearing tables...');
    await importer.clearTables();
    console.log('✅ Cleared amazon_transactions and amazon_import_log');
    
    // Verify they're empty
    console.log('\n📊 After clearing:');
    const after = await importer.listAmazonTransactions('all', 3650);
    console.log(`  Amazon transactions: ${after.summary.count}`);
    console.log(`  Total amount: $${after.summary.total_amount.toFixed(2)}`);
    
    console.log('\n🎉 Amazon tables cleared successfully!');
    
  } catch (error) {
    console.error('❌ Error clearing tables:', error);
  } finally {
    importer.close();
  }
}

clearAmazonTables(); 