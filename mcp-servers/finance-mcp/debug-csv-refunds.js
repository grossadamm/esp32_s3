#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { SimpleAmazonImporter } from './dist/importers/amazon-import.js';

const refundsPath = path.join(process.env.HOME, 'Downloads', 'Your Orders', 'Retail.OrdersReturned.Payments.1', 'Retail.OrdersReturned.Payments.1.csv');

console.log('🔍 Debugging refunds CSV parsing...');

const csvContent = fs.readFileSync(refundsPath, 'utf-8');
const records = parse(csvContent, {
  columns: true,
  skip_empty_lines: true,
  trim: true,
  relax_quotes: true,
  escape: '"'
});

console.log(`📊 Total records: ${records.length}`);

const importer = new SimpleAmazonImporter();

// Test first few records
console.log('\n🔍 Testing first 5 records:');
for (let i = 0; i < Math.min(5, records.length); i++) {
  const record = records[i];
  console.log(`\nRecord ${i + 1}:`);
  console.log('  Data:', JSON.stringify(record, null, 2));
  
  try {
    const result = importer.parseRefundRow(record);
    console.log('  ✅ Parse result:', result);
  } catch (error) {
    console.log('  ❌ Parse error:', error.message);
  }
}

// Check the problematic record at the end
console.log('\n🔍 Testing last record:');
const lastRecord = records[records.length - 1];
console.log('Last record:', JSON.stringify(lastRecord, null, 2));

try {
  const result = importer.parseRefundRow(lastRecord);
  console.log('✅ Last record parse result:', result);
} catch (error) {
  console.log('❌ Last record parse error:', error.message);
}

importer.close(); 