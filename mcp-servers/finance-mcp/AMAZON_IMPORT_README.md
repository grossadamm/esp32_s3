# Amazon Transaction Import

This feature allows you to import Amazon transaction data (orders, returns, and rentals) into your finance database.

## Setup

### 1. Export Amazon Data
1. Go to [Amazon Account & Login Info](https://www.amazon.com/gp/privacyprefs/manager)
2. Click "Request my data" 
3. Select "Your Orders" and request export
4. Download and extract to `~/Downloads/Your Orders/`

### 2. Expected File Structure
```
~/Downloads/Your Orders/
├── Retail.OrderHistory.1/
│   └── Retail.OrderHistory.1.csv           # Physical orders
├── Retail.OrdersReturned.1/
│   └── Retail.OrdersReturned.1.csv         # Return logistics
├── Retail.OrdersReturned.Payments.1/
│   └── Retail.OrdersReturned.Payments.1.csv # Actual refund payments
├── Retail.AmazonRentals/
│   └── datasets/
│       └── Retail.AmazonRentals.rental_contracts/
│           └── Retail.AmazonRentals.rental_contracts.csv
├── Digital-Ordering.1/
│   ├── Digital Orders.csv                   # Digital orders
│   └── Digital Orders Monetary.csv          # Digital financial transactions
└── Digital.Orders.Returns.1/
    └── Digital.Orders.Returns.Monetary.1.csv # Digital refunds
```

## Usage

### Import Amazon Data
```typescript
// Import all Amazon data
await importAmazonData();

// Import from custom path
await importAmazonData('/path/to/your/orders');
```

### Query Amazon Transactions
```typescript
// List all transactions from last 30 days
await listAmazonTransactions();

// List only orders from last 90 days
await listAmazonTransactions('order', 90);

// List returns with status filter
await listAmazonTransactions('return', 365, 'Completed');
```

## Database Schema

### amazon_transactions
- `id` - Primary key
- `transaction_id` - Unique identifier (orderID_asin for multi-item orders)
- `transaction_type` - 'order', 'return', 'rental', 'refund', 'digital_purchase', 'digital_refund'
- `date` - Transaction date (YYYY-MM-DD)
- `status` - Order status, return status, etc.
- `product_name` - Product description
- `amount` - Amount (negative for purchases, positive for refunds)
- `details` - JSON blob with additional data (ASIN, shipping, etc.)
- `created_at` - Import timestamp

### amazon_import_log
- `id` - Primary key
- `import_date` - When import occurred
- `file_name` - Source CSV file
- `records_processed` - Total records in file
- `records_imported` - Successfully imported records

## Financial Accounting

**Amount Convention:**
- **Orders/Rentals/Digital Purchases**: Negative amounts (money spent)
- **Returns/Refunds/Digital Refunds**: Positive amounts (money received)
- **Net calculation**: `SUM(amount)` gives net Amazon impact

**Transaction Types:**
- **order**: Physical item purchases (individual items in multi-item orders)
- **return**: Return logistics (usually $0, for tracking purposes)
- **refund**: Actual refund payments (money back to account)
- **rental**: Amazon rental services (e.g., textbook rentals)
- **digital_purchase**: Digital content (e-books, music, movies, apps)
- **digital_refund**: Digital content refunds

**Example Queries:**
```sql
-- Net Amazon spending this year
SELECT SUM(amount) as net_amazon_spending 
FROM amazon_transactions 
WHERE date >= '2024-01-01';

-- Recent deliveries
SELECT * FROM amazon_transactions 
WHERE transaction_type = 'order' 
AND JSON_EXTRACT(details, '$.shipment_status') = 'Shipped'
AND date >= date('now', '-30 days');

-- Return analysis
SELECT 
  COUNT(*) as return_count,
  SUM(amount) as total_refunds,
  AVG(amount) as avg_refund
FROM amazon_transactions 
WHERE transaction_type = 'return' 
AND date >= '2024-01-01';
```

## MCP Tools

### import-amazon-data
Imports all Amazon transaction data from CSV files.

**Parameters:**
- `data_path` (optional): Path to "Your Orders" directory
  - Default: `~/Downloads/Your Orders`

**Returns:**
- Success status
- Import summary (orders, returns, rentals processed/imported)
- Total transactions imported

### list-amazon-transactions
Lists Amazon transactions with filtering options.

**Parameters:**
- `transaction_type` (optional): 'order', 'return', 'rental', 'refund', 'digital_purchase', 'digital_refund', or 'all'
  - Default: 'all'
- `days_back` (optional): Number of days to look back
  - Default: 30
- `status_filter` (optional): Filter by status (e.g., 'Shipped', 'Closed')

**Returns:**
- Array of transactions with parsed details
- Summary statistics (count, total amount, date range)

## Error Handling

- **Missing files**: Skips missing CSV files gracefully
- **Malformed data**: Logs errors and continues processing
- **Duplicate imports**: Prevents duplicate transactions by transaction_id
- **Invalid amounts**: Defaults to 0 for unparseable amounts
- **Missing dates**: Skips records without valid dates

## Data Quality Notes

**Current Import Success Rates:**
- **Physical Orders**: 3,646/3,664 imported (99.5% success rate)
- **Returns**: 339/388 imported (87.4% success rate - logistics only, $0 amounts)
- **Refunds**: 338/339 imported (99.7% success rate - actual money returned)
- **Rentals**: 1/1 imported (100% success rate)
- **Digital Orders**: 491/1,084 imported (45.3% success rate - skips duplicate monetary components)
- **Digital Refunds**: 4/7 imported (57.1% success rate)

**Key Improvements Made:**
- **Multi-item Orders**: Fixed duplicate Order ID handling using `orderID_asin` unique keys
- **BOM Character Handling**: Dynamic key lookup for CSV parsing issues
- **Date Validation**: Fallback dates for invalid date fields
- **Field Mapping**: Correct field names for all CSV types

**Data Characteristics:**
- **Physical Orders**: Each item in multi-item orders gets separate transaction record
- **Digital Content**: Includes $0 transactions (Kindle Unlimited, Prime Video, promotions)
- **Amount Formats**: Handles complex Amazon CSV formats like `"'-0.7'"` and `"$14.52"`
- **Date Formats**: Supports ISO 8601 and other common formats
- **Total Typical Import**: ~4,800+ transactions representing $80k+ in activity 