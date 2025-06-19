declare class OptionsImporter {
    private db;
    constructor();
    private initializeDatabase;
    private parseDate;
    private parsePrice;
    private parseQuantity;
    private calculateExpirationDate;
    importOptions(filename: string): Promise<void>;
    close(): void;
}
export { OptionsImporter };
//# sourceMappingURL=options-import.d.ts.map