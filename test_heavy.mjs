global.window = {};
const { TaxCalculator } = require('./js/tax_calculator.js');

const calc = new TaxCalculator();

const inputs = {
    type: 'house',
    assetCategory: 'house',
    houseCount: 2,
    isAdjustedAreaAtTransfer: 'yes',
    sellDate: '2025-05-15',
    buyDate: '2015-01-01',
    sellPrice: 1500000000,
    buyPrice: 500000000,
    necessaryExpenses: 10000000,
    isJointOwnership: false,
    jointPercent: 50,
    owners: 1
};

const result = calc.calculate(inputs);

console.log('--- TEST HEAVY TAX SAVINGS ---');
console.log('isHeavyTaxApplicable:', result.isHeavyTaxApplicable);
console.log('totalTax:', result.totalTax.toLocaleString(), '원');
console.log('hypotheticalHeavyTax:', result.hypotheticalHeavyTax.toLocaleString(), '원');
console.log('savingsFromGracePeriod:', result.savingsFromGracePeriod.toLocaleString(), '원');
