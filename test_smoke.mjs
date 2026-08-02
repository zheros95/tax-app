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
    sellDate: '2026-05-20', buyDate: '2020-03-10',
    asOfDate: '2026-06-01' // 예정신고 기한(7/31) 이전 — 기준일 고정으로 시간 경과에 안 깨지게
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
    sellDate: '2026-05-20', buyDate: '2014-03-10',
    asOfDate: '2026-06-01' // 기한 내
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

// ── 7. 조정대상지역 자동판정 (main.js detectAdjustedArea 실동작) ──
// 데이터 모양이 아니라 '주소 + 날짜 → 판정결과'를 직접 검증한다.
// 한 주소가 여러 그룹(시기별)에 걸릴 수 있으므로 지정기간은 합집합으로 본다.
const ADJUSTED_AREA_HISTORY = eval(
    readFileSync(new URL('./js/region_data.js', import.meta.url), 'utf8') + '\n;ADJUSTED_AREA_HISTORY;'
);
const mainSrc = readFileSync(new URL('./js/main.js', import.meta.url), 'utf8');
const sliceMethod = (name) => {
    const i = mainSrc.indexOf('    ' + name + '(');
    return mainSrc.slice(i, mainSrc.indexOf('\n    }\n', i) + 7);
};
const RegionApp = eval('(class { '
    + ['detectAddressCity', 'matchesDistrict', 'detectAdjustedArea', 'detectNewlyDesignated2025']
        .map(sliceMethod).join('\n')
    + ' })');
const region = new RegionApp();
// '조정' | '비조정' | 'unknown'(부분지정·판별불가 → 사용자에게 직접 확인)
const at = (address, date) => {
    const r = region.detectAdjustedArea(address, date);
    return r.status === 'detected' ? (r.isAdjusted ? '조정' : '비조정') : r.status;
};

// 2026-07-01 신규 지정 (화성동탄·용인기흥·구리)
check('동탄 법정동(목동) 2026-07-02 조정대상 O', at('경기도 화성시 동탄구 목동', '2026-07-02') === '조정');
check('서울 양천 목동은 화성 동탄과 무관', at('서울특별시 양천구 목동', '2026-07-02') === '조정');
check('구리 2026-07-02 조정대상 O', at('경기도 구리시 인창동', '2026-07-02') === '조정');
check('구리 2026-06-30 조정대상 X', at('경기도 구리시 인창동', '2026-06-30') === '비조정');
check('기흥 2026-07-02 조정대상 O', at('경기도 용인시 기흥구 구갈동', '2026-07-02') === '조정');
check('군포시: 2026-07-02 조정대상 X', at('경기도 군포시 산본동', '2026-07-02') === '비조정');
check('수원 권선구: 2026-07-02 조정대상 X', at('경기도 수원시 권선구 세류동', '2026-07-02') === '비조정');

// 부분문자열 오탐 방지
check('남양주시가 양주시로 오탐되지 않음 (2018 → 조정)', at('경기도 남양주시 별내동', '2018-05-01') === '조정');
check('경기 광주시를 광주광역시로 오인하지 않음', at('경기도 광주시 태전동', '2021-05-01') === 'unknown');
check('광주광역시 2021 조정대상 O', at('광주광역시 서구 치평동', '2021-05-01') === '조정');

// 해제 효력일 당일은 이미 비조정
check('서울 마포 2023-01-04 조정 O', at('서울특별시 마포구 공덕동', '2023-01-04') === '조정');
check('서울 마포 2023-01-05 조정 X (해제일 당일)', at('서울특별시 마포구 공덕동', '2023-01-05') === '비조정');
check('강남구는 2023-01-05 이후에도 유지', at('서울특별시 강남구 대치동', '2023-01-05') === '조정');

// 해제일·지정일 정정분
check('인천 2022-10-01 조정 O (해제는 11/14)', at('인천광역시 연수구 송도동', '2022-10-01') === '조정');
check('인천 2022-11-14 조정 X', at('인천광역시 연수구 송도동', '2022-11-14') === '비조정');
check('평택 2022-10-01 조정 X (9/26 해제)', at('경기도 평택시 비전동', '2022-10-01') === '비조정');
check('성남 중원 2018-01-01 조정 O', at('경기도 성남시 중원구 성남동', '2018-01-01') === '조정');
check('용인 기흥 2018-11-01 조정 X (최초지정 12/31)', at('경기도 용인시 기흥구 구갈동', '2018-11-01') === '비조정');

// 지방권 데이터
check('대전 2021 조정 O', at('대전광역시 서구 둔산동', '2021-05-01') === '조정');
check('창원 성산구 2021 조정 O', at('경상남도 창원시 성산구 상남동', '2021-05-01') === '조정');
check('창원 의창구 2021 조정 X', at('경상남도 창원시 의창구 팔용동', '2021-05-01') === '비조정');
check('여수 2022-08-01 조정 X (7/5 해제)', at('전라남도 여수시 학동', '2022-08-01') === '비조정');
check('강원 춘천은 비조정', at('강원특별자치도 춘천시 퇴계동', '2021-05-01') === '비조정');

// 동명 구는 시·도 없이는 판별 불가
check('시·도 없는 중구는 unknown', at('중구 남포동', '2021-05-01') === 'unknown');
check('부산 중구 2021 조정 X', at('부산광역시 중구 남포동', '2021-05-01') === '비조정');
check('인천 중구 2021 조정 O', at('인천광역시 중구 신흥동', '2021-05-01') === '조정');

// 중과 유예 예외 6개월 대상 자동판별 (소득령 §167의3①12호의2 나목4)
const newly = (a) => {
    const r = region.detectNewlyDesignated2025(a);
    return r === null ? 'unknown' : (r ? '6개월' : '4개월');
};
check('서울 마포구 → 6개월', newly('서울특별시 마포구 공덕동') === '6개월');
check('서울 강남구 → 4개월 (닫힌 열거에서 제외)', newly('서울특별시 강남구 대치동') === '4개월');
check('서울 용산구 → 4개월', newly('서울특별시 용산구 한남동') === '4개월');
check('용인 수지구 → 6개월', newly('경기도 용인시 수지구 풍덕천동') === '6개월');
check('용인 기흥구 → 4개월 (2026.7.1. 지정분)', newly('경기도 용인시 기흥구 구갈동') === '4개월');
check('구리시 → 4개월', newly('경기도 구리시 인창동') === '4개월');
check('군포시 → 4개월', newly('경기도 군포시 산본동') === '4개월');

// ── 8. 주택 수 제외: 비과세 판정용 / 중과 판정용 이중 기준 (소득령 §154·§155 vs §167의3②) ──
// 서울 조정지역 15억 주택 + 지방 3억 이하 주택 = 2주택
const houseBase = {
    type: 'house', assetCategory: 'house', houseCount: 2, houseTaxView: 'taxable',
    transferPrice: 1500000000, acquisitionPrice: 600000000, necessaryExpenses: 20000000,
    holdingPeriod: 8.4, residencyPeriod: 3,
    isAdjustedAreaAtAcquisition: 'yes', isAdjustedAreaAtTransfer: 'yes',
    buyDate: '2018-01-10', sellDate: '2026-06-01', asOfDate: '2026-06-15'
};
// 지방저가주택은 중과 판정에서만 빠진다 → 비과세로 새면 안 됨
const rLocalLow = calc.calculate({
    ...houseBase, houseCountExclusions: ['local_low_price'],
    effectiveHouseCount: 2, heavyTaxHouseCount: 1
});
check('지방저가주택 체크해도 1세대1주택 비과세로 새지 않음', rLocalLow.isNonTaxable === false,
    `isNonTaxable=${rLocalLow.isNonTaxable}`);
const rNoExcl = calc.calculate({ ...houseBase, effectiveHouseCount: 2, heavyTaxHouseCount: 2 });
check('지방저가주택 체크는 중과세만 완화', rNoExcl.totalTax >= rLocalLow.totalTax,
    `${rNoExcl.totalTax} vs ${rLocalLow.totalTax}`);
// 상속 5년 이내 주택은 비과세 판정에서 빠진다(소득령 §155②)
const rInherited = calc.calculate({
    ...houseBase, houseCountExclusions: ['inherited_within_5yr'],
    effectiveHouseCount: 1, heavyTaxHouseCount: 2
});
check('상속 5년 주택은 비과세 판정에서 제외', rInherited.isNonTaxable === true);
// 3주택 중 소형신축 1채 → 중과 가산 30%p → 20%p
const h3 = { ...houseBase, houseCount: 3 };
const r3homes = calc.calculate({ ...h3, effectiveHouseCount: 3, heavyTaxHouseCount: 3 });
const r3excl = calc.calculate({ ...h3, houseCountExclusions: ['small_new_unsold'],
    effectiveHouseCount: 3, heavyTaxHouseCount: 2 });
check('소형신축 제외 시 중과 가산 30%p→20%p', r3excl.totalTax < r3homes.totalTax,
    `${r3excl.totalTax} vs ${r3homes.totalTax}`);
check('소형신축은 비과세 판정에 영향 없음', r3excl.isNonTaxable === false);

// ── 9. 질문 플로우: 답변 후 조건이 바뀌어도 다음 질문이 건너뛰어지지 않는다 ──
// (renderQuestion 없이 커서 이동만 재현)
const flowApp = (() => {
    const stub = () => ({ classList: { add() {}, remove() {} }, style: {}, appendChild() {},
        addEventListener() {}, setAttribute() {}, focus() {} });
    const sandboxGlobals = { document: { readyState: 'complete', addEventListener() {},
        getElementById() { return null; }, createElement: stub, body: stub() }, alert() {} };
    const appSrc = mainSrc.slice(0, mainSrc.lastIndexOf('class App'))
        + mainSrc.slice(mainSrc.lastIndexOf('class App'))
            .replace(/\n(document\.addEventListener|new App|window\.app)[\s\S]*$/, '\n');
    const factory = new Function('window', 'document', 'alert', 'TaxCalculator',
        'HWPXFormFiller', 'ADJUSTED_AREA_HISTORY', appSrc + '\n; return App;');
    return factory({}, sandboxGlobals.document, sandboxGlobals.alert, TaxCalculator,
        class {}, ADJUSTED_AREA_HISTORY);
})();
const walk = (answers) => {
    const app = Object.create(flowApp.prototype);
    app.calculator = new TaxCalculator();
    app.currentPhase = 1;
    app.cursorId = null;
    app.inputs = app.getInitialInputs();
    app.phases = app.buildPhases();
    const seen = [];
    for (let guard = 0; guard < 300; guard += 1) {
        app.syncAutoDetectedRegion();
        const q = app.resolveCursorQuestion(app.getCurrentQuestions());
        if (!q) {
            if (app.currentPhase < 3) { app.currentPhase += 1; app.cursorId = null; continue; }
            break;
        }
        app.cursorId = q.id;
        seen.push(q.id);
        if (Object.prototype.hasOwnProperty.call(answers, q.id)) {
            app.inputs[q.id] = answers[q.id];
            app.inputs[`_userSet_${q.id}`] = true;
            if (q.onSelect) q.onSelect(app.inputs, answers[q.id]);
        }
        const all = app.getPhaseQuestions();
        const vis = app.getCurrentQuestions();
        const pos = all.findIndex((x) => x.id === app.cursorId);
        const next = vis.find((x) => all.indexOf(x) > pos);
        app.cursorId = next ? next.id : '__end_of_phase__';
    }
    return seen;
};
const flowRedev = walk({ assetCategory: 'house', wasFormerMembershipRight: 'yes' });
check('재개발 완공주택: 원조합원/승계조합원 질문이 나온다', flowRedev.includes('membershipType'),
    flowRedev.join(' → '));
const flowRental = walk({ assetCategory: 'house', houseTaxView: 'nontaxable',
    houseNonTaxableCategory: 'special', specialCases: ['rental'], propertySpecialCases: ['rental'],
    rentalSaleType: 'residence', rentalIsRegistered: 'yes' });
check('임대사업자 거주주택: 등록 여부를 묻는다', flowRental.includes('rentalIsRegistered'),
    flowRental.join(' → '));
check('임대사업자 거주주택: 임대료 5% 요건까지 묻는다', flowRental.includes('rentalPriceCapMet'));
const flowGift = walk({ assetCategory: 'house', houseTaxView: 'taxable', houseCount: 2,
    specialCases: ['inherited'], acquiredByGift: 'yes' });
check('증여 취득: 이월과세 질문이 나온다', flowGift.includes('acquiredByGift'), flowGift.join(' → '));
check('증여 취득: 증여자 취득가액까지 이어서 묻는다', flowGift.includes('giftCarryoverPrices'));
for (const [label, seen] of [['재개발', flowRedev], ['임대', flowRental], ['증여', flowGift]]) {
    const dups = [...new Set(seen.filter((x, i) => seen.indexOf(x) !== i))];
    check(`${label} 흐름: 같은 질문이 두 번 나오지 않음`, dups.length === 0, JSON.stringify(dups));
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
