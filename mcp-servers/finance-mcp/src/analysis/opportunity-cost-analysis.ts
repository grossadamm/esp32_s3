import fs from 'fs';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';

interface DatabaseRow {
  [key: string]: any;
}

class DatabaseWrapper {
  private db: sqlite3.Database;
  public all: (sql: string, params?: any[]) => Promise<DatabaseRow[]>;
  public get: (sql: string, params?: any[]) => Promise<DatabaseRow | undefined>;
  public run: (sql: string, params?: any[]) => Promise<void>;

  constructor(filename: string) {
    this.db = new sqlite3.Database(filename);
    this.all = promisify(this.db.all.bind(this.db));
    this.get = promisify(this.db.get.bind(this.db));
    this.run = promisify(this.db.run.bind(this.db));
  }

  close(): void {
    this.db.close();
  }
}

interface OptionGrant {
  grant_date: string;
  exercise_cost: number;
  current_value: number;
}

class OpportunityCostAnalyzer {
  private db: DatabaseWrapper;

  constructor(dbPath: string = './finance.db') {
    this.db = new DatabaseWrapper(dbPath);
  }

  async fetchSP500Data(): Promise<void> {
    console.log('📈 Fetching S&P 500 historical data...');
    
    const API_KEY = 'H7NU47N5NIPL94NY';
    const symbol = 'SPY'; // S&P 500 ETF as proxy
    
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=full&apikey=${API_KEY}`;
    
    try {
      const response = await fetch(url);
      const data = await response.json() as any;
      
      if (data['Error Message']) {
        throw new Error(`API Error: ${data['Error Message']}`);
      }
      
      const timeSeries = data['Time Series (Daily)'];
      if (!timeSeries) {
        throw new Error('No S&P 500 time series data found');
      }

      // Create table for S&P 500 data
      await this.db.run(`
        CREATE TABLE IF NOT EXISTS sp500_prices (
          date TEXT PRIMARY KEY,
          close REAL NOT NULL
        )
      `);

      console.log('💾 Importing S&P 500 data...');
      let imported = 0;

      for (const [date, values] of Object.entries(timeSeries)) {
        const dayData = values as any;
        try {
          await this.db.run(
            'INSERT OR REPLACE INTO sp500_prices (date, close) VALUES (?, ?)',
            [date, parseFloat(dayData['4. close'])]
          );
          imported++;
        } catch (error) {
          // Skip errors
        }
      }

      console.log(`✅ Imported ${imported} days of S&P 500 data`);
      
    } catch (error) {
      console.error('❌ Error fetching S&P 500 data:', error);
      throw error;
    }
  }

  async getOptionsInvestmentByYear(): Promise<Map<number, number>> {
    const options = await this.db.all(`
      SELECT grant_date, exercise_cost 
      FROM stock_options 
      WHERE symbol = 'NFLX'
      ORDER BY grant_date
    `);

    const investmentByYear = new Map<number, number>();

    for (const option of options) {
      const year = new Date(option.grant_date).getFullYear();
      const currentTotal = investmentByYear.get(year) || 0;
      investmentByYear.set(year, currentTotal + option.exercise_cost);
    }

    return investmentByYear;
  }

  async calculateSP500Returns(): Promise<{totalReturn: number, annualizedReturn: number}> {
    // Get S&P 500 prices for our investment period
    const startDate = '2016-10-01'; // Around first option grant
    const endDate = '2025-06-16';   // Latest data

    const startPrice = await this.db.get(
      'SELECT close FROM sp500_prices WHERE date >= ? ORDER BY date ASC LIMIT 1',
      [startDate]
    );

    const endPrice = await this.db.get(
      'SELECT close FROM sp500_prices WHERE date <= ? ORDER BY date DESC LIMIT 1',
      [endDate]
    );

    if (!startPrice || !endPrice) {
      throw new Error('Could not find S&P 500 price data for period');
    }

    const totalReturn = (endPrice.close - startPrice.close) / startPrice.close;
    
    // Calculate years between dates
    const years = (new Date(endDate).getTime() - new Date(startPrice.date || startDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    const annualizedReturn = Math.pow(1 + totalReturn, 1/years) - 1;

    console.log(`📊 S&P 500 Analysis (${startPrice.date || startDate} to ${endPrice.date || endDate}):`);
    console.log(`   Start Price: $${startPrice.close.toFixed(2)}`);
    console.log(`   End Price: $${endPrice.close.toFixed(2)}`);
    console.log(`   Total Return: ${(totalReturn * 100).toFixed(1)}%`);
    console.log(`   Annualized Return: ${(annualizedReturn * 100).toFixed(1)}%`);
    console.log(`   Period: ${years.toFixed(1)} years`);

    return { totalReturn, annualizedReturn };
  }

  async performOpportunityCostAnalysis(): Promise<void> {
    console.log('\n🎯 OPPORTUNITY COST ANALYSIS: Netflix Options vs S&P 500\n');
    console.log('🚨 CRITICAL TAX CONSIDERATION: Options require exercise (taxable event) vs S&P 500 allows borrowing (no tax)\n');

    // Get current Netflix options position
    const optionsSummary = await this.db.get(`
      SELECT 
        SUM(exercise_cost) as total_exercise_cost,
        SUM(current_value) as total_current_value
      FROM stock_options 
      WHERE symbol = 'NFLX'
    `);

    if (!optionsSummary) {
      throw new Error('Could not retrieve options summary');
    }

    const optionsInvested = optionsSummary.total_exercise_cost;
    const optionsCurrentValue = optionsSummary.total_current_value;
    const optionsGain = optionsCurrentValue - optionsInvested;
    const optionsReturn = optionsGain / optionsInvested;

    console.log('📈 NETFLIX OPTIONS INVESTMENT:');
    console.log(`   Amount Invested (pre-tax): $${optionsInvested.toLocaleString()}`);
    console.log(`   Current Value: $${optionsCurrentValue.toLocaleString()}`);
    console.log(`   Total Gain: $${optionsGain.toLocaleString()}`);
    console.log(`   Total Return: ${(optionsReturn * 100).toFixed(1)}%`);

    // Tax implications of exercising options
    const highTaxRate = 0.45; // 37% federal + 8% state + potential AMT
    const optionsTaxOwed = optionsGain * highTaxRate;
    const optionsAfterTax = optionsCurrentValue - optionsTaxOwed;

    console.log(`\n💸 NETFLIX OPTIONS TAX IMPACT (Upon Exercise):`);
    console.log(`   Taxable gain: $${optionsGain.toLocaleString()}`);
    console.log(`   Tax rate (Fed+State+AMT): ${(highTaxRate * 100).toFixed(0)}%`);
    console.log(`   Tax owed: $${optionsTaxOwed.toLocaleString()}`);
    console.log(`   After-tax value: $${optionsAfterTax.toLocaleString()}`);

    // Calculate after-tax equivalent investment for S&P 500
    const initialTaxRate = 0.37; // What you saved initially
    const afterTaxEquivalent = optionsInvested * (1 - initialTaxRate);

    // Get S&P 500 returns
    const sp500Returns = await this.calculateSP500Returns();
    const sp500FinalValue = afterTaxEquivalent * (1 + sp500Returns.totalReturn);

    console.log(`\n📊 S&P 500 ALTERNATIVE INVESTMENT:`);
    console.log(`   Amount invested (after-tax): $${afterTaxEquivalent.toLocaleString()}`);
    console.log(`   Final value (pre-tax): $${sp500FinalValue.toLocaleString()}`);

    // S&P 500 borrowing strategy
    const borrowingRate = 0.04; // 4% typical securities-based lending rate
    const maxBorrowRatio = 0.6; // 60% loan-to-value typical
    const maxBorrowAmount = sp500FinalValue * maxBorrowRatio;
    const annualInterest = maxBorrowAmount * borrowingRate;

    console.log(`\n🏦 S&P 500 BORROWING STRATEGY (No Tax Event):`);
    console.log(`   Portfolio value: $${sp500FinalValue.toLocaleString()}`);
    console.log(`   Max borrowing (60% LTV): $${maxBorrowAmount.toLocaleString()}`);
    console.log(`   Annual interest (4%): $${annualInterest.toLocaleString()}`);
    console.log(`   Tax liability: $0 (no sale/realization)`);
    console.log(`   Available liquidity: $${maxBorrowAmount.toLocaleString()}`);

    // Compare accessible cash
    const optionsAccessibleCash = optionsAfterTax; // Must pay taxes to access
    const sp500AccessibleCash = maxBorrowAmount; // No taxes, just interest

    console.log(`\n💰 ACCESSIBLE LIQUIDITY COMPARISON:`);
    console.log(`   Netflix options (after-tax): $${optionsAccessibleCash.toLocaleString()}`);
    console.log(`   S&P 500 (borrowed, no tax): $${sp500AccessibleCash.toLocaleString()}`);
    
    const liquidityDifference = optionsAccessibleCash - sp500AccessibleCash;
    
    if (liquidityDifference > 0) {
      console.log(`   ✅ Netflix provides +$${liquidityDifference.toLocaleString()} more liquidity`);
    } else {
      console.log(`   ❌ Netflix provides $${Math.abs(liquidityDifference).toLocaleString()} less liquidity`);
    }

    // Long-term tax implications
    console.log(`\n🏛️  LONG-TERM TAX STRATEGY IMPLICATIONS:`);
    console.log(`   Netflix Options:`);
    console.log(`     • MUST exercise before expiration (forced tax event)`);
    console.log(`     • Gain taxed as ordinary income (up to 45%)`);
    console.log(`     • No step-up basis benefit`);
    console.log(`     • Tax bill: $${optionsTaxOwed.toLocaleString()}`);
    
    console.log(`\n   S&P 500 Investment:`);
    console.log(`     • NEVER required to sell (voluntary tax timing)`);
    console.log(`     • Long-term capital gains rate (0%, 15%, or 20%)`);
    console.log(`     • Step-up basis at death (estate planning)`);
    console.log(`     • Borrow against assets indefinitely`);
    console.log(`     • Annual borrowing cost: $${annualInterest.toLocaleString()}`);

    // Calculate true opportunity cost including taxes
    const netOptionsValue = optionsAfterTax;
    const netSP500Strategy = sp500FinalValue; // Keeps full value, borrows against it

    console.log(`\n🎯 TRUE OPPORTUNITY COST (Tax-Adjusted):`);
    console.log(`   Netflix net after-tax value: $${netOptionsValue.toLocaleString()}`);
    console.log(`   S&P 500 retained value: $${netSP500Strategy.toLocaleString()}`);
    
    const trueOpportunityCost = netOptionsValue - netSP500Strategy;
    
    if (trueOpportunityCost > 0) {
      console.log(`   ✅ Netflix still ahead by: $${trueOpportunityCost.toLocaleString()}`);
    } else {
      console.log(`   ❌ S&P 500 strategy wins by: $${Math.abs(trueOpportunityCost).toLocaleString()}`);
    }

    console.log(`\n💡 STRATEGIC INSIGHTS:`);
    console.log(`   • Tax burden dramatically reduces Netflix advantage`);
    console.log(`   • S&P 500 offers superior tax flexibility`);
    console.log(`   • Borrowing costs (~4%) << tax rates (~45%)`);
    console.log(`   • Estate planning: S&P 500 has step-up basis advantage`);
    console.log(`   • Liquidity: Both provide substantial accessible cash`);
    
    const yearsToBreakEven = Math.abs(trueOpportunityCost) / annualInterest;
    if (trueOpportunityCost < 0) {
      console.log(`   • Break-even: S&P 500 borrowing costs paid for ${yearsToBreakEven.toFixed(1)} years`);
    }
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

async function main() {
  const analyzer = new OpportunityCostAnalyzer();
  
  try {
    // Fetch S&P 500 data
    await analyzer.fetchSP500Data();
    
    // Perform analysis
    await analyzer.performOpportunityCostAnalysis();
    
  } catch (error) {
    console.error('💥 Analysis failed:', error);
    process.exit(1);
  } finally {
    await analyzer.close();
  }
}

// Run analysis
main(); 