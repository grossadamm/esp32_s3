# Amazon Transaction Import - Project Plan

## Overview
Add Amazon transaction import capability to the finance MCP server to track orders, returns, and rentals from Amazon data export files.

## Goals
- Import Amazon order history, returns, and rental data
- Provide query tools for recent deliveries and order status tracking
- Maintain accurate financial accounting (purchases negative, refunds positive)
- Keep implementation simple and maintainable

## Data Sources
**Location**: `~/Downloads/"Your Orders"/`

**Key Files**:
- `Retail.OrderHistory.1/Retail.OrderHistory.1.csv` (~3,944 records)
- `Retail.OrdersReturned.1/Retail.OrdersReturned.1.csv` (~389 records) 
- `Retail.AmazonRentals/datasets/Retail.AmazonRentals.rental_contracts/Retail.AmazonRentals.rental_contracts.csv` (~1 record)

## Database Schema

### Core Table
```sql
amazon_transactions (
  id INTEGER PRIMARY KEY,
  transaction_id TEXT UNIQUE,    -- order_id, return_id, rental_id
  transaction_type TEXT,         -- 'order', 'return', 'rental'
  date TEXT,                     -- YYYY-MM-DD format
  status TEXT,                   -- order_status, return_status, etc.
  product_name TEXT,
  amount REAL,                   -- negative for purchases, positive for refunds
  details TEXT,                  -- JSON blob for type-specific fields
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### Import Log Table
```sql
amazon_import_log (
  id INTEGER PRIMARY KEY,
  import_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  file_name TEXT,
  records_processed INTEGER,
  records_imported INTEGER
)
```

## Amount Handling Convention

**Financial Accounting Standards**:
- **Orders/Rentals**: Always negative (money OUT)
- **Returns/Refunds**: Always positive (money IN)
- **Net calculation**: SUM(amount) = net Amazon impact

**Implementation**:
```typescript
// Orders: -Math.abs(parseFloat(row['Total Owed']))
// Returns: +Math.abs(parseFloat(row['DirectDebitRefundAmount']))
// Rentals: -Math.abs(parseFloat(row['initial_rental_price_amount']))
```

## Implementation Structure

### File Organization
```
mcp-servers/finance-mcp/src/importers/
└── amazon-import.ts              # Single file implementation
```

### Core Components
1. **SimpleAmazonImporter class**
   - `importAmazonData()` - Main entry point
   - `importFile()` - Generic CSV file processor
   - `parseRow()` - Row transformation by type
   - `parseAmount()` - Amount standardization

2. **CSV Processing**
   - Handle Amazon's complex CSV format with embedded quotes
   - Parse dates from ISO format to YYYY-MM-DD
   - Clean amount strings: `"'-0.7'"` → `-0.7`

3. **Data Transformation**
   ```typescript
   // Order transformation
   {
     transaction_id: row['Order ID'],
     transaction_type: 'order',
     date: row['Order Date']?.split('T')[0],
     status: row['Order Status'],
     product_name: row['Product Name'],
     amount: -Math.abs(parseFloat(row['Total Owed'])),
     details: JSON.stringify({
       shipment_status: row['Shipment Status'],
       ship_date: row['Ship Date'],
       carrier: row['Carrier Name & Tracking Number']
     })
   }
   ```

## MCP Tools

### Import Tool
```typescript
{
  name: "import-amazon-data",
  description: "Import all Amazon transaction data (orders, returns, rentals)",
  inputSchema: {
    type: "object", 
    properties: {
      data_path: { 
        type: "string",
        description: "Path to Your Orders directory", 
        default: "~/Downloads/Your Orders"
      }
    }
  }
}
```

### Query Tool
```typescript
{
  name: "list-amazon-transactions", 
  description: "List Amazon transactions by type and date range",
  inputSchema: {
    type: "object",
    properties: {
      transaction_type: { enum: ["order", "return", "rental", "all"] },
      days_back: { type: "number", default: 30 },
      status_filter: { type: "string" }
    }
  }
}
```

## Key Use Cases

1. **Recent Deliveries**: Filter by `shipment_status: 'Shipped'` in last N days
2. **Order Status Tracking**: Query by `order_status` ('Closed', 'Cancelled', 'New')
3. **Return Analysis**: View refunds and return reasons
4. **Financial Summary**: Calculate net Amazon spending vs refunds

## Implementation Notes

### CSV Parsing Challenges
- Amazon uses complex quoting: `"Product Name"` and embedded quotes
- Amount formats vary: `"14.52"`, `"'-0.7'"`, `"Not Available"`
- Date format: ISO 8601 (`2025-06-18T01:50:18Z`)

### Error Handling
- Skip malformed rows with logging
- Handle missing/invalid amounts (default to 0)
- Track import statistics in log table
- Prevent duplicate imports by transaction_id

### Data Quality
- **Orders**: ~3,944 records, mostly 'Closed' status
- **Returns**: ~389 records, mostly 'Completed' status  
- **Rentals**: Minimal data (~1 record from 2013)

## Success Criteria
- [ ] Import Amazon order history successfully
- [ ] Track financial impact accurately (negative purchases, positive refunds)
- [ ] Query recent deliveries and order statuses
- [ ] Handle CSV parsing edge cases gracefully
- [ ] Maintain import history and prevent duplicates

## Future Enhancements
- Digital orders import (`Digital-Ordering.1/Digital Orders.csv`)
- Return payment tracking (`Retail.OrdersReturned.Payments.1.csv`)
- Cart analysis (`Retail.CartItems.1.csv`)
- Order-return matching and analysis 