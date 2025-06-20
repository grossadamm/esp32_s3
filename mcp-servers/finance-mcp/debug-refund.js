#!/usr/bin/env node

import { SimpleAmazonImporter } from './dist/importers/amazon-import.js';

const testRow = {
  'OrderID': '111-0032298-1149017',
  'ReversalID': 'NiaDgMNOQdCvUjZVHk5kiw',
  'RefundCompletionDate': '2025-06-18T01:40:25.562Z',
  'Currency': 'USD',
  'AmountRefunded': '14.74',
  'Status': 'Completed',
  'DisbursementType': 'Refund'
};

console.log('🔍 Testing refund row parsing...');
console.log('Input row:', testRow);

const importer = new SimpleAmazonImporter();

console.log('\n📅 Date parsing test:');
const dateResult = importer.parseDate(testRow.RefundCompletionDate);
console.log(`Date "${testRow.RefundCompletionDate}" -> ${dateResult}`);

console.log('\n💰 Amount parsing test:');
const amountResult = importer.parseAmount(testRow.AmountRefunded);
console.log(`Amount "${testRow.AmountRefunded}" -> ${amountResult}`);

console.log('\n💰 Full refund row parsing:');
try {
  const result = importer.parseRefundRow(testRow);
  console.log('✅ Success:', result);
} catch (error) {
  console.log('❌ Error:', error.message);
  console.log('Fields check:');
  console.log('  ReversalID:', JSON.stringify(testRow.ReversalID));
  console.log('  RefundCompletionDate:', JSON.stringify(testRow.RefundCompletionDate));
  console.log('  Parsed date:', dateResult);
  console.log('  Date truthy:', !!dateResult);
  console.log('  ID truthy:', !!testRow.ReversalID);
}

importer.close(); 