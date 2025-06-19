// Cost Reduction Analysis for $3.5M House Gap
const MONTHLY_GAP_NEEDED = 5751;

console.log('\n💰 COST REDUCTION ANALYSIS');
console.log('==========================');
console.log(`Target Monthly Savings Needed: $${MONTHLY_GAP_NEEDED.toLocaleString()}\n`);

// Current monthly spending (derived from 3-month data)
const currentSpending = {
  shopping: 3220,           // $9,659 ÷ 3 months
  restaurants: 1172,        // $3,516 ÷ 3 months  
  insurance: 1167,          // $3,500.9 ÷ 3 months
  groceries: 861,           // $2,583 ÷ 3 months
  autoPayment: 751,         // Toyota lease
  entertainment: 615,       // $1,844 ÷ 3 months
  gas: 574,                 // $1,722 ÷ 3 months
  pgE: 581,                 // Utilities
  education: 778,           // Preschool
  medical: 588,             // $1,764 ÷ 3 months
  personal: 561             // $1,684 ÷ 3 months
};

console.log('📊 CURRENT MONTHLY SPENDING BY CATEGORY:');
Object.entries(currentSpending)
  .sort(([,a], [,b]) => b - a)
  .forEach(([category, amount]) => {
    console.log(`${category.charAt(0).toUpperCase() + category.slice(1)}: $${amount.toLocaleString()}`);
  });

console.log('\n🎯 POTENTIAL COST REDUCTIONS:\n');

const reductions = [
  {
    category: 'Shopping',
    current: 3220,
    potential: 1500,
    savings: 1720,
    difficulty: 'Easy',
    notes: 'Reduce Amazon/online shopping by 53% - still $1,500/month budget'
  },
  {
    category: 'Restaurants & Bars', 
    current: 1172,
    potential: 500,
    savings: 672,
    difficulty: 'Moderate',
    notes: 'Cook more at home, limit dining out to special occasions'
  },
  {
    category: 'Auto Payment',
    current: 751,
    potential: 400,
    savings: 351,
    difficulty: 'Moderate', 
    notes: 'Buy out Toyota lease or downgrade to cheaper vehicle'
  },
  {
    category: 'Entertainment',
    current: 615,
    potential: 300,
    savings: 315,
    difficulty: 'Easy',
    notes: 'Reduce entertainment spending by 50%'
  },
  {
    category: 'Insurance',
    current: 1167,
    potential: 900,
    savings: 267,
    difficulty: 'Easy',
    notes: 'Shop for better rates, bundle policies'
  },
  {
    category: 'Gas',
    current: 574,
    potential: 400,
    savings: 174,
    difficulty: 'Easy',
    notes: 'Optimize driving, work from home more'
  },
  {
    category: 'Personal',
    current: 561,
    potential: 300,
    savings: 261,
    difficulty: 'Easy',
    notes: 'Reduce personal/miscellaneous spending'
  },
  {
    category: 'PG&E',
    current: 581,
    potential: 450,
    savings: 131,
    difficulty: 'Moderate',
    notes: 'Energy efficiency improvements, solar consideration'
  }
];

let totalPotentialSavings = 0;
let easyWins = 0;
let moderateChanges = 0;

reductions.forEach(reduction => {
  const savingsPercent = ((reduction.savings / reduction.current) * 100).toFixed(1);
  console.log(`${reduction.difficulty === 'Easy' ? '✅' : '⚠️ '} ${reduction.category}:`);
  console.log(`   Current: $${reduction.current.toLocaleString()} → Target: $${reduction.potential.toLocaleString()}`);
  console.log(`   Savings: $${reduction.savings.toLocaleString()} (${savingsPercent}% reduction)`);
  console.log(`   ${reduction.notes}\n`);
  
  totalPotentialSavings += reduction.savings;
  if (reduction.difficulty === 'Easy') easyWins += reduction.savings;
  else moderateChanges += reduction.savings;
});

console.log('📈 SAVINGS SUMMARY:');
console.log(`Total Potential Monthly Savings: $${totalPotentialSavings.toLocaleString()}`);
console.log(`Easy Wins: $${easyWins.toLocaleString()}`);  
console.log(`Moderate Changes: $${moderateChanges.toLocaleString()}`);
console.log(`Gap Coverage: ${((totalPotentialSavings / MONTHLY_GAP_NEEDED) * 100).toFixed(1)}%\n`);

const remainingGap = MONTHLY_GAP_NEEDED - totalPotentialSavings;

if (remainingGap > 0) {
  console.log(`❌ REMAINING GAP: $${remainingGap.toLocaleString()}`);
  console.log('\n🔧 ADDITIONAL OPTIONS:');
  console.log('• Increase income through side business/consulting');
  console.log('• Consider 15-year mortgage instead of 30-year');  
  console.log('• Wait for lower interest rates');
  console.log('• Target a lower house price ($3M-$3.2M range)');
  console.log('• Use adjustable rate mortgage (ARM) - higher risk');
} else {
  console.log('✅ GAP FULLY COVERED with cost reductions!');
}

console.log('\n🎯 RECOMMENDED IMPLEMENTATION PLAN:');
console.log('Phase 1 (Month 1-2): Easy wins for immediate $' + easyWins.toLocaleString() + ' savings');
console.log('• Reduce shopping and entertainment spending');
console.log('• Shop for better insurance rates');
console.log('• Optimize gas usage');

console.log('\nPhase 2 (Month 3-6): Moderate changes for $' + moderateChanges.toLocaleString() + ' additional savings');
console.log('• Change dining habits');
console.log('• Address vehicle payment');
console.log('• Energy efficiency improvements');

console.log('\n⚖️  LIFESTYLE IMPACT ASSESSMENT:');
console.log('Low Impact: Insurance, gas, PG&E optimizations');
console.log('Medium Impact: Reduced shopping, entertainment budgets');
console.log('High Impact: Significantly less dining out, vehicle downgrade');

const newTotalSpending = Object.values(currentSpending).reduce((sum, val) => sum + val, 0) - totalPotentialSavings;
console.log(`\nNew Total Monthly Spending: $${newTotalSpending.toLocaleString()} (down from $${Object.values(currentSpending).reduce((sum, val) => sum + val, 0).toLocaleString()})`); 