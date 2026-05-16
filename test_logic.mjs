import { TaxCalculator } from './js/tax_calculator.js';

const calc = new TaxCalculator();

console.log("=== Testing Tax Calculator Logic (2025 Rules) ===");

// Scenario 1: 1 House, 12억 양도, 5억 취득, 3년 보유, 2년 거주 (비과세 예상)
// Expectation: Total Tax should be 0 (Below 12B limit)
const case1 = {
    type: 'house',
    houseCount: 1,
    transferPrice: 1200000000,
    acquisitionPrice: 500000000,
    holdingPeriod: 3,
    residencyPeriod: 2,
    necessaryExpenses: 10000000,
    isAdjustedAreaAtAcquisition: true
};

const result1 = calc.calculate(case1);
console.log(`\n[Case 1] 1세대 1주택 (12억이하 비과세):`);
console.log(`- 양도차익: ${result1.capitalGains.toLocaleString()}원`);
console.log(`- 비과세여부: ${result1.isNonTaxable}`);
console.log(`- 총세액: ${result1.totalTax.toLocaleString()}원`);
if (result1.isNonTaxable && result1.totalTax === 0) {
    console.log("✅ PASS: Case 1 is correctly Non-Taxable");
} else {
    console.log("❌ FAIL: Case 1 should be Non-Taxable");
}

// Scenario 2: 2 House, Short-term (<1yr), 10억 양도
// Expectation: 70% Tax Rate
const case2 = {
    type: 'house',
    houseCount: 2,
    transferPrice: 1000000000,
    acquisitionPrice: 600000000,
    holdingPeriod: 0.5,
    residencyPeriod: 0,
    necessaryExpenses: 0,
    isAdjustedAreaAtAcquisition: true
};

const result2 = calc.calculate(case2);
console.log(`\n[Case 2] 2주택자 1년 미만 단기 매매 (70%):`);
console.log(`- 양도차익: ${result2.capitalGains.toLocaleString()}원`);
console.log(`- 세율: ${result2.taxRate * 100}%`);
if (result2.taxRate === 0.70) {
    console.log("✅ PASS: Case 2 applied 70% tax rate");
} else {
    console.log(`❌ FAIL: Case 2 tax rate is ${result2.taxRate}`);
}

// Scenario 3: 1 House, High Value (15억), 10년 보유/10년 거주 (Max Deduction 80%)
// Expectation: Taxable on (3/15) portion, 80% deduction on that.
const case3 = {
    type: 'house',
    houseCount: 1,
    transferPrice: 1500000000,
    acquisitionPrice: 500000000,
    holdingPeriod: 10,
    residencyPeriod: 10,
    necessaryExpenses: 0,
    isAdjustedAreaAtAcquisition: true
};
const result3 = calc.calculate(case3);
console.log(`\n[Case 3] 1세대 1주택 고가주택 (15억):`);
console.log(`- 전체 양도차익: ${result3.capitalGains.toLocaleString()}`);
console.log(`- 과세대상 양도차익: ${result3.taxableGains.toLocaleString()}`);
console.log(`- 장특공제율: ${Math.round(result3.longTermRate * 100)}%`); // Expect 80%

const expectedTaxableRatio = (1500000000 - 1200000000) / 1500000000; // 0.2
const roughTaxable = 1000000000 * expectedTaxableRatio; // 2억

if (Math.abs(result3.taxableGains - roughTaxable) < 1000000) {
    console.log("✅ PASS: Taxable Gain calculated correctly (pro-rated)");
} else {
    console.log(`❌ FAIL: Taxable Gain mismatch. Got ${result3.taxableGains}, Expected approx ${roughTaxable}`);
}

if (result3.longTermRate === 0.8) {
    console.log("✅ PASS: 80% Max Deduction Applied");
} else {
    console.log(`❌ FAIL: Deduction Rate is ${result3.longTermRate}, Expected 0.8`);
}

// Scenario 4: Hwansan Acquisition Cost
// Transfer: 10억, TransferTaxBase: 5억, AcqTaxBase: 2.5억
// Estimated Acq Price = 10억 * (2.5/5) = 5억
// Expenses = 2.5억 * 3% = 7,500,000
const case4 = {
    type: 'house',
    houseCount: 2,
    transferPrice: 1000000000,
    acquisitionMethod: 'estimated',
    transferTaxBase: 500000000,
    acquisitionTaxBase: 250000000,
    holdingPeriod: 5,
    necessaryExpenses: 0 // Should be ignored
};

const result4 = calc.calculate(case4);
console.log(`\n[Case 4] 환산취득가액 적용 Test:`);
console.log(`- 계산된 취득가액: ${result4.acquisitionCost.toLocaleString()}`);
console.log(`- 필요경비(개산공제): ${result4.necessaryExpenses.toLocaleString()}`);

if (result4.acquisitionCost === 500000000 && result4.necessaryExpenses === 7500000) {
    console.log("✅ PASS: Hwansan Cost & Gyesan Gongje Correct");
} else {
    console.log("❌ FAIL: Hwansan logic incorrect");
}

