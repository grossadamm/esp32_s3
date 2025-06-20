#!/usr/bin/env node

import { SimpleAmazonImporter } from './dist/importers/amazon-import.js';
import path from 'path';

async function testRefunds() {
  console.log('💰 Testing Amazon Refund Import...\n');
  
  const dbPath = path.join(process.cwd(), '..', '..', 'data', 'finance.db');
  const importer = new SimpleAmazonImporter(dbPath);
  
  try {
    // Check current state
    console.log('📊 Before import:');
    const before = await importer.listAmazonTransactions('all', 3650);
    const beforeRefunds = before.transactions.filter(t => t.transaction_type === 'refund');
    console.log(`  Total transactions: ${before.summary.count}`);
    console.log(`  Refunds: ${beforeRefunds.length}`);
    console.log();
    
    // Run import
    console.log('🚀 Running import...');
    const result = await importer.importAmazonData();
    console.log('✅ Import results:');
    console.log(`  Orders: ${result.summary.orders.imported}/${result.summary.orders.processed}`);
    console.log(`  Returns: ${result.summary.returns.imported}/${result.summary.returns.processed}`);
    console.log(`  Rentals: ${result.summary.rentals.imported}/${result.summary.rentals.processed}`);
    console.log(`  Refunds: ${result.summary.refunds.imported}/${result.summary.refunds.processed}`);
    console.log();
    
    // Check final state
    console.log('📊 After import:');
    const after = await importer.listAmazonTransactions('all', 3650);
    const refunds = after.transactions.filter(t => t.transaction_type === 'refund');
    console.log(`  Total transactions: ${after.summary.count}`);
    console.log(`  Refunds: ${refunds.length}`);
    
    if (refunds.length > 0) {
      console.log('\n💰 Sample refunds:');
      refunds.slice(0, 5).forEach(r => {
        console.log(`  ${r.date} | ${r.product_name} | $${r.amount.toFixed(2)}`);
      });
      
      console.log('\n📈 Refund totals:');
      const refundTotal = refunds.reduce((sum, r) => sum + r.amount, 0);
      console.log(`  Total refunded: $${refundTotal.toFixed(2)}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    importer.close();
  }
}

testRefunds(); 