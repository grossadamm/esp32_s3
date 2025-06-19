declare const MONTHLY_GAP_NEEDED = 5751;
declare const currentSpending: {
    shopping: number;
    restaurants: number;
    insurance: number;
    groceries: number;
    autoPayment: number;
    entertainment: number;
    gas: number;
    pgE: number;
    education: number;
    medical: number;
    personal: number;
};
declare const reductions: {
    category: string;
    current: number;
    potential: number;
    savings: number;
    difficulty: string;
    notes: string;
}[];
declare let totalPotentialSavings: number;
declare let easyWins: number;
declare let moderateChanges: number;
declare const remainingGap: number;
declare const newTotalSpending: number;
//# sourceMappingURL=cost-reduction-analysis.d.ts.map