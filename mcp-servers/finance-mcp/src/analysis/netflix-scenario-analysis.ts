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

class NetflixScenarioAnalyzer {
  private db: DatabaseWrapper;

  constructor(dbPath: string = './finance.db') {
    this.db = new DatabaseWrapper(dbPath);
  }

  async analyzeScenario(targetPrice: number = 2000): Promise<void> {
    console.log(`\n🎯 NETFLIX SCENARIO ANALYSIS: What if NFLX hits $${targetPrice} in next 3 years?\n`);

    // Get current options position
    const currentOptions = await this.db.all(`
      SELECT 
        grant_number,
        grant_date,
        expiration_date,
        exercise_price,
        quantity,
        current_value,
        exercise_cost
      FROM stock_options 
      WHERE symbol = 'NFLX'
      ORDER BY expiration_date
    `);

    const currentPrice = 1225.35; // Current NFLX price

    // Calculate current vs scenario values
    let currentTotalValue = 0;
    let scenarioTotalValue = 0;
    let totalExerciseCost = 0;
    let expiringBefore2028 = [];

    console.log('📊 CURRENT POSITION vs $2,000 SCENARIO:\n');

    for (const option of currentOptions) {
      const currentIntrinsic = Math.max(0, currentPrice - option.exercise_price) * option.quantity;
      const scenarioIntrinsic = Math.max(0, targetPrice - option.exercise_price) * option.quantity;
      
      currentTotalValue += currentIntrinsic;
      scenarioTotalValue += scenarioIntrinsic;
      totalExerciseCost += option.exercise_cost;

      // Check if expires before 2028 (urgent decisions)
      if (new Date(option.expiration_date) < new Date('2028-01-01')) {
        expiringBefore2028.push({
          grant_number: option.grant_number,
          expiration_date: option.expiration_date,
          exercise_cost: option.exercise_cost,
          currentValue: currentIntrinsic,
          scenarioValue: scenarioIntrinsic,
          upside: scenarioIntrinsic - currentIntrinsic
        });
      }
    }

    console.log(`Current total value (@$${currentPrice}): $${currentTotalValue.toLocaleString()}`);
    console.log(`Scenario value (@$${targetPrice}): $${scenarioTotalValue.toLocaleString()}`);
    console.log(`Additional upside: $${(scenarioTotalValue - currentTotalValue).toLocaleString()}`);
    console.log(`Total exercise cost: $${totalExerciseCost.toLocaleString()}\n`);

    // Tax implications at both price levels
    const highTaxRate = 0.45; // Fed + State + AMT
    
    const currentGain = currentTotalValue - totalExerciseCost;
    const currentTaxBill = currentGain * highTaxRate;
    const currentAfterTax = currentTotalValue - currentTaxBill;

    const scenarioGain = scenarioTotalValue - totalExerciseCost;
    const scenarioTaxBill = scenarioGain * highTaxRate;
    const scenarioAfterTax = scenarioTotalValue - scenarioTaxBill;

    console.log('💸 TAX IMPLICATIONS COMPARISON:\n');
    console.log(`Current scenario (@$${currentPrice}):`);
    console.log(`   Gain: $${currentGain.toLocaleString()}`);
    console.log(`   Tax (45%): $${currentTaxBill.toLocaleString()}`);
    console.log(`   After-tax value: $${currentAfterTax.toLocaleString()}\n`);

    console.log(`$${targetPrice} scenario:`);
    console.log(`   Gain: $${scenarioGain.toLocaleString()}`);
    console.log(`   Tax (45%): $${scenarioTaxBill.toLocaleString()}`);
    console.log(`   After-tax value: $${scenarioAfterTax.toLocaleString()}\n`);

    // Timeline pressure analysis
    console.log('⏰ EXPIRATION TIMELINE PRESSURE:\n');
    console.log(`Options expiring before 2028 (URGENT decisions): ${expiringBefore2028.length}`);
    
    let urgentCurrentValue = 0;
    let urgentScenarioValue = 0;
    let urgentExerciseCost = 0;

    expiringBefore2028.forEach(option => {
      urgentCurrentValue += option.currentValue;
      urgentScenarioValue += option.scenarioValue;
      urgentExerciseCost += option.exercise_cost;
    });

    console.log(`Urgent options current value: $${urgentCurrentValue.toLocaleString()}`);
    console.log(`Urgent options @$${targetPrice}: $${urgentScenarioValue.toLocaleString()}`);
    console.log(`Additional upside on urgent options: $${(urgentScenarioValue - urgentCurrentValue).toLocaleString()}\n`);

    // Compare to S&P 500 growth
    console.log('📈 S&P 500 COMPARISON (3-year projection):\n');
    
    // Assume 10% annual S&P 500 growth (reasonable historical average)
    const sp500AnnualGrowth = 0.10;
    const years = 3;
    const sp500Growth = Math.pow(1 + sp500AnnualGrowth, years) - 1;
    
    // Original after-tax investment equivalent
    const originalAfterTax = totalExerciseCost * (1 - 0.37); // $374,844
    const sp500FutureValue = originalAfterTax * (1 + sp500Growth);
    
    // Borrowing capacity in 3 years
    const borrowingCapacity = sp500FutureValue * 0.6; // 60% LTV
    const annualBorrowingCost = borrowingCapacity * 0.04; // 4% rate

    console.log(`S&P 500 3-year growth (10% annual): ${(sp500Growth * 100).toFixed(1)}%`);
    console.log(`S&P 500 portfolio value in 3 years: $${sp500FutureValue.toLocaleString()}`);
    console.log(`Borrowing capacity (60% LTV): $${borrowingCapacity.toLocaleString()}`);
    console.log(`Annual borrowing cost: $${annualBorrowingCost.toLocaleString()}\n`);

    // Net opportunity analysis
    console.log('🎯 NET OPPORTUNITY ANALYSIS:\n');
    
    const netflixAdvantage = scenarioAfterTax - sp500FutureValue;
    const liquidityAdvantage = scenarioAfterTax - borrowingCapacity;

    console.log(`Netflix after-tax value @$${targetPrice}: $${scenarioAfterTax.toLocaleString()}`);
    console.log(`S&P 500 portfolio value: $${sp500FutureValue.toLocaleString()}`);
    
    if (netflixAdvantage > 0) {
      console.log(`✅ Netflix advantage: $${netflixAdvantage.toLocaleString()}`);
    } else {
      console.log(`❌ S&P 500 advantage: $${Math.abs(netflixAdvantage).toLocaleString()}`);
    }

    console.log(`\nAccessible liquidity comparison:`);
    console.log(`   Netflix (after-tax): $${scenarioAfterTax.toLocaleString()}`);
    console.log(`   S&P 500 (borrowed): $${borrowingCapacity.toLocaleString()}`);
    
    if (liquidityAdvantage > 0) {
      console.log(`   ✅ Netflix provides $${liquidityAdvantage.toLocaleString()} more liquidity\n`);
    } else {
      console.log(`   ❌ S&P 500 provides $${Math.abs(liquidityAdvantage).toLocaleString()} more liquidity\n`);
    }

    // Risk analysis
    console.log('⚠️  RISK ANALYSIS:\n');
    
    const nflxReturnsNeeded = (targetPrice / currentPrice) - 1;
    const sp500Returns = sp500Growth;
    
    console.log(`Returns needed:`);
    console.log(`   Netflix: ${(nflxReturnsNeeded * 100).toFixed(1)}% in 3 years (${((Math.pow(1 + nflxReturnsNeeded, 1/3) - 1) * 100).toFixed(1)}% annually)`);
    console.log(`   S&P 500: ${(sp500Returns * 100).toFixed(1)}% in 3 years (${(sp500AnnualGrowth * 100).toFixed(1)}% annually)\n`);

    console.log('📊 STRATEGIC IMPLICATIONS:\n');
    
    if (netflixAdvantage > 200000) {
      console.log('✅ If NFLX hits $2,000, Netflix options provide substantial advantage');
    } else if (netflixAdvantage > 0) {
      console.log('⚖️  If NFLX hits $2,000, Netflix has modest advantage');
    } else {
      console.log('❌ Even at $2,000, S&P 500 strategy may be superior');
    }

    console.log(`\n💡 KEY DECISIONS:`);
    console.log(`   • Stop new option contributions: Focus capital on diversified investments`);
    console.log(`   • Monitor expiring options: ${expiringBefore2028.length} expire before 2028`);
    console.log(`   • Exercise timing: Consider tax implications and market conditions`);
    console.log(`   • Risk management: Netflix concentration vs diversification trade-off`);
    
    // Calculate break-even Netflix price
    const breakEvenGain = sp500FutureValue - totalExerciseCost;
    const breakEvenValue = breakEvenGain / (1 - highTaxRate) + totalExerciseCost;
    const breakEvenPrice = breakEvenValue / (currentOptions.reduce((sum, opt) => sum + opt.quantity, 0));
    
    console.log(`\n🎯 BREAK-EVEN ANALYSIS:`);
    console.log(`   Netflix needs to reach $${breakEvenPrice.toFixed(2)} to match S&P 500 after taxes`);
    console.log(`   That's ${((breakEvenPrice / currentPrice - 1) * 100).toFixed(1)}% upside needed vs ${(sp500Growth * 100).toFixed(1)}% for S&P 500`);
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

async function main() {
  const analyzer = new NetflixScenarioAnalyzer();
  
  try {
    await analyzer.analyzeScenario(2000);
  } catch (error) {
    console.error('💥 Analysis failed:', error);
    process.exit(1);
  } finally {
    await analyzer.close();
  }
}

// Run analysis
main(); 