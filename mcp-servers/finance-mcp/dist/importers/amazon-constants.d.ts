export declare const TRANSACTION_TYPES: {
    readonly ORDER: "order";
    readonly RETURN: "return";
    readonly RENTAL: "rental";
    readonly REFUND: "refund";
    readonly DIGITAL_PURCHASE: "digital_purchase";
    readonly DIGITAL_REFUND: "digital_refund";
    readonly CONCESSION: "concession";
};
export type TransactionType = typeof TRANSACTION_TYPES[keyof typeof TRANSACTION_TYPES];
export declare const FILE_PATHS: {
    readonly ORDERS: "Retail.OrderHistory.1/Retail.OrderHistory.1.csv";
    readonly RETURNS: "Retail.OrdersReturned.1/Retail.OrdersReturned.1.csv";
    readonly RENTALS: "Retail.AmazonRentals/datasets/Retail.AmazonRentals.rental_contracts/Retail.AmazonRentals.rental_contracts.csv";
    readonly REFUNDS: "Retail.OrdersReturned.Payments.1/Retail.OrdersReturned.Payments.1.csv";
    readonly DIGITAL_ORDERS: "Digital-Ordering.1/Digital Orders.csv";
    readonly DIGITAL_MONETARY: "Digital-Ordering.1/Digital Orders Monetary.csv";
    readonly DIGITAL_REFUNDS: "Digital.Orders.Returns.1/Digital.Orders.Returns.Monetary.1.csv";
    readonly CONCESSIONS: "Retail.Orders&Returns.Concessions/datasets/OrdersAndReturns.CSConcessions.Concessions/OrdersAndReturns.CSConcessions.Concessions.csv";
};
export declare const CSV_FIELD_NAMES: {
    readonly ORDER_ID: "Order ID";
    readonly ORDER_DATE: "Order Date";
    readonly TOTAL_OWED: "Total Owed";
    readonly ASIN: "ASIN";
    readonly PRODUCT_NAME: "Product Name";
    readonly ORDER_STATUS: "Order Status";
    readonly REVERSAL_ID: "ReversalID";
    readonly CREATION_DATE: "CreationDate";
    readonly REVERSAL_STATUS: "ReversalStatus";
    readonly REVERSAL_REASON: "ReversalReason";
    readonly REFUND_COMPLETION_DATE: "RefundCompletionDate";
    readonly AMOUNT_REFUNDED: "AmountRefunded";
    readonly DISBURSEMENT_TYPE: "DisbursementType";
    readonly DELIVERY_PACKET_ID: "DeliveryPacketId";
    readonly TRANSACTION_AMOUNT: "TransactionAmount";
    readonly DIGITAL_ORDER_ITEM_ID: "DigitalOrderItemId";
    readonly CONCESSION_ORDER_ID: "order id";
    readonly REPLACEMENT_ORDER_ID: "replacement order id";
};
export declare const SPECIAL_VALUES: {
    readonly NOT_AVAILABLE: "Not Available";
    readonly NOT_APPLICABLE: "Not Applicable";
    readonly NO_REPLACEMENT: "No Replacement Order ID";
};
export declare const FALLBACK_VALUES: {
    readonly FALLBACK_DATE: "1900-01-01";
    readonly UNKNOWN_PRODUCT: "Unknown Product";
    readonly UNKNOWN_STATUS: "Unknown";
    readonly UNKNOWN_ASIN: "unknown";
};
export declare const CONSOLE_ICONS: {
    readonly SHOPPING: "🛍️";
    readonly PACKAGE: "📦";
    readonly RETURN: "🔄";
    readonly HOUSE: "🏠";
    readonly MONEY: "💰";
    readonly PHONE: "📱";
    readonly CREDIT_CARD: "💳";
    readonly GIFT: "🎁";
    readonly SUCCESS: "✅";
    readonly WARNING: "⚠️";
    readonly ERROR: "❌";
    readonly CLEAN: "🧹";
    readonly FOLDER: "📂";
    readonly CHART: "📊";
};
//# sourceMappingURL=amazon-constants.d.ts.map