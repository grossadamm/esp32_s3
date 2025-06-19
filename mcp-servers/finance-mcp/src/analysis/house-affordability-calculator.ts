import sqlite3 from 'sqlite3';
import { promisify } from 'util';

interface DatabaseRow {
  [key: string]: any;
}

class DatabaseWrapper {
  private db: sqlite3.Database;
  public all: (sql: string, params?: any[]) => Promise<DatabaseRow[]>;
  public get: (sql: string, params?: any[]) => Promise<DatabaseRow | undefined>;

  constructor(filename: string) {
    this.db = new sqlite3.Database(filename);
    this.all = promisify(this.db.all.bind(this.db));
    this.get = promisify(this.db.get.bind(this.db));
  }

  close(): void {
    this.db.close();
  }
}

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

export class HouseAffordabilityCalculator {
  private db: DatabaseWrapper;

  constructor() {
    this.db = new DatabaseWrapper('./data/finance.db');
  }

  async calculateAffordability(): Promise<HouseAffordabilityAnalysis> {
    // Get current financial position
    const accounts = await this.getAccountBalances();
    const cashFlow = await this.getCashFlow();
    const optionsData = await this.getOptionsData();

    // Calculate liquid assets (excluding retirement accounts and stock options)
    const liquidAssets = this.calculateLiquidAssets(accounts);
    
    // Calculate monthly income and expenses
    const monthlyIncome = cashFlow.income / 3; // 90-day to monthly
    const monthlyExpenses = cashFlow.expenses / 3;
    const monthlySurplus = monthlyIncome - monthlyExpenses;

    // Current debt (credit cards and loans)
    const currentDebt = this.calculateCurrentDebt(accounts);

    // Stock options analysis
    const stockOptionsValue = optionsData.total_value;
    const stockOptionsExerciseCost = optionsData.total_exercise_cost;
    const stockOptionsNetValue = optionsData.net_value;

    // Tax rate for stock options (estimated)
    const stockOptionsTaxRate = 0.45; // 45% combined federal + state + payroll

    const currentFinancialPosition = {
      total_net_worth: accounts.total,
      liquid_assets: liquidAssets,
      stock_options_value: stockOptionsValue,
      stock_options_exercise_cost: stockOptionsExerciseCost,
      stock_options_net_value: stockOptionsNetValue,
      monthly_income: monthlyIncome,
      monthly_expenses: monthlyExpenses,
      monthly_surplus: monthlySurplus,
      current_debt: currentDebt
    };

    // Down payment scenarios
    const downPaymentScenarios = {
      conservative_10_percent: {
        down_payment: liquidAssets * 0.8, // Use 80% of liquid assets
        max_house_price: (liquidAssets * 0.8) / 0.10,
        source: "80% of current liquid assets (conservative cash preservation)"
      },
      moderate_20_percent: {
        down_payment: liquidAssets + (stockOptionsNetValue * 0.3), // Liquid + partial options exercise
        max_house_price: (liquidAssets + (stockOptionsNetValue * 0.3)) / 0.20,
        source: "All liquid assets + 30% of stock options (after taxes)"
      },
      aggressive_25_percent: {
        down_payment: liquidAssets + (stockOptionsNetValue * 0.5), // Liquid + half options
        max_house_price: (liquidAssets + (stockOptionsNetValue * 0.5)) / 0.25,
        source: "All liquid assets + 50% of stock options (after taxes)"
      }
    };

    // Monthly affordability analysis
    const maxDebtToIncomeRatio = 0.28; // Conservative 28% front-end ratio
    const maxMonthlyPayment = monthlyIncome * maxDebtToIncomeRatio;
    
    // Mortgage calculation assumptions
    const interestRate = 0.07; // 7% current rates
    const loanTermYears = 30;
    const propertyTaxRate = 0.012; // 1.2% annually
    const insurancePerYear = 2000;
    const hoaPerMonth = 200;

    // Calculate max house price based on monthly payment
    const monthlyRate = interestRate / 12;
    const numPayments = loanTermYears * 12;
    const maxLoanAmount = maxMonthlyPayment / (
      monthlyRate * Math.pow(1 + monthlyRate, numPayments) / 
      (Math.pow(1 + monthlyRate, numPayments) - 1)
    );

    const monthlyAffordability = {
      max_monthly_payment: maxMonthlyPayment,
      debt_to_income_ratio: maxDebtToIncomeRatio,
      recommended_max_house_price: maxLoanAmount / 0.8, // Assuming 20% down
      assumes: {
        interest_rate: interestRate,
        loan_term_years: loanTermYears,
        property_tax_rate: propertyTaxRate,
        insurance_per_year: insurancePerYear,
        hoa_per_month: hoaPerMonth
      }
    };

    // Stock options strategies
    const stockOptionsStrategy = {
      immediate_exercise: {
        available_cash: stockOptionsExerciseCost,
        tax_liability: stockOptionsNetValue * stockOptionsTaxRate,
        net_proceeds: stockOptionsNetValue * (1 - stockOptionsTaxRate),
        recommended: false // Too much tax hit at once
      },
      partial_exercise: {
        exercise_amount: stockOptionsValue * 0.3,
        tax_liability: (stockOptionsValue * 0.3 - stockOptionsExerciseCost * 0.3) * stockOptionsTaxRate,
        available_for_house: (stockOptionsValue * 0.3 - stockOptionsExerciseCost * 0.3) * (1 - stockOptionsTaxRate),
        remaining_options_value: stockOptionsValue * 0.7,
        recommended: true
      },
      leverage_options: {
        borrow_against_options: stockOptionsValue * 0.5, // 50% LTV
        estimated_interest_cost: stockOptionsValue * 0.5 * 0.06, // 6% interest
        monthly_payment: (stockOptionsValue * 0.5 * 0.06) / 12,
        recommended: false // Risky with single stock concentration
      }
    };

    // Final recommendations
    const recommendedStrategy = downPaymentScenarios.moderate_20_percent;
    const maxRecommendedHousePrice = Math.min(
      recommendedStrategy.max_house_price,
      monthlyAffordability.recommended_max_house_price
    );

    const recommendations = {
      max_recommended_house_price: maxRecommendedHousePrice,
      preferred_strategy: "20% down using liquid assets + partial stock options exercise",
      down_payment_amount: recommendedStrategy.down_payment,
      monthly_payment_estimate: maxMonthlyPayment,
      key_considerations: [
        "Stock options create significant tax liability when exercised",
        "Current monthly surplus of $" + monthlySurplus.toFixed(0) + " provides good payment cushion",
        "Netflix stock concentration risk - consider diversification after house purchase",
        "Interest rates at 7% - consider timing if rates may decrease",
        "Emergency fund should remain separate from down payment funds"
      ],
      action_items: [
        "Meet with tax advisor to optimize stock options exercise timing",
        "Get pre-approved for mortgage to understand actual rates/terms",
        "Consider exercising options gradually to spread tax burden",
        "Set aside 6-month emergency fund before house purchase",
        "Research property tax rates in target areas"
      ]
    };

    return {
      current_financial_position: currentFinancialPosition,
      down_payment_scenarios: downPaymentScenarios,
      monthly_affordability: monthlyAffordability,
      stock_options_strategy: stockOptionsStrategy,
      recommendations: recommendations
    };
  }

  private async getAccountBalances(): Promise<any> {
    const rows = await this.db.all('SELECT name, type, balance FROM accounts WHERE balance IS NOT NULL');
    
    const accounts: Record<string, any> = {};
    let total = 0;

    for (const row of rows) {
      accounts[row.name] = {
        name: row.name,
        type: row.type,
        balance: row.balance,
      };
      total += row.balance;
    }

    return { accounts, total };
  }

  private async getCashFlow(): Promise<any> {
    const days = 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoff = cutoffDate.toISOString().split('T')[0];

    const incomeRow = await this.db.get(
      'SELECT SUM(amount) as total FROM transactions WHERE date >= ? AND amount > 0',
      [cutoff]
    );

    const expenseRow = await this.db.get(
      'SELECT SUM(amount) as total FROM transactions WHERE date >= ? AND amount < 0',
      [cutoff]
    );

    const income = incomeRow?.total || 0;
    const expenses = Math.abs(expenseRow?.total || 0);

    return { income, expenses };
  }

  private async getOptionsData(): Promise<any> {
    const summary = await this.db.get(`
      SELECT 
        COUNT(*) as total_grants,
        SUM(current_value) as total_value,
        SUM(exercise_cost) as total_exercise_cost,
        SUM(intrinsic_value) as total_intrinsic_value
      FROM stock_options
    `);

    return {
      total_grants: summary?.total_grants || 0,
      total_value: summary?.total_value || 0,
      total_exercise_cost: summary?.total_exercise_cost || 0,
      total_intrinsic_value: summary?.total_intrinsic_value || 0,
      net_value: (summary?.total_value || 0) - (summary?.total_exercise_cost || 0)
    };
  }

  private calculateLiquidAssets(accounts: any): number {
    const liquidAccountTypes = ['depository', 'brokerage'];
    const excludeRetirement = ['401(K)', 'IRA', 'ROTH', 'Health Savings'];
    const excludeStockPlan = ['Stock Plan'];

    let liquidAssets = 0;
    
    for (const [name, account] of Object.entries(accounts.accounts)) {
      const acc = account as any;
      if (acc.balance > 0 && liquidAccountTypes.includes(acc.type)) {
        // Exclude retirement accounts and stock plan
        const isRetirement = excludeRetirement.some(keyword => 
          acc.name.toUpperCase().includes(keyword.toUpperCase())
        );
        const isStockPlan = excludeStockPlan.some(keyword => 
          acc.name.toUpperCase().includes(keyword.toUpperCase())
        );
        
        if (!isRetirement && !isStockPlan) {
          liquidAssets += acc.balance;
        }
      }
    }

    return liquidAssets;
  }

  private calculateCurrentDebt(accounts: any): number {
    let totalDebt = 0;
    
    for (const [name, account] of Object.entries(accounts.accounts)) {
      const acc = account as any;
      if (acc.balance < 0 && (acc.type === 'credit' || acc.type === 'loan')) {
        totalDebt += Math.abs(acc.balance);
      }
    }

    return totalDebt;
  }

  close(): void {
    this.db.close();
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const calculator = new HouseAffordabilityCalculator();
  
  calculator.calculateAffordability()
    .then((analysis) => {
      console.log('\n🏠 HOUSE AFFORDABILITY ANALYSIS');
      console.log('=====================================\n');
      
      console.log('💰 CURRENT FINANCIAL POSITION:');
      console.log(`Total Net Worth: $${analysis.current_financial_position.total_net_worth.toLocaleString()}`);
      console.log(`Liquid Assets: $${analysis.current_financial_position.liquid_assets.toLocaleString()}`);
      console.log(`Stock Options Value: $${analysis.current_financial_position.stock_options_value.toLocaleString()}`);
      console.log(`Monthly Income: $${analysis.current_financial_position.monthly_income.toLocaleString()}`);
      console.log(`Monthly Surplus: $${analysis.current_financial_position.monthly_surplus.toLocaleString()}`);
      console.log(`Current Debt: $${analysis.current_financial_position.current_debt.toLocaleString()}\n`);

      console.log('🏡 DOWN PAYMENT SCENARIOS:');
      console.log(`Conservative (10% down): $${analysis.down_payment_scenarios.conservative_10_percent.max_house_price.toLocaleString()} house price`);
      console.log(`Moderate (20% down): $${analysis.down_payment_scenarios.moderate_20_percent.max_house_price.toLocaleString()} house price`);
      console.log(`Aggressive (25% down): $${analysis.down_payment_scenarios.aggressive_25_percent.max_house_price.toLocaleString()} house price\n`);

      console.log('📊 MONTHLY AFFORDABILITY:');
      console.log(`Max Monthly Payment: $${analysis.monthly_affordability.max_monthly_payment.toLocaleString()}`);
      console.log(`Based on Income: $${analysis.monthly_affordability.recommended_max_house_price.toLocaleString()} house price\n`);

      console.log('🎯 FINAL RECOMMENDATION:');
      console.log(`Max Recommended House Price: $${analysis.recommendations.max_recommended_house_price.toLocaleString()}`);
      console.log(`Strategy: ${analysis.recommendations.preferred_strategy}`);
      console.log(`Down Payment: $${analysis.recommendations.down_payment_amount.toLocaleString()}\n`);

      console.log('⚠️  KEY CONSIDERATIONS:');
      analysis.recommendations.key_considerations.forEach(item => {
        console.log(`• ${item}`);
      });

      console.log('\n✅ ACTION ITEMS:');
      analysis.recommendations.action_items.forEach(item => {
        console.log(`• ${item}`);
      });

      calculator.close();
    })
    .catch((error) => {
      console.error('Error:', error);
      calculator.close();
      process.exit(1);
    });
} 