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
        rental: {
            label: '임대사업자·거주주택',
            message: '임대사업자 또는 거주주택 전환 특례는 등록요건, 임대기간, 거주기간을 함께 확인해야 합니다.',
            documents: ['임대사업자 등록자료', '임대차계약서']
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

        const transferPrice = inputs.transferPrice;

        let acquisitionCost = 0;
        let necessaryExpenses = inputs.necessaryExpenses;
        let acquisitionCalcDetail = '실지거래가액 적용';

        if (inputs.acquisitionMethod === 'estimated') {
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

        let capitalGains = transferPrice - acquisitionCost - necessaryExpenses;
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
        const deductionRate = heavyTaxInfo.isApplicable ? 0 : this.getLongTermDeductionRate(inputs, isNonTaxable);
        const longTermDeduction = Math.floor(taxableGains * deductionRate);

        let incomeAmount = taxableGains - longTermDeduction;
        incomeAmount = Math.max(0, incomeAmount);

        const persons = inputs.isJointOwnership ? 2 : 1;
        const incomePerPerson = inputs.isJointOwnership ? Math.floor(incomeAmount / 2) : incomeAmount;
        const basicDeductionPerPerson = Math.min(incomePerPerson, this.data.BASIC_DEDUCTION);
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
        const localTax = Math.floor(calculatedTax * 0.1);
        const totalTax = calculatedTax + localTax;

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
            savingsFromGracePeriod = Math.max(0, hypotheticalHeavyTax - totalTax);
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
            localTax,
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
            mixedUseApportionment
        };

        result.nonTaxableChecklist = this.buildNonTaxableChecklist(inputs, result);
        result.calculationSteps = this.buildCalculationSteps(inputs, result);
        result.analysis = this.buildCaseAnalysis(inputs, result);
        result.scenarios = this.buildScenarios(inputs, result);
        result.filingGuide = this.buildFilingGuide(inputs, result);

        return result;
    }

    normalizeInputs(inputs) {
        return {
            ...inputs,
            type: inputs.type || 'house',
            assetCategory: inputs.assetCategory || 'house',
            otherAssetCategory: inputs.otherAssetCategory || '',
            houseTaxView: inputs.houseTaxView || '',
            houseNonTaxableCategory: inputs.houseNonTaxableCategory || '',
            houseCount: Number(inputs.houseCount || 1),
            temp2House: inputs.temp2House || 'no',
            specialCases: Array.isArray(inputs.specialCases) ? inputs.specialCases : [],
            isJointOwnership: Boolean(inputs.isJointOwnership),
            acquisitionMethod: inputs.acquisitionMethod || 'real',
            transferPrice: Number(inputs.transferPrice || 0),
            acquisitionPrice: Number(inputs.acquisitionPrice || 0),
            necessaryExpenses: Number(inputs.necessaryExpenses || 0),
            transferTaxBase: Number(inputs.transferTaxBase || 0),
            acquisitionTaxBase: Number(inputs.acquisitionTaxBase || 0),
            holdingPeriod: Number(inputs.holdingPeriod || 0),
            residencyPeriod: Number(inputs.residencyPeriod || 0),
            buyDate: inputs.buyDate || '',
            contractDate: inputs.contractDate || '',
            sellDate: inputs.sellDate || '',
            newHomeContractDate: inputs.newHomeContractDate || '',
            stockItemCount: Number(inputs.stockItemCount || 1),
            stockRateCategory: inputs.stockRateCategory || 'general20',
            isAdjustedAreaAtAcquisition: this.normalizeChoice(inputs.isAdjustedAreaAtAcquisition),
            oldHomeAdjustedAtNewHomeContract: this.normalizeChoice(inputs.oldHomeAdjustedAtNewHomeContract),
            newHomeAdjustedAtContract: this.normalizeChoice(inputs.newHomeAdjustedAtContract),
            isAdjustedAreaAtTransfer: this.normalizeChoice(inputs.isAdjustedAreaAtTransfer),
            // 겸용주택 관련
            mixedUseHouseArea: Number(inputs.mixedUseHouseArea || 0),
            mixedUseCommercialArea: Number(inputs.mixedUseCommercialArea || 0),
            mixedUseHouseStdPrice: Number(inputs.mixedUseHouseStdPrice || 0),
            mixedUseCommercialStdPrice: Number(inputs.mixedUseCommercialStdPrice || 0),
            mixedUseHouseStdPriceAtAcq: Number(inputs.mixedUseHouseStdPriceAtAcq || 0),
            mixedUseCommercialStdPriceAtAcq: Number(inputs.mixedUseCommercialStdPriceAtAcq || 0)
        };
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

        if (inputs.houseCount === 1) {
            if (inputs.holdingPeriod < 2) {
                return {
                    isEligible: false,
                    needsReview: false,
                    message: '1세대 1주택이라도 보유기간 2년 요건을 먼저 충족해야 합니다.'
                };
            }

            if (inputs.isAdjustedAreaAtAcquisition === 'yes' && inputs.residencyPeriod < 2) {
                return {
                    isEligible: false,
                    needsReview: false,
                    message: '조정대상지역 취득 주택으로 보아 거주기간 2년 요건을 충족하지 못한 것으로 계산했습니다.'
                };
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

        if (inputs.houseCount === 2 && inputs.temp2House === 'yes') {
            const tempTwoHomeInfo = this.checkTemporaryTwoHome(inputs);
            return {
                isEligible: tempTwoHomeInfo.isEligible,
                needsReview: tempTwoHomeInfo.needsReview,
                message: tempTwoHomeInfo.message,
                tempTwoHomeInfo
            };
        }

        return {
            isEligible: false,
            needsReview: false,
            message: '다주택 또는 일반 과세 흐름으로 계산했습니다.'
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
        if (inputs.type !== 'house' || inputs.houseCount < 2) {
            return { isApplicable: false, addRate: 0 };
        }

        if (inputs.isAdjustedAreaAtTransfer !== 'yes') {
            return { isApplicable: false, addRate: 0 };
        }

        const hypotheticalAddRate = inputs.houseCount === 2 ? 0.20 : 0.30;

        const sellDate = this.toDate(inputs.sellDate);
        const heavyTaxStartDate = this.toDate('2026-05-10');

        if (!sellDate || sellDate < heavyTaxStartDate) {
            return { isApplicable: false, addRate: 0, gracePeriodApplied: true, hypotheticalAddRate };
        }

        const contractDate = this.toDate(inputs.contractDate);
        const gracePeriodEndContract = this.toDate('2026-05-09');

        if (contractDate && contractDate <= gracePeriodEndContract) {
            const deadline = new Date(contractDate);
            deadline.setMonth(deadline.getMonth() + 4);
            if (sellDate <= deadline) {
                return { isApplicable: false, addRate: 0, gracePeriodApplied: true, hypotheticalAddRate };
            }
        }

        return {
            isApplicable: true,
            addRate: inputs.houseCount === 2 ? 0.20 : 0.30
        };
    }

    getLongTermDeductionRate(inputs, isNonTaxable1Home) {
        if (inputs.type === 'stock') return 0;
        if (inputs.type === 'right') {
            if (inputs.rightType === 'ticket') return 0; // 분양권은 장특공제 불가
            if (inputs.rightType === 'membership' && inputs.membershipType === 'succeeding') return 0; // 승계조합원은 장특공제 불가
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
        if (inputs.type === 'right' && inputs.rightType === 'ticket' && years < 1) {
            progressiveRateObj = { rate: 0.70, deduction: 0 };
        } else if (inputs.type === 'right' && inputs.rightType === 'ticket' && years < 2) {
            progressiveRateObj = { rate: 0.60, deduction: 0 };
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
                subheadline = inputs.houseCount >= 2
                    ? '현재 입력 기준으로 다주택 중과 요건에는 해당하지 않아 기본세율 흐름으로 계산했습니다.'
                    : '1주택 과세 흐름으로 계산했습니다.';
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
                    inputs.houseCount >= 2
                        ? '현재 입력값 기준으로 다주택 중과 요건에는 해당하지 않아 기본세율 흐름으로 계산했습니다.'
                        : '현재 입력값 기준으로 1주택 일반과세 흐름으로 계산했습니다.'
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

        if (result.nonTaxableInfo.needsReview && result.nonTaxableInfo.message) {
            cautions.push(result.nonTaxableInfo.message);
        }

        if (
            inputs.type === 'house' &&
            inputs.houseCount === 1 &&
            inputs.isAdjustedAreaAtAcquisition === 'unknown' &&
            inputs.residencyPeriod < 2
        ) {
            cautions.push('취득 당시 규제지역 여부가 불분명하면 1세대 1주택 비과세 판단이 달라질 수 있습니다.');
        }

        if (
            inputs.type === 'house' &&
            inputs.houseCount >= 2 &&
            inputs.isAdjustedAreaAtTransfer === 'unknown' &&
            this.toDate(inputs.sellDate) >= this.toDate('2026-05-10')
        ) {
            cautions.push('양도일 현재 규제지역 여부가 불분명해 다주택 중과 적용 여부가 바뀔 수 있습니다.');
        }

        if (inputs.acquisitionMethod === 'estimated') {
            cautions.push('환산취득가액은 실제 증빙이 없을 때의 보조 계산입니다. 실제 신고 세액과 차이가 날 수 있습니다.');
        }

        if (inputs.otherAssetCategory === 'complex') {
            cautions.push('복수 자산·특수 자산은 자산별 계산명세와 세율 검토가 따로 필요하므로 현재 계산값은 본표 요약 참고용으로 보세요.');
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
            cautions.push('원조합원의 조합원입주권 양도차익은 관리처분계획 인가일 전후를 나누어 복잡하게 계산해야 하며, 장기보유특별공제는 인가일 이전까지만 적용됩니다. 본 계산기는 입력된 전체 기간을 바탕으로 한 단순 추정치이므로 반드시 세무 전문가의 상담을 받으시기 바랍니다.');
        }

        if (inputs.isJointOwnership) {
            cautions.push('공동명의 지분비율이 50:50이 아니면 세액이 달라질 수 있습니다.');
        }

        if (inputs.specialCases.includes('mixed_use_building') && inputs.transferPrice > 1200000000) {
            cautions.push('12억 초과 고가 상가주택은 주택/상가 면적에 상관없이 상가 부분을 분리하여 별도 과세해야 하므로 정확한 안분 계산이 필수입니다.');
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
        if (inputs.houseCount === 1) {
            checks.push({ pass: true, label: '1세대 1주택', detail: '양도일 현재 한 채만 보유' });
        } else if (inputs.houseCount === 2 && inputs.temp2House === 'yes') {
            checks.push({
                pass: result.tempTwoHomeInfo?.isEligible || false,
                label: '일시적 2주택 특례',
                detail: result.tempTwoHomeInfo?.isEligible
                    ? `신규주택 계약일 기준 ${result.tempTwoHomeInfo?.allowedYears || 3}년 이내 양도`
                    : `허용기간 초과 (기한: ${result.tempTwoHomeInfo?.deadlineLabel || '확인 필요'})`
            });
        } else {
            checks.push({ pass: false, label: '1세대 1주택', detail: `현재 ${inputs.houseCount}주택으로 비과세 불가` });
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

        // Step 7: 지방소득세 포함 최종 세액
        steps.push({
            step: stepNum + 2,
            label: '총 납부세액 (지방소득세 10% 포함)',
            formula: `${fmt(result.calculatedTax)} + ${fmt(result.localTax)}`,
            result: fmt(result.totalTax),
            note: '양도일이 속하는 달의 말일부터 2개월 이내에 예정신고 필요'
        });

        return steps;
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
            inputs.houseCount >= 2 &&
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

        if (!result.isNonTaxable && inputs.type === 'house' && inputs.houseCount === 1) {
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
        if (inputs.type === 'right') return '분양권·입주권';
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

            if (inputs.houseCount === 1) return '주택 과세 · 1주택 일반과세';
            if (inputs.houseCount >= 2) return '주택 과세 · 일반과세';
            return '주택 과세 검토';
        }

        if (inputs.houseCount === 1) return '1세대 1주택';
        if (inputs.houseCount === 2 && inputs.temp2House === 'yes') return '일시적 2주택 추정';
        if (inputs.houseCount === 2) return '2주택';
        return '3주택 이상';
    }

    buildFilingGuide(inputs, result) {
        if (inputs.type === 'stock' && inputs.stockItemCount <= 2) {
            return this.buildSimpleStockGuide(inputs, result);
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
                '공동명의라면 실제 지분별로 각자 신고서를 나누어 작성해야 할 수 있습니다.'
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
                { label: '⑳ 감면세액', value: '해당 시 직접 입력' },
                { label: '㉑ 전자신고세액공제', value: '전자신고 시 최대 20,000원 검토' },
                { label: '㉒ 가산세', value: '해당 시 직접 계산' },
                { label: '㉓ 납부할 세액', value: this.formatCurrency(result.totalTax) },
                { label: '㉔ 분납할 세액', value: this.getInstallmentTaxLabel(result.totalTax) }
            ],
            manualFields: [
                '① 양도인, ② 양수인 인적사항',
                '③ 자산종류 코드, ④ 세율구분 코드',
                '부동산고유번호, 양도·취득 원인, 면적',
                '오른쪽 취득가액·필요경비 상세 적요와 증빙종류 코드',
                '전자신고세액공제, 가산세, 감면세액 해당 여부'
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
                '국내 상장주식 장내거래 소액주주는 일반적으로 양도소득세 신고대상이 아니므로 대상 여부를 먼저 확인하세요.'
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
                { label: '전자신고세액공제', value: '전자신고 시 최대 20,000원 검토' },
                { label: '가산세', value: '해당 시 직접 계산' },
                { label: '납부할 세액', value: this.formatCurrency(result.totalTax) },
                { label: '분납할 세액', value: this.getInstallmentTaxLabel(result.totalTax) }
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
        return {
            ...formInfo,
            reason: '복합 사례, 주식 3종목 이상, 여러 자산을 한 번에 정리하는 경우를 대비해 별지 제84호 본표 중심으로 마무리하도록 잡았습니다.',
            notes: [
                '별지84는 요약 본표 성격이어서 자산별 양도소득금액 계산명세를 함께 준비해야 할 수 있습니다.',
                '복수 자산은 자산별 세율, 기본공제 적용 순서, 손익통산 여부를 별도로 맞춘 뒤 본표 합계로 옮기는 것이 안전합니다.'
            ],
            lines: [
                { label: '③ 세율구분', value: this.getDisplayTaxRate(inputs, result) },
                { label: '④ 양도소득금액', value: this.formatCurrency(result.incomeAmount) },
                { label: '⑤ 기신고·결정·경정된 양도소득금액', value: '해당 시 직접 입력' },
                { label: '⑥ 소득감면대상 소득금액', value: '해당 시 직접 입력' },
                { label: '⑦ 양도소득기본공제', value: this.formatCurrency(result.basicDeductionTotal) },
                { label: '⑧ 과세표준', value: this.formatCurrency(result.taxBaseTotal) },
                { label: '⑨ 세율', value: this.getDisplayTaxRate(inputs, result) },
                { label: '⑩ 산출세액', value: this.formatCurrency(result.calculatedTax) },
                { label: '⑪ 감면세액', value: '해당 시 직접 입력' },
                { label: '⑫ 외국납부세액공제', value: '해당 시 직접 입력' },
                { label: '⑬ 원천징수세액공제', value: '해당 시 직접 입력' },
                { label: '⑭ 연금계좌세액공제', value: '해당 시 직접 입력' },
                { label: '⑮ 전자신고세액공제', value: '전자신고 시 최대 20,000원 검토' },
                { label: '⑯ 가산세', value: '해당 시 직접 계산' },
                { label: '⑰ 기신고·결정·경정세액', value: '해당 시 직접 입력' },
                { label: '⑱ 납부할 세액', value: this.formatCurrency(result.totalTax) },
                { label: '⑲ 분납할 세액', value: this.getInstallmentTaxLabel(result.totalTax) }
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

    getInstallmentTaxLabel(totalTax) {
        if (totalTax <= 10000000) {
            return '해당 없음';
        }

        if (totalTax <= 20000000) {
            return this.formatCurrency(totalTax - 10000000);
        }

        return `${this.formatCurrency(Math.floor(totalTax / 2))} 이내`;
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
