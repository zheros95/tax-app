// 핵심 시나리오 스모크 테스트: node test_smoke.mjs
import { readFileSync } from 'fs';

const window = {};
eval(readFileSync(new URL('./js/tax_calculator.js', import.meta.url), 'utf8'));
const TaxCalculator = window.TaxCalculator;
const calc = new TaxCalculator();

let pass = 0;
let fail = 0;
const check = (name, cond, detail = '') => {
    if (cond) { pass += 1; console.log(`✅ ${name}`); }
    else { fail += 1; console.log(`❌ ${name} ${detail}`); }
};

// ── 1. 1세대 1주택 12억 이하 비과세 ──
const r1 = calc.calculate({
    type: 'house', assetCategory: 'house', houseCount: 1,
    transferPrice: 1200000000, acquisitionPrice: 500000000,
    holdingPeriod: 3, residencyPeriod: 2, necessaryExpenses: 10000000,
    isAdjustedAreaAtAcquisition: 'yes', sellDate: '2026-05-02', buyDate: '2023-04-01'
});
check('1주택 12억 이하 비과세: totalTax 0', r1.isNonTaxable && r1.totalTax === 0,
    `isNonTaxable=${r1.isNonTaxable} totalTax=${r1.totalTax}`);
check('비과세: nationalTax 0', r1.nationalTax === 0, `nationalTax=${r1.nationalTax}`);

// ── 2. 일반 과세(기한 내): totalTax = nationalTax + localTax, 가산세 없음 ──
const r2 = calc.calculate({
    type: 'general', assetCategory: 'other', otherAssetCategory: 'commercial',
    transferPrice: 800000000, acquisitionPrice: 400000000,
    holdingPeriod: 6, necessaryExpenses: 20000000,
    sellDate: '2026-05-20', buyDate: '2020-03-10'
});
check('과세: totalTax = nationalTax + localTax', r2.totalTax === r2.nationalTax + r2.localTax,
    `${r2.totalTax} vs ${r2.nationalTax}+${r2.localTax}`);
check('기한 내: filingPenalty 0', r2.filingPenalty.total === 0, JSON.stringify(r2.filingPenalty));
check('localTax = decisionTax×10%', r2.localTax === Math.floor(r2.decisionTax * 0.1));
const lastSteps = r2.calculationSteps.slice(-3).map((s) => s.label);
check('계산과정: 국세→지방세→총액 스텝 존재',
    lastSteps[0].includes('국세') && lastSteps[1].includes('지방소득세') && lastSteps[2].includes('총 납부세액'),
    lastSteps.join(' | '));
check('신고서 납부할세액 = nationalTax (지방세 미포함)',
    r2.filingGuide.lines.some((l) => l.label.includes('납부할 세액') && l.value === calc.formatCurrency(r2.nationalTax)));
check('신고서에 지방소득세 별도 라인', r2.filingGuide.lines.some((l) => l.label.includes('지방소득세')));

// ── 3. 8년 자경농지 감면: 본표 라우팅 + 감면 스텝 ──
const r3 = calc.calculate({
    type: 'general', assetCategory: 'other', otherAssetCategory: 'land',
    selfFarmingExemption: 'yes', selfFarming8yrMet: 'yes', farmlandAtTransfer: 'yes',
    isBusinessUseLand: 'yes',
    transferPrice: 900000000, acquisitionPrice: 200000000,
    holdingPeriod: 12, necessaryExpenses: 5000000,
    sellDate: '2026-05-20', buyDate: '2014-03-10'
});
check('자경감면 적용됨', r3.taxReduction.amount > 0, JSON.stringify(r3.taxReduction));
check('감면 시 본표(84) 라우팅', r3.filingGuide.formCode === '84', `formCode=${r3.filingGuide.formCode}`);
check('감면세액 라인 자동 기재', r3.filingGuide.lines.some((l) => l.label.includes('감면세액') && l.value.includes('원')));
check('감면 스텝 존재', r3.calculationSteps.some((s) => s.label.includes('세액감면')));
check('nationalTax = decisionTax (가산세 없음)', r3.nationalTax === r3.decisionTax);
check('감면 반영: decisionTax = calculatedTax - 감면', r3.decisionTax === Math.max(0, r3.calculatedTax - r3.taxReduction.amount));

// ── 4. 예정신고 기한 경과: 무신고·납부지연 가산세 자동 반영 ──
const r4 = calc.calculate({
    type: 'general', assetCategory: 'other', otherAssetCategory: 'commercial',
    transferPrice: 800000000, acquisitionPrice: 400000000,
    holdingPeriod: 6, necessaryExpenses: 20000000,
    sellDate: '2025-08-15', buyDate: '2019-03-10'
});
// 기한: 2025-10-31, 오늘이 2026-06이면 6개월 초과 → 감면 0
check('기한 경과: 가산세 > 0', r4.filingPenalty.total > 0, JSON.stringify(r4.filingPenalty));
check('무신고가산세 = decisionTax×20%×(1-감면율)',
    r4.filingPenalty.noFiling === Math.floor(r4.decisionTax * 0.2 * (1 - r4.filingPenalty.reductionRate)));
check('납부지연 = decisionTax×일수×0.022%',
    r4.filingPenalty.latePayment === Math.floor(r4.decisionTax * r4.filingPenalty.daysLate * 0.00022));
check('nationalTax에 가산세 포함', r4.nationalTax === r4.decisionTax + r4.conversionSurcharge + r4.filingPenalty.total);
check('가산세 스텝 존재', r4.calculationSteps.some((s) => s.label.includes('무신고·납부지연')));
check('기한 경과 주의문구', r4.analysis.cautions.some((c) => c.includes('무신고가산세')));

// ── 5. 예정신고 기한 산정 (말일+2개월 규칙) ──
const due55 = calc.getFilingDueDate({ sellDate: '2026-05-15', type: 'house' });
check('5월 양도 → 기한 7/31', due55.getMonth() === 6 && due55.getDate() === 31, due55.toString());
const due2 = calc.getFilingDueDate({ sellDate: '2026-02-10', type: 'house' });
check('2월 양도 → 기한 4/30', due2.getMonth() === 3 && due2.getDate() === 30, due2.toString());
const dueStock = calc.getFilingDueDate({ sellDate: '2026-03-10', type: 'stock' });
check('주식 상반기 양도 → 기한 8/31', dueStock.getMonth() === 7 && dueStock.getDate() === 31, dueStock.toString());

// ── 6. 다주택 중과 유예 (기존 회귀) ──
const r6 = calc.calculate({
    type: 'house', assetCategory: 'house', houseCount: 2, effectiveHouseCount: 2,
    isAdjustedAreaAtTransfer: 'yes', houseTaxView: 'taxable',
    transferPrice: 1500000000, acquisitionPrice: 500000000,
    holdingPeriod: 10, necessaryExpenses: 10000000,
    sellDate: '2026-04-15', buyDate: '2016-01-01'
});
check('중과 유예 절감액 ≥ 0', r6.savingsFromGracePeriod >= 0);
check('2주택 totalTax 정합', r6.totalTax === r6.nationalTax + r6.localTax);

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
