export const TRANSACTION_TYPES = {
    ORDER: 'order',
    RETURN: 'return',
    RENTAL: 'rental',
    REFUND: 'refund',
    DIGITAL_PURCHASE: 'digital_purchase',
    DIGITAL_REFUND: 'digital_refund',
    CONCESSION: 'concession'
};
export const FILE_PATHS = {
    ORDERS: 'Retail.OrderHistory.1/Retail.OrderHistory.1.csv',
    RETURNS: 'Retail.OrdersReturned.1/Retail.OrdersReturned.1.csv',
    RENTALS: 'Retail.AmazonRentals/datasets/Retail.AmazonRentals.rental_contracts/Retail.AmazonRentals.rental_contracts.csv',
    REFUNDS: 'Retail.OrdersReturned.Payments.1/Retail.OrdersReturned.Payments.1.csv',
    DIGITAL_ORDERS: 'Digital-Ordering.1/Digital Orders.csv',
    DIGITAL_MONETARY: 'Digital-Ordering.1/Digital Orders Monetary.csv',
    DIGITAL_REFUNDS: 'Digital.Orders.Returns.1/Digital.Orders.Returns.Monetary.1.csv',
    CONCESSIONS: 'Retail.Orders&Returns.Concessions/datasets/OrdersAndReturns.CSConcessions.Concessions/OrdersAndReturns.CSConcessions.Concessions.csv'
};
export const CSV_FIELD_NAMES = {
    // Order fields
    ORDER_ID: 'Order ID',
    ORDER_DATE: 'Order Date',
    TOTAL_OWED: 'Total Owed',
    ASIN: 'ASIN',
    PRODUCT_NAME: 'Product Name',
    ORDER_STATUS: 'Order Status',
    // Return fields
    REVERSAL_ID: 'ReversalID',
    CREATION_DATE: 'CreationDate',
    REVERSAL_STATUS: 'ReversalStatus',
    REVERSAL_REASON: 'ReversalReason',
    // Refund fields
    REFUND_COMPLETION_DATE: 'RefundCompletionDate',
    AMOUNT_REFUNDED: 'AmountRefunded',
    DISBURSEMENT_TYPE: 'DisbursementType',
    // Digital fields
    DELIVERY_PACKET_ID: 'DeliveryPacketId',
    TRANSACTION_AMOUNT: 'TransactionAmount',
    DIGITAL_ORDER_ITEM_ID: 'DigitalOrderItemId',
    // Concession fields
    CONCESSION_ORDER_ID: 'order id',
    REPLACEMENT_ORDER_ID: 'replacement order id'
};
export const SPECIAL_VALUES = {
    NOT_AVAILABLE: 'Not Available',
    NOT_APPLICABLE: 'Not Applicable',
    NO_REPLACEMENT: 'No Replacement Order ID'
};
export const FALLBACK_VALUES = {
    FALLBACK_DATE: '1900-01-01',
    UNKNOWN_PRODUCT: 'Unknown Product',
    UNKNOWN_STATUS: 'Unknown',
    UNKNOWN_ASIN: 'unknown'
};
export const CONSOLE_ICONS = {
    SHOPPING: '🛍️',
    PACKAGE: '📦',
    RETURN: '🔄',
    HOUSE: '🏠',
    MONEY: '💰',
    PHONE: '📱',
    CREDIT_CARD: '💳',
    GIFT: '🎁',
    SUCCESS: '✅',
    WARNING: '⚠️',
    ERROR: '❌',
    CLEAN: '🧹',
    FOLDER: '📂',
    CHART: '📊'
};
//# sourceMappingURL=amazon-constants.js.map