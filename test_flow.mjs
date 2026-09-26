// 간편 흐름(main.js) 스모크 테스트: node test_flow.mjs
// 브라우저 없이 질문 노출 조건·상세 흐름 전환·거주기간 계산·계산기 연동을 확인한다.
import { readFileSync } from 'fs';
import vm from 'vm';

// ── 최소 DOM 스텁 ──
const makeEl = () => {
    const el = {
        style: {}, dataset: {}, children: [], value: '', textContent: '', innerHTML: '', checked: false,
        classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
        addEventListener() {}, appendChild(child) { this.children.push(child); return child; },
        querySelector() { return makeEl(); }, querySelectorAll() { return []; },
        setAttribute() {}, removeAttribute() {}, focus() {}, click() {}
    };
    return el;
};
const document = {
    readyState: 'complete',
    getElementById: () => makeEl(), querySelector: () => makeEl(), querySelectorAll: () => [],
    createElement: () => makeEl(), addEventListener() {}, body: makeEl()
};
const window = { document, addEventListener() {}, navigator: {} };
const ctx = {
    window, document, console, navigator: {}, setTimeout, TextEncoder, TextDecoder,
    alert: (m) => { throw new Error('alert: ' + m); },
    requestAnimationFrame: (f) => f(), Blob: class {}, URL: { createObjectURL() {} }, fetch: async () => ({ ok: false })
};
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['js/region_data.js', 'js/tax_calculator.js', 'js/hwpx_form_filler.js', 'js/main.js']) {
    vm.runInContext(readFileSync(new URL('./' + f, import.meta.url), 'utf8'), ctx, { filename: f });
}
const app = ctx.window.app;

let pass = 0;
let fail = 0;
const check = (name, cond, detail = '') => {
    if (cond) { pass += 1; console.log(`✅ ${name}`); }
    else { fail += 1; console.log(`❌ ${name} ${detail}`); }
};

/** 현재 모드·입력값 기준으로 사용자에게 보일 질문 id를 단계 순서대로 모은다. */
const visibleIds = () => {
    app.syncAutoDetectedRegion();
    const ids = [];
    for (const p of [1, 2, 3]) {
        const saved = app.currentPhase;
        app.currentPhase = p;
        ids.push(...app.getCurrentQuestions().map((q) => q.id));
        app.currentPhase = saved;
    }
    return ids;
};

const startSimple = (count) => {
    app.reset();
    app.mode = 'simple';
    app.applySimpleBaseline(count);
};

// ── 1. 1주택·비조정·9억: 7화면 ──
startSimple(1);
Object.assign(app.inputs, {
    simpleSituations: [], address: '서울특별시 노원구 상계동 100',
    buyDate: '2015-03-02', sellDate: '2026-09-01', holdingPeriod: 11.5,
    isJointOwnership: false, transferPrice: 900000000, acqPrice_real: 500000000
});
let ids = visibleIds();
check('1주택 비조정 9억: 7화면', ids.length === 7, ids.join(','));
check('1주택 비조정 9억: 거주기간 질문 없음', !ids.includes('simpleResidency'));
check('1주택: 규제지역 질문은 주소로 자동 판별돼 숨김', !ids.includes('isAdjustedAreaAtAcquisition'), ids.join(','));

// ── 2. 1주택·강남 2019 취득·15억: 거주기간 질문 포함 8화면 ──
startSimple(1);
Object.assign(app.inputs, {
    address: '서울특별시 강남구 대치동 100', buyDate: '2019-03-02', sellDate: '2026-09-01', holdingPeriod: 7.5,
    isJointOwnership: false, transferPrice: 1500000000, acqPrice_real: 900000000
});
ids = visibleIds();
check('1주택 강남 15억: 8화면', ids.length === 8, ids.join(','));
check('1주택 강남 15억: 거주기간 질문 포함', ids.includes('simpleResidency'));
check('규제지역 자동 판별 결과 yes', app.inputs.isAdjustedAreaAtAcquisition === 'yes', app.inputs.isAdjustedAreaAtAcquisition);

// ── 3. 일시적 2주택: 새 집 잔금일 질문 포함 ──
startSimple(2);
Object.assign(app.inputs, {
    address: '경기도 수원시 영통구 망포동 1', buyDate: '2018-01-05', sellDate: '2026-09-01', holdingPeriod: 8.6,
    newHomeContractDate: '2024-06-01', isJointOwnership: false, transferPrice: 800000000, acqPrice_real: 400000000
});
ids = visibleIds();
check('일시적 2주택: 새 집 잔금일 질문 포함', ids.includes('newHomeContractDate'), ids.join(','));
check('일시적 2주택: 8화면', ids.length === 8, ids.join(','));
check('일시적 2주택: 분류 플래그', app.inputs.temp2House === 'yes' && app.inputs.houseNonTaxableCategory === 'tempTwoHome' && app.inputs.newAssetType === 'house');

// ── 4. 취득가액 모름 → 공시가격 화면, 비용 화면 생략 ──
startSimple(1);
Object.assign(app.inputs, {
    address: '서울특별시 노원구 상계동 100', buyDate: '2005-03-02', sellDate: '2026-09-01',
    isJointOwnership: false, transferPrice: 900000000, acqPriceUnknown: true, acquisitionMethod: 'estimated'
});
ids = visibleIds();
check('취득가액 모름: 공시가격 질문 노출', ids.includes('simpleEstimatedPrices'), ids.join(','));
check('취득가액 모름: 비용 질문 생략', !ids.includes('simpleExpenses'), ids.join(','));

// ── 5. 특별한 사정 라우팅 ──
startSimple(1);
check('해외 거주만: 간편 흐름 유지 + 비거주자 플래그',
    app.routeSimpleSituations(['overseas']) === null && app.inputs.specialCases.includes('nonResident'));

startSimple(1);
let route = app.routeSimpleSituations(['redevelopment']);
check('재개발: 입주권 완공주택 프리셋', route && route.presets.assetCategory === 'right' && route.presets.wasFormerMembershipRight === 'yes');
app.switchToDetailed(route.presets, route.skip);
ids = visibleIds();
check('재개발 → 상세 첫 질문 = 원조합원/승계 구분', ids[0] === 'membershipType', ids.slice(0, 3).join(','));
check('상세 전환 시 분류 질문 재노출 안 함', !ids.includes('assetCategory') && !ids.includes('wasFormerMembershipRight'));

startSimple(1);
route = app.routeSimpleSituations(['mixed_use']);
app.switchToDetailed(route.presets, route.skip);
ids = visibleIds();
check('1채+상가주택 → 1주택 분류 유지, 집 특성 프리셋', app.inputs.houseNonTaxableCategory === 'singleHome' && app.inputs.propertySpecialCases.includes('mixed_use_building'));
check('1채+상가주택 → 상세 첫 질문 = 명의 형태', ids[0] === 'isJointOwnership', ids.slice(0, 3).join(','));
check('1채+상가주택 → 겸용주택 면적 질문 노출', ids.includes('mixedUseArea'), ids.join(','));

startSimple(1);
route = app.routeSimpleSituations(['inherited_or_gift']);
app.switchToDetailed(route.presets, route.skip);
ids = visibleIds();
check('1채+상속·증여 → 증여(이월과세) 질문 노출', ids.includes('acquiredByGift'), ids.join(','));

startSimple(2);
route = app.routeSimpleSituations(['inherited_or_gift']);
app.switchToDetailed(route.presets, route.skip);
ids = visibleIds();
check('2채+상속 → 특례 분류·주택 수 질문부터', app.inputs.houseNonTaxableCategory === 'specialNonTaxable' && ids[0] === 'houseCount', ids.slice(0, 3).join(','));

startSimple(1);
route = app.routeSimpleSituations(['not_house']);
app.switchToDetailed(route.presets, route.skip);
ids = visibleIds();
check('집이 아님 → 상세 첫 질문 = 자산 종류', ids[0] === 'assetCategory', ids.slice(0, 3).join(','));

// 뒤로 가기: 상세 첫 화면에서 간편 흐름 복귀
app.returnToSimple();
check('상세 첫 화면에서 뒤로 → 간편 흐름 복귀', app.mode === 'simple' && app.skipQuestionIds.size === 0);

// 3채 이상 / 2채 다른 사유
startSimple(3);
app.switchToDetailed(
    { houseNonTaxableCategory: 'taxable', houseTaxView: 'taxable', houseCount: null, effectiveHouseCount: null, heavyTaxHouseCount: null, temp2House: 'no' },
    ['assetCategory', 'wasFormerMembershipRight', 'houseNonTaxableCategory']
);
ids = visibleIds();
check('3채 이상 → 상세 첫 질문 = 주택 수', ids[0] === 'houseCount', ids.slice(0, 3).join(','));

// ── 6. 거주기간 계산 ──
const years = (o) => app.computeResidencyYears({ buyDate: '2019-03-02', sellDate: '2026-09-01', neverLived: false, moveInDate: '', moveOutDate: '', ...o });
check('거주: 전입 후 계속 거주(전출일 비움) ≈ 7.5년', Math.abs(years({ moveInDate: '2019-03-02' }) - 7.5) < 0.05, String(years({ moveInDate: '2019-03-02' })));
check('거주: 취득 전 거주기간은 제외', Math.abs(years({ moveInDate: '2017-01-01', moveOutDate: '2020-03-02' }) - 1.0) < 0.05, String(years({ moveInDate: '2017-01-01', moveOutDate: '2020-03-02' })));
check('거주: 1년 11개월은 2년 미만', years({ moveInDate: '2019-03-02', moveOutDate: '2021-02-01' }) < 2);
check('거주: 산 적 없음 = 0', years({ neverLived: true, moveInDate: '2019-03-02' }) === 0);

// ── 7. 계산기 연동 (간편 흐름 입력 그대로) ──
startSimple(1);
Object.assign(app.inputs, {
    address: '서울특별시 노원구 상계동 100', buyDate: '2015-03-02', sellDate: '2026-09-01', holdingPeriod: 11.5,
    isJointOwnership: false, transferPrice: 900000000, acqPrice_real: 500000000, acqTax: 6000000, sellBrokerFee: 4000000
});
app.syncAutoDetectedRegion();
app.finalizeAmounts();
let r = app.calculator.calculate(app.inputs);
check('1주택 12억 이하: 비과세 0원', r.isNonTaxable && r.totalTax === 0, `isNonTaxable=${r.isNonTaxable} totalTax=${r.totalTax}`);
check('금액 합산: 취득가액 = 산 가격 + 취득세', app.inputs.acquisitionPrice === 506000000, String(app.inputs.acquisitionPrice));
check('서울 1주택 비과세: 배지 "비과세 가능"(중과 유예 문구가 검토 필요로 격하시키지 않음)',
    r.analysis.statusLabel === '비과세 가능' && !r.analysis.cautions.some((c) => c.includes('6개월')),
    `${r.analysis.statusLabel} / ${JSON.stringify(r.analysis.cautions)}`);

startSimple(1);
Object.assign(app.inputs, {
    address: '서울특별시 강남구 대치동 100', buyDate: '2019-03-02', sellDate: '2026-09-01', holdingPeriod: 7.5,
    isJointOwnership: false, transferPrice: 1500000000, acqPrice_real: 900000000,
    neverLived: false, moveInDate: '2019-03-02', moveOutDate: '2020-06-01'
});
app.syncAutoDetectedRegion();
app.inputs.residencyPeriod = app.computeResidencyYears(app.inputs);
app.finalizeAmounts();
r = app.calculator.calculate(app.inputs);
check('조정지역 취득 + 거주 1.2년: 비과세 아님', !r.isNonTaxable && r.totalTax > 0, `isNonTaxable=${r.isNonTaxable} totalTax=${r.totalTax}`);

startSimple(2);
Object.assign(app.inputs, {
    address: '경기도 수원시 영통구 망포동 1', buyDate: '2018-01-05', sellDate: '2026-09-01', holdingPeriod: 8.6,
    newHomeContractDate: '2024-06-01', isJointOwnership: false, transferPrice: 800000000, acqPrice_real: 400000000
});
app.syncAutoDetectedRegion();
app.finalizeAmounts();
r = app.calculator.calculate(app.inputs);
check('일시적 2주택(3년 내 양도): 비과세', r.isNonTaxable && r.totalTax === 0, `isNonTaxable=${r.isNonTaxable} totalTax=${r.totalTax}`);

app.inputs.newHomeContractDate = '2022-06-01'; // 새 집 취득 후 3년 넘겨 양도
r = app.calculator.calculate(app.inputs);
check('일시적 2주택(3년 초과): 과세', !r.isNonTaxable && r.totalTax > 0, `isNonTaxable=${r.isNonTaxable} totalTax=${r.totalTax}`);

// ── 8. 결과 세 줄 요약 ──
const briefFor = (setup) => {
    startSimple(setup.count || 1);
    Object.assign(app.inputs, setup.inputs);
    app.syncAutoDetectedRegion();
    if (setup.residency) app.inputs.residencyPeriod = app.computeResidencyYears(app.inputs);
    app.finalizeAmounts();
    const res = app.calculator.calculate(app.inputs);
    return { res, brief: app.buildResultBrief(res) };
};

let b = briefFor({ inputs: {
    address: '서울특별시 노원구 상계동 100', buyDate: '2015-03-02', sellDate: '2026-09-01', holdingPeriod: 11.5,
    isJointOwnership: false, transferPrice: 900000000, acqPrice_real: 500000000
} });
check('요약: 1주택 비과세 → "낼 세금이 없어요"', b.brief.taxHeadline === '낼 세금이 없어요', b.brief.taxHeadline);
check('요약: 1주택 비과세 이유에 요건 나열', b.brief.why.includes('1세대 1주택 비과세') && b.brief.why.includes('보유'), b.brief.why);
check('요약: 1주택 비과세 → 신고 불필요·버튼 숨김', b.brief.filing.includes('신고하지 않아도') && b.brief.needsFiling === false, b.brief.filing);

b = briefFor({ inputs: {
    address: '서울특별시 강남구 대치동 100', buyDate: '2019-03-02', sellDate: '2026-09-01', holdingPeriod: 7.5,
    isJointOwnership: false, transferPrice: 1500000000, acqPrice_real: 900000000,
    moveInDate: '2019-03-02', moveOutDate: '2020-06-01'
}, residency: true });
check('요약: 거주요건 미충족 → 이유에 2년 실거주 언급', b.brief.why.includes('2년') && b.brief.why.includes('실거주'), b.brief.why);
check('요약: 과세 → 기한과 홈택스 안내', b.brief.needsFiling && b.brief.filing.includes('까지') && b.brief.filing.includes('홈택스'), b.brief.filing);
check('요약: 과세 → 세금 머리글에 금액', /^예상 세금 [\d,]+원$/.test(b.brief.taxHeadline), b.brief.taxHeadline);

b = briefFor({ inputs: {
    address: '서울특별시 강남구 대치동 100', buyDate: '2015-03-02', sellDate: '2026-09-01', holdingPeriod: 11.5,
    isJointOwnership: false, transferPrice: 1500000000, acqPrice_real: 900000000,
    moveInDate: '2015-03-02'
}, residency: true });
check('요약: 고가주택 → 이유에 12억 초과분', b.res.isHighValue && b.brief.why.includes('12억'), b.brief.why);
check('요약: 고가주택 → 신고 필요', b.brief.needsFiling && b.brief.filing.includes('신고'), b.brief.filing);

b = briefFor({ count: 2, inputs: {
    address: '경기도 수원시 영통구 망포동 1', buyDate: '2018-01-05', sellDate: '2026-09-01', holdingPeriod: 8.6,
    newHomeContractDate: '2022-06-01', isJointOwnership: false, transferPrice: 800000000, acqPrice_real: 400000000
} });
check('요약: 일시적 2주택 기한 초과 → 이유에 3년', b.brief.why.includes('3년'), b.brief.why);

b = briefFor({ count: 2, inputs: {
    address: '경기도 수원시 영통구 망포동 1', buyDate: '2018-01-05', sellDate: '2026-09-01', holdingPeriod: 8.6,
    newHomeContractDate: '2024-06-01', isJointOwnership: false, transferPrice: 800000000, acqPrice_real: 400000000
} });
check('요약: 일시적 2주택 충족 → 이유에 일시적 2주택 비과세', b.brief.why.includes('일시적 2주택 비과세'), b.brief.why);

b = briefFor({ inputs: {
    address: '서울특별시 강남구 대치동 100', buyDate: '2019-03-02', sellDate: '2026-03-01', holdingPeriod: 7.0,
    isJointOwnership: false, transferPrice: 1500000000, acqPrice_real: 900000000,
    moveInDate: '2019-03-02', moveOutDate: '2020-06-01', asOfDate: '2026-09-26'
}, residency: true });
check('요약: 기한 경과 → 가산세 안내', b.res.filingPenalty.daysLate > 0 && b.brief.filing.includes('가산세') && b.brief.taxSub.includes('가산세'), b.brief.filing);

console.log(`\n${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
