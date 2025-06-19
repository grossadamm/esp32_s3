#!/usr/bin/env tsx
import sqlite3 from 'sqlite3';
import * as dotenv from 'dotenv';
dotenv.config();
class TaxAwareRetirementCalculator {
    db;
    // Tax rates for different income levels (federal + state estimate)
    TAX_RATES = {
        low: 0.25, // Lower income years, careful exercise timing
        standard: 0.35, // Current high income + state taxes
        high: 0.45 // Peak exercise year with AMT/NIIT
    };
    WITHDRAWAL_SCENARIOS = [
        { name: "Conservative", rate: 0.03, desc: "3% - Very safe, accounts for sequence risk" },
        { name: "Traditional", rate: 0.04, desc: "4% - Standard FIRE rule" },
        { name: "Aggressive", rate: 0.05, desc: "5% - Higher risk, requires flexibility" }
    ];
    EXCLUDED_SPENDING = new Set([
        'Transfer', 'Credit Card Payment', 'Auto Payment', 'Taxes'
    ]);
    constructor() {
        this.db = new sqlite3.Database('finance.db');
    }
    async getCurrentNetWorth() {
        return new Promise((resolve, reject) => {
            this.db.get(`
        SELECT SUM(balance) as total 
        FROM accounts 
        WHERE balance IS NOT NULL
      `, [], (err, row) => {
                if (err)
                    reject(err);
                else
                    resolve(row?.total || 0);
            });
        });
    }
    async getOptionsAnalysis() {
        return new Promise((resolve, reject) => {
            this.db.get(`
        SELECT 
          SUM(current_value) as total_value,
          SUM(exercise_cost) as total_exercise_cost
        FROM stock_options 
        WHERE symbol = 'NFLX'
      `, [], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                const grossValue = row?.total_value || 0;
                const exerciseCost = row?.total_exercise_cost || 0;
                const taxableGain = grossValue - exerciseCost;
                const taxRate = this.TAX_RATES.standard;
                const estimatedTax = taxableGain * taxRate;
                const netAfterTaxValue = grossValue - estimatedTax;
                resolve({
                    grossValue,
                    exerciseCost,
                    taxableGain,
                    estimatedTax,
                    netAfterTaxValue,
                    taxRate
                });
            });
        });
    }
    async getAnnualSpending() {
        return new Promise((resolve, reject) => {
            this.db.all(`
        SELECT 
          category,
          SUM(ABS(amount)) as total_amount
        FROM transactions 
        WHERE date >= date('now', '-365 days')
          AND amount < 0
          AND category IS NOT NULL
          AND category != ''
        GROUP BY category
      `, [], (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                let totalSpending = 0;
                for (const row of rows) {
                    if (!this.EXCLUDED_SPENDING.has(row.category)) {
                        totalSpending += row.total_amount;
                    }
                }
                resolve(totalSpending);
            });
        });
    }
    async getAnnualIncome() {
        return new Promise((resolve, reject) => {
            this.db.get(`
        SELECT SUM(amount) as total_income
        FROM transactions 
        WHERE date >= date('now', '-365 days')
          AND amount > 0
      `, [], (err, row) => {
                if (err)
                    reject(err);
                else
                    resolve(row?.total_income || 0);
            });
        });
    }
    calculateYearsToTarget(currentAmount, targetAmount, annualSavings, growthRate = 0.07) {
        if (annualSavings <= 0 || currentAmount >= targetAmount)
            return 0;
        const shortfall = targetAmount - currentAmount;
        // Simple approximation: shortfall / (savings + growth on current)
        const effectiveAnnualProgress = annualSavings + (currentAmount * growthRate);
        return Math.max(0, shortfall / effectiveAnnualProgress);
    }
    calculateScenarios(spending, netWorth, annualSavings) {
        return this.WITHDRAWAL_SCENARIOS.map(scenario => {
            const requiredPortfolio = spending / scenario.rate;
            const shortfall = Math.max(0, requiredPortfolio - netWorth);
            const canRetireNow = shortfall === 0;
            const yearsToRetirement = canRetireNow ? 0 : this.calculateYearsToTarget(netWorth, requiredPortfolio, annualSavings);
            const targetYear = new Date().getFullYear() + Math.ceil(yearsToRetirement);
            return {
                name: scenario.name,
                withdrawalRate: scenario.rate,
                description: scenario.desc,
                requiredPortfolio,
                canRetireNow,
                shortfall,
                yearsToRetirement,
                targetYear
            };
        });
    }
    generateRecommendations(analysis) {
        const recommendations = [];
        // Check for urgent options expirations
        if (analysis.urgentActions.length > 0) {
            recommendations.push("🚨 URGENT: Address expiring stock options immediately");
        }
        // Tax optimization
        if (analysis.optionsTaxAnalysis.taxableGain > 100000) {
            recommendations.push("💡 Consider multi-year options exercise strategy to manage tax brackets");
            recommendations.push("🏠 Evaluate moving to no-income-tax state before large option exercises");
            recommendations.push("📈 Consider charitable giving strategies with appreciated shares");
        }
        // Diversification
        const optionsPercent = (analysis.optionsTaxAnalysis.grossValue / analysis.currentNetWorth) * 100;
        if (optionsPercent > 40) {
            recommendations.push(`⚖️ Your Netflix position is ${optionsPercent.toFixed(0)}% of net worth - consider gradual diversification`);
        }
        // Timeline-specific advice
        const aggressiveScenario = analysis.scenarios.find(s => s.name === "Aggressive");
        if (aggressiveScenario && aggressiveScenario.yearsToRetirement < 1) {
            recommendations.push("🎯 You're within 1 year of retirement under aggressive scenario - start detailed planning");
        }
        else if (aggressiveScenario && aggressiveScenario.yearsToRetirement < 3) {
            recommendations.push("📅 Retirement is 2-3 years away - begin transition planning and tax optimization");
        }
        recommendations.push("📊 Regularly update this analysis as market conditions and income change");
        recommendations.push("👥 Consult with tax professional for personalized optimization strategy");
        return recommendations;
    }
    async getUrgentActions() {
        return new Promise((resolve, reject) => {
            this.db.get(`
        SELECT 
          COUNT(*) as expiring_count,
          SUM(current_value) as expiring_value
        FROM stock_options 
        WHERE symbol = 'NFLX' 
          AND expiration_date <= date('now', '+2 years')
      `, [], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                const actions = [];
                if (row?.expiring_count > 0) {
                    actions.push(`${row.expiring_count} Netflix grants worth $${row.expiring_value.toLocaleString()} expire within 2 years`);
                }
                resolve(actions);
            });
        });
    }
    async calculateRetirement() {
        const [netWorth, optionsAnalysis, annualSpending, annualIncome, urgentActions] = await Promise.all([
            this.getCurrentNetWorth(),
            this.getOptionsAnalysis(),
            this.getAnnualSpending(),
            this.getAnnualIncome(),
            this.getUrgentActions()
        ]);
        const annualSavings = annualIncome - annualSpending;
        const taxAdjustedNetWorth = netWorth - optionsAnalysis.estimatedTax;
        const scenarios = this.calculateScenarios(annualSpending, taxAdjustedNetWorth, annualSavings);
        const analysis = {
            currentNetWorth: netWorth,
            taxAdjustedNetWorth,
            annualSpending,
            annualSavings,
            scenarios,
            optionsTaxAnalysis: optionsAnalysis,
            recommendations: [],
            urgentActions
        };
        analysis.recommendations = this.generateRecommendations(analysis);
        return analysis;
    }
    close() {
        this.db.close();
    }
}
// CLI tool
async function main() {
    const calculator = new TaxAwareRetirementCalculator();
    try {
        console.log("🏖️  TAX-AWARE RETIREMENT ANALYSIS");
        console.log("=".repeat(60));
        console.log(`Analysis Date: ${new Date().toLocaleDateString()}`);
        const analysis = await calculator.calculateRetirement();
        console.log("\n💰 FINANCIAL SUMMARY:");
        console.log(`Current Net Worth: $${analysis.currentNetWorth.toLocaleString()}`);
        console.log(`Tax-Adjusted Net Worth: $${analysis.taxAdjustedNetWorth.toLocaleString()}`);
        console.log(`Annual Spending: $${analysis.annualSpending.toLocaleString()}`);
        console.log(`Annual Savings: $${analysis.annualSavings.toLocaleString()}`);
        console.log(`Savings Rate: ${((analysis.annualSavings / (analysis.annualSavings + analysis.annualSpending)) * 100).toFixed(1)}%`);
        console.log("\n📊 NETFLIX OPTIONS TAX ANALYSIS:");
        console.log(`Gross Value: $${analysis.optionsTaxAnalysis.grossValue.toLocaleString()}`);
        console.log(`Exercise Cost: $${analysis.optionsTaxAnalysis.exerciseCost.toLocaleString()}`);
        console.log(`Taxable Gain: $${analysis.optionsTaxAnalysis.taxableGain.toLocaleString()}`);
        console.log(`Estimated Tax (${(analysis.optionsTaxAnalysis.taxRate * 100).toFixed(0)}%): $${analysis.optionsTaxAnalysis.estimatedTax.toLocaleString()}`);
        console.log(`Net After-Tax Value: $${analysis.optionsTaxAnalysis.netAfterTaxValue.toLocaleString()}`);
        console.log("\n🎯 RETIREMENT SCENARIOS:");
        console.log("=".repeat(60));
        for (const scenario of analysis.scenarios) {
            console.log(`\n${scenario.name.toUpperCase()} (${(scenario.withdrawalRate * 100).toFixed(0)}% withdrawal):`);
            console.log(`  ${scenario.description}`);
            console.log(`  Required Portfolio: $${scenario.requiredPortfolio.toLocaleString()}`);
            if (scenario.canRetireNow) {
                const surplus = analysis.taxAdjustedNetWorth - scenario.requiredPortfolio;
                console.log(`  ✅ CAN RETIRE NOW! Surplus: $${surplus.toLocaleString()}`);
            }
            else {
                console.log(`  ❌ Shortfall: $${scenario.shortfall.toLocaleString()}`);
                console.log(`  📅 Years to retirement: ${scenario.yearsToRetirement.toFixed(1)}`);
                console.log(`  🗓️  Target year: ${scenario.targetYear}`);
            }
        }
        if (analysis.urgentActions.length > 0) {
            console.log("\n🚨 URGENT ACTIONS:");
            console.log("=".repeat(50));
            for (const action of analysis.urgentActions) {
                console.log(`⚠️  ${action}`);
            }
        }
        console.log("\n💡 RECOMMENDATIONS:");
        console.log("=".repeat(50));
        for (const rec of analysis.recommendations) {
            console.log(`${rec}`);
        }
        console.log("\n" + "=".repeat(60));
    }
    catch (error) {
        console.error('Error calculating retirement:', error);
    }
    finally {
        calculator.close();
    }
}
// Export for API use
export { TaxAwareRetirementCalculator };
// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
//# sourceMappingURL=retirement-calculator.js.map