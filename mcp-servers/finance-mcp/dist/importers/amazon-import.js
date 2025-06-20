import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import { parse } from 'csv-parse/sync';
class DatabaseWrapper {
    db;
    all;
    get;
    run;
    constructor(filename) {
        this.db = new sqlite3.Database(filename);
        this.all = promisify(this.db.all.bind(this.db));
        this.get = promisify(this.db.get.bind(this.db));
        this.run = promisify(this.db.run.bind(this.db));
    }
    close() {
        this.db.close();
    }
}
export class SimpleAmazonImporter {
    db;
    constructor(dbPath) {
        const finalDbPath = dbPath || path.join(process.cwd(), '..', '..', 'data', 'finance.db');
        this.db = new DatabaseWrapper(finalDbPath);
    }
    async importAmazonData(dataPath = '~/Downloads/Your Orders') {
        console.log('🛍️  Starting Amazon data import...');
        // Ensure tables exist
        await this.ensureTables();
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
            digital_refunds: { processed: 0, imported: 0 }
        };
        // Import orders
        const ordersPath = path.join(expandedPath, 'Retail.OrderHistory.1', 'Retail.OrderHistory.1.csv');
        if (fs.existsSync(ordersPath)) {
            const orderResult = await this.importFile(ordersPath, 'order');
            summary.orders = orderResult;
            console.log(`  📦 Orders: ${orderResult.imported}/${orderResult.processed} imported`);
        }
        // Import returns
        const returnsPath = path.join(expandedPath, 'Retail.OrdersReturned.1', 'Retail.OrdersReturned.1.csv');
        if (fs.existsSync(returnsPath)) {
            const returnResult = await this.importFile(returnsPath, 'return');
            summary.returns = returnResult;
            console.log(`  🔄 Returns: ${returnResult.imported}/${returnResult.processed} imported`);
        }
        // Import rentals
        const rentalsPath = path.join(expandedPath, 'Retail.AmazonRentals', 'datasets', 'Retail.AmazonRentals.rental_contracts', 'Retail.AmazonRentals.rental_contracts.csv');
        if (fs.existsSync(rentalsPath)) {
            const rentalResult = await this.importFile(rentalsPath, 'rental');
            summary.rentals = rentalResult;
            console.log(`  🏠 Rentals: ${rentalResult.imported}/${rentalResult.processed} imported`);
        }
        // Import return payments (actual refund amounts)
        const paymentsPath = path.join(expandedPath, 'Retail.OrdersReturned.Payments.1', 'Retail.OrdersReturned.Payments.1.csv');
        if (fs.existsSync(paymentsPath)) {
            const paymentResult = await this.importFile(paymentsPath, 'refund');
            summary.refunds = paymentResult;
            console.log(`  💰 Refunds: ${paymentResult.imported}/${paymentResult.processed} imported`);
        }
        // Import digital orders
        const digitalOrdersResult = await this.importDigitalOrders(expandedPath);
        summary.digital_orders = digitalOrdersResult;
        console.log(`  📱 Digital Orders: ${digitalOrdersResult.imported}/${digitalOrdersResult.processed} imported`);
        // Import digital refunds
        const digitalRefundsResult = await this.importDigitalRefunds(expandedPath);
        summary.digital_refunds = digitalRefundsResult;
        console.log(`  💳 Digital Refunds: ${digitalRefundsResult.imported}/${digitalRefundsResult.processed} imported`);
        const totalImported = summary.orders.imported + summary.returns.imported + summary.rentals.imported + summary.refunds.imported + summary.digital_orders.imported + summary.digital_refunds.imported;
        console.log(`✅ Amazon import complete! Total imported: ${totalImported} transactions`);
        return {
            success: true,
            summary,
            message: `Successfully imported ${totalImported} Amazon transactions`
        };
    }
    async ensureTables() {
        // Create amazon_transactions table
        await this.db.run(`
      CREATE TABLE IF NOT EXISTS amazon_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_id TEXT UNIQUE,
        transaction_type TEXT NOT NULL,
        date TEXT NOT NULL,
        status TEXT,
        product_name TEXT,
        amount REAL NOT NULL,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
        // Create amazon_import_log table
        await this.db.run(`
      CREATE TABLE IF NOT EXISTS amazon_import_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        import_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        file_name TEXT NOT NULL,
        records_processed INTEGER NOT NULL,
        records_imported INTEGER NOT NULL
      )
    `);
        console.log('📋 Database tables ensured');
    }
    async importFile(filePath, transactionType) {
        console.log(`📂 Reading ${transactionType} file: ${path.basename(filePath)}`);
        const csvContent = fs.readFileSync(filePath, 'utf-8');
        const records = parse(csvContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
            relax_quotes: true,
            escape: '"'
        });
        console.log(`📊 Found ${records.length} ${transactionType} records`);
        let processed = 0;
        let imported = 0;
        for (const row of records) {
            processed++;
            try {
                const transaction = this.parseRow(row, transactionType);
                if (transaction) {
                    // Check if already exists
                    const existing = await this.db.get('SELECT id FROM amazon_transactions WHERE transaction_id = ?', [transaction.transaction_id]);
                    if (!existing) {
                        await this.db.run(`
              INSERT INTO amazon_transactions 
              (transaction_id, transaction_type, date, status, product_name, amount, details)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                            transaction.transaction_id,
                            transaction.transaction_type,
                            transaction.date,
                            transaction.status,
                            transaction.product_name,
                            transaction.amount,
                            transaction.details
                        ]);
                        imported++;
                    }
                    else if (transactionType === 'refund') {
                        console.log(`⚠️  Refund ${transaction.transaction_id} already exists, skipping`);
                    }
                }
                else if (transactionType === 'refund') {
                    console.log(`⚠️  Refund row ${processed} failed to parse`);
                }
            }
            catch (error) {
                console.error(`❌ Error processing ${transactionType} record ${processed}:`, error);
                console.error('Row data:', row);
            }
        }
        // Log import
        await this.db.run(`
      INSERT INTO amazon_import_log (file_name, records_processed, records_imported)
      VALUES (?, ?, ?)
    `, [path.basename(filePath), processed, imported]);
        return { processed, imported };
    }
    parseRow(row, transactionType) {
        try {
            switch (transactionType) {
                case 'order':
                    return this.parseOrderRow(row);
                case 'return':
                    return this.parseReturnRow(row);
                case 'rental':
                    return this.parseRentalRow(row);
                case 'refund':
                    return this.parseRefundRow(row);
                case 'digital_refund':
                    return this.parseDigitalRefundRow(row);
                default:
                    throw new Error(`Unknown transaction type: ${transactionType}`);
            }
        }
        catch (error) {
            // Skip invalid rows instead of stopping the import
            return null;
        }
    }
    parseOrderRow(row) {
        const orderId = row['Order ID'];
        const orderDate = this.parseDate(row['Order Date']);
        const totalOwed = this.parseAmount(row['Total Owed']);
        if (!orderId || !orderDate) {
            throw new Error('Missing required order fields');
        }
        return {
            transaction_id: orderId,
            transaction_type: 'order',
            date: orderDate,
            status: row['Order Status'] || 'Unknown',
            product_name: row['Product Name'] || 'Unknown Product',
            amount: -Math.abs(totalOwed), // Orders are negative (money out)
            details: JSON.stringify({
                shipment_status: row['Shipment Status'],
                ship_date: this.parseDate(row['Ship Date']),
                carrier: row['Carrier Name & Tracking Number'],
                quantity: row['Quantity'],
                list_price: this.parseAmount(row['List Price Per Unit']),
                purchase_price: this.parseAmount(row['Purchase Price Per Unit'])
            })
        };
    }
    parseReturnRow(row) {
        const returnId = row['ReversalID'] || row['OrderID'];
        const returnDate = this.parseDate(row['CreationDate']);
        const refundAmount = this.parseAmount(row['DirectDebitRefundAmount']);
        if (!returnId || !returnDate) {
            throw new Error('Missing required return fields');
        }
        return {
            transaction_id: returnId,
            transaction_type: 'return',
            date: returnDate,
            status: row['ReversalStatus'] || 'Unknown',
            product_name: `Return: ${row['ReversalReason'] || 'Unknown reason'}`,
            amount: Math.abs(refundAmount), // Returns are positive (money in)
            details: JSON.stringify({
                original_order_id: row['OrderID'],
                reversal_reason: row['ReversalReason'],
                currency: row['Currency'],
                quantity: row['Quantity'],
                reversal_amount_state: row['ReversalAmountState']
            })
        };
    }
    parseRentalRow(row) {
        // Handle BOM character in CSV - first key might have UTF-8 BOM prefix
        const keys = Object.keys(row);
        const rentalIdKey = keys.find(key => key.endsWith('rental_id')) || 'rental_id';
        const rentalId = row[rentalIdKey];
        const startDate = this.parseDate(row['creation_date']);
        const rentalPrice = this.parseAmount(row['initial_rental_price_amount']);
        if (!rentalId || !startDate) {
            throw new Error('Missing required rental fields');
        }
        return {
            transaction_id: rentalId,
            transaction_type: 'rental',
            date: startDate,
            status: 'Rental Contract',
            product_name: `Rental: ${rentalId}`,
            amount: -Math.abs(rentalPrice), // Rentals are negative (money out)
            details: JSON.stringify({
                rental_full_value: this.parseAmount(row['rental_full_value']),
                currency: row['currency'],
                creation_date: row['creation_date']
            })
        };
    }
    parseRefundRow(row) {
        const refundId = row['ReversalID'];
        const refundDate = this.parseDate(row['RefundCompletionDate']);
        const refundAmount = this.parseAmount(row['AmountRefunded']);
        // Skip rows with "Not Applicable" or missing critical data
        if (!refundId || !refundDate || row['RefundCompletionDate'] === 'Not Applicable') {
            throw new Error('Missing required refund fields');
        }
        // Handle BOM character in CSV - first key might have UTF-8 BOM prefix
        const keys = Object.keys(row);
        const orderIdKey = keys.find(key => key.includes('OrderID')) || 'OrderID';
        return {
            transaction_id: `refund_${refundId}`, // Prefix to avoid conflict with return ReversalIDs
            transaction_type: 'refund',
            date: refundDate,
            status: row['Status'] || 'Unknown',
            product_name: `Refund: ${row['DisbursementType'] || 'Payment'}`,
            amount: Math.abs(refundAmount), // Refunds are positive (money in)
            details: JSON.stringify({
                original_order_id: row[orderIdKey],
                original_reversal_id: refundId, // Keep the original ReversalID for reference
                disbursement_type: row['DisbursementType'],
                currency: row['Currency'],
                amount_refunded: refundAmount
            })
        };
    }
    parseDate(dateStr) {
        if (!dateStr || dateStr === 'Not Available' || dateStr === 'Not Applicable') {
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
        }
        catch {
            return null;
        }
    }
    parseAmount(amountStr) {
        if (!amountStr || amountStr === 'Not Available' || amountStr === 'Not Applicable' || amountStr === '') {
            return 0;
        }
        try {
            // Clean up Amazon's complex amount formats
            // Examples: "14.52", "'14.52'", "'-0.7'", "$14.52"
            let cleaned = amountStr
                .replace(/["']/g, '') // Remove quotes
                .replace(/[$,]/g, '') // Remove dollar signs and commas
                .trim();
            const parsed = parseFloat(cleaned);
            return isNaN(parsed) ? 0 : parsed;
        }
        catch {
            return 0;
        }
    }
    async listAmazonTransactions(transactionType = 'all', daysBack = 30, statusFilter) {
        // Ensure tables exist before querying
        await this.ensureTables();
        let whereClause = 'WHERE date >= date("now", "-" || ? || " days")';
        const params = [daysBack];
        if (transactionType !== 'all') {
            whereClause += ' AND transaction_type = ?';
            params.push(transactionType);
        }
        if (statusFilter) {
            whereClause += ' AND status LIKE ?';
            params.push(`%${statusFilter}%`);
        }
        const transactions = await this.db.all(`
      SELECT 
        transaction_id,
        transaction_type,
        date,
        status,
        product_name,
        amount,
        details
      FROM amazon_transactions 
      ${whereClause}
      ORDER BY date DESC, transaction_id
    `, params);
        // Get summary statistics
        const summary = await this.db.get(`
      SELECT 
        COUNT(*) as count,
        SUM(amount) as total_amount,
        MIN(date) as earliest,
        MAX(date) as latest
      FROM amazon_transactions 
      ${whereClause}
    `, params);
        return {
            transactions: transactions.map(t => ({
                ...t,
                details: t.details ? JSON.parse(t.details) : {}
            })),
            summary: {
                count: summary?.count || 0,
                total_amount: summary?.total_amount || 0,
                date_range: summary?.earliest ? {
                    earliest: summary.earliest,
                    latest: summary.latest
                } : null
            }
        };
    }
    async importDigitalOrders(dataPath) {
        const ordersPath = path.join(dataPath, 'Digital-Ordering.1', 'Digital Orders.csv');
        const monetaryPath = path.join(dataPath, 'Digital-Ordering.1', 'Digital Orders Monetary.csv');
        if (!fs.existsSync(ordersPath) || !fs.existsSync(monetaryPath)) {
            console.log('  📱 Digital order files not found, skipping');
            return { processed: 0, imported: 0 };
        }
        console.log(`📂 Reading digital orders: ${path.basename(ordersPath)} + ${path.basename(monetaryPath)}`);
        // Read both files
        const ordersContent = fs.readFileSync(ordersPath, 'utf-8');
        const monetaryContent = fs.readFileSync(monetaryPath, 'utf-8');
        const ordersRecords = parse(ordersContent, {
            columns: true, skip_empty_lines: true, trim: true, relax_quotes: true, escape: '"'
        });
        const monetaryRecords = parse(monetaryContent, {
            columns: true, skip_empty_lines: true, trim: true, relax_quotes: true, escape: '"'
        });
        // Group monetary records by DeliveryPacketId
        const monetaryByPacket = new Map();
        for (const monetary of monetaryRecords) {
            const packetId = monetary.DeliveryPacketId;
            if (!monetaryByPacket.has(packetId)) {
                monetaryByPacket.set(packetId, []);
            }
            monetaryByPacket.get(packetId).push(monetary);
        }
        let processed = 0;
        let imported = 0;
        for (const order of ordersRecords) {
            processed++;
            const packetId = order.DeliveryPacketId;
            const monetaryTransactions = monetaryByPacket.get(packetId) || [];
            // Calculate total amount for this order
            let totalAmount = 0;
            const components = [];
            for (const monetary of monetaryTransactions) {
                const amount = this.parseAmount(monetary.TransactionAmount);
                totalAmount += amount;
                components.push({
                    type: monetary.MonetaryComponentTypeCode,
                    amount: amount,
                    currency: monetary.BaseCurrencyCode
                });
            }
            // Skip if no monetary transactions or zero amount
            if (totalAmount === 0)
                continue;
            try {
                const transaction = this.parseDigitalOrderRow(order, totalAmount, components);
                if (transaction) {
                    const existing = await this.db.get('SELECT id FROM amazon_transactions WHERE transaction_id = ?', [transaction.transaction_id]);
                    if (!existing) {
                        await this.db.run(`
              INSERT INTO amazon_transactions 
              (transaction_id, transaction_type, date, status, product_name, amount, details)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                            transaction.transaction_id,
                            transaction.transaction_type,
                            transaction.date,
                            transaction.status,
                            transaction.product_name,
                            transaction.amount,
                            transaction.details
                        ]);
                        imported++;
                    }
                }
            }
            catch (error) {
                console.error(`❌ Error processing digital order record ${processed}:`, error);
            }
        }
        console.log(`📊 Found ${ordersRecords.length} digital orders with ${monetaryRecords.length} monetary transactions`);
        return { processed, imported };
    }
    async importDigitalRefunds(dataPath) {
        const refundsPath = path.join(dataPath, 'Digital.Orders.Returns.1', 'Digital.Orders.Returns.Monetary.1.csv');
        if (!fs.existsSync(refundsPath)) {
            console.log('  💳 Digital refunds file not found, skipping');
            return { processed: 0, imported: 0 };
        }
        return await this.importFile(refundsPath, 'digital_refund');
    }
    parseDigitalOrderRow(order, amount, components) {
        const orderId = order.OrderId;
        const orderDate = this.parseDate(order.OrderDate);
        if (!orderId || !orderDate || orderId.trim() === '' || orderDate.trim() === '') {
            console.log(`⚠️  Digital order missing fields - OrderId: "${orderId}", OrderDate: "${order.OrderDate}" -> parsed: "${orderDate}"`);
            throw new Error('Missing required digital order fields');
        }
        return {
            transaction_id: `digital_${orderId}`,
            transaction_type: 'digital_purchase',
            date: orderDate,
            status: order.OrderStatus || 'Unknown',
            product_name: `Digital Purchase: ${order.Marketplace || 'Amazon'}`,
            amount: -Math.abs(amount), // Digital purchases are negative (money out)
            details: JSON.stringify({
                marketplace: order.Marketplace,
                delivery_packet_id: order.DeliveryPacketId,
                order_status: order.OrderStatus,
                components: components,
                country_code: order.CountryCode,
                subscription_type: order.SubscriptionOrderType
            })
        };
    }
    parseDigitalRefundRow(row) {
        const packetId = row.DeliveryPacketId;
        const orderId = row.OrderId;
        const refundDate = this.parseDate(row.OrderDate) || new Date().toISOString().split('T')[0];
        const refundAmount = this.parseAmount(row.TransactionAmount);
        if (!packetId || !orderId) {
            throw new Error('Missing required digital refund fields');
        }
        return {
            transaction_id: `digital_refund_${packetId}`,
            transaction_type: 'digital_refund',
            date: refundDate,
            status: 'Refunded',
            product_name: `Digital Refund: ${row.ReasonCode || 'Unknown reason'}`,
            amount: Math.abs(refundAmount), // Refunds are positive (money in)
            details: JSON.stringify({
                original_order_id: orderId,
                delivery_packet_id: packetId,
                reason_code: row.ReasonCode,
                condition_code: row.ConditionCode,
                currency: row.BaseCurrencyCode,
                monetary_component_type: row.MonetaryComponentType
            })
        };
    }
    async clearTables() {
        await this.db.run('DELETE FROM amazon_transactions');
        await this.db.run('DELETE FROM amazon_import_log');
    }
    close() {
        this.db.close();
    }
}
//# sourceMappingURL=amazon-import.js.map