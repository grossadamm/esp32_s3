#!/usr/bin/env tsx
interface RetirementScenario {
    name: string;
    withdrawalRate: number;
    description: string;
    requiredPortfolio: number;
    canRetireNow: boolean;
    shortfall: number;
    yearsToRetirement: number;
    targetYear: number;
}
interface TaxAnalysis {
    grossValue: number;
    exerciseCost: number;
    taxableGain: number;
    estimatedTax: number;
    netAfterTaxValue: number;
    taxRate: number;
}
interface RetirementAnalysis {
    currentNetWorth: number;
    taxAdjustedNetWorth: number;
    annualSpending: number;
    annualSavings: number;
    scenarios: RetirementScenario[];
    optionsTaxAnalysis: TaxAnalysis;
    recommendations: string[];
    urgentActions: string[];
}
declare class TaxAwareRetirementCalculator {
    private db;
    private readonly TAX_RATES;
    private readonly WITHDRAWAL_SCENARIOS;
    private readonly EXCLUDED_SPENDING;
    constructor();
    private getCurrentNetWorth;
    private getOptionsAnalysis;
    private getAnnualSpending;
    private getAnnualIncome;
    private calculateYearsToTarget;
    private calculateScenarios;
    private generateRecommendations;
    private getUrgentActions;
    calculateRetirement(): Promise<RetirementAnalysis>;
    close(): void;
}
export { TaxAwareRetirementCalculator, RetirementAnalysis };
//# sourceMappingURL=retirement-calculator.d.ts.map