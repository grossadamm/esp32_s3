// Quick gap analysis for $3.5M house
const TARGET_HOUSE_PRICE = 3500000;
const DOWN_PAYMENT_PERCENT = 0.20; // 20%
const INTEREST_RATE = 0.07; // 7%
const LOAN_TERM_YEARS = 30;

// Current financial position (from API data)
const CURRENT_MONTHLY_INCOME = 45990;
const CURRENT_MAX_MONTHLY_PAYMENT = 12877; // 28% of income
const LIQUID_ASSETS = 799449;
const STOCK_OPTIONS_NET_VALUE = 1253367;

// Calculate mortgage payment
function calculateMonthlyPayment(loanAmount: number, annualRate: number, years: number): number {
  const monthlyRate = annualRate / 12;
  const numPayments = years * 12;
  
  if (monthlyRate === 0) return loanAmount / numPayments;
  
  return loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
         (Math.pow(1 + monthlyRate, numPayments) - 1);
}

// Calculate required income for debt-to-income ratio
function calculateRequiredIncome(monthlyPayment: number, debtToIncomeRatio: number = 0.28): number {
  return monthlyPayment / debtToIncomeRatio;
}

console.log('\n💰 GAP ANALYSIS FOR $3.5M HOUSE');
console.log('================================\n');

// Down payment analysis
const requiredDownPayment = TARGET_HOUSE_PRICE * DOWN_PAYMENT_PERCENT;
const availableForDownPayment = LIQUID_ASSETS + (STOCK_OPTIONS_NET_VALUE * 0.5); // Use 50% of stock options
const downPaymentGap = requiredDownPayment - availableForDownPayment;

console.log('🏡 DOWN PAYMENT ANALYSIS:');
console.log(`Required (20%): $${requiredDownPayment.toLocaleString()}`);
console.log(`Available: $${availableForDownPayment.toLocaleString()}`);
console.log(`Gap: ${downPaymentGap > 0 ? '$' + downPaymentGap.toLocaleString() + ' SHORT' : '$' + Math.abs(downPaymentGap).toLocaleString() + ' SURPLUS'}\n`);

// Monthly payment analysis
const loanAmount = TARGET_HOUSE_PRICE - requiredDownPayment;
const requiredMonthlyPayment = calculateMonthlyPayment(loanAmount, INTEREST_RATE, LOAN_TERM_YEARS);
const monthlyPaymentGap = requiredMonthlyPayment - CURRENT_MAX_MONTHLY_PAYMENT;

console.log('📊 MONTHLY PAYMENT ANALYSIS:');
console.log(`Loan Amount: $${loanAmount.toLocaleString()}`);
console.log(`Required Monthly Payment: $${requiredMonthlyPayment.toLocaleString()}`);
console.log(`Current Max Payment Capacity: $${CURRENT_MAX_MONTHLY_PAYMENT.toLocaleString()}`);
console.log(`Gap: $${monthlyPaymentGap.toLocaleString()} SHORT\n`);

// Income requirement analysis
const requiredMonthlyIncome = calculateRequiredIncome(requiredMonthlyPayment);
const incomeGap = requiredMonthlyIncome - CURRENT_MONTHLY_INCOME;

console.log('💵 INCOME REQUIREMENT ANALYSIS:');
console.log(`Required Monthly Income: $${requiredMonthlyIncome.toLocaleString()}`);
console.log(`Current Monthly Income: $${CURRENT_MONTHLY_INCOME.toLocaleString()}`);
console.log(`Income Gap: $${incomeGap.toLocaleString()} SHORT`);
console.log(`Required Annual Income: $${(requiredMonthlyIncome * 12).toLocaleString()}\n`);

// Alternative scenarios
const aggressiveDownPayment = LIQUID_ASSETS + (STOCK_OPTIONS_NET_VALUE * 0.8); // 80% of stock options
const aggressiveDownPaymentPercent = aggressiveDownPayment / TARGET_HOUSE_PRICE;
const aggressiveLoanAmount = TARGET_HOUSE_PRICE - aggressiveDownPayment;
const aggressiveMonthlyPayment = calculateMonthlyPayment(aggressiveLoanAmount, INTEREST_RATE, LOAN_TERM_YEARS);
const aggressiveIncomeNeeded = calculateRequiredIncome(aggressiveMonthlyPayment);

console.log('🎯 ALTERNATIVE SCENARIO (LARGER DOWN PAYMENT):');
console.log(`Down Payment: $${aggressiveDownPayment.toLocaleString()} (${(aggressiveDownPaymentPercent * 100).toFixed(1)}%)`);
console.log(`Loan Amount: $${aggressiveLoanAmount.toLocaleString()}`);
console.log(`Monthly Payment: $${aggressiveMonthlyPayment.toLocaleString()}`);
console.log(`Required Monthly Income: $${aggressiveIncomeNeeded.toLocaleString()}`);
console.log(`Income Gap: $${(aggressiveIncomeNeeded - CURRENT_MONTHLY_INCOME).toLocaleString()}\n`);

// Summary
console.log('📋 SUMMARY FOR $3.5M HOUSE:');
console.log(`• Down Payment: ${downPaymentGap <= 0 ? '✅ COVERED' : '❌ SHORT $' + downPaymentGap.toLocaleString()}`);
console.log(`• Monthly Payment: ❌ SHORT $${monthlyPaymentGap.toLocaleString()}`);
console.log(`• Income Needed: ❌ NEED $${incomeGap.toLocaleString()} more monthly income`);
console.log(`• Annual Income Gap: $${(incomeGap * 12).toLocaleString()}`);

console.log('\n🔧 WAYS TO BRIDGE THE GAP:');
if (downPaymentGap > 0) {
  console.log(`• Exercise more stock options for down payment`);
}
console.log(`• Increase monthly income by $${incomeGap.toLocaleString()}`);
console.log(`• Consider a less expensive house ($2.4M max recommended)`);
console.log(`• Wait for interest rates to decrease`);
console.log(`• Consider interest-only or ARM loans (higher risk)`); 