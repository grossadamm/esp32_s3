interface HouseAffordabilityAnalysis {
    current_financial_position: {
        total_net_worth: number;
        liquid_assets: number;
        stock_options_value: number;
        stock_options_exercise_cost: number;
        stock_options_net_value: number;
        monthly_income: number;
        monthly_expenses: number;
        monthly_surplus: number;
        current_debt: number;
    };
    down_payment_scenarios: {
        conservative_10_percent: {
            down_payment: number;
            max_house_price: number;
            source: string;
        };
        moderate_20_percent: {
            down_payment: number;
            max_house_price: number;
            source: string;
        };
        aggressive_25_percent: {
            down_payment: number;
            max_house_price: number;
            source: string;
        };
    };
    monthly_affordability: {
        max_monthly_payment: number;
        debt_to_income_ratio: number;
        recommended_max_house_price: number;
        assumes: {
            interest_rate: number;
            loan_term_years: number;
            property_tax_rate: number;
            insurance_per_year: number;
            hoa_per_month: number;
        };
    };
    stock_options_strategy: {
        immediate_exercise: {
            available_cash: number;
            tax_liability: number;
            net_proceeds: number;
            recommended: boolean;
        };
        partial_exercise: {
            exercise_amount: number;
            tax_liability: number;
            available_for_house: number;
            remaining_options_value: number;
            recommended: boolean;
        };
        leverage_options: {
            borrow_against_options: number;
            estimated_interest_cost: number;
            monthly_payment: number;
            recommended: boolean;
        };
    };
    recommendations: {
        max_recommended_house_price: number;
        preferred_strategy: string;
        down_payment_amount: number;
        monthly_payment_estimate: number;
        key_considerations: string[];
        action_items: string[];
    };
}
export declare class HouseAffordabilityCalculator {
    private db;
    constructor();
    calculateAffordability(): Promise<HouseAffordabilityAnalysis>;
    private getAccountBalances;
    private getCashFlow;
    private getOptionsData;
    private calculateLiquidAssets;
    private calculateCurrentDebt;
    close(): void;
}
export {};
//# sourceMappingURL=house-affordability-calculator.d.ts.map