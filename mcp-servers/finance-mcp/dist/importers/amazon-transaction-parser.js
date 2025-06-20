import { AmazonParsingUtils } from './amazon-utils.js';
import { TRANSACTION_TYPES, CSV_FIELD_NAMES, SPECIAL_VALUES, FALLBACK_VALUES } from './amazon-constants.js';
export class AmazonTransactionParser {
    parseRow(row, transactionType) {
        try {
            switch (transactionType) {
                case TRANSACTION_TYPES.ORDER:
                    return this.parseOrderRow(row);
                case TRANSACTION_TYPES.RETURN:
                    return this.parseReturnRow(row);
                case TRANSACTION_TYPES.RENTAL:
                    return this.parseRentalRow(row);
                case TRANSACTION_TYPES.REFUND:
                    return this.parseRefundRow(row);
                case TRANSACTION_TYPES.DIGITAL_REFUND:
                    return this.parseDigitalRefundRow(row);
                case TRANSACTION_TYPES.CONCESSION:
                    return this.parseConcessionRow(row);
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
        const orderId = row[CSV_FIELD_NAMES.ORDER_ID];
        const orderDate = AmazonParsingUtils.parseDate(row[CSV_FIELD_NAMES.ORDER_DATE]) || FALLBACK_VALUES.FALLBACK_DATE;
        const totalOwed = AmazonParsingUtils.parseAmount(row[CSV_FIELD_NAMES.TOTAL_OWED]);
        if (!orderId) {
            throw new Error('Missing required Order ID');
        }
        // Make transaction_id unique by including ASIN to handle multiple items per order
        const asin = row[CSV_FIELD_NAMES.ASIN] || FALLBACK_VALUES.UNKNOWN_ASIN;
        const productName = row[CSV_FIELD_NAMES.PRODUCT_NAME] || FALLBACK_VALUES.UNKNOWN_PRODUCT;
        return {
            transaction_id: AmazonParsingUtils.createUniqueTransactionId(orderId, asin),
            transaction_type: TRANSACTION_TYPES.ORDER,
            date: orderDate,
            status: AmazonParsingUtils.getSafeValue(row, CSV_FIELD_NAMES.ORDER_STATUS, FALLBACK_VALUES.UNKNOWN_STATUS),
            product_name: productName,
            amount: -Math.abs(totalOwed), // Orders are negative (money out)
            details: AmazonParsingUtils.createDetailsJson({
                asin: asin,
                shipment_status: row['Shipment Status'],
                ship_date: AmazonParsingUtils.parseDate(row['Ship Date']),
                carrier: row['Carrier Name & Tracking Number'],
                quantity: row['Quantity'],
                list_price: AmazonParsingUtils.parseAmount(row['List Price Per Unit']),
                purchase_price: AmazonParsingUtils.parseAmount(row['Purchase Price Per Unit'])
            })
        };
    }
    parseReturnRow(row) {
        const returnId = row[CSV_FIELD_NAMES.REVERSAL_ID] || row['OrderID'];
        const returnDate = AmazonParsingUtils.parseDate(row[CSV_FIELD_NAMES.CREATION_DATE]);
        const refundAmount = AmazonParsingUtils.parseAmount(row['DirectDebitRefundAmount']);
        if (!returnId || !returnDate) {
            throw new Error('Missing required return fields');
        }
        return {
            transaction_id: returnId,
            transaction_type: TRANSACTION_TYPES.RETURN,
            date: returnDate,
            status: AmazonParsingUtils.getSafeValue(row, CSV_FIELD_NAMES.REVERSAL_STATUS, FALLBACK_VALUES.UNKNOWN_STATUS),
            product_name: `Return: ${AmazonParsingUtils.getSafeValue(row, CSV_FIELD_NAMES.REVERSAL_REASON, 'Unknown reason')}`,
            amount: Math.abs(refundAmount), // Returns are positive (money in)
            details: AmazonParsingUtils.createDetailsJson({
                original_order_id: row['OrderID'],
                reversal_reason: row[CSV_FIELD_NAMES.REVERSAL_REASON],
                currency: row['Currency'],
                quantity: row['Quantity'],
                reversal_amount_state: row['ReversalAmountState']
            })
        };
    }
    parseRentalRow(row) {
        // Handle BOM character in CSV using utility
        const rentalIdKey = AmazonParsingUtils.findDynamicKey(row, ['rental_id']);
        const rentalId = row[rentalIdKey];
        const startDate = AmazonParsingUtils.parseDate(row['creation_date']);
        const rentalPrice = AmazonParsingUtils.parseAmount(row['initial_rental_price_amount']);
        if (!rentalId || !startDate) {
            throw new Error('Missing required rental fields');
        }
        return {
            transaction_id: rentalId,
            transaction_type: TRANSACTION_TYPES.RENTAL,
            date: startDate,
            status: 'Rental Contract',
            product_name: `Rental: ${rentalId}`,
            amount: -Math.abs(rentalPrice), // Rentals are negative (money out)
            details: AmazonParsingUtils.createDetailsJson({
                rental_full_value: AmazonParsingUtils.parseAmount(row['rental_full_value']),
                currency: row['currency'],
                creation_date: row['creation_date']
            })
        };
    }
    parseRefundRow(row) {
        const refundId = row[CSV_FIELD_NAMES.REVERSAL_ID];
        const refundDate = AmazonParsingUtils.parseDate(row[CSV_FIELD_NAMES.REFUND_COMPLETION_DATE]);
        const refundAmount = AmazonParsingUtils.parseAmount(row[CSV_FIELD_NAMES.AMOUNT_REFUNDED]);
        // Skip rows with "Not Applicable" or missing critical data
        if (!refundId || !refundDate || row[CSV_FIELD_NAMES.REFUND_COMPLETION_DATE] === SPECIAL_VALUES.NOT_APPLICABLE) {
            throw new Error('Missing required refund fields');
        }
        // Handle BOM character in CSV using utility
        const orderIdKey = AmazonParsingUtils.findDynamicKey(row, ['OrderID']);
        return {
            transaction_id: `refund_${refundId}`, // Prefix to avoid conflict with return ReversalIDs
            transaction_type: TRANSACTION_TYPES.REFUND,
            date: refundDate,
            status: AmazonParsingUtils.getSafeValue(row, 'Status', FALLBACK_VALUES.UNKNOWN_STATUS),
            product_name: `Refund: ${AmazonParsingUtils.getSafeValue(row, CSV_FIELD_NAMES.DISBURSEMENT_TYPE, 'Payment')}`,
            amount: Math.abs(refundAmount), // Refunds are positive (money in)
            details: AmazonParsingUtils.createDetailsJson({
                original_order_id: row[orderIdKey],
                original_reversal_id: refundId, // Keep the original ReversalID for reference
                disbursement_type: row[CSV_FIELD_NAMES.DISBURSEMENT_TYPE],
                currency: row['Currency'],
                amount_refunded: refundAmount
            })
        };
    }
    parseDigitalMonetaryRow(monetary, order) {
        const amount = AmazonParsingUtils.parseAmount(monetary[CSV_FIELD_NAMES.TRANSACTION_AMOUNT]);
        const packetId = monetary[CSV_FIELD_NAMES.DELIVERY_PACKET_ID];
        const componentType = monetary['MonetaryComponentTypeCode'] || 'Purchase';
        if (!packetId) {
            throw new Error('Missing required DeliveryPacketId');
        }
        // Use order info if available, otherwise use monetary data
        const orderId = order?.OrderId || packetId;
        const orderDate = order ?
            (AmazonParsingUtils.parseDate(order.OrderDate) || AmazonParsingUtils.getCurrentDateString()) :
            AmazonParsingUtils.getCurrentDateString();
        const marketplace = order?.Marketplace || 'Amazon Digital';
        return {
            transaction_id: AmazonParsingUtils.createUniqueTransactionId(`digital_${packetId}`, monetary[CSV_FIELD_NAMES.DIGITAL_ORDER_ITEM_ID] || 'item'),
            transaction_type: TRANSACTION_TYPES.DIGITAL_PURCHASE,
            date: orderDate,
            status: order?.OrderStatus || 'SUCCESS',
            product_name: amount === 0 ?
                `Free Digital ${componentType}: ${marketplace}` :
                `Digital ${componentType}: ${marketplace}`,
            amount: -Math.abs(amount), // Digital purchases are negative (money out)
            details: AmazonParsingUtils.createDetailsJson({
                delivery_packet_id: packetId,
                digital_item_id: monetary[CSV_FIELD_NAMES.DIGITAL_ORDER_ITEM_ID],
                component_type: componentType,
                currency: monetary['BaseCurrencyCode'],
                marketplace: marketplace,
                order_id: orderId,
                offer_type: monetary['OfferTypeCode']
            })
        };
    }
    parseDigitalRefundRow(row) {
        // Handle BOM character in CSV using utility
        const packetIdKey = AmazonParsingUtils.findDynamicKey(row, [CSV_FIELD_NAMES.DELIVERY_PACKET_ID]);
        const orderIdKey = AmazonParsingUtils.findDynamicKey(row, ['OrderId']);
        const packetId = row[packetIdKey];
        const orderId = row[orderIdKey];
        const refundDate = AmazonParsingUtils.getCurrentDateString(); // No date field in CSV
        const refundAmount = AmazonParsingUtils.parseAmount(row[CSV_FIELD_NAMES.TRANSACTION_AMOUNT]);
        if (!packetId || !orderId) {
            throw new Error('Missing required digital refund fields');
        }
        return {
            transaction_id: AmazonParsingUtils.createUniqueTransactionId(`digital_refund_${packetId}`, row[CSV_FIELD_NAMES.DIGITAL_ORDER_ITEM_ID] || 'item'),
            transaction_type: TRANSACTION_TYPES.DIGITAL_REFUND,
            date: refundDate,
            status: 'Refunded',
            product_name: `Digital Refund: ${AmazonParsingUtils.getSafeValue(row, 'ReasonCode', 'Unknown reason')}`,
            amount: Math.abs(refundAmount), // Refunds are positive (money in)
            details: AmazonParsingUtils.createDetailsJson({
                original_order_id: orderId,
                delivery_packet_id: packetId,
                digital_item_id: row[CSV_FIELD_NAMES.DIGITAL_ORDER_ITEM_ID],
                reason_code: row['ReasonCode'],
                condition_code: row['ConditionCode'],
                currency: row['BaseCurrencyCode'],
                monetary_component_type: row['MonetaryComponentType']
            })
        };
    }
    parseConcessionRow(row) {
        // Handle BOM character in CSV using utility
        const orderIdKey = AmazonParsingUtils.findDynamicKey(row, [CSV_FIELD_NAMES.CONCESSION_ORDER_ID]);
        const replacementIdKey = AmazonParsingUtils.findDynamicKey(row, [CSV_FIELD_NAMES.REPLACEMENT_ORDER_ID]);
        const originalOrderId = row[orderIdKey];
        const replacementOrderId = row[replacementIdKey];
        if (!originalOrderId) {
            throw new Error('Missing required order id');
        }
        const isReplacement = replacementOrderId && replacementOrderId !== SPECIAL_VALUES.NO_REPLACEMENT;
        const transactionId = isReplacement
            ? AmazonParsingUtils.createUniqueTransactionId(`concession_${originalOrderId}`, replacementOrderId)
            : AmazonParsingUtils.createUniqueTransactionId(`concession_${originalOrderId}`, undefined, true);
        return {
            transaction_id: transactionId,
            transaction_type: TRANSACTION_TYPES.CONCESSION,
            date: AmazonParsingUtils.getCurrentDateString(), // No date in concessions CSV
            status: isReplacement ? 'Replacement Sent' : 'Credit/Refund',
            product_name: `Concession: ${isReplacement ? 'Replacement Order' : 'Account Credit'}`,
            amount: 0, // No direct financial impact to customer
            details: AmazonParsingUtils.createDetailsJson({
                original_order_id: originalOrderId,
                replacement_order_id: isReplacement ? replacementOrderId : null,
                concession_type: isReplacement ? 'replacement' : 'credit_refund'
            })
        };
    }
}
//# sourceMappingURL=amazon-transaction-parser.js.map