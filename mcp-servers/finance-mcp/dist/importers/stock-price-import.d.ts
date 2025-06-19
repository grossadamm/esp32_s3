interface StockPriceData {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}
declare class StockPriceImporter {
    private db;
    constructor(dbPath?: string);
    createStockPricesTable(): Promise<void>;
    loadNflxDataFromCsv(filename?: string): Promise<StockPriceData[]>;
    fetchNflxData(): Promise<StockPriceData[]>;
    importStockData(stockData: StockPriceData[]): Promise<void>;
    getCurrentPrice(): Promise<number>;
    updateOptionsValues(): Promise<void>;
    close(): Promise<void>;
}
export { StockPriceImporter };
//# sourceMappingURL=stock-price-import.d.ts.map