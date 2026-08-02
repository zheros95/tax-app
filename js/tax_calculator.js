/**
 * tax_calculator.js
 * Core logic for a guided Korean capital gains tax calculator (2025 guide aligned)
 */

const TaxData = {
    BASIC_DEDUCTION: 2500000,
    NON_TAXABLE_LIMIT: 1200000000,
    BASIC_RATES: [
        { limit: 14000000, rate: 0.06, deduction: 0 },
        { limit: 50000000, rate: 0.15, deduction: 1260000 },
        { limit: 88000000, rate: 0.24, deduction: 5760000 },
        { limit: 150000000, rate: 0.35, deduction: 15440000 },
        { limit: 300000000, rate: 0.38, deduction: 19940000 },
        { limit: 500000000, rate: 0.40, deduction: 25940000 },
        { limit: 1000000000, rate: 0.42, deduction: 35940000 },
        { limit: Infinity, rate: 0.45, deduction: 65940000 }
    ],
    SHORT_TERM_RATES: {
        HOUSE_OR_RIGHT_LT_1Y: 0.70,
        HOUSE_OR_RIGHT_LT_2Y: 0.60,
        GENERAL_LT_1Y: 0.50,
        GENERAL_LT_2Y: 0.40
    },
    LONG_TERM_GENERAL: {
        RATE_PER_YEAR: 0.02,
        MAX_RATE: 0.30
    },
    LONG_TERM_1HOME: {
        HOLDING_RATE_PER_YEAR: 0.04,
        RESIDENCY_RATE_PER_YEAR: 0.04,
        MAX_HOLDING_RATE: 0.40,
        MAX_RESIDENCY_RATE: 0.40
    },
    SPECIAL_CASES: {
        inherited: {
            label: '상속·증여 자산',
            message: '상속·증여 자산은 취득가액 승계, 보유기간 계산, 이월과세 여부를 별도로 확인해야 합니다.',
            documents: ['상속·증여 관련 계약서 또는 결정서', '취득가액 산정자료'],
            severe: true
        },
        marriage: {
            label: '혼인 특례',
            message: '혼인으로 2주택이 된 경우는 2024년 11월 12일 이후 양도분부터 10년 특례 적용 여부를 함께 봐야 합니다.',
            documents: ['혼인관계증명서', '각 주택 취득일 증빙']
        },
        cohabitation: {
            label: '동거봉양 합가 특례',
            message: '60세 이상 직계존속을 모시려고 세대를 합쳐 2주택이 된 경우(소득세법 시행령 §155④), 합가일로부터 10년 이내에 먼저 양도하는 주택은 1세대 1주택 비과세가 가능합니다. 합가 전 각자 1주택을 보유했고 양도 주택이 보유·거주 요건을 갖추어야 합니다.',
            documents: ['가족관계증명서(직계존속 확인)', '주민등록표 등본(합가 사실·합가일 확인)', '각 주택 취득일 증빙']
        },
        rental: {
            label: '임대사업자·거주주택 특례',
            message: '임대사업자 거주주택 비과세 특례(소득세법 시행령 §155⑳)는 양도일 현재 등록 유지, 의무임대기간 준수, 임대료 증액 5% 이하 제한을 모두 갖추어야 합니다. 요건 미충족 시 소급 추납 의무가 있으므로 양도 전 최종 확인이 필요합니다.',
            documents: ['임대사업자 등록증 사본 (세무서 사업자등록 + 지자체 임대사업자등록)', '임대차계약서 전체 이력', '임대료 증액 내역 확인자료', '임차인 주민등록표 등본']
        },
        winwin: {
            label: '상생임대',
            message: '상생임대 특례는 직전 계약, 임대료 인상률 5% 이하, 계약 체결기한(2026년 12월 31일) 등을 확인해야 합니다.',
            documents: ['직전·신규 임대차계약서', '임대료 증액 비교표']
        },
        farm_officetel: {
            label: '오피스텔·농어촌주택',
            message: '오피스텔의 실제 사용도와 농어촌주택 특례 여부에 따라 주택 수 판정이 달라질 수 있습니다.',
            documents: ['건축물대장', '임대차 또는 실제 사용 증빙']
        },
        reconstruction: {
            label: '재개발·재건축 권리',
            message: '입주권과 재건축 자산은 일반 주택과 달리 주택 수와 양도차익 계산 방식이 달라집니다.',
            documents: ['관리처분계획 인가 관련 서류', '권리가액 산정자료'],
            severe: true
        },
        cash_settlement: {
            label: '재개발·재건축 현금청산',
            message: '현금청산은 기존 부동산이 사실상 양도되는 것으로 취급됩니다. 양도가액은 수령한 현금청산금이며, 취득일부터 대금청산일까지의 기간이 보유기간이 됩니다. 1세대 1주택 요건 충족 시 비과세가 가능합니다.',
            documents: ['관리처분계획 인가서', '현금청산금 산정 내역서', '대금청산 확인서류'],
            severe: false
        },
        unsold_new: {
            label: '준공 후 미분양·소형신축 특례',
            message: '준공 후 미분양주택 또는 소형 신축주택 특례는 취득기간, 면적, 가액, 소재지를 함께 확인해야 합니다.',
            documents: ['분양계약서', '미분양 확인서 또는 주택 요건 증빙']
        },
        multi_family_whole: {
            label: '다가구주택 통매각',
            message: '다가구주택을 건물 전체로 양도하는 경우 단독주택 1채로 보아 1세대 1주택 비과세 및 고가주택 판정을 적용할 수 있습니다.',
            documents: ['건축물대장', '매매계약서 (통매각 특약 확인)']
        },
        mixed_use_building: {
            label: '상가주택 건물',
            message: '12억 원을 초과하는 고가 상가주택은 면적에 상관없이 주택과 상가 부분을 분리하여 과세하므로 전문가의 안분 계산이 필요합니다.',
            documents: ['건축물대장', '감정평가서 또는 기준시가 산정자료'],
            severe: true
        }
    }
};

const FilingFormFiles = {
    simplifiedRealEstate: {
        formCode: '84의4',
        title: '양도소득세 간편신고서',
        pdfPath: 'forms/yangdo_simple_84_4.pdf',
        hwpxPath: 'forms/yangdo_simple_84_4.hwpx',
        pdfDownloadName: '별지84의4_양도소득세_간편신고서.pdf',
        hwpxDownloadName: '별지84의4_양도소득세_간편신고서.hwpx'
    },
    simplifiedStock: {
        formCode: '84의5',
        title: '주식등 양도소득세 간편신고서',
        pdfPath: 'forms/yangdo_stock_simple_84_5.pdf',
        hwpxPath: 'forms/yangdo_stock_simple_84_5.hwpx',
        pdfDownloadName: '별지84의5_주식등_양도소득세_간편신고서.pdf',
        hwpxDownloadName: '별지84의5_주식등_양도소득세_간편신고서.hwpx'
    },
    standard: {
        formCode: '84',
        title: '양도소득 과세표준 신고 및 납부계산서',
        pdfPath: 'forms/yangdo_standard_84.pdf',
        hwpxPath: 'forms/yangdo_standard_84.hwpx',
        pdfDownloadName: '별지84_양도소득_과세표준_신고_및_납부계산서.pdf',
        hwpxDownloadName: '별지84_양도소득_과세표준_신고_및_납부계산서.hwpx'
    }
};

class TaxCalculator {
    constructor() {
        this.data = TaxData;
    }

    calculate(rawInputs) {
        const inputs = this.normalizeInputs(rawInputs);

        // ── 겸용주택 안분 처리 ──
        const isMixedUse = inputs.specialCases.includes('mixed_use_building')
            && inputs.mixedUseHouseStdPrice > 0
            && inputs.mixedUseCommercialStdPrice > 0;

        let mixedUseApportionment = null;
        if (isMixedUse) {
            const totalStdPriceSell = inputs.mixedUseHouseStdPrice + inputs.mixedUseCommercialStdPrice;
            const houseRatioSell = inputs.mixedUseHouseStdPrice / totalStdPriceSell;
            const commercialRatioSell = 1 - houseRatioSell;

            const hasAcqStdPrice = inputs.mixedUseHouseStdPriceAtAcq > 0 && inputs.mixedUseCommercialStdPriceAtAcq > 0;
            const totalStdPriceAcq = hasAcqStdPrice
                ? inputs.mixedUseHouseStdPriceAtAcq + inputs.mixedUseCommercialStdPriceAtAcq
                : totalStdPriceSell;
            const houseRatioAcq = hasAcqStdPrice
                ? inputs.mixedUseHouseStdPriceAtAcq / totalStdPriceAcq
                : houseRatioSell;

            mixedUseApportionment = {
                houseRatioSell: Number(houseRatioSell.toFixed(4)),
                commercialRatioSell: Number(commercialRatioSell.toFixed(4)),
                houseRatioAcq: Number(houseRatioAcq.toFixed(4)),
                houseAreaLarger: inputs.mixedUseHouseArea > inputs.mixedUseCommercialArea
            };
        }

        // ── 토지·건물 분리 계산 (상가·일반 건물) ──
        const isLandBuildingSplit = inputs.landBuildingSeparate
            && inputs.assetCategory === 'other' && inputs.otherAssetCategory !== 'land';
        const lbCalc = isLandBuildingSplit ? this.getLandBuildingCalc(inputs) : null;
        if (lbCalc) {
            // 합산 과세표준에 기본세율 적용(단기·중과·비교과세는 경고로 안내). 기본세율 유도를 위해 보유기간 보정
            inputs.holdingPeriod = Math.max(inputs.landHoldingPeriod || 0, inputs.buildingHoldingPeriod || 0, 2);
        }

        const transferPrice = lbCalc ? lbCalc.transferPrice : inputs.transferPrice;

        let acquisitionCost = 0;
        let necessaryExpenses = inputs.necessaryExpenses;
        let acquisitionCalcDetail = '실지거래가액 적용';

        if (lbCalc) {
            acquisitionCost = lbCalc.acquisitionCost;
            necessaryExpenses = lbCalc.necessaryExpenses;
            acquisitionCalcDetail = `토지·건물 분리 계산: 토지 취득가 ${this.formatCurrency(lbCalc.landAcq)}${lbCalc.landConverted ? '(환산)' : ''} + 건물 취득가 ${this.formatCurrency(lbCalc.buildingAcq)}${lbCalc.buildingConverted ? '(환산)' : ''}`;
        } else if (inputs.acquisitionMethod === 'estimated') {
            if (inputs.transferTaxBase > 0 && inputs.acquisitionTaxBase > 0) {
                acquisitionCost = Math.floor(
                    transferPrice * (inputs.acquisitionTaxBase / inputs.transferTaxBase)
                );
                necessaryExpenses = Math.floor(inputs.acquisitionTaxBase * 0.03);
                acquisitionCalcDetail = `환산취득가액 ${this.formatCurrency(acquisitionCost)} + 개산공제 ${this.formatCurrency(necessaryExpenses)}`;
            } else {
                acquisitionCost = inputs.acquisitionPrice;
                acquisitionCalcDetail = '환산취득가액 입력값 부족으로 보조 계산 사용';
            }
        } else {
            acquisitionCost = inputs.acquisitionPrice;
        }

        // ── 재개발 원조합원 분리 계산 ──
        let redevCalc = null;
        const isRedevOriginal = inputs.type === 'right'
            && inputs.rightType === 'membership'
            && inputs.membershipType === 'original';

        if (isRedevOriginal && inputs.priorBuildingValue > 0) {
            redevCalc = this.getRedevOriginalMemberCalc(inputs, acquisitionCost, necessaryExpenses, transferPrice);
        }

        let capitalGains;
        if (lbCalc) {
            capitalGains = lbCalc.totalGain;
        } else if (redevCalc) {
            capitalGains = redevCalc.totalCapitalGains;
            acquisitionCalcDetail = `원조합원 분리 계산: 기존부동산부 ${this.formatCurrency(redevCalc.preApprovalGains)} + 권리부 ${this.formatCurrency(redevCalc.postApprovalGains)}`;
        } else if (isRedevOriginal || (inputs.type === 'right' && inputs.rightType === 'membership')) {
            // 납부 청산금을 취득원가 추가 공제로 처리
            capitalGains = transferPrice - acquisitionCost - inputs.paidClearanceAmount - necessaryExpenses;
            if (inputs.paidClearanceAmount > 0) {
                acquisitionCalcDetail += ` (청산금 ${this.formatCurrency(inputs.paidClearanceAmount)} 추가 공제)`;
            }
        } else {
            capitalGains = transferPrice - acquisitionCost - necessaryExpenses;
        }
        capitalGains = Math.max(0, capitalGains);

        const nonTaxableInfo = this.checkNonTaxable(inputs);
        const isNonTaxable = nonTaxableInfo.isEligible;

        let taxableGains = capitalGains;
        let taxableRatio = 1.0;
        if (isNonTaxable) {
            if (transferPrice > this.data.NON_TAXABLE_LIMIT) {
                taxableRatio = (transferPrice - this.data.NON_TAXABLE_LIMIT) / transferPrice;
                taxableGains = Math.floor(capitalGains * taxableRatio);
            } else {
                taxableRatio = 0;
                taxableGains = 0;
            }
        }

        const heavyTaxInfo = this.checkHeavyTax(inputs);
        let deductionRate = heavyTaxInfo.isApplicable ? 0 : this.getLongTermDeductionRate(inputs, isNonTaxable);
        let longTermDeduction = Math.floor(taxableGains * deductionRate);

        // 토지·건물 분리: 장특공제를 토지/건물 각각 보유기간 기준으로 계산한 합계로 대체
        if (lbCalc) {
            deductionRate = lbCalc.blendedRate;
            longTermDeduction = lbCalc.totalLTD;
        }
        // 원조합원 분리 계산: 장특공제를 기존 부동산부 차익에만 적용
        if (redevCalc && !heavyTaxInfo.isApplicable) {
            deductionRate = redevCalc.deductionRate;
            longTermDeduction = redevCalc.longTermDeduction;
        }

        let incomeAmount = taxableGains - longTermDeduction;
        incomeAmount = Math.max(0, incomeAmount);

        const persons = inputs.isJointOwnership ? 2 : 1;
        const incomePerPerson = inputs.isJointOwnership ? Math.floor(incomeAmount / 2) : incomeAmount;
        // 미등기 양도자산은 양도소득기본공제(250만원)도 배제 (소득세법 §103①)
        const isUnregistered = (inputs.specialCases || []).includes('unregistered');
        const basicDeductionPerPerson = isUnregistered ? 0 : Math.min(incomePerPerson, this.data.BASIC_DEDUCTION);
        const taxBasePerPerson = Math.max(0, incomePerPerson - basicDeductionPerPerson);

        const rateInfo = this.getTaxRate(
            taxBasePerPerson,
            inputs,
            heavyTaxInfo.isApplicable,
            heavyTaxInfo.addRate
        );

        const calculatedTaxPerPerson = Math.max(
            0,
            Math.floor((taxBasePerPerson * rateInfo.rate) - rateInfo.deduction)
        );

        const calculatedTax = calculatedTaxPerPerson * persons;
        // ── 세액감면 (8년 자경농지 감면 등, 조세특례제한법) ──
        const taxReduction = this.getTaxReduction(inputs, calculatedTax);
        const decisionTax = Math.max(0, calculatedTax - taxReduction.amount);
        const localTax = Math.floor(decisionTax * 0.1);
        // 환산취득가액 적용 가산세 (소득세법 §114의2): 신축·증축 건물을 5년 내 양도하며 환산취득가액 적용 시 그 5%
        const conversionSurcharge = lbCalc
            ? lbCalc.buildingSurcharge
            : ((inputs.acquisitionMethod === 'estimated'
                && inputs.buildingNewBuildWithin5yr === 'yes'
                && acquisitionCost > 0)
                ? Math.floor(acquisitionCost * 0.05) : 0);
        // 예정신고 기한 경과 시 무신고·납부지연 가산세 추정 (오늘 기한 후 신고·납부 가정)
        const filingPenalty = this.getFilingPenalty(inputs, decisionTax, inputs.asOfDate);
        // 신고서(국세분)에 적는 납부할 세액 — 지방소득세는 별도 신고이므로 제외
        const nationalTax = decisionTax + conversionSurcharge + filingPenalty.total;
        const totalTax = nationalTax + localTax;

        let normalTotalTax = 0;
        if (heavyTaxInfo.isApplicable) {
            const normalRateInfo = this.getTaxRate(taxBasePerPerson, inputs, false, 0);
            const normalDeductionRate = this.getLongTermDeductionRate(inputs, isNonTaxable);
            const normalLongTermDeduction = Math.floor(taxableGains * normalDeductionRate);
            const normalIncome = Math.max(0, taxableGains - normalLongTermDeduction);
            const normalIncomePerPerson = inputs.isJointOwnership ? Math.floor(normalIncome / 2) : normalIncome;
            const normalBasic = Math.min(normalIncomePerPerson, this.data.BASIC_DEDUCTION);
            const normalTaxBase = Math.max(0, normalIncomePerPerson - normalBasic);
            const normalTaxPerPerson = Math.max(
                0,
                Math.floor((normalTaxBase * normalRateInfo.rate) - normalRateInfo.deduction)
            );
            const normalCalculatedTax = normalTaxPerPerson * persons;
            const normalLocalTax = Math.floor(normalCalculatedTax * 0.1);
            normalTotalTax = normalCalculatedTax + normalLocalTax;
        }

        let hypotheticalHeavyTax = 0;
        let savingsFromGracePeriod = 0;
        if (heavyTaxInfo.gracePeriodApplied && heavyTaxInfo.hypotheticalAddRate > 0) {
            const hypoRateInfo = this.getTaxRate(taxBasePerPerson, inputs, true, heavyTaxInfo.hypotheticalAddRate);
            const hypoLongTermDeduction = 0; // 중과 시 장특공제 배제
            const hypoIncome = Math.max(0, taxableGains - hypoLongTermDeduction);
            const hypoIncomePerPerson = inputs.isJointOwnership ? Math.floor(hypoIncome / 2) : hypoIncome;
            const hypoBasic = Math.min(hypoIncomePerPerson, this.data.BASIC_DEDUCTION);
            const hypoTaxBase = Math.max(0, hypoIncomePerPerson - hypoBasic);
            const hypoTaxPerPerson = Math.max(
                0,
                Math.floor((hypoTaxBase * hypoRateInfo.rate) - hypoRateInfo.deduction)
            );
            const hypoCalculatedTax = hypoTaxPerPerson * persons;
            const hypoLocalTax = Math.floor(hypoCalculatedTax * 0.1);
            hypotheticalHeavyTax = hypoCalculatedTax + hypoLocalTax;
            // 가산세는 양쪽 시나리오에 공통이므로 비교에서 제외 (감면·기본세액 + 지방세 기준)
            savingsFromGracePeriod = Math.max(0, hypotheticalHeavyTax - (decisionTax + localTax));
        }

        const result = {
            transferPrice,
            acquisitionCost,
            necessaryExpenses,
            acquisitionCalcDetail,
            capitalGains,
            taxableGains,
            isNonTaxable,
            isHighValue: isNonTaxable && transferPrice > this.data.NON_TAXABLE_LIMIT,
            longTermRate: deductionRate,
            longTermDeduction,
            incomeAmount,
            basicDeductionTotal: basicDeductionPerPerson * persons,
            taxBaseTotal: taxBasePerPerson * persons,
            taxRate: rateInfo.rate,
            taxProgressiveDeduction: rateInfo.deduction,
            calculatedTax,
            taxReduction,
            decisionTax,
            localTax,
            conversionSurcharge,
            filingPenalty,
            nationalTax,
            totalTax,
            persons,
            isHeavyTaxApplicable: heavyTaxInfo.isApplicable,
            heavyTaxTotalTax: totalTax,
            normalTotalTax,
            hypotheticalHeavyTax,
            savingsFromGracePeriod,
            nonTaxableInfo,
            taxableRatio,
            tempTwoHomeInfo: nonTaxableInfo.tempTwoHomeInfo || null,
            isMixedUse,
            mixedUseApportionment,
            redevCalc,
            isLandBuildingSplit,
            lbCalc
        };

        result.carryoverApplied = inputs._carryoverApplied || false;
        result.carryoverPeriodYears = inputs._carryoverPeriodYears || 0;
        result.landLimitInfo = (inputs.type === 'house' && (inputs.specialCases || []).includes('large_land_house'))
            ? this.getResidentialLandLimit(inputs)
            : null;

        result.nonTaxableChecklist = this.buildNonTaxableChecklist(inputs, result);
        result.calculationSteps = this.buildCalculationSteps(inputs, result);
        result.analysis = this.buildCaseAnalysis(inputs, result);
        result.scenarios = this.buildScenarios(inputs, result);
        result.filingGuide = this.buildFilingGuide(inputs, result);

        // ── 이월과세 부인 비교 (소득세법 §97의2②): 적용 세액이 미적용 세액보다 적으면 미적용 ──
        if (inputs._carryoverApplied && !rawInputs._skipCarryover) {
            const nonCarry = this.calculate({ ...rawInputs, _skipCarryover: true });
            if (nonCarry.totalTax > result.totalTax) {
                nonCarry.carryoverDenied = true;
                nonCarry.carryoverPeriodYears = result.carryoverPeriodYears;
                if (nonCarry.analysis && Array.isArray(nonCarry.analysis.cautions)) {
                    nonCarry.analysis.cautions.unshift('증여받은 자산이지만, 이월과세를 적용한 세액이 적용하지 않은 세액보다 적어 법에 따라 이월과세를 적용하지 않고(부인) 더 큰 세액으로 계산했습니다(소득세법 §97의2②). 증여자의 취득가액·취득일은 무시하고, 증여받은 분(수증자) 기준으로 계산했습니다.');
                }
                return nonCarry;
            }
        }

        return result;
    }

    normalizeInputs(rawInputs) {
        const inputs = {
            ...rawInputs,
            type: rawInputs.type || 'house',
            assetCategory: rawInputs.assetCategory || 'house',
            otherAssetCategory: rawInputs.otherAssetCategory || '',
            houseTaxView: rawInputs.houseTaxView || '',
            houseNonTaxableCategory: rawInputs.houseNonTaxableCategory || '',
            houseCount: Number(rawInputs.houseCount || 1),
            // 비과세 판정용 주택 수 (소득령 §154·§155)
            effectiveHouseCount: rawInputs.effectiveHouseCount != null
                ? Number(rawInputs.effectiveHouseCount)
                : Number(rawInputs.houseCount || 1),
            // 중과 판정용 주택 수 (소득령 §167의3②) — 제외 사유가 서로 달라 별도로 센다
            heavyTaxHouseCount: rawInputs.heavyTaxHouseCount != null
                ? Number(rawInputs.heavyTaxHouseCount)
                : Number(rawInputs.houseCount || 1),
            temp2House: rawInputs.temp2House || 'no',
            specialCases: Array.isArray(rawInputs.specialCases) ? rawInputs.specialCases : [],
            isJointOwnership: Boolean(rawInputs.isJointOwnership),
            acquisitionMethod: rawInputs.acquisitionMethod || 'real',
            transferPrice: Number(rawInputs.transferPrice || 0),
            acquisitionPrice: Number(rawInputs.acquisitionPrice || 0),
            necessaryExpenses: Number(rawInputs.necessaryExpenses || 0),
            transferTaxBase: Number(rawInputs.transferTaxBase || 0),
            acquisitionTaxBase: Number(rawInputs.acquisitionTaxBase || 0),
            holdingPeriod: Number(rawInputs.holdingPeriod || 0),
            residencyPeriod: Number(rawInputs.residencyPeriod || 0),
            buyDate: rawInputs.buyDate || '',
            contractDate: rawInputs.contractDate || '',
            sellDate: rawInputs.sellDate || '',
            asOfDate: rawInputs.asOfDate || '', // 가산세 기준일(테스트용 주입, 평소엔 오늘)
            newHomeContractDate: rawInputs.newHomeContractDate || '',
            marriageDate: rawInputs.marriageDate || '',
            cohabitationDate: rawInputs.cohabitationDate || '',
            inheritanceSaleType: rawInputs.inheritanceSaleType || '',
            inheritanceShareType: rawInputs.inheritanceShareType || '',
            inheritanceRuralHouseType: rawInputs.inheritanceRuralHouseType || '',
            propertySpecialCases: Array.isArray(rawInputs.propertySpecialCases) ? rawInputs.propertySpecialCases : [],
            stockItemCount: Number(rawInputs.stockItemCount || 1),
            stockRateCategory: rawInputs.stockRateCategory || 'general20',
            isAdjustedAreaAtAcquisition: this.normalizeChoice(rawInputs.isAdjustedAreaAtAcquisition),
            oldHomeAdjustedAtNewHomeContract: this.normalizeChoice(rawInputs.oldHomeAdjustedAtNewHomeContract),
            newHomeAdjustedAtContract: this.normalizeChoice(rawInputs.newHomeAdjustedAtContract),
            isAdjustedAreaAtTransfer: this.normalizeChoice(rawInputs.isAdjustedAreaAtTransfer),
            isNewlyDesignatedArea: rawInputs.isNewlyDesignatedArea || 'no',
            // 겸용주택 관련
            mixedUseHouseArea: Number(rawInputs.mixedUseHouseArea || 0),
            mixedUseCommercialArea: Number(rawInputs.mixedUseCommercialArea || 0),
            mixedUseHouseStdPrice: Number(rawInputs.mixedUseHouseStdPrice || 0),
            mixedUseCommercialStdPrice: Number(rawInputs.mixedUseCommercialStdPrice || 0),
            mixedUseHouseStdPriceAtAcq: Number(rawInputs.mixedUseHouseStdPriceAtAcq || 0),
            mixedUseCommercialStdPriceAtAcq: Number(rawInputs.mixedUseCommercialStdPriceAtAcq || 0),
            // 재개발·재건축 관련
            redevSaleType: rawInputs.redevSaleType || '',
            approvalDate: rawInputs.approvalDate || '',
            completionDate: rawInputs.completionDate || '',
            priorBuildingValue: Number(rawInputs.priorBuildingValue || 0),
            paidClearanceAmount: Number(rawInputs.paidClearanceAmount || 0),
            // 임대사업자 거주주택 특례 관련
            rentalSaleType: rawInputs.rentalSaleType || '',
            rentalIsRegistered: rawInputs.rentalIsRegistered || '',
            rentalRegisteredBefore2020: rawInputs.rentalRegisteredBefore2020 || '',
            rentalPeriodType: rawInputs.rentalPeriodType || '',
            rentalPriceCapMet: rawInputs.rentalPriceCapMet || '',
            // 환산취득가액 가산세 관련 (소득세법 §114의2)
            buildingNewBuildWithin5yr: rawInputs.buildingNewBuildWithin5yr || '',
            isNonBusinessLand: rawInputs.isNonBusinessLand || '',
            // 8년 자경농지 감면 (조특법 §69)
            selfFarmingExemption: rawInputs.selfFarmingExemption || '',
            selfFarming8yrMet: rawInputs.selfFarming8yrMet || '',
            farmlandAtTransfer: rawInputs.farmlandAtTransfer || '',
            // 주택 부수토지 한도(소득세법 §104의3, 시행령 §157)
            residentialLandArea: Number(rawInputs.residentialLandArea || 0),
            buildingFootprintArea: Number(rawInputs.buildingFootprintArea || 0),
            landZoneType: rawInputs.landZoneType || '',
            // 토지·건물 분리 계산 관련
            landBuildingSeparate: Boolean(rawInputs.landBuildingSeparate),
            priceInputMode: rawInputs.priceInputMode || 'separate',
            landTransferPrice: Number(rawInputs.landTransferPrice || 0),
            buildingTransferPrice: Number(rawInputs.buildingTransferPrice || 0),
            landStdAtSell: Number(rawInputs.landStdAtSell || 0),
            buildingStdAtSell: Number(rawInputs.buildingStdAtSell || 0),
            landAcqMethod: rawInputs.landAcqMethod || 'real',
            buildingAcqMethod: rawInputs.buildingAcqMethod || 'real',
            landAcqPrice: Number(rawInputs.landAcqPrice || 0),
            buildingAcqPrice: Number(rawInputs.buildingAcqPrice || 0),
            landStdAtAcq: Number(rawInputs.landStdAtAcq || 0),
            buildingStdAtAcq: Number(rawInputs.buildingStdAtAcq || 0),
            landHoldingPeriod: Number(rawInputs.landHoldingPeriod || 0),
            buildingHoldingPeriod: Number(rawInputs.buildingHoldingPeriod || 0),
            landExpenses: Number(rawInputs.landExpenses || 0),
            buildingExpenses: Number(rawInputs.buildingExpenses || 0)
        };

        // 승계조합원 완공 후 양도 → 사실상 주택 양도로 취급, 보유기간 준공일부터 재산정
        if (
            inputs.type === 'right'
            && inputs.rightType === 'membership'
            && inputs.membershipType === 'succeeding'
            && inputs.redevSaleType === 'after_completion'
            && inputs.completionDate
        ) {
            inputs.type = 'house';
            inputs.redevOriginalType = 'succeeding_after_completion';

            const completionDate = this.toDate(inputs.completionDate);
            const sellDate = this.toDate(inputs.sellDate);
            if (completionDate && sellDate && sellDate > completionDate) {
                const days = (sellDate - completionDate) / (1000 * 60 * 60 * 24);
                inputs.holdingPeriod = Number((days / 365.25).toFixed(2));
            }
        }

        // ── 배우자·직계존비속 증여 이월과세 (소득세법 §97의2) ──
        inputs.acquiredByGift = rawInputs.acquiredByGift || 'no';
        inputs.giftRegistrationDate = rawInputs.giftRegistrationDate || '';
        inputs.donorAcqDate = rawInputs.donorAcqDate || '';
        inputs.donorAcqPrice = Number(rawInputs.donorAcqPrice || 0);
        inputs.giftTaxPaid = Number(rawInputs.giftTaxPaid || 0);
        inputs._carryoverApplied = false;
        inputs._carryoverEligibleButManual = false;

        if (
            inputs.acquiredByGift === 'yes'
            && inputs.giftRegistrationDate
            && inputs.donorAcqDate
            && inputs.donorAcqPrice > 0
            && inputs.sellDate
            && inputs.type !== 'stock'
        ) {
            const giftDate = this.toDate(inputs.giftRegistrationDate);
            const sellDate = this.toDate(inputs.sellDate);
            const donorDate = this.toDate(inputs.donorAcqDate);
            // 증여등기일 2023.1.1 이후 증여분은 10년, 그 전은 5년 이내 양도 시 이월과세
            const periodYears = inputs.giftRegistrationDate >= '2023-01-01' ? 10 : 5;
            const deadline = giftDate ? new Date(giftDate) : null;
            if (deadline) deadline.setFullYear(deadline.getFullYear() + periodYears);

            const withinPeriod = giftDate && sellDate && donorDate && deadline && sellDate <= deadline;
            // 토지·건물 분리, 겸용주택, 원조합원 분리 계산과 동시 적용은 위험하므로 자동계산에서 제외(경고만)
            const autoSafe = (inputs.assetCategory === 'house' || inputs.assetCategory === 'other')
                && !inputs.landBuildingSeparate
                && !(rawInputs.specialCases || []).includes('mixed_use_building');

            if (withinPeriod) {
                inputs._carryoverPeriodYears = periodYears;
                if (autoSafe && !rawInputs._skipCarryover) {
                    inputs._carryoverApplied = true;
                    inputs.acquisitionMethod = 'real';
                    inputs.acquisitionPrice = inputs.donorAcqPrice;
                    inputs.necessaryExpenses = (inputs.necessaryExpenses || 0) + inputs.giftTaxPaid;
                    inputs.buyDate = inputs.donorAcqDate;
                    const days = (sellDate - donorDate) / (1000 * 60 * 60 * 24);
                    inputs.holdingPeriod = Number(Math.max(0, days / 365.25).toFixed(2));
                } else if (!autoSafe) {
                    inputs._carryoverEligibleButManual = true;
                }
            }
        }

        return inputs;
    }

    normalizeChoice(value) {
        if (value === true || value === 'yes') return 'yes';
        if (value === false || value === 'no') return 'no';
        return 'unknown';
    }

    checkNonTaxable(inputs) {
        if (inputs.type === 'stock') {
            return {
                isEligible: false,
                needsReview: false,
                message: '주식등은 비과세 1주택 판정 없이 양도차익과 세율 구분을 기준으로 계산했습니다.'
            };
        }

        if (inputs.type !== 'house') {
            return {
                isEligible: false,
                needsReview: false,
                message: '주택 외 자산은 1세대 1주택 비과세 판정 대상이 아닙니다.'
            };
        }

        // ── 미등기 양도자산: 비과세·감면·장기보유특별공제 전부 배제 (소득세법 §91①, §104①10호) ──
        if ((inputs.specialCases || []).includes('unregistered')) {
            return {
                isEligible: false,
                needsReview: false,
                message: '등기를 하지 않고 판 집(미등기 양도)은 1세대 1주택 비과세·감면·장기보유특별공제가 모두 빠지고, 양도차익의 70%가 세금으로 부과됩니다.'
            };
        }

        // ── 비거주자: 1세대 1주택 비과세 원칙적 배제 (소득세법 §121②) ──
        if ((inputs.specialCases || []).includes('nonResident')) {
            return {
                isEligible: false,
                needsReview: true,
                message: '해외에 사는 비거주자는 원칙적으로 1세대 1주택 비과세를 받을 수 없습니다. 다만 국내에 살던(거주자) 때 산 집을 출국일부터 2년 안에 팔면 비과세가 가능하니, 출국일과 취득일을 꼭 확인하세요.'
            };
        }

        if (inputs.effectiveHouseCount === 1) {
            if (inputs.holdingPeriod < 2) {
                return {
                    isEligible: false,
                    needsReview: false,
                    message: '1세대 1주택이라도 보유기간 2년 요건을 먼저 충족해야 합니다.'
                };
            }

            if (inputs.isAdjustedAreaAtAcquisition === 'yes' && inputs.residencyPeriod < 2) {
                if (inputs.winwinRentalApplied === 'yes') {
                    // 상생임대 특례 적용: 거주 2년 요건 면제 (소득령 §155조의3)
                } else if (inputs.winwinRentalApplied === 'unknown') {
                    return {
                        isEligible: false,
                        needsReview: true,
                        message: '상생임대 특례 요건 충족 여부가 불확실합니다. 요건을 갖추면 거주기간 2년 없이도 비과세 가능합니다.'
                    };
                } else {
                    return {
                        isEligible: false,
                        needsReview: false,
                        message: '조정대상지역 취득 주택으로 보아 거주기간 2년 요건을 충족하지 못한 것으로 계산했습니다.'
                    };
                }
            }

            if (inputs.isAdjustedAreaAtAcquisition === 'unknown' && inputs.residencyPeriod < 2) {
                return {
                    isEligible: false,
                    needsReview: true,
                    message: '취득 당시 규제지역 여부가 확인되지 않아 1세대 1주택 비과세를 확정할 수 없습니다.'
                };
            }

            return {
                isEligible: true,
                needsReview: false,
                message: '1세대 1주택 비과세 흐름에 맞춰 보유·거주 요건을 충족한 것으로 계산했습니다.'
            };
        }

        if (inputs.effectiveHouseCount === 2 && inputs.temp2House === 'yes') {
            const tempTwoHomeInfo = this.checkTemporaryTwoHome(inputs);
            return {
                isEligible: tempTwoHomeInfo.isEligible,
                needsReview: tempTwoHomeInfo.needsReview,
                message: tempTwoHomeInfo.message,
                tempTwoHomeInfo
            };
        }

        if (inputs.houseNonTaxableCategory === 'specialNonTaxable') {
            return this.checkSpecialNonTaxable(inputs);
        }

        // specialNonTaxable 경로가 아니어도 특례 케이스를 선택했으면 검토
        const specialCasesForCheck = inputs.specialCases || [];
        const SPECIAL_CASE_KEYS = ['rental', 'marriage', 'cohabitation', 'inherited', 'winwin'];
        if (SPECIAL_CASE_KEYS.some(k => specialCasesForCheck.includes(k))) {
            return this.checkSpecialNonTaxable(inputs);
        }

        return {
            isEligible: false,
            needsReview: false,
            message: '다주택 또는 일반 과세 흐름으로 계산했습니다.'
        };
    }

    checkSpecialNonTaxable(inputs) {
        const specialCases = inputs.specialCases || [];

        // ── 혼인 특례 ──
        if (specialCases.includes('marriage')) {
            if (!inputs.marriageDate || !inputs.sellDate) {
                return {
                    isEligible: false,
                    needsReview: true,
                    message: '혼인합가일 또는 양도일 정보가 부족하여 10년 특례 여부를 판정할 수 없습니다. 혼인관계증명서와 매매계약서를 확인하세요.'
                };
            }
            const marriageDate = this.toDate(inputs.marriageDate);
            const sellDate = this.toDate(inputs.sellDate);
            const deadline = new Date(marriageDate);
            deadline.setFullYear(deadline.getFullYear() + 10);

            if (sellDate <= deadline) {
                return {
                    isEligible: true,
                    needsReview: true,
                    message: `혼인합가일(${this.formatDate(marriageDate)})로부터 10년 이내 양도에 해당합니다. 혼인 전 각자 1주택을 보유했고 보유·거주 요건을 충족하면 비과세가 적용됩니다. 전문가 확인을 권장합니다.`
                };
            } else {
                return {
                    isEligible: false,
                    needsReview: false,
                    message: `혼인합가일(${this.formatDate(marriageDate)})로부터 10년이 경과하여(기한: ${this.formatDate(deadline)}) 혼인 특례 비과세 요건을 충족하지 못했습니다.`
                };
            }
        }

        // ── 동거봉양 합가 특례 (소득세법 시행령 §155④) ──
        if (specialCases.includes('cohabitation')) {
            if (!inputs.cohabitationDate || !inputs.sellDate) {
                return {
                    isEligible: false,
                    needsReview: true,
                    message: '동거봉양 합가일 또는 양도일 정보가 부족하여 10년 특례 여부를 판정할 수 없습니다. 주민등록표 등본으로 합가일을 확인하세요.'
                };
            }
            const cohabDate = this.toDate(inputs.cohabitationDate);
            const sellDate = this.toDate(inputs.sellDate);
            const deadline = new Date(cohabDate);
            deadline.setFullYear(deadline.getFullYear() + 10);

            if (sellDate <= deadline) {
                return {
                    isEligible: true,
                    needsReview: true,
                    message: `동거봉양 합가일(${this.formatDate(cohabDate)})로부터 10년 이내 양도에 해당합니다(소득세법 시행령 §155④). 합가 전 각자 1주택을 보유했고 양도 주택이 보유·거주 요건을 충족하면 비과세가 적용됩니다. 60세 이상 직계존속 동거봉양 요건을 전문가와 확인하세요.`
                };
            } else {
                return {
                    isEligible: false,
                    needsReview: false,
                    message: `동거봉양 합가일(${this.formatDate(cohabDate)})로부터 10년이 경과하여(기한: ${this.formatDate(deadline)}) 동거봉양 특례 비과세 요건을 충족하지 못했습니다.`
                };
            }
        }

        // ── 상속 특례 ──
        if (specialCases.includes('inherited')) {
            if (inputs.inheritanceSaleType === 'general') {
                const isRural = inputs.inheritanceRuralHouseType === 'rural_5yr';
                if (inputs.holdingPeriod >= 2) {
                    if (isRural) {
                        return {
                            isEligible: true,
                            needsReview: true,
                            message: '피상속인이 5년 이상 거주한 농어촌주택을 상속받은 경우(소득세법 시행령 §155⑦①), 상속개시일 이후 새로 취득한 일반주택을 양도할 때도 1주택으로 보아 비과세가 가능합니다. 수도권 밖 읍·면 소재 여부, 피상속인 거주 기간(5년 이상) 등 요건을 전문가와 확인하세요.'
                        };
                    }
                    return {
                        isEligible: true,
                        needsReview: true,
                        message: '상속주택을 보유하고 상속개시 당시 보유하던 일반주택을 양도하는 경우, 상속 당시 1주택자였다면 1세대 1주택 비과세 특례(§155②)가 적용될 수 있습니다. 상속개시 당시 주택 수 및 요건을 전문가와 확인하세요.'
                    };
                } else {
                    return {
                        isEligible: false,
                        needsReview: true,
                        message: `상속 ${isRural ? '농어촌주택(§155⑦①)' : '특례(§155②)'} 비과세가 가능하나 보유기간 2년 요건을 충족하지 못했습니다. 보유기간 요건과 상속개시 당시 주택 수를 전문가와 확인하세요.`
                    };
                }
            } else if (inputs.inheritanceSaleType === 'inherited') {
                if (inputs.inheritanceShareType === 'minority') {
                    return {
                        isEligible: false,
                        needsReview: true,
                        message: '공동상속주택 소수지분자는 해당 주택이 주택 수에서 제외되어 주택 수 산정에는 유리합니다. 다만 소수지분을 양도할 때는 비과세가 아닌 일반 양도로 취급되며, 취득가액·장기보유특별공제 계산이 복잡하므로 전문가 확인이 필요합니다.'
                    };
                }
                // 단독 상속 또는 최대지분자
                return {
                    isEligible: false,
                    needsReview: true,
                    message: '상속받은 주택 자체를 양도하는 경우, 상속 당시 무주택자였고 보유·거주 요건을 충족하면 1세대 1주택 비과세가 가능합니다. 상속개시 당시 주택 보유 여부, 보유·거주 기간 요건을 전문가와 확인하세요.'
                };
            }
            return {
                isEligible: false,
                needsReview: true,
                message: '상속 특례 비과세 여부는 양도하는 주택의 유형, 상속 당시 주택 수 등에 따라 달라집니다. 전문가 확인이 필요합니다.'
            };
        }

        // ── 임대사업자 거주주택 특례 (소득세법 시행령 §155⑳) ──
        if (specialCases.includes('rental')) {
            const { rentalSaleType, rentalIsRegistered, rentalRegisteredBefore2020, rentalPeriodType, rentalPriceCapMet } = inputs;
            const residencyPeriod = inputs.residencyPeriod || 0;

            // 정보 미입력
            if (!rentalSaleType) {
                return {
                    isEligible: false,
                    needsReview: true,
                    message: '임대사업자 특례 판정을 위해 양도 집 종류와 등록 정보를 입력해주세요.'
                };
            }

            // 임대주택 자체 양도: 비과세 불가, 중과세 배제 가능
            if (rentalSaleType === 'rental_property') {
                return {
                    isEligible: false,
                    needsReview: rentalIsRegistered === 'yes',
                    message: rentalIsRegistered === 'yes'
                        ? '등록 임대주택을 양도하는 경우 비과세는 적용되지 않습니다. 단, 장기임대주택 등록 요건(소득세법 시행령 §167의3①②)을 갖추었다면 다주택 중과세가 배제될 수 있습니다. 전문가 확인을 권장합니다.'
                        : '임대주택을 양도하는 경우 비과세는 적용되지 않습니다.'
                };
            }

            // 거주주택 양도: 비과세 특례 요건 검토
            if (rentalIsRegistered === 'no') {
                return {
                    isEligible: false,
                    needsReview: false,
                    message: '세무서(사업자등록)와 지자체(민간임대주택법 §5 임대사업자등록) 모두 등록하지 않은 경우 거주주택 비과세 특례(§155⑳)를 적용받을 수 없습니다.'
                };
            }
            if (rentalIsRegistered === 'unknown') {
                return {
                    isEligible: false,
                    needsReview: true,
                    message: '임대주택의 등록 여부를 확인하세요. 세무서 사업자등록과 지자체 임대사업자등록이 모두 완료되어 있어야 거주주택 비과세 특례(§155⑳)가 가능합니다.'
                };
            }

            // 거주기간 2년 이상 (§155⑳①)
            if (residencyPeriod < 2) {
                return {
                    isEligible: false,
                    needsReview: false,
                    message: `거주주택 비과세 특례(§155⑳)는 보유기간 중 거주기간이 2년 이상이어야 합니다. 현재 입력 기준 거주기간은 ${Math.floor(residencyPeriod)}년입니다.`
                };
            }

            // 2020년 7월 10일 이전 등록 여부 (§155⑳ 가목·다목~마목 적용 요건)
            if (rentalRegisteredBefore2020 === 'no') {
                return {
                    isEligible: false,
                    needsReview: true,
                    message: '2020년 7월 11일 이후에 등록한 임대주택은 §155⑳의 장기임대주택 요건을 원칙적으로 충족하지 못합니다(아파트 장기임대 매입 신규등록 불가). 단, 민간건설임대(바목) 등 일부 예외가 있을 수 있으므로 전문가 확인이 필요합니다.'
                };
            }

            // 임대료 5% 상한 미준수
            if (rentalPriceCapMet === 'no') {
                return {
                    isEligible: false,
                    needsReview: false,
                    message: '임대료(보증금 포함)를 직전 계약 대비 5% 초과 인상한 경우 거주주택 비과세 특례(§155⑳②) 요건을 충족하지 못합니다.'
                };
            }

            const needsReview = rentalRegisteredBefore2020 === 'unknown' || rentalPriceCapMet === 'unknown' || !rentalPeriodType;

            // 의무임대기간 미충족: §155㉑에 따라 선적용 가능하나 사후 미충족 시 추납
            if (rentalPeriodType === 'under5') {
                return {
                    isEligible: true,
                    needsReview: true,
                    message: '의무임대기간을 아직 채우지 않았더라도 거주주택 비과세 특례(§155⑳, ㉑)를 먼저 적용받을 수 있습니다. 다만, 이후 의무임대기간을 충족하지 못하면 소급하여 세액을 추납(사유발생월 말일로부터 2개월 이내)해야 합니다. 반드시 전문가와 확인하세요.'
                };
            }

            return {
                isEligible: true,
                needsReview,
                message: needsReview
                    ? '입력 정보 기준으로 거주주택 비과세 특례(소득세법 시행령 §155⑳) 요건을 충족할 가능성이 있습니다. 등록 요건, 임대기간, 임대료 증액 제한 등을 전문가와 최종 확인하세요.'
                    : '거주주택 비과세 특례(소득세법 시행령 §155⑳) 요건을 충족한 것으로 계산했습니다. 임대사업자 등록 유지 및 의무임대기간 준수 여부를 양도 전 최종 확인하세요.'
            };
        }

        // ── 상생임대 특례 ──
        if (specialCases.includes('winwin')) {
            return {
                isEligible: false,
                needsReview: true,
                message: '상생임대 특례는 직전 계약 대비 임대료 5% 이하 인상, 2026년 12월 31일까지 계약 체결 요건을 충족하면 거주기간 요건 없이 비과세가 가능합니다. 직전·신규 임대차계약서로 요건을 확인하세요.'
            };
        }

        // 기타 특례 (오피스텔, 농어촌주택 등)
        return {
            isEligible: false,
            needsReview: true,
            message: '선택하신 특례는 요건이 복잡하여 전문가 확인이 필요합니다. 결과 화면의 주의사항을 참고하세요.'
        };
    }

    checkTemporaryTwoHome(inputs) {
        if (!inputs.newHomeContractDate || !inputs.sellDate || !inputs.buyDate) {
            return {
                isEligible: false,
                needsReview: true,
                message: '일시적 2주택 특례는 종전주택 취득일, 신규 자산 취득(계약)일, 종전주택 양도일을 모두 확인해야 합니다.'
            };
        }

        const buyDate = this.toDate(inputs.buyDate);
        const contractDate = this.toDate(inputs.newHomeContractDate);
        const sellDate = this.toDate(inputs.sellDate);

        // 2021년 1월 1일 이전 취득한 분양권은 주택 수에 포함되지 않음 (사실상 1세대 1주택)
        const ticketLawStartDate = this.toDate('2021-01-01');
        if (inputs.newAssetType === 'ticket' && contractDate < ticketLawStartDate) {
            return {
                isEligible: true,
                needsReview: false,
                allowedYears: Infinity,
                deadline: null,
                deadlineLabel: '기한 없음',
                message: '2021년 1월 1일 이전에 취득한 분양권은 세법상 주택 수에 포함되지 않으므로, 종전주택 양도 시 1세대 1주택 비과세가 적용됩니다 (기한 제한 없음).'
            };
        }

        // 1년 이상 경과 후 신규 자산 취득 요건 (1년 갭)
        const oneYearAfterBuy = new Date(buyDate);
        oneYearAfterBuy.setFullYear(oneYearAfterBuy.getFullYear() + 1);
        if (contractDate < oneYearAfterBuy) {
            return {
                isEligible: false,
                needsReview: true,
                message: '종전주택 취득 후 1년이 지나기 전에 신규 자산을 취득하여 일시적 2주택 요건(1년 이상 경과)을 충족하지 못했습니다.'
            };
        }

        // 2022년 5월 10일 이후 양도분부터는 신규주택 및 종전주택 지역 불문 처분기한 3년으로 일원화
        // 이사 및 전입 요건도 전면 폐지되었으므로 기본적으로 3년 기한을 적용
        let allowedYears = 3;

        const deadline = new Date(contractDate);
        deadline.setFullYear(deadline.getFullYear() + allowedYears);
        
        let isEligible = sellDate <= deadline;
        let message = '';

        if (!isEligible && (inputs.newAssetType === 'ticket' || inputs.newAssetType === 'right')) {
            if (inputs.specialMoveInCondition === 'yes') {
                isEligible = true;
                message = `신규 취득일 기준 3년이 지났으나, 새 주택 완공 후 3년 내 종전주택 양도 및 1년 이상 계속 거주 특례 요건을 충족한다고 답변하여 일시적 2주택 비과세를 적용했습니다.`;
            } else {
                message = `신규 자산 취득일 기준 3년 허용기한 ${this.formatDate(deadline)}을 넘겼고, 완공 후 3년 내 양도 및 1년 거주 특례 요건도 충족하지 않는다고 답변하여 비과세를 적용하지 않았습니다.`;
            }
        } else {
            message = isEligible
                ? `신규 자산 취득일 기준 ${allowedYears}년 내에 종전주택을 양도한 것으로 계산했습니다.`
                : `신규 자산 취득일 기준 허용기한 ${this.formatDate(deadline)}을 넘겨 비과세를 적용하지 않았습니다.`;
        }

        return {
            isEligible,
            needsReview: false,
            allowedYears,
            deadline,
            deadlineLabel: this.formatDate(deadline),
            message
        };
    }

    checkHeavyTax(inputs) {
        // 중과 판정 주택 수는 비과세 판정용(effectiveHouseCount)과 제외 사유가 다르다.
        // 소득령 §167의3②(지방저가주택·소형신축·인구감소지역 등)은 여기서만 빠진다.
        const effectiveCount = inputs.heavyTaxHouseCount ?? inputs.houseCount;
        if (inputs.type !== 'house' || effectiveCount < 2) {
            return { isApplicable: false, addRate: 0 };
        }

        // 등록 임대주택 양도: 중과세 배제 (소득세법 시행령 §167의3①②)
        if ((inputs.specialCases || []).includes('rental') &&
            inputs.rentalSaleType === 'rental_property' &&
            inputs.rentalIsRegistered === 'yes') {
            return { isApplicable: false, addRate: 0, rentalExemptionApplied: true };
        }

        if (inputs.isAdjustedAreaAtTransfer !== 'yes') {
            return { isApplicable: false, addRate: 0 };
        }

        const hypotheticalAddRate = effectiveCount === 2 ? 0.20 : 0.30;

        const sellDate = this.toDate(inputs.sellDate);
        const heavyTaxStartDate = this.toDate('2026-05-10');

        if (!sellDate || sellDate < heavyTaxStartDate) {
            return { isApplicable: false, addRate: 0, gracePeriodApplied: true, hypotheticalAddRate };
        }

        const contractDate = this.toDate(inputs.contractDate);
        const gracePeriodEndContract = this.toDate('2026-05-09');

        if (contractDate && contractDate <= gracePeriodEndContract) {
            // 2025.10.16 신규 지정 조정대상지역은 예외 기한이 계약일+6개월(2026.11.9 한정), 기존 지역은 +4개월
            const graceMonths = inputs.isNewlyDesignatedArea === 'yes' ? 6 : 4;
            const deadline = new Date(contractDate);
            deadline.setMonth(deadline.getMonth() + graceMonths);
            if (sellDate <= deadline) {
                return { isApplicable: false, addRate: 0, gracePeriodApplied: true, hypotheticalAddRate, graceMonths };
            }
        }

        return {
            isApplicable: true,
            addRate: effectiveCount === 2 ? 0.20 : 0.30
        };
    }

    getRedevOriginalMemberCalc(inputs, acquisitionCost, necessaryExpenses, transferPrice) {
        const approvalDate = this.toDate(inputs.approvalDate);
        const buyDate = this.toDate(inputs.buyDate);

        let preApprovalHoldingYears = inputs.holdingPeriod;
        if (approvalDate && buyDate && approvalDate > buyDate) {
            const days = (approvalDate - buyDate) / (1000 * 60 * 60 * 24);
            preApprovalHoldingYears = Math.max(0, days / 365.25);
        }

        const priorBuildingValue = inputs.priorBuildingValue;
        const paidClearanceAmount = inputs.paidClearanceAmount || 0;

        // 기존 부동산부 차익 (인가 전): 관리처분 평가액 - 취득가액(취득세 등 포함)
        const preApprovalGains = Math.max(0, priorBuildingValue - acquisitionCost);

        // 권리부 차익 (인가 후): 양도가액 - (관리처분 평가액 + 납부청산금) - 양도 필요경비
        const postApprovalGains = Math.max(0, transferPrice - priorBuildingValue - paidClearanceAmount - necessaryExpenses);

        const totalCapitalGains = preApprovalGains + postApprovalGains;

        // 장특공제: 기존 부동산부 차익에만, 인가 전 보유기간 기준 (일반 연 2%, 최대 30%)
        const preApprovalYears = Math.floor(preApprovalHoldingYears);
        const deductionRate = preApprovalYears >= 3
            ? Number(Math.min(preApprovalYears * this.data.LONG_TERM_GENERAL.RATE_PER_YEAR, this.data.LONG_TERM_GENERAL.MAX_RATE).toFixed(2))
            : 0;
        const longTermDeduction = Math.floor(preApprovalGains * deductionRate);

        return {
            preApprovalGains,
            postApprovalGains,
            totalCapitalGains,
            preApprovalHoldingYears,
            deductionRate,
            longTermDeduction,
            paidClearanceAmount
        };
    }

    // 토지·건물 분리 계산 (상가·일반 건물): 양도가액 안분, 토지/건물 각각 취득가액(실가/환산)·장기보유특별공제
    getLandBuildingCalc(inputs) {
        const ltdRate = (yrs) => {
            const y = Math.floor(yrs || 0);
            if (y < 3) return 0;
            return Number(Math.min(y * this.data.LONG_TERM_GENERAL.RATE_PER_YEAR, this.data.LONG_TERM_GENERAL.MAX_RATE).toFixed(2));
        };

        // 1. 양도가액 토지/건물 분리
        let landTP, buildingTP, apportioned = false, stdDiffWarn = false;
        const lStdSell = inputs.landStdAtSell, bStdSell = inputs.buildingStdAtSell;
        if (inputs.priceInputMode === 'lumped') {
            const totStd = lStdSell + bStdSell;
            if (totStd > 0) {
                landTP = Math.floor(inputs.transferPrice * lStdSell / totStd);
                buildingTP = inputs.transferPrice - landTP;
                apportioned = true;
            } else {
                landTP = inputs.transferPrice;
                buildingTP = 0;
            }
        } else {
            landTP = inputs.landTransferPrice || 0;
            buildingTP = inputs.buildingTransferPrice || 0;
            // 구분기재액이 기준시가 안분액과 30% 이상 차이나면 구분기장 부인 (소득령 §166)
            if (lStdSell > 0 && bStdSell > 0) {
                const total = landTP + buildingTP;
                if (total > 0) {
                    const stdLandTP = total * lStdSell / (lStdSell + bStdSell);
                    if (Math.abs(landTP - stdLandTP) / total >= 0.30) stdDiffWarn = true;
                }
            }
        }

        // 2. 취득가액 (토지/건물 각각 실가 또는 환산)
        const calcAcq = (method, tp, acqPrice, stdAtAcq, stdAtSell) => {
            if (method === 'estimated' && stdAtAcq > 0 && stdAtSell > 0) {
                return {
                    acq: Math.floor(tp * stdAtAcq / stdAtSell),
                    gae: Math.floor(stdAtAcq * 0.03), // 개산공제 (취득 기준시가의 3%)
                    converted: true
                };
            }
            return { acq: acqPrice || 0, gae: 0, converted: false };
        };
        const land = calcAcq(inputs.landAcqMethod, landTP, inputs.landAcqPrice, inputs.landStdAtAcq, lStdSell);
        const building = calcAcq(inputs.buildingAcqMethod, buildingTP, inputs.buildingAcqPrice, inputs.buildingStdAtAcq, bStdSell);

        // 3. 필요경비 (환산이면 개산공제, 실가면 입력 경비)
        const landExp = land.converted ? land.gae : (inputs.landExpenses || 0);
        const buildingExp = building.converted ? building.gae : (inputs.buildingExpenses || 0);

        // 4. 양도차익
        const landGain = Math.max(0, landTP - land.acq - landExp);
        const buildingGain = Math.max(0, buildingTP - building.acq - buildingExp);

        // 5. 장기보유특별공제 (각 보유기간 기준, 일반 연 2% 최대 30%)
        const landRate = ltdRate(inputs.landHoldingPeriod);
        const buildingRate = ltdRate(inputs.buildingHoldingPeriod);
        const landLTD = Math.floor(landGain * landRate);
        const buildingLTD = Math.floor(buildingGain * buildingRate);

        // 6. 양도소득금액
        const landIncome = Math.max(0, landGain - landLTD);
        const buildingIncome = Math.max(0, buildingGain - buildingLTD);
        const totalGain = landGain + buildingGain;
        const totalLTD = landLTD + buildingLTD;
        const totalIncome = landIncome + buildingIncome;

        // 7. 건물 신축·증축 5년 내 환산취득 → 가산세 5% (§114의2, 건물분 환산가액 기준)
        const buildingSurcharge = (building.converted && inputs.buildingNewBuildWithin5yr === 'yes')
            ? Math.floor(building.acq * 0.05) : 0;

        const blendedRate = totalGain > 0 ? Number((totalLTD / totalGain).toFixed(4)) : 0;

        return {
            landTP, buildingTP,
            landAcq: land.acq, buildingAcq: building.acq,
            landConverted: land.converted, buildingConverted: building.converted,
            landExp, buildingExp,
            landGain, buildingGain,
            landRate, buildingRate, landLTD, buildingLTD,
            landIncome, buildingIncome,
            totalGain, totalLTD, totalIncome, blendedRate,
            transferPrice: landTP + buildingTP,
            acquisitionCost: land.acq + building.acq,
            necessaryExpenses: landExp + buildingExp,
            apportioned, stdDiffWarn, buildingSurcharge,
            shortTermWarn: (inputs.landHoldingPeriod < 2 || inputs.buildingHoldingPeriod < 2),
            nonBusinessLandWarn: inputs.isNonBusinessLand === 'yes' || inputs.isNonBusinessLand === 'unknown'
        };
    }

    getLongTermDeductionRate(inputs, isNonTaxable1Home) {
        if (inputs.type === 'stock') return 0;
        // 미등기 양도자산은 장기보유특별공제 배제 (소득세법 §95②)
        if ((inputs.specialCases || []).includes('unregistered')) return 0;
        if (inputs.type === 'right') {
            if (inputs.rightType === 'ticket') return 0; // 분양권은 장특공제 불가
            // 승계조합원: 입주권 상태 양도는 장특공제 불가 (완공 후는 이미 type='house'로 변환됨)
            if (inputs.rightType === 'membership' && inputs.membershipType === 'succeeding') return 0;
            // 원조합원: redevCalc에서 별도 계산하므로 여기서는 0 반환 (calculate()에서 override)
            if (inputs.rightType === 'membership' && inputs.membershipType === 'original') return 0;
        }

        const years = Math.floor(inputs.holdingPeriod);
        if (years < 3) return 0;

        if (isNonTaxable1Home && inputs.residencyPeriod >= 2) {
            const holdingRate = Math.min(
                years * this.data.LONG_TERM_1HOME.HOLDING_RATE_PER_YEAR,
                this.data.LONG_TERM_1HOME.MAX_HOLDING_RATE
            );
            const residencyRate = Math.min(
                Math.floor(inputs.residencyPeriod) * this.data.LONG_TERM_1HOME.RESIDENCY_RATE_PER_YEAR,
                this.data.LONG_TERM_1HOME.MAX_RESIDENCY_RATE
            );
            return Number((holdingRate + residencyRate).toFixed(2));
        }

        return Number(
            Math.min(
                years * this.data.LONG_TERM_GENERAL.RATE_PER_YEAR,
                this.data.LONG_TERM_GENERAL.MAX_RATE
            ).toFixed(2)
        );
    }

    getTaxRate(taxBase, inputs, isHeavyTaxApplicable = false, heavyTaxAddRate = 0) {
        if (inputs.type === 'stock') {
            return this.getStockRateInfo(taxBase, inputs.stockRateCategory);
        }

        // 미등기 양도자산: 보유기간·자산종류와 무관하게 70% 고정세율 (소득세법 §104①10호)
        if ((inputs.specialCases || []).includes('unregistered')) {
            return { rate: 0.70, deduction: 0 };
        }

        const years = inputs.holdingPeriod;
        let shortTermRateObj = null;

        if (years < 1) {
            if (inputs.type === 'house' || inputs.type === 'right') {
                shortTermRateObj = { rate: this.data.SHORT_TERM_RATES.HOUSE_OR_RIGHT_LT_1Y, deduction: 0 };
            } else {
                shortTermRateObj = { rate: this.data.SHORT_TERM_RATES.GENERAL_LT_1Y, deduction: 0 };
            }
        } else if (years < 2) {
            if (inputs.type === 'house' || inputs.type === 'right') {
                shortTermRateObj = { rate: this.data.SHORT_TERM_RATES.HOUSE_OR_RIGHT_LT_2Y, deduction: 0 };
            } else {
                shortTermRateObj = { rate: this.data.SHORT_TERM_RATES.GENERAL_LT_2Y, deduction: 0 };
            }
        }

        let progressiveRateObj;
        if (inputs.type === 'right' && inputs.rightType === 'ticket') {
            // 분양권은 보유기간과 무관하게 1년 미만 70%, 1년 이상 60% 고정 (소득세법 §104①4호)
            progressiveRateObj = years < 1 ? { rate: 0.70, deduction: 0 } : { rate: 0.60, deduction: 0 };
        } else {
            progressiveRateObj = this.data.BASIC_RATES.find((bracket) => taxBase <= bracket.limit)
                || this.data.BASIC_RATES[this.data.BASIC_RATES.length - 1];
            progressiveRateObj = { ...progressiveRateObj };
        }

        if (isHeavyTaxApplicable) {
            progressiveRateObj.rate += heavyTaxAddRate;
        } else if (inputs.type === 'general' && inputs.otherAssetCategory === 'land' && (inputs.isNonBusinessLand === 'yes' || inputs.isNonBusinessLand === 'unknown')) {
            // 비사업용 토지 10%p 중과
            progressiveRateObj.rate += 0.10;
        }

        if (shortTermRateObj) {
            const progressiveTax = (taxBase * progressiveRateObj.rate) - progressiveRateObj.deduction;
            const shortTermTax = (taxBase * shortTermRateObj.rate) - shortTermRateObj.deduction;
            return progressiveTax > shortTermTax ? progressiveRateObj : shortTermRateObj;
        }

        return progressiveRateObj;
    }

    getResidentialLandLimit(inputs) {
        // 주택 부수토지 한도 = 건물 정착면적(바닥면적) × 용도지역별 배율 (소득령 §154⑦, §157)
        const land = inputs.residentialLandArea;
        const foot = inputs.buildingFootprintArea;
        const mult = inputs.landZoneType === 'urban_res' ? 3
            : inputs.landZoneType === 'urban_green' ? 5
            : inputs.landZoneType === 'non_urban' ? 10
            : 0;
        if (!(land > 0 && foot > 0 && mult > 0)) return null;
        const limit = foot * mult;
        const excess = Math.max(0, land - limit);
        return {
            land,
            foot,
            mult,
            limit,
            excess,
            excessRatio: land > 0 ? Number((excess / land).toFixed(4)) : 0,
            exceeds: excess > 0
        };
    }

    getTaxReduction(inputs, calculatedTax) {
        // 8년 자경농지 감면 (조세특례제한법 §69): 양도소득세 100% 감면, 1과세기간 1억원 한도(농어촌특별세 비과세)
        const REDUCTION_LIMIT = 100000000;
        if (
            inputs.assetCategory === 'other'
            && inputs.otherAssetCategory === 'land'
            && inputs.selfFarmingExemption === 'yes'
            && inputs.selfFarming8yrMet === 'yes'
            && inputs.farmlandAtTransfer !== 'no'
        ) {
            const amount = Math.min(calculatedTax, REDUCTION_LIMIT);
            return {
                amount,
                label: '8년 자경농지 감면(조특법 §69)',
                capped: calculatedTax > REDUCTION_LIMIT,
                limit: REDUCTION_LIMIT
            };
        }
        return { amount: 0, label: '', capped: false, limit: REDUCTION_LIMIT };
    }

    // 예정신고 기한 = 양도일이 속한 달(주식은 반기)의 말일부터 2개월
    getFilingDueDate(inputs) {
        const sd = this.toDate(inputs.sellDate);
        if (!sd) return null;
        const periodEndMonth = inputs.type === 'stock'
            ? (sd.getMonth() < 6 ? 5 : 11)
            : sd.getMonth();
        // 말일부터 2개월: 해당 월 + 2개월의 말일 (예: 5월 양도 → 7/31, 상반기 주식 → 8/31)
        return new Date(sd.getFullYear(), periodEndMonth + 3, 0);
    }

    // 무신고·납부지연 가산세 추정 (국기법 §47의2·§47의4, §48②1 기한 후 신고 감면) — 오늘 신고·납부 가정
    // asOfDate: 기준일 주입용(테스트에서 시간을 고정하기 위함). 없으면 실제 오늘.
    getFilingPenalty(inputs, decisionTax, asOfDate) {
        const none = { total: 0, noFiling: 0, latePayment: 0, daysLate: 0, reductionRate: 0, dueDate: null };
        if (decisionTax <= 0 || !inputs.sellDate) return none;
        const due = this.getFilingDueDate(inputs);
        if (!due) return none;
        const today = asOfDate ? this.toDate(asOfDate) || new Date(asOfDate) : new Date();
        if (today <= due) return { ...none, dueDate: due };
        const daysLate = Math.floor((today - due) / 86400000);
        const addMonths = (d, m) => new Date(d.getFullYear(), d.getMonth() + m, d.getDate());
        let reductionRate = 0;
        if (today <= addMonths(due, 1)) reductionRate = 0.5;
        else if (today <= addMonths(due, 3)) reductionRate = 0.3;
        else if (today <= addMonths(due, 6)) reductionRate = 0.2;
        const noFiling = Math.floor(decisionTax * 0.2 * (1 - reductionRate));
        const latePayment = Math.floor(decisionTax * daysLate * 0.00022);
        return { total: noFiling + latePayment, noFiling, latePayment, daysLate, reductionRate, dueDate: due };
    }

    getStockRateInfo(taxBase, category) {
        switch (category) {
            case 'smallBusiness10':
                return { rate: 0.10, deduction: 0 };
            case 'shortTerm30':
                return { rate: 0.30, deduction: 0 };
            case 'majorProgressive':
                if (taxBase > 300000000) {
                    return { rate: 0.25, deduction: 15000000 };
                }
                return { rate: 0.20, deduction: 0 };
            case 'general20':
            default:
                return { rate: 0.20, deduction: 0 };
        }
    }

    buildCaseAnalysis(inputs, result) {
        const caseLabel = this.getCaseLabel(inputs, result);
        const summaryChips = this.buildSummaryChips(inputs, result, caseLabel);
        const decisionPath = this.buildDecisionPath(inputs, result);
        const cautions = this.buildCautions(inputs, result);
        const documents = this.buildDocumentChecklist(inputs, result);

        const reviewRequired = inputs.type === 'stock'
            ? inputs.stockItemCount > 2
            : cautions.length > 0;
        let tone = 'taxable';
        let statusLabel = '과세 예상';
        let headline = '현재 입력 기준으로 과세가 예상됩니다.';
        let subheadline = `${caseLabel} 흐름으로 계산했습니다.`;

        if (result.isNonTaxable && !result.isHighValue && !reviewRequired) {
            tone = 'good';
            statusLabel = '비과세 가능';
            headline = '비과세 가능성이 높습니다.';
            subheadline = '1세대 1주택 또는 일시적 2주택 특례 흐름에서 비과세 조건을 충족한 것으로 계산했습니다.';
        } else if (result.isNonTaxable && result.isHighValue && !reviewRequired) {
            tone = 'good';
            statusLabel = '고가주택 일부과세';
            headline = '1세대 1주택 특례를 일부 반영했습니다.';
            subheadline = '양도가액 12억원 초과분만 과세대상으로 남는 흐름입니다.';
        } else if (inputs.type === 'house' && inputs.houseTaxView === 'taxable' && !reviewRequired) {
            tone = 'taxable';
            if (result.isHeavyTaxApplicable) {
                statusLabel = '중과세 적용';
                headline = '중과세율이 반영됐습니다.';
                subheadline = '주택 수, 규제지역 여부, 양도일을 기준으로 다주택 중과 흐름에 해당하는 것으로 계산했습니다.';
            } else {
                statusLabel = '일반과세';
                headline = '중과세는 적용되지 않았습니다.';
                subheadline = (inputs.heavyTaxHouseCount ?? inputs.houseCount) >= 2
                    ? '현재 입력 기준으로 다주택 중과 요건에는 해당하지 않아 기본세율 흐름으로 계산했습니다.'
                    : '실질 1주택 흐름으로 계산했습니다.';
            }
        } else if (inputs.type === 'stock' && !reviewRequired) {
            tone = 'taxable';
            statusLabel = '주식 신고 흐름';
            headline = '주식등 양도소득세 신고 흐름으로 정리했습니다.';
            subheadline = '세율 구분과 신고대상 여부는 대주주, 장내·장외거래, 국내·국외 여부를 다시 확인하세요.';
        } else if (reviewRequired) {
            tone = 'review';
            statusLabel = '특례 검토 필요';
            headline = '예상세액은 계산됐지만 추가 검토가 필요합니다.';
            subheadline = '특례, 규제지역 여부, 권리성 자산 여부에 따라 결과가 달라질 수 있습니다.';
        }

        return {
            tone,
            statusLabel,
            headline,
            subheadline,
            caseLabel,
            summaryChips,
            decisionPath,
            cautions,
            documents,
            reviewRequired
        };
    }

    buildSummaryChips(inputs, result, caseLabel) {
        const chips = [caseLabel];

        if (inputs.isJointOwnership) {
            chips.push('공동명의 50:50 가정');
        } else {
            chips.push('단독명의');
        }

        chips.push(inputs.acquisitionMethod === 'estimated' ? '환산취득가액' : '실지거래가액');
        chips.push(`보유 ${this.formatYears(inputs.holdingPeriod)}`);

        if (inputs.type === 'house' && inputs.houseTaxView === 'nonTaxable') chips.push('비과세 우선 검토');
        if (inputs.type === 'house' && inputs.houseTaxView === 'taxable') {
            chips.push(result.isHeavyTaxApplicable ? '중과세 해당' : '일반과세 흐름');
        }
        if (inputs.temp2House === 'yes') chips.push('일시적 2주택 검토');
        if (result.isHeavyTaxApplicable) chips.push('다주택 중과 반영');
        if (result.longTermRate > 0) chips.push(`장특공제 ${Math.round(result.longTermRate * 100)}%`);
        if (result.isMixedUse && result.mixedUseApportionment) {
            chips.push(`겸용주택 안분 (주택 ${Math.round(result.mixedUseApportionment.houseRatioSell * 100)}%)`);
        }
        if (inputs.type === 'stock') chips.push(`${Math.max(1, inputs.stockItemCount)}종목 입력`);
        if (inputs.type === 'stock') chips.push(this.getStockRateCategoryLabel(inputs.stockRateCategory));

        return chips;
    }

    buildDecisionPath(inputs, result) {
        const path = [];

        // 겸용주택 안분 내역
        if (result.isMixedUse && result.mixedUseApportionment) {
            const ap = result.mixedUseApportionment;
            const housePercent = Math.round(ap.houseRatioSell * 100);
            const commercialPercent = 100 - housePercent;
            path.push(`겸용주택(상가주택)으로 보아 양도 당시 기준시가 비율(주택 ${housePercent}% : 상가 ${commercialPercent}%)로 양도가액과 양도 시 필요경비를 안분했습니다.`);
            if (ap.houseRatioAcq !== ap.houseRatioSell) {
                const houseAcqPercent = Math.round(ap.houseRatioAcq * 100);
                path.push(`취득가액과 취득 시 필요경비는 취득 당시 기준시가 비율(주택 ${houseAcqPercent}%)로 안분했습니다.`);
            }
            path.push('※ 현재 계산은 전체 금액 기준입니다. 겸용주택의 정확한 세금은 주택/상가를 분리하여 각각 계산해야 합니다. 세무사 상담을 권합니다.');
        }

        path.push(
            `양도차익은 양도가액 ${this.formatCurrency(result.transferPrice)}에서 취득가액 ${this.formatCurrency(result.acquisitionCost)}와 필요경비 ${this.formatCurrency(result.necessaryExpenses)}를 차감해 계산했습니다.`
        );

        path.push(result.acquisitionCalcDetail);

        if (result.nonTaxableInfo.message) {
            path.push(result.nonTaxableInfo.message);
        }

        if (result.isNonTaxable && result.isHighValue) {
            path.push('양도가액 12억원 초과 고가주택으로 보아 초과분에 대해서만 과세대상 양도차익을 계산했습니다.');
        } else if (result.isNonTaxable) {
            path.push('과세대상 양도차익은 0원으로 계산했습니다.');
        } else {
            path.push(`과세대상 양도차익은 ${this.formatCurrency(result.taxableGains)}입니다.`);
        }

        if (result.longTermRate > 0) {
            path.push(`장기보유특별공제 ${Math.round(result.longTermRate * 100)}%를 반영했습니다.`);
        } else if (result.isHeavyTaxApplicable) {
            path.push('다주택 중과 흐름으로 보아 장기보유특별공제를 적용하지 않았습니다.');
        } else if (inputs.type === 'stock') {
            path.push('주식등은 장기보유특별공제 없이 세율 구분과 기본공제를 기준으로 계산했습니다.');
        } else {
            path.push('이번 입력값 기준으로 장기보유특별공제는 적용되지 않았습니다.');
        }

        if (inputs.isJointOwnership) {
            path.push('공동명의는 50:50으로 나누어 인별 기본공제를 적용했습니다.');
        }

        if (inputs.type === 'house' && inputs.houseTaxView === 'taxable') {
            if (result.isHeavyTaxApplicable) {
                path.push('현재 입력값 기준으로 다주택 중과 요건에 해당해 중과세율을 반영했습니다.');
            } else {
                path.push(
                    (inputs.heavyTaxHouseCount ?? inputs.houseCount) >= 2
                        ? '현재 입력값 기준으로 다주택 중과 요건에는 해당하지 않아 기본세율 흐름으로 계산했습니다.'
                        : '실질 1주택 일반과세 흐름으로 계산했습니다.'
                );
            }
        }

        path.push(`적용세율은 ${result.isNonTaxable && !result.isHighValue ? '비과세' : `${Math.round(result.taxRate * 100)}%`}입니다.`);

        if (result.isHeavyTaxApplicable) {
            path.push('2026년 5월 10일 이후 조정대상지역 다주택 양도로 보아 중과세율을 반영했습니다.');
        } else if (inputs.type === 'general' && inputs.otherAssetCategory === 'land' && (inputs.isNonBusinessLand === 'yes' || inputs.isNonBusinessLand === 'unknown')) {
            path.push('비사업용 토지로 보아 기본세율에 10%p를 가산해 계산했습니다.');
        }

        if (inputs.type === 'stock') {
            path.push(`선택한 주식 세율 구분은 "${this.getStockRateCategoryLabel(inputs.stockRateCategory)}"입니다.`);
        }

        return path;
    }

    buildCautions(inputs, result) {
        const cautions = [];
        const special = inputs.specialCases || [];

        if (result.nonTaxableInfo.needsReview && result.nonTaxableInfo.message) {
            cautions.push(result.nonTaxableInfo.message);
        }

        // ── 미등기 양도 ──
        if (special.includes('unregistered')) {
            cautions.push('등기를 하지 않고 판 집(미등기 양도)으로 계산했습니다. 양도차익의 70%가 세금으로 부과되고, 1세대 1주택 비과세·장기보유특별공제·기본공제(250만원)·감면이 모두 적용되지 않습니다(소득세법 §104①10호 등).');
        }

        // ── 비거주자 ──
        if (special.includes('nonResident')) {
            cautions.push('해외에 사는 비거주자는 1세대 1주택 비과세가 원칙적으로 안 됩니다. 단, 거주자일 때 산 집을 출국일부터 2년 이내에 팔면 비과세가 가능하니 출국일·취득일을 확인하세요. 비거주자는 장기보유특별공제 표2(거주기간 공제)도 적용되지 않습니다.');
        }

        // ── 배우자·직계존속 증여 이월과세 안내 (자동계산 미반영) ──
        if (special.includes('inherited')) {
            cautions.push('증여받은 집(배우자·부모 등 직계존속에게서 받은 경우)을 일정 기간 안에 팔면 "이월과세"가 적용됩니다 — 취득가액과 보유기간을 증여한 사람이 처음 산 시점 기준으로 다시 계산해 세금이 크게 늘 수 있습니다(증여등기일이 2023.1.1 이후면 10년, 그 전이면 5년 이내 양도 시). 이 앱은 이월과세를 자동 계산하지 않으니, 해당하면 전문가 확인이 필요합니다.');
        }

        // ── 상속주택 상속개시 5년 내 양도 중과배제 안내 ──
        if (
            inputs.type === 'house'
            && (inputs.heavyTaxHouseCount ?? inputs.houseCount) >= 2
            && special.includes('inherited')
            && inputs.inheritanceSaleType === 'inherited'
        ) {
            cautions.push('상속받은 주택을 상속개시일(돌아가신 날)부터 5년 이내에 팔면 다주택 중과세가 빠집니다(소득령 §167의3①7호). 상속개시일을 확인하세요 — 5년 이내라면 중과세 없는 세액으로 보아야 합니다.');
        }

        // ── 이월과세 자동 적용 안내 ──
        if (inputs._carryoverApplied) {
            cautions.push(`배우자·직계존비속에게 증여받은 자산을 ${inputs._carryoverPeriodYears || 10}년 이내에 양도해 이월과세를 적용했습니다(소득세법 §97의2). 취득가액과 보유기간을 증여한 사람이 처음 산 가격·시점 기준으로 계산했고, 이미 낸 증여세는 필요경비로 빼드렸습니다. 단, 양도가 수용(사업인정고시일 2년 전 증여분)인 경우엔 이월과세가 적용되지 않으니 확인하세요.`);
        }
        if (inputs._carryoverEligibleButManual) {
            cautions.push('증여받은 자산이 이월과세 대상 기간 안에 있지만, 토지·건물 분리·겸용주택·재개발 분리 계산과 겹쳐 자동 반영하지 못했습니다. 취득가액·보유기간을 증여한 사람 기준으로 다시 계산해야 하니 전문가 확인이 필요합니다.');
        }
        if (inputs.acquiredByGift === 'yes' && !inputs._carryoverApplied && !inputs._carryoverEligibleButManual && !result.carryoverDenied && !(inputs.donorAcqPrice > 0)) {
            cautions.push('증여받은 자산이지만 증여한 사람의 취득가액이 입력되지 않아 이월과세를 반영하지 못했습니다. 정확히 계산하려면 증여자의 당초 취득가액·취득일을 입력하세요.');
        }

        // ── 신규지정 조정대상지역 6개월 유예 적용 안내 ──
        if (inputs.isNewlyDesignatedArea === 'yes') {
            cautions.push('2025년 10월 16일 새로 지정된 조정대상지역으로 보아, 다주택 중과 유예 예외 기한을 계약일부터 6개월(2026년 11월 9일까지)로 적용했습니다. 계약금 수령일과 잔금일을 증빙으로 확인하세요.');
        }

        // ── 주택 부수토지 한도 초과 ──
        if (result.landLimitInfo) {
            const li = result.landLimitInfo;
            const zoneLabel = inputs.landZoneType === 'urban_res' ? '도시지역 주거·상업·공업(3배)'
                : inputs.landZoneType === 'urban_green' ? '도시지역 녹지(5배)'
                : '도시지역 밖(10배)';
            if (li.exceeds) {
                cautions.push(`주택 부수토지 한도를 초과했습니다 — 건물 바닥면적 ${li.foot}㎡ × ${li.mult}배 = 한도 ${li.limit}㎡인데, 실제 토지는 ${li.land}㎡로 ${li.excess}㎡(${Math.round(li.excessRatio * 100)}%)가 초과됩니다(${zoneLabel}).`);
                cautions.push(`초과한 부수토지(${li.excess}㎡)는 주택이 아니라 비사업용 토지로 보아 ① 1세대 1주택 비과세에서 빠지고 ② 그 부분 양도차익에는 기본세율 +10%p가 더 붙습니다. 정확한 세액은 토지·건물 가액을 나눠 비교과세(소득세법 §104⑤)로 계산해야 하므로, 이 앱 계산값은 한도 내 주택 기준 참고치로 보고 전문가 확인을 받으세요.`);
            } else {
                cautions.push(`주택 부수토지가 한도 이내입니다 — 건물 바닥면적 ${li.foot}㎡ × ${li.mult}배 = 한도 ${li.limit}㎡, 실제 토지 ${li.land}㎡로 전부 주택 부수토지로 인정됩니다(${zoneLabel}).`);
            }
        }

        // ── 8년 자경농지 감면 ──
        if (result.taxReduction && result.taxReduction.amount > 0) {
            cautions.push(`${result.taxReduction.label}을 적용해 양도소득세 ${this.formatCurrency(result.taxReduction.amount)}을 감면했습니다. 감면 한도는 1년에 1억원(5년 합계 2억원)이니, 최근 5년 내 다른 감면을 받았다면 합산 한도를 확인하세요.`);
            if (result.taxReduction.capped) {
                cautions.push('산출세액이 감면 한도(1억원)를 넘어, 한도까지만 감면하고 나머지는 과세했습니다.');
            }
            cautions.push('자경 사실(농지원부·농약·비료 구입내역·직접 경작 증빙)은 세무조사 시 자주 부인되는 부분이니, 양도일 현재까지 직접 농사지었다는 증빙을 꼼꼼히 준비하세요. 8년 자경농지 감면은 농어촌특별세가 면제됩니다.');
        } else if (inputs.selfFarmingExemption === 'yes' && (inputs.selfFarming8yrMet === 'unknown' || inputs.farmlandAtTransfer === 'unknown')) {
            cautions.push('자경기간(소득이 연 3,700만원 이상인 해는 제외) 통산 8년 충족 여부나 양도일 현재 농지 여부가 불확실해 자경농지 감면을 자동 반영하지 않았습니다. 요건을 갖추면 양도소득세를 최대 1억원까지 감면받을 수 있으니 확인하세요.');
        }

        if (
            inputs.type === 'house' &&
            inputs.effectiveHouseCount === 1 &&
            inputs.isAdjustedAreaAtAcquisition === 'unknown' &&
            inputs.residencyPeriod < 2
        ) {
            cautions.push('취득 당시 규제지역 여부가 불분명하면 1세대 1주택 비과세 판단이 달라질 수 있습니다.');
        }

        if (
            inputs.type === 'house' &&
            inputs.effectiveHouseCount >= 2 &&
            inputs.isAdjustedAreaAtTransfer === 'unknown' &&
            this.toDate(inputs.sellDate) >= this.toDate('2026-05-10')
        ) {
            cautions.push('양도일 현재 규제지역 여부가 불분명해 다주택 중과 적용 여부가 바뀔 수 있습니다.');
        }

        if (inputs.acquisitionMethod === 'estimated') {
            cautions.push('환산취득가액은 실제 증빙이 없을 때의 보조 계산입니다. 실제 신고 세액과 차이가 날 수 있습니다.');
        }

        if (inputs.acquisitionMethod === 'estimated' && inputs.assetCategory === 'other' && inputs.otherAssetCategory !== 'land') {
            cautions.push('토지 취득가액이 실지거래가액으로 확인된다면, 토지는 실가로 신고하고 건물만 환산취득가액을 적용하는 것이 원칙입니다. 환산취득가액이 실제 취득가액보다 과대하면 과세관청이 부인할 수 있으니 취득 증빙을 확인하세요.');
        }

        if (result.conversionSurcharge > 0) {
            cautions.push(`신축·증축 건물을 5년 이내 양도하며 환산취득가액을 적용해, 환산취득가액의 5%인 ${this.formatCurrency(result.conversionSurcharge)}이 가산세로 부과됩니다(소득세법 §114의2). 현재 계산은 전체 환산취득가액 기준이므로, 토지가 포함돼 있다면 건물분 환산가액만으로 다시 계산해야 정확합니다.`);
        }

        if (inputs.otherAssetCategory === 'complex') {
            cautions.push('복수 자산·특수 자산은 자산별 계산명세와 세율 검토가 따로 필요하므로 현재 계산값은 본표 요약 참고용으로 보세요.');
            cautions.push('양도소득 기본공제 250만원은 부동산 등·주식·파생상품 등 소득 그룹별로 각각 적용됩니다. 같은 그룹 내 여러 건을 양도하면 연 250만원을 한 번만 공제하세요.');
        }

        if (inputs.type === 'stock') {
            cautions.push('주식등 세율은 대주주 여부, 중소기업 여부, 국내·국외 구분, 장내·장외거래 여부에 따라 달라집니다.');
            cautions.push('국내·국외 주식 양도손익 통산, 기신고 내역, 증권사별 손익 합산 여부에 따라 실제 신고세액이 달라질 수 있습니다.');
            if (inputs.stockRateCategory === 'majorProgressive') {
                cautions.push('대주주 세율 구분은 과세표준 3억원 초과분부터 25%와 누진공제가 반영되므로 연간 누적 양도소득금액을 함께 확인해야 합니다.');
            }
            if (inputs.stockItemCount > 2) {
                cautions.push('주식 3종목 이상 또는 복수 증권사 거래는 간편신고서보다 별지84 본표와 계산명세 정리가 더 안전합니다.');
            }
        }

        if (inputs.temp2House === 'yes' && result.tempTwoHomeInfo?.needsReview) {
            cautions.push(result.tempTwoHomeInfo.message);
        }

        inputs.specialCases.forEach((key) => {
            const specialCase = this.data.SPECIAL_CASES[key];
            if (specialCase) cautions.push(specialCase.message);
        });

        if (inputs.type === 'right' && inputs.rightType === 'membership' && inputs.membershipType === 'original') {
            if (inputs.priorBuildingValue > 0 && inputs.approvalDate) {
                cautions.push('원조합원 분리 계산이 적용되었습니다. 관리처분계획 평가액(권리가액)과 인가일은 조합에서 발급하는 서류로 반드시 확인하고, 실제 신고 전에는 세무 전문가와 검토하시기 바랍니다.');
            } else {
                cautions.push('원조합원 조합원입주권 계산을 위해 관리처분계획 인가일과 기존건물 평가액(권리가액)을 입력하면 인가 전·후 차익을 분리하여 장기보유특별공제를 정확히 계산할 수 있습니다. 현재는 단순 추정치입니다.');
            }
        }
        if (inputs.redevOriginalType === 'succeeding_after_completion') {
            cautions.push('승계조합원 완공 후 양도는 준공일부터 보유기간이 새로 시작됩니다. 1세대 1주택 비과세를 받으려면 준공일 이후 2년 이상 보유(조정지역 취득 시 거주도 2년) 요건을 충족해야 합니다.');
        }
        if ((inputs.specialCases || []).includes('cash_settlement')) {
            cautions.push('현금청산 양도일은 대금청산일(현금청산금 수령일)을 기준으로 합니다. 사용승인일, 이주일 등과 혼동하지 않도록 주의하세요.');
        }

        if (inputs.isJointOwnership) {
            cautions.push('공동명의 지분비율이 50:50이 아니면 세액이 달라질 수 있습니다.');
        }

        if (inputs.specialCases.includes('mixed_use_building') && inputs.transferPrice > 1200000000) {
            cautions.push('12억 초과 고가 상가주택은 주택/상가 면적에 상관없이 상가 부분을 분리하여 별도 과세해야 하므로 정확한 안분 계산이 필수입니다.');
        }

        // ── 예정신고 기한 경과 시 무신고·납부지연 가산세 안내 (세액에 자동 반영) ──
        if (result.filingPenalty && result.filingPenalty.total > 0) {
            const fp = result.filingPenalty;
            const due = fp.dueDate;
            cautions.push(`예정신고 기한(${due.getFullYear()}년 ${due.getMonth() + 1}월 ${due.getDate()}일)이 ${fp.daysLate}일 지났습니다. 오늘 기한 후 신고·납부한다고 가정해 무신고가산세 ${this.formatCurrency(fp.noFiling)}${fp.reductionRate > 0 ? `(기한 후 신고 ${Math.round(fp.reductionRate * 100)}% 감면 반영)` : ''}와 납부지연가산세 ${this.formatCurrency(fp.latePayment)}(하루 0.022%)를 세액에 포함했습니다. 일부러 숨긴 부정무신고면 40%로 늘어나고, 이미 신고·납부를 마쳤다면 이 가산세는 무시하세요.`);
        }

        if (result.lbCalc) {
            const lb = result.lbCalc;
            cautions.push(`토지·건물을 나누어 계산했습니다 — 토지 양도차익 ${this.formatCurrency(lb.landGain)}(장특공제 ${Math.round(lb.landRate * 100)}%), 건물 양도차익 ${this.formatCurrency(lb.buildingGain)}(장특공제 ${Math.round(lb.buildingRate * 100)}%).`);
            if (lb.apportioned) cautions.push('일괄 양도가액을 양도 당시 기준시가 비율로 토지·건물에 안분했습니다.');
            if (lb.stdDiffWarn) cautions.push('계약서상 토지·건물 구분금액이 기준시가 안분액과 30% 이상 차이납니다. 세법상 기준시가 안분액을 실지거래가액으로 보아 재계산될 수 있습니다(소득세법 시행령 §166).');
            if (lb.shortTermWarn) cautions.push('토지 또는 건물의 보유기간이 2년 미만입니다. 단기보유 세율(1년 미만 50%, 1~2년 40%)이 적용될 수 있어 현재 기본세율 계산과 달라질 수 있습니다. 전문가 확인이 필요합니다.');
            if (lb.nonBusinessLandWarn) cautions.push('비사업용 토지에 해당하면 토지분 세율에 10%p가 가산될 수 있습니다. 현재 계산은 기본세율 기준이므로 별도 확인이 필요합니다.');
        }

        return [...new Set(cautions)];
    }

    buildDocumentChecklist(inputs) {
        const documents = new Set();

        if (inputs.type === 'stock') {
            documents.add('증권사 매도 체결내역 또는 거래명세서');
            documents.add('증권사 매수 체결내역 또는 취득내역');
            documents.add('증권사 수수료·제세금 내역');
            documents.add('종목명·종목코드·주식 수 확인자료');
            documents.add('기신고 양도소득세 신고서가 있다면 그 사본');
            return Array.from(documents);
        }

        documents.add('취득 매매계약서');
        documents.add('양도 매매계약서');
        documents.add('취득세·등기비용·중개수수료·법무사 수수료 영수증');

        if (inputs.acquisitionMethod === 'estimated') {
            documents.add('취득 당시·양도 당시 기준시가 자료');
        } else {
            documents.add('자본적 지출 증빙(샷시, 확장, 구조 변경 등)');
        }

        if (inputs.type === 'house') {
            documents.add('주민등록초본 또는 거주기간 확인서류');
            documents.add('등기사항전부증명서');
        }

        if (inputs.temp2House === 'yes') {
            documents.add('신규주택 계약서 또는 취득일 증빙');
        }

        // 재개발·재건축 서류
        if (inputs.rightType === 'membership' || inputs.redevOriginalType) {
            documents.add('조합원 분양계약서 또는 입주권 관련 서류');
            documents.add('관리처분계획인가서 (인가일 확인)');
            if (inputs.membershipType === 'original') {
                documents.add('기존건물 권리가액(평가액) 산정자료');
                documents.add('납부 청산금 영수증 또는 청산금 납부확인서');
            }
            if (inputs.membershipType === 'succeeding') {
                documents.add('입주권 매수 계약서');
                documents.add('납부 청산금 영수증 (해당 시)');
            }
            if (inputs.redevSaleType === 'after_completion' || inputs.redevOriginalType === 'succeeding_after_completion') {
                documents.add('준공검사 합격 확인서 또는 사용승인서');
            }
        }

        inputs.specialCases.forEach((key) => {
            const specialCase = this.data.SPECIAL_CASES[key];
            if (specialCase) {
                specialCase.documents.forEach((doc) => documents.add(doc));
            }
        });

        return Array.from(documents);
    }

    buildNonTaxableChecklist(inputs, result) {
        if (inputs.type !== 'house') return [];

        const checks = [];
        const holdingYears = Math.floor(inputs.holdingPeriod);
        const residencyYears = Math.floor(inputs.residencyPeriod);

        // 1세대 1주택 여부
        if (inputs.effectiveHouseCount === 1) {
            const tag = inputs.houseCount > 1 ? `(원래 ${inputs.houseCount}주택 → 주택수 제외 적용)` : '';
            checks.push({ pass: true, label: '1세대 1주택', detail: `양도일 현재 실질 한 채 ${tag}`.trim() });
        } else if (inputs.effectiveHouseCount === 2 && inputs.temp2House === 'yes') {
            checks.push({
                pass: result.tempTwoHomeInfo?.isEligible || false,
                label: '일시적 2주택 특례',
                detail: result.tempTwoHomeInfo?.isEligible
                    ? `신규주택 계약일 기준 ${result.tempTwoHomeInfo?.allowedYears || 3}년 이내 양도`
                    : `허용기간 초과 (기한: ${result.tempTwoHomeInfo?.deadlineLabel || '확인 필요'})`
            });
        } else if (inputs.houseNonTaxableCategory === 'specialNonTaxable') {
            const specialCases = inputs.specialCases || [];
            if (specialCases.includes('inherited')) {
                if (inputs.inheritanceSaleType === 'general') {
                    if (inputs.inheritanceRuralHouseType === 'rural_5yr') {
                        checks.push({
                            pass: null,
                            label: '농어촌 상속주택 특례 — 비과세 검토 (§155⑦①)',
                            detail: '피상속인 5년 거주 농어촌주택 상속 → 상속 후 취득 일반주택 양도 시도 1주택으로 간주 (전문가 확인 필요)'
                        });
                    } else {
                        checks.push({
                            pass: null,
                            label: '상속주택 보유로 인한 2주택 — 특례 비과세 검토 (§155②)',
                            detail: '상속 당시 1주택자였고 상속개시 당시 보유하던 일반주택 양도 시 1세대 1주택 특례 비과세 가능 (전문가 확인 필요)'
                        });
                    }
                } else if (inputs.inheritanceSaleType === 'inherited') {
                    checks.push({
                        pass: null,
                        label: '상속받은 주택 양도 — 특례 비과세 검토',
                        detail: '상속 당시 무주택자이고 보유·거주 요건을 충족하는 경우 비과세 가능 (전문가 확인 필요)'
                    });
                } else {
                    checks.push({ pass: null, label: '상속 특례 비과세 검토', detail: '양도하는 주택 유형을 확인하세요.' });
                }
            } else if (specialCases.includes('marriage')) {
                checks.push({
                    pass: null,
                    label: '혼인 특례 — 2주택 특례 비과세 검토',
                    detail: '혼인으로 인한 2주택, 혼인신고일 10년 이내 양도 시 특례 비과세 가능'
                });
            } else if (specialCases.includes('cohabitation')) {
                checks.push({
                    pass: null,
                    label: '동거봉양 합가 특례 — 2주택 특례 비과세 검토 (§155④)',
                    detail: '60세 이상 직계존속 동거봉양 합가, 합가일 10년 이내 양도 시 특례 비과세 가능'
                });
            } else if (specialCases.includes('rental')) {
                const isSaleOfRental = inputs.rentalSaleType === 'rental_property';
                checks.push({
                    pass: isSaleOfRental ? false : (result.isNonTaxable ? true : (result.nonTaxableInfo.needsReview ? null : false)),
                    label: '임대사업자 거주주택 비과세 특례 검토 (§155⑳)',
                    detail: isSaleOfRental
                        ? '임대주택 양도 — 비과세 불가, 중과세 배제 검토 필요'
                        : (result.isNonTaxable
                            ? '거주주택 양도 — 비과세 요건 충족'
                            : '거주주택 양도 — 등록·거주기간·임대료 증액 등 요건 확인 필요')
                });
            } else {
                checks.push({
                    pass: null,
                    label: '특례 비과세 검토 대상',
                    detail: '해당 특례 요건 충족 여부는 전문가 확인이 필요합니다.'
                });
            }
        } else if ((inputs.specialCases || []).includes('rental')) {
            const isSaleOfRental = inputs.rentalSaleType === 'rental_property';
            checks.push({
                pass: isSaleOfRental ? false : (result.isNonTaxable ? true : (result.nonTaxableInfo?.needsReview ? null : false)),
                label: '임대사업자 거주주택 비과세 특례 검토 (§155⑳)',
                detail: isSaleOfRental
                    ? '임대주택 양도 — 비과세 불가, 중과세 배제 검토 필요'
                    : (result.isNonTaxable
                        ? '거주주택 양도 — 비과세 요건 충족'
                        : '거주주택 양도 — 등록·거주기간·임대료 증액 등 요건 확인 필요')
            });
        } else {
            checks.push({ pass: false, label: '1세대 1주택', detail: `실질 ${inputs.effectiveHouseCount}주택으로 비과세 불가` });
        }

        // 보유기간 2년 이상
        checks.push({
            pass: holdingYears >= 2,
            label: '보유기간 2년 이상',
            detail: `${this.formatYears(inputs.holdingPeriod)} 보유${holdingYears >= 2 ? '' : ' → 요건 미충족'}`
        });

        // 거주기간 2년 이상 (조정대상지역 취득 시)
        if (inputs.isAdjustedAreaAtAcquisition === 'yes') {
            checks.push({
                pass: residencyYears >= 2,
                label: '거주기간 2년 이상 (조정대상지역 취득)',
                detail: `${residencyYears}년 거주${residencyYears >= 2 ? '' : ' → 요건 미충족'}`
            });
        } else if (inputs.isAdjustedAreaAtAcquisition === 'no') {
            checks.push({
                pass: true,
                label: '거주요건 해당 없음',
                detail: '비조정대상지역 취득으로 거주요건 면제'
            });
        } else {
            checks.push({
                pass: null,
                label: '거주요건 확인 필요',
                detail: '조정대상지역 여부 불분명 → 전문가 확인 권장'
            });
        }

        // 고가주택 여부
        if (result.isHighValue) {
            const ratioPercent = Math.round(result.taxableRatio * 100);
            checks.push({
                pass: null,
                label: `고가주택 (양도가액 ${this.formatCurrency(result.transferPrice)})`,
                detail: `12억원 초과 → 초과분 ${ratioPercent}%만 과세`
            });
        } else if (result.isNonTaxable) {
            checks.push({
                pass: true,
                label: '고가주택 해당 없음',
                detail: `양도가액 ${this.formatCurrency(result.transferPrice)} (12억원 이하)`
            });
        }

        // 비과세 최종 결과
        if (result.isNonTaxable && !result.isHighValue) {
            checks.push({
                pass: true,
                label: '비과세 적용',
                detail: '모든 요건 충족 → 양도소득세 비과세'
            });
        } else if (result.isNonTaxable && result.isHighValue) {
            checks.push({
                pass: null,
                label: '비과세 + 고가주택 일부과세',
                detail: '비과세 요건은 충족했으나 12억 초과분에 대해서만 과세'
            });
        }

        return checks;
    }

    buildCalculationSteps(inputs, result) {
        const steps = [];
        const fmt = (v) => this.formatCurrency(v);

        // 원조합원 분리 계산 스텝
        if (result.redevCalc) {
            const rc = result.redevCalc;
            const preYears = Math.floor(rc.preApprovalHoldingYears);
            steps.push({
                step: 1,
                label: '① 기존 부동산부 차익 (인가 전)',
                formula: `관리처분 평가액 ${fmt(inputs.priorBuildingValue)} - 취득가액 ${fmt(result.acquisitionCost)}`,
                result: fmt(rc.preApprovalGains),
                note: `보유기간: 취득일 ~ 관리처분계획 인가일 (약 ${this.formatYears(rc.preApprovalHoldingYears)})`
            });
            steps.push({
                step: 2,
                label: '② 권리부 차익 (인가 후)',
                formula: `양도가액 ${fmt(result.transferPrice)} - (평가액 ${fmt(inputs.priorBuildingValue)} + 청산금 ${fmt(rc.paidClearanceAmount)}) - 필요경비 ${fmt(result.necessaryExpenses)}`,
                result: fmt(rc.postApprovalGains),
                note: '관리처분계획 인가일 이후 ~ 양도일까지 발생한 차익 (장기보유특별공제 미적용)'
            });
            steps.push({
                step: 3,
                label: '총 양도차익 (① + ②)',
                formula: `${fmt(rc.preApprovalGains)} + ${fmt(rc.postApprovalGains)}`,
                result: fmt(result.capitalGains),
                note: ''
            });
            steps.push({
                step: 4,
                label: '장기보유특별공제 (① 기존 부동산부에만 적용)',
                formula: `${fmt(rc.preApprovalGains)} × ${Math.round(rc.deductionRate * 100)}%`,
                result: `-${fmt(result.longTermDeduction)}`,
                note: `인가 전 보유기간 ${preYears}년 기준 (연 2%, 최대 30%)`
            });
            const incomeStep = 5;
            steps.push({
                step: incomeStep,
                label: '양도소득금액',
                formula: `${fmt(result.capitalGains)} - ${fmt(result.longTermDeduction)}`,
                result: fmt(result.incomeAmount),
                note: ''
            });
            steps.push({
                step: incomeStep + 1,
                label: '과세표준',
                formula: `${fmt(result.incomeAmount)} - 기본공제 ${fmt(result.basicDeductionTotal)}`,
                result: fmt(result.taxBaseTotal),
                note: inputs.isJointOwnership ? '공동명의 50:50으로 인별 공제 적용' : '연 250만원 기본공제'
            });
            steps.push({
                step: incomeStep + 2,
                label: '산출세액',
                formula: `과세표준 × ${Math.round(result.taxRate * 100)}%`,
                result: fmt(result.calculatedTax),
                note: ''
            });
            this.appendFinalTaxSteps(steps, result, incomeStep + 3);
            return steps;
        }

        // Step 1: 양도차익
        steps.push({
            step: 1,
            label: '양도차익 계산',
            formula: `${fmt(result.transferPrice)} - ${fmt(result.acquisitionCost)} - ${fmt(result.necessaryExpenses)}`,
            result: fmt(result.capitalGains),
            note: result.acquisitionCalcDetail
        });

        // Step 2: 과세대상 양도차익
        if (result.isNonTaxable && result.isHighValue) {
            const ratioPercent = Math.round(result.taxableRatio * 100);
            steps.push({
                step: 2,
                label: '과세대상 양도차익 (고가주택 안분)',
                formula: `${fmt(result.capitalGains)} × (${fmt(result.transferPrice)} - 12억) / ${fmt(result.transferPrice)}`,
                result: fmt(result.taxableGains),
                note: `12억 초과분 비율 ${ratioPercent}%를 적용하여 안분 계산`
            });
        } else if (result.isNonTaxable && !result.isHighValue) {
            steps.push({
                step: 2,
                label: '과세대상 양도차익',
                formula: '비과세 적용',
                result: '0원',
                note: '1세대 1주택 비과세 요건 충족 (12억 이하)'
            });
        } else {
            steps.push({
                step: 2,
                label: '과세대상 양도차익',
                formula: '전액 과세',
                result: fmt(result.taxableGains),
                note: ''
            });
        }

        // Step 3: 장기보유특별공제
        if (result.longTermRate > 0) {
            const isSpecialRate = result.isNonTaxable && inputs.residencyPeriod >= 2;
            steps.push({
                step: 3,
                label: '장기보유특별공제',
                formula: `${fmt(result.taxableGains)} × ${Math.round(result.longTermRate * 100)}%`,
                result: `-${fmt(result.longTermDeduction)}`,
                note: isSpecialRate
                    ? `1주택 특례: 보유 연 4%(최대 40%) + 거주 연 4%(최대 40%) = ${Math.round(result.longTermRate * 100)}%`
                    : `일반 공제: 연 2%(최대 30%) = ${Math.round(result.longTermRate * 100)}%`
            });
        } else if (inputs.type === 'right') {
            steps.push({
                step: 3,
                label: '장기보유특별공제',
                formula: '적용 불가',
                result: '0원',
                note: '분양권·입주권은 장기보유특별공제 대상이 아닙니다'
            });
        }

        // Step 4: 양도소득금액
        steps.push({
            step: result.longTermRate > 0 || inputs.type === 'right' ? 4 : 3,
            label: '양도소득금액',
            formula: `${fmt(result.taxableGains)} - ${fmt(result.longTermDeduction)}`,
            result: fmt(result.incomeAmount),
            note: ''
        });

        // Step 5: 기본공제 & 과세표준
        const stepNum = (result.longTermRate > 0 || inputs.type === 'right') ? 5 : 4;
        steps.push({
            step: stepNum,
            label: '과세표준',
            formula: `${fmt(result.incomeAmount)} - 기본공제 ${fmt(result.basicDeductionTotal)}`,
            result: fmt(result.taxBaseTotal),
            note: inputs.isJointOwnership ? '공동명의 50:50으로 인별 공제 적용' : '연 250만원 기본공제'
        });

        // Step 6: 세액 산출
        const rateLabel = result.isNonTaxable && !result.isHighValue
            ? '비과세'
            : `${Math.round(result.taxRate * 100)}%`;
        steps.push({
            step: stepNum + 1,
            label: '산출세액',
            formula: `과세표준 × ${rateLabel}`,
            result: fmt(result.calculatedTax),
            note: inputs.type === 'right' && inputs.holdingPeriod < 1
                ? '분양권 1년 미만 보유: 70% 세율 적용'
                : (inputs.type === 'right' && inputs.holdingPeriod < 2
                    ? '분양권 1~2년 보유: 60% 세율 적용'
                    : '')
        });

        this.appendFinalTaxSteps(steps, result, stepNum + 2);

        return steps;
    }

    // 산출세액 이후 공통 마무리 스텝: 감면 → 가산세 → 국세 납부세액 → 지방소득세 → 총액
    appendFinalTaxSteps(steps, result, startNum) {
        const fmt = (v) => this.formatCurrency(v);
        let n = startNum;

        if (result.taxReduction && result.taxReduction.amount > 0) {
            steps.push({
                step: n++,
                label: `세액감면 — ${result.taxReduction.label}`,
                formula: `${fmt(result.calculatedTax)} - 감면 ${fmt(result.taxReduction.amount)}`,
                result: fmt(result.decisionTax),
                note: result.taxReduction.capped
                    ? '감면 한도(1과세기간 1억원)가 적용되어 일부만 감면됩니다'
                    : '산출세액에서 감면세액을 뺀 금액이 신고서의 기준 세액이 됩니다'
            });
        }

        if (result.conversionSurcharge > 0) {
            steps.push({
                step: n++,
                label: '환산취득가액 가산세 (소득세법 §114의2)',
                formula: `환산취득가액 ${fmt(result.acquisitionCost)} × 5%`,
                result: `+${fmt(result.conversionSurcharge)}`,
                note: '신축·증축 건물을 5년 이내 양도하며 환산취득가액을 적용해 부과됩니다. 토지가 포함된 환산가액이면 건물분만으로 다시 계산이 필요합니다.'
            });
        }

        if (result.filingPenalty && result.filingPenalty.total > 0) {
            const fp = result.filingPenalty;
            steps.push({
                step: n++,
                label: '무신고·납부지연 가산세 (예정신고 기한 경과)',
                formula: `무신고 ${fmt(fp.noFiling)} + 납부지연 ${fmt(fp.latePayment)}`,
                result: `+${fmt(fp.total)}`,
                note: `오늘 기한 후 신고한다고 가정한 추정액입니다(기한 ${fp.daysLate}일 경과${fp.reductionRate > 0 ? `, 무신고가산세 ${Math.round(fp.reductionRate * 100)}% 감면 반영` : ''}). 이미 신고·납부했다면 제외하세요.`
            });
        }

        const adjustParts = [fmt(result.calculatedTax)];
        if (result.taxReduction && result.taxReduction.amount > 0) adjustParts.push(`- 감면 ${fmt(result.taxReduction.amount)}`);
        if (result.conversionSurcharge > 0) adjustParts.push(`+ 가산세 ${fmt(result.conversionSurcharge)}`);
        if (result.filingPenalty && result.filingPenalty.total > 0) adjustParts.push(`+ 가산세 ${fmt(result.filingPenalty.total)}`);
        steps.push({
            step: n++,
            label: '양도소득세 납부세액 (국세)',
            formula: adjustParts.length > 1 ? adjustParts.join(' ') : '산출세액과 동일',
            result: fmt(result.nationalTax),
            note: '신고서의 "납부할 세액" 칸에는 지방소득세를 뺀 이 금액을 적습니다'
        });

        steps.push({
            step: n++,
            label: '지방소득세 (양도소득분)',
            formula: `${fmt(result.decisionTax)} × 10%`,
            result: `+${fmt(result.localTax)}`,
            note: '양도소득세와 별도로 신고하는 지방세입니다. 홈택스 예정신고 시 함께 신고할 수 있습니다.'
        });

        steps.push({
            step: n,
            label: '총 납부세액 (지방소득세 포함)',
            formula: `${fmt(result.nationalTax)} + ${fmt(result.localTax)}`,
            result: fmt(result.totalTax),
            note: '양도일이 속하는 달의 말일부터 2개월 이내에 예정신고 필요'
        });

        return n;
    }

    buildScenarios(inputs, result) {
        const scenarios = [];

        if (inputs.type === 'stock') {
            scenarios.push({
                tone: inputs.stockItemCount <= 2 ? 'good' : 'warn',
                title: '주식 신고서 선택',
                detail: inputs.stockItemCount <= 2
                    ? '1~2종목 단순 사례로 입력돼 별지84의5 간편신고서 흐름을 우선 추천합니다.'
                    : '3종목 이상으로 입력돼 별지84 본표 중심 정리를 우선 추천합니다.'
            });

            if (inputs.stockRateCategory === 'majorProgressive') {
                scenarios.push({
                    tone: 'info',
                    title: '대주주 세율 구간',
                    detail: '과세표준이 3억원을 넘으면 25% 세율과 누진공제가 적용될 수 있어 연간 합산 금액을 다시 보아야 합니다.'
                });
            }

            scenarios.push({
                tone: 'info',
                title: '주식 간편신고서 기재 범위',
                detail: '종목명, 종목코드, 국내·국외 구분, 양도유형, 취득유형, 주식 수, 주당 단가는 계산 후에도 직접 확인해 적어야 합니다.'
            });

            return scenarios.slice(0, 3);
        }

        if (result.isHeavyTaxApplicable) {
            scenarios.push({
                tone: 'warn',
                title: '다주택 중과 비교',
                detail: `중과를 반영한 현재 세액은 ${this.formatCurrency(result.heavyTaxTotalTax)}입니다. 중과가 없다면 약 ${this.formatCurrency(result.normalTotalTax)} 수준입니다.`
            });
        } else if (
            inputs.type === 'house' &&
            (inputs.heavyTaxHouseCount ?? inputs.houseCount) >= 2 &&
            inputs.isAdjustedAreaAtTransfer === 'yes'
        ) {
            if (this.toDate(inputs.sellDate) < this.toDate('2026-05-10')) {
                scenarios.push({
                    tone: 'good',
                    title: '중과 유예 일정',
                    detail: '2026년 5월 9일까지는 다주택 중과 한시 배제 구간이어서 기본세율 흐름으로 계산했습니다.'
                });
            } else if (result.isHeavyTaxApplicable === false && inputs.contractDate) { // Grace period applied
                scenarios.push({
                    tone: 'good',
                    title: '중과 유예 특례 (계약일 기준)',
                    detail: '26.5.9. 이전 매매계약 체결 후 4개월 내 양도에 해당하여 예외적으로 다주택 중과를 배제했습니다.'
                });
            }
        }

        if (result.tempTwoHomeInfo?.deadlineLabel) {
            scenarios.push({
                tone: result.tempTwoHomeInfo.isEligible ? 'good' : 'warn',
                title: '일시적 2주택 허용기한',
                detail: `신규주택 계약일 기준 허용기한은 ${result.tempTwoHomeInfo.deadlineLabel}입니다.`
            });
        }

        if (!result.isNonTaxable && inputs.type === 'house' && inputs.effectiveHouseCount === 1) {
            if (inputs.residencyPeriod < 2) {
                scenarios.push({
                    tone: 'info',
                    title: '거주요건 재점검',
                    detail: '취득 당시 규제지역 주택이라면 거주기간 2년 충족 여부에 따라 비과세 가능성이 달라질 수 있습니다.'
                });
            } else if (inputs.holdingPeriod < 2) {
                scenarios.push({
                    tone: 'info',
                    title: '보유기간 확인',
                    detail: '보유기간 2년을 채우는지에 따라 1세대 1주택 비과세 여부가 달라질 수 있습니다.'
                });
            }
        }

        if (!result.isNonTaxable && result.longTermRate > 0 && result.longTermRate < 0.30 && inputs.type !== 'right') {
            scenarios.push({
                tone: 'info',
                title: '장기보유특별공제 여지',
                detail: '보유기간이 늘어나면 장기보유특별공제율이 올라갈 수 있습니다.'
            });
        }

        if (scenarios.length === 0) {
            scenarios.push({
                tone: 'info',
                title: '기본 검토 포인트',
                detail: '실제 신고 전에는 규제지역 여부, 취득가액 증빙, 특례 적용 서류를 다시 확인하는 것이 안전합니다.'
            });
        }

        return scenarios.slice(0, 3);
    }

    getCaseLabel(inputs, result = null) {
        if (inputs.type === 'stock') return '주식등';
        if (inputs.type === 'right') {
            if (inputs.rightType === 'membership') {
                const base = inputs.membershipType === 'original' ? '원조합원 입주권' : '승계조합원 입주권';
                if (inputs.redevSaleType === 'after_completion') return `${base} (완공 후 양도)`;
                return `${base} (입주권 상태 양도)`;
            }
            return '분양권·입주권';
        }
        // 승계조합원 완공 후 → type이 'house'로 변환된 케이스
        if (inputs.redevOriginalType === 'succeeding_after_completion') return '승계조합원 (완공 후 새 아파트 양도)';
        if ((inputs.specialCases || []).includes('cash_settlement')) return '재개발 현금청산';
        if (inputs.type === 'general') {
            if (inputs.otherAssetCategory === 'land') return '토지';
            if (inputs.otherAssetCategory === 'commercial') return '상가·일반 부동산';
            if (inputs.otherAssetCategory === 'complex') return '복합 사례';
            return '기타 자산';
        }

        if (inputs.houseTaxView === 'nonTaxable') {
            if (inputs.houseNonTaxableCategory === 'singleHome') return '주택 비과세 · 1세대 1주택';
            if (inputs.houseNonTaxableCategory === 'tempTwoHome') return '주택 비과세 · 일시적 2주택';
            if (inputs.houseNonTaxableCategory === 'specialNonTaxable') return '주택 비과세 특례 검토';

        }

        if (inputs.houseTaxView === 'taxable') {
            if (result?.isHeavyTaxApplicable) {
                return '주택 과세 · 중과세 적용';
            }

            if (inputs.effectiveHouseCount === 1) return '주택 과세 · 1주택 일반과세';
            if (inputs.effectiveHouseCount >= 2) return '주택 과세 · 일반과세';
            return '주택 과세 검토';
        }

        if (inputs.effectiveHouseCount === 1) return inputs.houseCount > 1 ? `실질 1주택 (원래 ${inputs.houseCount}주택)` : '1세대 1주택';
        if (inputs.effectiveHouseCount === 2 && inputs.temp2House === 'yes') return '일시적 2주택 추정';
        if (inputs.effectiveHouseCount === 2) return '2주택';
        return `${inputs.effectiveHouseCount}주택 이상`;
    }

    buildFilingGuide(inputs, result) {
        if (inputs.type === 'stock' && inputs.stockItemCount <= 2) {
            return this.buildSimpleStockGuide(inputs, result);
        }

        // 세액감면 적용 시: 간편신고서(84의4, 2025.3.21 개정)에는 감면세액 칸이 없으므로 본표로 안내
        if (result.taxReduction && result.taxReduction.amount > 0) {
            return this.buildStandardGuide(inputs, result);
        }

        if (inputs.type !== 'stock' && inputs.otherAssetCategory !== 'complex') {
            return this.buildSimpleRealEstateGuide(inputs, result);
        }

        return this.buildStandardGuide(inputs, result);
    }

    buildSimpleRealEstateGuide(inputs, result) {
        const formInfo = FilingFormFiles.simplifiedRealEstate;
        return {
            ...formInfo,
            reason: '단일 부동산·권리자산 1건 흐름으로 입력되어 별지 제84호의4 간편신고서에 바로 옮겨 적기 좋습니다.',
            notes: [
                '양수인 인적사항, 지분, 자산종류 코드, 세율구분 코드는 직접 확인해 적으세요.',
                '공동명의라면 실제 지분별로 각자 신고서를 나누어 작성해야 할 수 있습니다.',
                '실제 신고는 홈택스(손택스) 전자신고가 가장 간편하고 전자신고세액공제 2만원도 받을 수 있습니다. 이 HWPX 파일은 서면 제출·사전 검토용 초안으로 활용하세요.'
            ],
            lines: [
                { label: '③ 자산종류', value: this.getCaseLabel(inputs, result) },
                { label: '자산소재지', value: inputs.address || '직접 입력' },
                { label: '⑤ 양도일', value: this.formatDate(inputs.sellDate) },
                { label: '⑥ 취득일', value: this.formatDate(inputs.buyDate) },
                { label: '⑦ 보유기간', value: this.formatYears(inputs.holdingPeriod) },
                { label: '⑧ 거주기간', value: inputs.type === 'house' ? this.formatYears(inputs.residencyPeriod) : '해당 없음' },
                { label: '⑨ 고가주택 거주기간', value: result.isHighValue ? this.formatYears(inputs.residencyPeriod) : '해당 없음' },
                { label: '⑩ 양도가액', value: this.formatCurrency(result.transferPrice) },
                { label: '⑪ 취득가액', value: this.formatCurrency(result.acquisitionCost) },
                { label: '⑫ 필요경비', value: this.formatCurrency(result.necessaryExpenses) },
                { label: '⑬ 양도차익', value: this.formatCurrency(result.capitalGains) },
                { label: '⑭ 장기보유특별공제', value: this.formatCurrency(result.longTermDeduction) },
                { label: '⑮ 양도소득금액', value: this.formatCurrency(result.incomeAmount) },
                { label: '⑯ 양도소득기본공제', value: this.formatCurrency(result.basicDeductionTotal) },
                { label: '⑰ 과세표준', value: this.formatCurrency(result.taxBaseTotal) },
                { label: '⑱ 세율', value: this.getDisplayTaxRate(inputs, result) },
                { label: '⑲ 산출세액', value: this.formatCurrency(result.calculatedTax) },
                { label: '⑳ 연금계좌세액공제', value: '양도대금을 연금계좌에 납입한 경우 직접 입력' },
                { label: '㉑ 전자신고세액공제', value: '홈택스 전자신고 시 20,000원 검토' },
                { label: '㉒ 가산세', value: this.getSurchargeLabel(result) },
                { label: '㉓ 납부할 세액', value: this.formatCurrency(result.nationalTax) },
                { label: '㉔ 분납할 세액', value: this.getInstallmentTaxLabel(result.nationalTax) },
                { label: '㉕ 납부세액', value: '분납하지 않으면 ㉓과 동일' },
                { label: '지방소득세 (별도 신고)', value: this.formatCurrency(result.localTax) }
            ],
            manualFields: [
                '① 양도인, ② 양수인 인적사항',
                '③ 자산종류 코드, ④ 세율구분 코드',
                '부동산고유번호, 양도·취득 원인, 면적',
                '오른쪽 취득가액·필요경비 상세 적요와 증빙종류 코드',
                '연금계좌세액공제, 전자신고세액공제 해당 여부'
            ]
        };
    }

    buildSimpleStockGuide(inputs, result) {
        const formInfo = FilingFormFiles.simplifiedStock;
        return {
            ...formInfo,
            reason: '주식 1~2종목 단순 사례로 입력되어 별지 제84호의5 주식등 양도소득세 간편신고서 흐름을 우선 추천합니다.',
            notes: [
                '국세청 안내상 신고대상 국내주식은 상장주식 대주주, 상장주식 장외거래, 비상장주식, 국외주식 등이 대표적입니다.',
                '국내 상장주식 장내거래 소액주주는 일반적으로 양도소득세 신고대상이 아니므로 대상 여부를 먼저 확인하세요.',
                '주식 예정신고 기한은 양도일이 속하는 반기의 말일부터 2개월입니다(상반기 양도 → 8월 말, 하반기 양도 → 다음 해 2월 말).',
                '실제 신고는 홈택스(손택스) 전자신고가 가장 간편합니다. 이 HWPX 파일은 서면 제출·사전 검토용 초안으로 활용하세요.'
            ],
            lines: [
                { label: '3. 양도한 주식등 상세내역', value: `${Math.max(1, inputs.stockItemCount)}종목 기준으로 작성` },
                { label: '⑪ 양도가액', value: this.formatCurrency(result.transferPrice) },
                { label: '⑬ 취득가액', value: this.formatCurrency(result.acquisitionCost) },
                { label: '⑭ 기타 필요경비', value: this.formatCurrency(result.necessaryExpenses) },
                { label: '⑮ 합계', value: this.formatCurrency(result.capitalGains) },
                { label: '⑯ 비과세', value: '0원 또는 비과세분 직접 확인' },
                { label: '⑰ 과세대상', value: this.formatCurrency(result.taxableGains) },
                { label: '⑱ 기신고 등', value: '해당 시 직접 입력' },
                { label: '⑲ 양도소득기본공제', value: this.formatCurrency(result.basicDeductionTotal) },
                { label: '⑳ 과세표준', value: this.formatCurrency(result.taxBaseTotal) },
                { label: '세율', value: this.getDisplayTaxRate(inputs, result) },
                { label: '산출세액', value: this.formatCurrency(result.calculatedTax) },
                { label: '전자신고세액공제', value: '홈택스 전자신고 시 20,000원 검토' },
                { label: '가산세', value: this.getSurchargeLabel(result) },
                { label: '납부할 세액', value: this.formatCurrency(result.nationalTax) },
                { label: '분납할 세액', value: this.getInstallmentTaxLabel(result.nationalTax) },
                { label: '지방소득세 (별도 신고)', value: this.formatCurrency(result.localTax) }
            ],
            manualFields: [
                '1. 양도인(신고인), 2. 양수인 인적사항',
                '종목명, 종목코드, 국내/외 구분, 종류코드, 양도유형, 취득유형',
                '주식 수와 주당 양도·취득가액',
                '필요경비 상세내역과 기신고 세액',
                '가산세, 전자신고세액공제, 분납 여부'
            ]
        };
    }

    buildStandardGuide(inputs, result) {
        const formInfo = FilingFormFiles.standard;
        const hasReduction = result.taxReduction && result.taxReduction.amount > 0;
        const notes = [
            '별지84는 요약 본표 성격이어서 자산별 양도소득금액 계산명세를 함께 준비해야 할 수 있습니다.',
            '복수 자산은 자산별 세율, 기본공제 적용 순서, 손익통산 여부를 별도로 맞춘 뒤 본표 합계로 옮기는 것이 안전합니다.',
            '실제 신고는 홈택스(손택스) 전자신고가 가장 간편하고 전자신고세액공제 2만원도 받을 수 있습니다. 이 HWPX 파일은 서면 제출·사전 검토용 초안으로 활용하세요.'
        ];
        if (hasReduction) {
            notes.unshift(`${result.taxReduction.label}을 적용하므로 간편신고서 대신 본표(별지84)에 ⑪ 감면세액을 적고, 세액감면신청서를 함께 제출해야 합니다.`);
        }
        return {
            ...formInfo,
            reason: hasReduction
                ? '세액감면을 적용하는 사례는 간편신고서에 감면세액 칸이 없어 별지 제84호 본표로 신고하는 것이 안전합니다.'
                : '복합 사례, 주식 3종목 이상, 여러 자산을 한 번에 정리하는 경우를 대비해 별지 제84호 본표 중심으로 마무리하도록 잡았습니다.',
            notes,
            lines: [
                { label: '③ 세율구분', value: this.getDisplayTaxRate(inputs, result) },
                { label: '④ 양도소득금액', value: this.formatCurrency(result.incomeAmount) },
                { label: '⑤ 기신고·결정·경정된 양도소득금액', value: '해당 시 직접 입력' },
                { label: '⑥ 소득감면대상 소득금액', value: '해당 시 직접 입력' },
                { label: '⑦ 양도소득기본공제', value: this.formatCurrency(result.basicDeductionTotal) },
                { label: '⑧ 과세표준', value: this.formatCurrency(result.taxBaseTotal) },
                { label: '⑨ 세율', value: this.getDisplayTaxRate(inputs, result) },
                { label: '⑩ 산출세액', value: this.formatCurrency(result.calculatedTax) },
                { label: '⑪ 감면세액', value: result.taxReduction && result.taxReduction.amount > 0 ? `${this.formatCurrency(result.taxReduction.amount)} (${result.taxReduction.label})` : '해당 시 직접 입력' },
                { label: '⑫ 외국납부세액공제', value: '해당 시 직접 입력' },
                { label: '⑬ 원천징수세액공제', value: '해당 시 직접 입력' },
                { label: '⑭ 연금계좌세액공제', value: '해당 시 직접 입력' },
                { label: '⑮ 전자신고세액공제', value: '홈택스 전자신고 시 20,000원 검토' },
                { label: '⑯ 가산세', value: this.getSurchargeLabel(result) },
                { label: '⑰ 기신고·결정·경정세액', value: '해당 시 직접 입력' },
                { label: '⑱ 납부할 세액', value: this.formatCurrency(result.nationalTax) },
                { label: '⑲ 분납할 세액', value: this.getInstallmentTaxLabel(result.nationalTax) },
                { label: '⑳ 납부세액', value: '분납하지 않으면 ⑱과 동일' },
                { label: '지방소득세 (별도 신고)', value: this.formatCurrency(result.localTax) }
            ],
            manualFields: [
                '① 신고인, ② 양수인 인적사항',
                '자산별 계산명세와 세율구분 코드',
                '기신고·경정세액, 감면세액, 외국납부세액공제, 원천징수세액공제',
                '복수 자산이면 자산별 손익통산과 기본공제 배분 검토',
                '주식 사례라면 종목별 상세내역과 증권사별 거래자료'
            ]
        };
    }

    getStockRateCategoryLabel(category) {
        switch (category) {
            case 'smallBusiness10':
                return '중소기업 주식 등 10%';
            case 'shortTerm30':
                return '1년 미만 보유 등 30%';
            case 'majorProgressive':
                return '대주주 20% 또는 25%';
            case 'general20':
            default:
                return '일반 주식 등 20%';
        }
    }

    getDisplayTaxRate(inputs, result) {
        if (result.isNonTaxable && !result.isHighValue) {
            return '비과세';
        }

        if (inputs.type === 'stock') {
            return `${Math.round(result.taxRate * 100)}% (${this.getStockRateCategoryLabel(inputs.stockRateCategory)})`;
        }

        return `${Math.round(result.taxRate * 100)}%`;
    }

    // 분납(소득세법 §112): 납부할 세액(국세분)이 1천만원 초과 시
    getInstallmentTaxLabel(nationalTax) {
        if (nationalTax <= 10000000) {
            return '해당 없음';
        }

        if (nationalTax <= 20000000) {
            return `${this.formatCurrency(nationalTax - 10000000)} (납부기한 후 2개월 내)`;
        }

        return `${this.formatCurrency(Math.floor(nationalTax / 2))} 이내 (납부기한 후 2개월 내)`;
    }

    // 신고서 가산세 칸 표시값 (환산취득가액 가산세 + 무신고·납부지연 추정액)
    getSurchargeLabel(result) {
        const total = (result.conversionSurcharge || 0) + ((result.filingPenalty && result.filingPenalty.total) || 0);
        if (total <= 0) {
            return '해당 없음';
        }
        const parts = [];
        if (result.conversionSurcharge > 0) parts.push(`환산가산세 ${this.formatCurrency(result.conversionSurcharge)}`);
        if (result.filingPenalty && result.filingPenalty.total > 0) parts.push(`무신고·납부지연 ${this.formatCurrency(result.filingPenalty.total)}`);
        return `${this.formatCurrency(total)} (${parts.join(', ')})`;
    }

    formatCurrency(value) {
        return `${Math.floor(value).toLocaleString('ko-KR')}원`;
    }

    formatYears(value) {
        return `${Number(value || 0).toFixed(1)}년`;
    }

    formatDate(dateLike) {
        const date = dateLike instanceof Date ? dateLike : this.toDate(dateLike);
        if (!date) return '-';

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}.${month}.${day}`;
    }

    toDate(value) {
        if (!value) return null;
        if (value instanceof Date) return value;

        const date = new Date(`${value}T00:00:00`);
        return Number.isNaN(date.getTime()) ? null : date;
    }
}

window.TaxCalculator = TaxCalculator;
