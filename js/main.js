/**
 * main.js
 * Guided UI flow for the capital gains tax helper app.
 */

class App {
    constructor() {
        this.calculator = new TaxCalculator();
        this.hwpxFormFiller = new HWPXFormFiller();
        this.currentPhase = 1;
        this.currentStepInPhase = 0;
        this.inputs = this.getInitialInputs();
        this.lastResult = null;
        this.phases = this.buildPhases();

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    getInitialInputs() {
        return {
            sellerName: '',
            residencyStatus: 'resident',
            assetCategory: '',
            otherAssetCategory: '',
            rightType: '',
            membershipType: '',
            isNonBusinessLand: '',
            type: '',
            houseTaxView: '',
            houseNonTaxableCategory: '',
            houseCount: null,
            temp2House: '',
            specialCases: [],
            isJointOwnership: null,
            address: '',
            isAdjustedAreaAtAcquisition: '',
            isAdjustedAreaAtTransfer: '',
            newHomeContractDate: '',
            holdingPeriod: 0,
            residencyPeriod: 0,
            stockItemCount: 1,
            stockRateCategory: 'general20',
            buyDate: '',
            contractDate: '',
            sellDate: '',
            transferPrice: 0,
            acquisitionPrice: 0,
            necessaryExpenses: 0,
            acquisitionMethod: '',
            transferTaxBase: 0,
            acquisitionTaxBase: 0,
            acqPrice_real: 0,
            acqTax: 0,
            acqBrokerFee: 0,
            acqLegalFee: 0,
            acqBrokerBizNo: '',
            acqBrokerPaidDate: '',
            acqLegalBizNo: '',
            acqLegalPaidDate: '',
            sellBrokerFee: 0,
            sellTaxFee: 0,
            capitalExpenditure: 0,
            sellBrokerBizNo: '',
            sellBrokerPaidDate: '',
            capitalExpenditureBizNo: '',
            capitalExpenditurePaidDate: '',
            // 겸용주택 관련
            mixedUseHouseArea: 0,
            mixedUseCommercialArea: 0,
            mixedUseHouseStdPrice: 0,
            mixedUseCommercialStdPrice: 0,
            mixedUseHouseStdPriceAtAcq: 0,
            mixedUseCommercialStdPriceAtAcq: 0,
            // 다가구주택 관련
            multiFamilyFloors: '',
            multiFamilyTotalArea: '',
            multiFamilyHouseholds: ''
        };
    }

    shouldAskHouseCount(inputs) {
        if (inputs.assetCategory !== 'house') {
            return false;
        }

        return (
            inputs.houseTaxView === 'taxable'
            || (
                inputs.houseTaxView === 'nonTaxable'
                && inputs.houseNonTaxableCategory === 'specialNonTaxable'
            )
        );
    }

    shouldAskTempTwoHome(inputs) {
        return false;
    }

    shouldAskResidencyPeriod(inputs) {
        if (inputs.assetCategory !== 'house') return false;

        // 비과세가 아닌 일반 과세 대상(다주택자 등)이면 거주기간이 세액 계산에 직접 영향을 주지 않음
        // (1주택 장기보유특별공제 표2가 아닌 일반공제 표1 적용 대상)
        if (inputs.houseTaxView === 'taxable') return false;

        // 1주택 비과세 또는 일시적 2주택 등 비과세 검토 흐름인 경우
        const buyDate = inputs.buyDate;
        const isAdjusted = inputs.isAdjustedAreaAtAcquisition === 'yes';
        const specialCases = inputs.specialCases || [];

        // 1. 거주요건이 법적으로 필수인 경우 (2017.8.3 이후 조정지역 취득)
        const isResidencyMandatory = (buyDate >= '2017-08-03' && isAdjusted);
        if (isResidencyMandatory) return true;

        // 2. 거주요건이 필수는 아니지만, 실거주 여부에 따라 세제 혜택(장기보유특별공제 표2 등)이 달라지는 경우
        // 고가주택(양도가액 12억 초과)인 경우 표2 공제를 받기 위해 거주기간 확인 필요
        const isHighValue = (inputs.transferPrice && inputs.transferPrice > 1200000000);
        const isBeneficial = isHighValue ||
                             specialCases.includes('winwin') ||
                             specialCases.includes('rental');
        if (isBeneficial) return true;

        // 3. 그 외의 경우 (예: 2017.8.2 이전 취득 & 일반 1주택)
        // 사용자의 요청대로 거주요건이 필요 없는 것으로 판단하여 스킵
        return false;
    }

    detectAdjustedArea(address, date) {
        if (!address || !date) return { status: 'incomplete' };

        const cleanAddress = address.trim();
        const cleanDate = date.split(' ')[0]; // Handle YYYY-MM-DD formats

        for (const group of ADJUSTED_AREA_HISTORY) {
            const cityMatch = cleanAddress.includes(group.city);
            
            // If districts are 'all', we MUST match the city.
            if (group.districts === 'all') {
                if (!cityMatch) continue;
                // If it's 'all' and city matches, we consider it a match
                const isAdjusted = group.periods.some(p => {
                    const start = p.start;
                    const end = p.end || '9999-12-31';
                    return cleanDate >= start && cleanDate <= end;
                });
                return { status: 'detected', isAdjusted };
            }

            // Otherwise, we can match EITHER by (city AND district) OR just by a specific district name (since district names like '서초구', '분당구' are usually unique enough in this context)
            const districtMatch = group.districts.some(d => cleanAddress.includes(d) || d.includes(cleanAddress.split(' ')[0]) || d.includes(cleanAddress.split(' ')[1] || '____'));

            if (districtMatch || (cityMatch && group.districts === 'all')) {
                const isAdjusted = group.periods.some(p => {
                    const start = p.start;
                    const end = p.end || '9999-12-31';
                    return cleanDate >= start && cleanDate <= end;
                });
                return { status: 'detected', isAdjusted };
            }
        }

        // 주소에 대한민국 주요 지역 키워드가 포함되어 있다면, 위 조정대상지역 목록에 걸리지 않았으므로 조정대상지역이 아님(false)으로 자동 판별
        const allRegions = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충청북도', '충남', '충청남도', '전북', '전라북도', '전남', '전라남도', '경북', '경상북도', '경남', '경상남도', '제주'];
        if (allRegions.some(region => cleanAddress.includes(region))) {
            return { status: 'detected', isAdjusted: false };
        }

        return { status: 'unknown' };
    }

    getHouseCountOptions(inputs) {
        const options = [
            {
                label: '1주택',
                detail: '이 집 하나만 보유',
                value: 1,
                icon: '1'
            },
            {
                label: '2주택',
                detail: '일시적 2주택 포함',
                value: 2,
                icon: '2'
            },
            {
                label: '3주택 이상',
                detail: '다주택 흐름',
                value: 3,
                icon: '3'
            }
        ];

        // 결혼/상속/임대사업 등 기타 특례는 기본적으로 2주택 이상인 경우에만 해당하므로 1주택 선택지 제외
        if (inputs.houseNonTaxableCategory === 'specialNonTaxable') {
            return options.filter(opt => opt.value !== 1);
        }

        return options;
    }

    buildPhases() {
        return {
            1: {
                title: '사례 분류',
                questions: [
                    {
                        id: 'assetCategory',
                        title: '무엇을 양도하시나요?',
                        subtitle: '가장 가까운 항목 하나를 고르면 질문 수가 줄어듭니다.',
                        helper: 'PDF에서도 자산 종류에 따라 비과세 판정, 세율, 공제 방식이 달라집니다.',
                        type: 'button',
                        onSelect: (inputs, value) => {
                            inputs.assetCategory = value;
                            inputs.otherAssetCategory = '';
                            inputs.houseTaxView = '';
                            inputs.houseNonTaxableCategory = '';
                            inputs.houseCount = null;
                            inputs.temp2House = 'no';
                            inputs.specialCases = [];
                            if (value === 'house') {
                                inputs.type = 'house';
                            } else if (value === 'right') {
                                inputs.type = 'right';
                                inputs.houseCount = 1;
                            } else if (value === 'stock') {
                                inputs.type = 'stock';
                                inputs.houseCount = 0;
                            } else {
                                inputs.type = 'general';
                            }
                        },

                        options: [
                            {
                                label: '주택',
                                detail: '아파트, 빌라, 단독주택',
                                value: 'house',
                                icon: '주'
                            },
                            {
                                label: '분양권·입주권',
                                detail: '권리성 자산',
                                value: 'right',
                                icon: '권'
                            },
                            {
                                label: '상가·토지 등',
                                detail: '주택 외 일반 부동산',
                                value: 'other',
                                icon: '토'
                            },
                            {
                                label: '주식등',
                                detail: '신고대상 주식 1~2종목 또는 일반 주식 사례',
                                value: 'stock',
                                icon: '주'
                            }
                        ]
                    },
                    {
                        id: 'houseNonTaxableCategory',
                        title: '현재 선생님의 상황에 가장 맞는 항목을 골라주세요.',
                        subtitle: '상황에 따라 세금이 줄거나 아예 안 낼 수도 있습니다. 가장 가까운 항목을 고르면 됩니다.',
                        helper: '가장 흔한 사례는 "우리 집은 딱 한 채에요" 이거나 "이사 가려고 잠시 집을 2채 가지게 되었어요" 입니다. 잘 모르겠거나 3주택 이상이면 "세금을 내야 하는 상황이에요"를 고르시면 됩니다.',
                        type: 'button',
                        condition: (inputs) => inputs.assetCategory === 'house',
                        onSelect: (inputs, value) => {
                            inputs.houseNonTaxableCategory = value;

                            if (value === 'singleHome') {
                                inputs.houseTaxView = 'nonTaxable';
                                inputs.houseCount = 1;
                                inputs.temp2House = 'no';
                                return;
                            }

                            if (value === 'tempTwoHome') {
                                inputs.houseTaxView = 'nonTaxable';
                                inputs.houseCount = 2;
                                inputs.temp2House = 'yes';
                                return;
                            }

                            if (value === 'specialNonTaxable') {
                                inputs.houseTaxView = 'nonTaxable';
                                inputs.houseCount = null;
                                inputs.temp2House = 'no';
                                return;
                            }

                            // taxable
                            inputs.houseTaxView = 'taxable';
                            inputs.houseCount = null;
                            inputs.temp2House = 'no';
                        },
                        options: [
                            {
                                label: '우리 집은 딱 한 채에요',
                                detail: '1세대 1주택 비과세 검토',
                                value: 'singleHome',
                                icon: '1'
                            },
                            {
                                label: '이사하려고 잠시 집을 2채 가지게 되었어요',
                                detail: '일시적 2주택 비과세 검토',
                                value: 'tempTwoHome',
                                icon: '2'
                            },
                            {
                                label: '결혼이나 상속, 임대사업 등 사연이 있어요',
                                detail: '기타 비과세 특례 검토',
                                value: 'specialNonTaxable',
                                icon: '특'
                            },
                            {
                                label: '세금을 내야 하는 상황이에요',
                                detail: '다주택자 등 자진 신고 목적 (과세 계산)',
                                value: 'taxable',
                                icon: '과'
                            }
                        ]
                    },
                    {
                        id: 'otherAssetCategory',
                        title: '어떤 종류의 자산인가요?',
                        subtitle: '주택이 아니라면 여기서 세부 유형을 나눕니다.',
                        type: 'button',
                        condition: (inputs) => inputs.assetCategory === 'other',
                        onSelect: (inputs, value) => {
                            inputs.otherAssetCategory = value;
                            inputs.type = 'general';
                            return true;
                        },
                        options: [
                            {
                                label: '상가·일반 건물',
                                detail: '상가 1건 또는 일반 건물',
                                value: 'commercial',
                                icon: '상'
                            },
                            {
                                label: '토지',
                                detail: '토지 1필지',
                                value: 'land',
                                icon: '토'
                            },
                            {
                                label: '복합 사례',
                                detail: '여러 자산 또는 특수 자산, 별지84 본표 중심',
                                value: 'complex',
                                icon: '검'
                            }
                        ]
                    },
                    {
                        id: 'isNonBusinessLand',
                        title: '이 토지를 사업용(농사, 임대 등)으로 사용하셨나요?',
                        subtitle: '사업용으로 사용하지 않은 토지는 세금이 중과(10%p 가산)될 수 있습니다.',
                        helper: '비사업용 토지는 세율이 10%p 가산됩니다. 실제 사업용 인정 여부는 일정 기간 이상 사용, 거주지 요건 등 복잡한 기준이 있으므로 주의가 필요합니다.',
                        type: 'button',
                        condition: (inputs) => inputs.otherAssetCategory === 'land',
                        options: [
                            { label: '예', detail: '사업용 토지로 계산 (기본세율)', value: 'no', icon: '사' },
                            { label: '아니오', detail: '비사업용 토지로 계산 (+10%p 중과)', value: 'yes', icon: '비' },
                            { label: '잘 모르겠어요', detail: '비사업용 가정 하에 검토 표시', value: 'unknown', icon: '?' }
                        ]
                    },
                    {
                        id: 'rightType',
                        title: '어떤 권리를 양도하시나요?',
                        subtitle: '권리 종류에 따라 장기보유특별공제와 세율(보유기간별)이 다릅니다.',
                        type: 'button',
                        condition: (inputs) => inputs.assetCategory === 'right',
                        options: [
                            { label: '분양권', detail: '주택, 상가 등을 공급받는 권리', value: 'ticket', icon: '분' },
                            { label: '조합원입주권', detail: '재개발/재건축 입주권 (관리처분계획 인가 후)', value: 'membership', icon: '입' }
                        ]
                    },
                    {
                        id: 'membershipType',
                        title: '어떤 방식의 조합원입주권이신가요?',
                        subtitle: '취득 방식에 따라 세금 계산(장기보유특별공제 등)이 크게 달라집니다.',
                        type: 'button',
                        condition: (inputs) => inputs.assetCategory === 'right' && inputs.rightType === 'membership',
                        options: [
                            { label: '원조합원', detail: '기존 주택/토지를 보유하다 입주권으로 변환', value: 'original', icon: '원' },
                            { label: '승계조합원', detail: '타인으로부터 입주권 상태에서 매수', value: 'succeeding', icon: '승' }
                        ]
                    },
                    {
                        id: 'stockItemCount',
                        title: '주식은 몇 종목을 신고하시나요?',
                        subtitle: '사용자 기준으로 1~2종목은 간편 주식 신고서, 그보다 많으면 별지84 본표 흐름을 우선 권합니다.',
                        type: 'button',
                        condition: (inputs) => inputs.assetCategory === 'stock',
                        options: [
                            {
                                label: '1종목',
                                detail: '단순 1종목 신고',
                                value: 1,
                                icon: '1'
                            },
                            {
                                label: '2종목',
                                detail: '간편 주식 신고서 범위',
                                value: 2,
                                icon: '2'
                            },
                            {
                                label: '3종목 이상',
                                detail: '별지84 본표로 요약 정리',
                                value: 3,
                                icon: '3'
                            }
                        ]
                    },
                    {
                        id: 'stockRateCategory',
                        title: '어떤 주식 세율 구분에 가까운가요?',
                        subtitle: '국세청 신고대상 주식 흐름을 단순화한 선택지입니다. 정확한 대상 여부는 신고 전 다시 확인해야 합니다.',
                        helper: '일반 장내매도 소액주주처럼 원래 신고대상이 아닌 사례는 이 앱보다 국세청 안내문 기준을 먼저 확인하는 편이 안전합니다.',
                        type: 'button',
                        condition: (inputs) => inputs.assetCategory === 'stock',
                        options: [
                            {
                                label: '일반 20%',
                                detail: '국외주식 또는 일반 주식등 20% 흐름',
                                value: 'general20',
                                icon: '20'
                            },
                            {
                                label: '중소기업 10%',
                                detail: '중소기업 주식등 10% 흐름',
                                value: 'smallBusiness10',
                                icon: '10'
                            },
                            {
                                label: '대주주 20/25%',
                                detail: '과세표준 3억원 초과 시 25% 반영',
                                value: 'majorProgressive',
                                icon: '대'
                            },
                            {
                                label: '1년 미만 30%',
                                detail: '단기보유 등 30% 흐름',
                                value: 'shortTerm30',
                                icon: '30'
                            }
                        ]
                    },
                    {
                        id: 'houseCount',
                        title: '현재 세대 기준 주택 수는 몇 채인가요?',
                        subtitle: '양도할 집을 포함해서 계산합니다.',
                        helper: '과세 흐름에서는 이 주택 수와 양도일 현재 규제지역 여부를 함께 봐서 중과 여부를 판단합니다. 오피스텔, 분양권, 입주권, 농어촌주택 등은 포함하며, 기준시가 3억 원 이하 지방 저가주택은 제외해주세요.',
                        type: 'button',
                        condition: (inputs) => this.shouldAskHouseCount(inputs),
                        onSelect: (inputs, value) => {
                            inputs.houseCount = value;
                            if (value !== 2 || inputs.houseTaxView === 'taxable') {
                                inputs.temp2House = 'no';
                            }
                        },
                        options: (inputs) => this.getHouseCountOptions(inputs)
                    },
                    {
                        id: 'temp2House',
                        title: '2주택이 된 사유가 이사나 갈아타기인가요?',
                        subtitle: '일시적 2주택 특례 여부를 보기 위한 질문입니다.',
                        type: 'button',
                        condition: (inputs) => this.shouldAskTempTwoHome(inputs),
                        options: [
                            {
                                label: '네, 갈아타기입니다',
                                detail: '기존 집을 나중에 처분할 예정',
                                value: 'yes',
                                icon: '예'
                            },
                            {
                                label: '아니오, 다주택입니다',
                                detail: '일반 다주택 흐름으로 계산',
                                value: 'no',
                                icon: '아'
                            }
                        ]
                    },
                    {
                        id: 'isJointOwnership',
                        title: '명의 형태는 어떻게 되나요?',
                        subtitle: '공동명의는 50:50으로 단순 가정해 계산합니다.',
                        type: 'button',
                        options: [
                            {
                                label: '단독명의',
                                detail: '한 사람 기준',
                                value: false,
                                icon: '단'
                            },
                            {
                                label: '공동명의',
                                detail: '부부 공동명의 50:50 가정',
                                value: true,
                                icon: '공'
                            }
                        ]
                    },
                    {
                        id: 'newAssetType',
                        title: '새로 취득하신 자산은 무엇인가요?',
                        subtitle: '어떤 자산을 샀는지에 따라 일시적 2주택 요건이 달라집니다.',
                        type: 'button',
                        condition: (inputs) => inputs.houseNonTaxableCategory === 'tempTwoHome' || inputs.temp2House === 'yes',
                        options: [
                            { label: '새로운 주택', detail: '아파트, 빌라 등 일반 주택', value: 'house', icon: '주' },
                            { label: '조합원입주권', detail: '재개발·재건축', value: 'right', icon: '입' },
                            { label: '분양권', detail: '아파트 청약 당첨 등', value: 'ticket', icon: '분' }
                        ]
                    },
                    {
                        id: 'specialCases',
                        title: (inputs) => {
                            if (inputs.houseNonTaxableCategory === 'singleHome') {
                                return '혹시 아래에 해당하는 것이 있나요?';
                            }
                            if (inputs.assetCategory === 'house' && inputs.houseTaxView === 'nonTaxable') {
                                return '아래 상황이 있으면 비과세 판단이 달라질 수 있어요. 해당되는 것이 있나요?';
                            }
                            return '아래 상황이 있으면 계산이 달라질 수 있어요. 해당되는 것이 있나요?';
                        },
                        subtitle: (inputs) => {
                            if (inputs.houseNonTaxableCategory === 'singleHome') {
                                return '1주택이라도 아래 항목에 해당하면 비과세가 안 됩니다. 해당 사항이 있으면 체크해주세요.';
                            }
                            if (inputs.assetCategory === 'house' && inputs.houseTaxView === 'nonTaxable') {
                                return '지금은 주택 비과세 쪽으로 보고 있습니다. 아래 항목이 있으면 바로 비과세라고 단정하지 않고 결과 화면에 꼭 다시 볼 사항으로 표시합니다.';
                            }
                            return '선택해도 계산은 계속되며, 결과 화면에 다시 볼 항목으로 정리됩니다.';
                        },
                        helper: (inputs) => {
                            if (inputs.houseNonTaxableCategory === 'singleHome') {
                                return '1세대 1주택 비과세는 보유·거주 요건, 등기 여부, 양도가액 등에 따라 과세될 수 있습니다. 잘 모르겠으면 선택하지 않고 넘어가셔도 계산은 계속됩니다.';
                            }
                            if (inputs.assetCategory === 'house' && inputs.houseTaxView === 'nonTaxable') {
                                return '쉽게 말해 "집 한 채 비과세"라고 바로 보기 어려운 예외 상황이 있는지 묻는 질문입니다. 잘 모르겠으면 선택하지 않고 넘어가셔도 계산은 계속됩니다.';
                            }
                            return '특례 적용이나 사실관계 확인이 필요한 대표 상황을 묻는 질문입니다. 잘 모르겠으면 선택하지 않고 넘어가셔도 됩니다.';
                        },
                        type: 'checklist',
                        selectionMode: 'store',
                        condition: (inputs) => inputs.assetCategory === 'house' && inputs.houseNonTaxableCategory !== 'tempTwoHome' && inputs.temp2House !== 'yes',
                        emptySelectionHint: '해당되는 것이 없으면 선택하지 말고 다음으로 넘어가세요.',
                        options: (inputs) => {
                            if (inputs.houseNonTaxableCategory === 'singleHome') {
                                // 1주택 비과세 불가 케이스 (NotebookLM 양도소득세 노트북 기반)
                                return [
                                    { label: '등기를 안 하고 팔았어요 (미등기 양도)', value: 'unregistered' },
                                    { label: '해외에 살고 있어요 (비거주자)', value: 'nonResident' },
                                    { label: '잔금 받기 전에 건물을 철거했어요', value: 'demolishedBeforeSettlement' },
                                    { label: '주택과 상가가 함께 있는 건물이에요 (양도가액과 면적에 따라 비과세 범위가 달라집니다)', value: 'mixed_use_building' },
                                    { label: '다가구주택을 건물 전체로 팔았어요', value: 'multi_family_whole' }
                                ];
                            }
                            // 기존: 비과세 특례 또는 과세 흐름의 일반 체크리스트
                            return [
                                { label: '상속받았거나 증여받은 집', value: 'inherited' },
                                { label: '결혼 때문에 2주택이 된 경우', value: 'marriage' },
                                { label: '임대사업 등록 또는 거주주택 특례가 있는 경우', value: 'rental' },
                                { label: '전세를 크게 올리지 않은 상생임대 특례 검토', value: 'winwin' },
                                { label: '오피스텔이나 농어촌주택을 함께 보유', value: 'farm_officetel' },
                                { label: '재개발·재건축으로 입주권이 생긴 경우', value: 'reconstruction' },
                                { label: '준공 후 미분양·소형 신축 특례 검토', value: 'unsold_new' },
                                { label: '다가구주택을 건물 전체로 파는 경우', value: 'multi_family_whole' },
                                { label: '주택과 상가가 함께 있는 상가주택 건물', value: 'mixed_use_building' }
                            ];
                        }
                    }
                ]
            },
            2: {
                title: '판정 정보',
                questions: [
                    {
                        id: 'address',
                        title: (inputs) => {
                            if (inputs.assetCategory === 'house') return '이번에 양도하는 주택(파는 집)의 주소를 적어주세요.';
                            if (inputs.assetCategory === 'right') return '이번에 양도하는 입주권의 대상 주소를 적어주세요.';
                            if (inputs.assetCategory === 'ticket') return '이번에 양도하는 분양권의 대상 주소를 적어주세요.';
                            return '이번에 양도하는 부동산의 주소를 적어주세요.';
                        },
                        subtitle: '정확한 주소를 몰라도 시/구/동이나 단지명까지만 입력해도 규제지역 자동 판별 등에 활용됩니다.',
                        type: 'text',
                        condition: (inputs) => inputs.assetCategory !== 'stock',
                        placeholder: '예: 서울 서초구 반포자이 101동'
                    },
                    // ── 다가구주택 요건 확인 ──
                    {
                        id: 'multiFamilyFloors',
                        title: '주택으로 쓰는 층수가 3개 층 이하인가요?',
                        subtitle: '지하층은 제외합니다. 1층이 필로티(주차장)이면 그 층도 제외됩니다.',
                        helper: '건축물대장의 층별 용도를 확인하세요. 주택 사용 층수가 4층 이상이면 다가구주택이 아니라 다세대주택(공동주택)에 해당합니다.',
                        type: 'button',
                        condition: (inputs) => (inputs.specialCases || []).includes('multi_family_whole'),
                        options: [
                            { label: '예, 3개 층 이하예요', detail: '다가구 요건 충족', value: 'yes', icon: '✓' },
                            { label: '아니오, 4층 이상이에요', detail: '다가구 요건 미충족', value: 'no', icon: '✗' },
                            { label: '잘 모르겠어요', detail: '건축물대장 확인 필요', value: 'unknown', icon: '?' }
                        ]
                    },
                    {
                        id: 'multiFamilyTotalArea',
                        title: '주택 바닥면적 합계가 660㎡ 이하인가요?',
                        subtitle: '1개 동 기준으로 주택으로 쓰이는 바닥면적의 합계입니다.',
                        helper: '건축물대장에서 각 층의 주택 면적을 합산해 확인하세요.',
                        type: 'button',
                        condition: (inputs) => (inputs.specialCases || []).includes('multi_family_whole'),
                        options: [
                            { label: '예, 660㎡ 이하예요', detail: '다가구 요건 충족', value: 'yes', icon: '✓' },
                            { label: '아니오, 660㎡ 초과예요', detail: '다가구 요건 미충족', value: 'no', icon: '✗' },
                            { label: '잘 모르겠어요', detail: '건축물대장 확인 필요', value: 'unknown', icon: '?' }
                        ]
                    },
                    {
                        id: 'multiFamilyHouseholds',
                        title: '거주 가구 수가 19가구 이하인가요?',
                        subtitle: '대지 내 동별 세대수를 합한 수를 기준으로 합니다.',
                        helper: '건축물대장의 호수 또는 세대수를 확인하세요. 20가구 이상이면 공동주택에 해당합니다.',
                        type: 'button',
                        condition: (inputs) => (inputs.specialCases || []).includes('multi_family_whole'),
                        options: [
                            { label: '예, 19가구 이하예요', detail: '다가구 요건 충족', value: 'yes', icon: '✓' },
                            { label: '아니오, 20가구 이상이에요', detail: '다가구 요건 미충족', value: 'no', icon: '✗' },
                            { label: '잘 모르겠어요', detail: '건축물대장 확인 필요', value: 'unknown', icon: '?' }
                        ]
                    },
                    // ── 겸용주택 면적·기준시가 입력 ──
                    {
                        id: 'mixedUseArea',
                        title: '주택 부분과 상가 부분의 면적을 입력해주세요.',
                        subtitle: '건축물대장 기준 연면적(㎡)입니다. 주택 면적이 상가 면적보다 큰지에 따라 비과세 범위가 달라집니다.',
                        helper: '건물등기부등본이나 건축물대장에서 각 용도별 면적을 확인할 수 있습니다.',
                        type: 'currency_group',
                        condition: (inputs) => (inputs.specialCases || []).includes('mixed_use_building'),
                        fields: [
                            { id: 'mixedUseHouseArea', label: '주택 부분 연면적 (㎡)' },
                            { id: 'mixedUseCommercialArea', label: '상가 부분 연면적 (㎡)' }
                        ]
                    }
                ]
            },
            3: {
                title: '거래 금액',
                questions: [
                    {
                        id: 'dates',
                        title: '언제 취득하고 양도하셨나요?',
                        subtitle: '보유기간과 일시적 2주택 허용기한을 계산합니다.',
                        type: 'date_group',
                        fields: (inputs) => {
                            if (inputs.assetCategory === 'right' && inputs.rightType === 'ticket') {
                                return [
                                    { id: 'buyDate', label: '분양권 취득일(당첨일 또는 계약일)' },
                                    { id: 'contractDate', label: '매매계약 체결일(선택)' },
                                    { id: 'sellDate', label: '양도일(잔금일)' }
                                ];
                            }
                            if (inputs.assetCategory === 'right' && inputs.rightType === 'membership') {
                                if (inputs.membershipType === 'original') {
                                    return [
                                        { id: 'buyDate', label: '종전 부동산(주택/토지) 취득일' },
                                        { id: 'contractDate', label: '매매계약 체결일(선택)' },
                                        { id: 'sellDate', label: '양도일(잔금일)' }
                                    ];
                                } else {
                                    return [
                                        { id: 'buyDate', label: '입주권 매수일(잔금일)' },
                                        { id: 'contractDate', label: '매매계약 체결일(선택)' },
                                        { id: 'sellDate', label: '양도일(잔금일)' }
                                    ];
                                }
                            }
                            const labelStr = inputs.assetCategory === 'house' ? '양도 주택 취득일' : '취득일';
                            return [
                                { id: 'buyDate', label: labelStr },
                                { id: 'contractDate', label: '매매계약 체결일(선택)' },
                                { id: 'sellDate', label: '양도일(잔금일)' }
                            ];
                        }
                    },
                    {
                        id: 'newHomeContractDate',
                        title: (inputs) => {
                            if (inputs.newAssetType === 'ticket') return '새로 산 분양권의 당첨일(또는 계약일)은 언제인가요?';
                            if (inputs.newAssetType === 'right') return '새로 산 입주권의 취득일(잔금청산일)은 언제인가요?';
                            return '새로 산 주택의 취득일(잔금청산일과 등기접수일 중 빠른 날)은 언제인가요?';
                        },
                        subtitle: '종전 주택을 산 지 1년 뒤에 샀는지, 그리고 신규 주택을 산 지 3년 안에 종전 주택을 팔았는지 계산하는 데 꼭 필요합니다.',
                        type: 'date_single',
                        condition: (inputs) => inputs.temp2House === 'yes'
                    },
                    {
                        id: 'specialMoveInCondition',
                        title: '종전 주택을 새 주택 완공 후 3년 내에 팔고, 1년 이상 거주 요건을 충족하시나요?',
                        subtitle: '입주권이나 분양권 취득 후 3년이 지나서 종전 주택을 팔더라도, 새 주택 완공 전 또는 완공 후 3년 내에 종전 주택을 양도하고, 완공 후 3년 내에 전 세대가 이사하여 1년 이상 계속 거주하면 비과세가 가능합니다.',
                        type: 'button',
                        condition: (inputs) => {
                            if (inputs.temp2House !== 'yes') return false;
                            if (inputs.newAssetType !== 'ticket' && inputs.newAssetType !== 'right') return false;
                            
                            // Check if sellDate is > 3 years after newHomeContractDate
                            if (inputs.sellDate && inputs.newHomeContractDate) {
                                const sellD = new Date(inputs.sellDate);
                                const buyNewD = new Date(inputs.newHomeContractDate);
                                buyNewD.setFullYear(buyNewD.getFullYear() + 3);
                                if (sellD > buyNewD) {
                                    return true;
                                }
                            }
                            return false;
                        },
                        options: [
                            { label: '예, 완공 후 3년 내 양도 및 1년 거주 요건을 충족합니다', detail: '비과세 적용', value: 'yes', icon: '✓' },
                            { label: '아니오, 요건을 충족하지 못합니다', detail: '과세 적용', value: 'no', icon: '✕' }
                        ]
                    },
                    {
                        id: 'isAdjustedAreaAtAcquisition',
                        title: '양도 주택의 취득 당시 규제지역(조정대상지역)이었나요?',
                        subtitle: '1세대 1주택 거주요건과 권리자산 판정에 영향을 줍니다.',
                        helper: '잘 모르겠다면 결과는 계속 보여주되, 검토 필요 항목으로 남깁니다.',
                        type: 'button',
                        condition: (inputs) => {
                            if (inputs.assetCategory !== 'house' && inputs.assetCategory !== 'right') return false;
                            
                            const detection = this.detectAdjustedArea(inputs.address, inputs.buyDate);
                            if (detection.status === 'detected') {
                                inputs.isAdjustedAreaAtAcquisition = detection.isAdjusted ? 'yes' : 'no';
                                return false; // 자동 판별 성공 시 문항 스킵
                            }
                            return true;
                        },
                        options: [
                            { label: '예', detail: '규제지역이었습니다', value: 'yes', icon: '예' },
                            { label: '아니오', detail: '비규제지역이었습니다', value: 'no', icon: '아' },
                            { label: '잘 모르겠어요', detail: '결과에 검토 표시', value: 'unknown', icon: '?' }
                        ]
                    },
                    {
                        id: 'isAdjustedAreaAtTransfer',
                        title: '양도일 현재 해당 주택은 규제지역인가요?',
                        subtitle: (inputs) => {
                            const sellDate = new Date(inputs.sellDate);
                            const gracePeriodEnd = new Date('2026-05-09');
                            if (sellDate <= gracePeriodEnd) {
                                return '양도일이 중과 유예 기간(26.5.9. 이전) 내에 해당하여, 유예 혜택으로 세금을 얼마나 절약하셨는지 알려드리기 위해 규제지역 여부를 확인합니다.';
                            }
                            return '다주택 중과 여부는 2026년 5월 10일 이후 양도분부터 다시 중요해집니다.';
                        },
                        type: 'button',
                        condition: (inputs) => {
                            if (inputs.assetCategory !== 'house' || inputs.houseCount < 2) return false;
                            
                            const detection = this.detectAdjustedArea(inputs.address, inputs.sellDate);
                            if (detection.status === 'detected') {
                                inputs.isAdjustedAreaAtTransfer = detection.isAdjusted ? 'yes' : 'no';
                                return false; // 자동 판별 성공 시 문항 스킵
                            }
                            return true;
                        },
                        options: [
                            { label: '예', detail: '규제지역이었습니다', value: 'yes', icon: '예' },
                            { label: '아니오', detail: '비규제지역이었습니다', value: 'no', icon: '아' },
                            { label: '잘 모르겠어요', detail: '결과에 검토 표시', value: 'unknown', icon: '?' }
                        ]
                    },
                    {
                        id: 'acquisitionMethod',
                        title: (inputs) => {
                            if (inputs.assetCategory === 'house') return '이번에 양도하는 주택(파는 집)을 과거에 취득하실 때 작성했던 매매계약서가 있으신가요?';
                            if (inputs.assetCategory === 'right') return '이번에 양도하는 입주권을 과거에 취득하실 때 작성했던 계약서가 있으신가요?';
                            if (inputs.assetCategory === 'ticket') return '이번에 양도하는 분양권을 과거에 취득하실 때 작성했던 계약서가 있으신가요?';
                            return '이번에 양도하는 부동산을 과거에 취득하실 때 작성했던 매매계약서가 있으신가요?';
                        },
                        subtitle: '실제 얼마에 샀는지 증명할 수 있는 계약서가 있으면 "예"를 고르세요.',
                        type: 'button',
                        condition: (inputs) => inputs.assetCategory !== 'stock',
                        options: [
                            { label: '예, 계약서가 있어요', detail: '실지거래가액 계산 (실제 산 금액 적용)', value: 'real', icon: '실' },
                            { label: '아니오, 계약서를 분실했어요', detail: '환산취득가액 계산 (나라가 정한 기준시가 기준)', value: 'estimated', icon: '환' }
                        ]
                    },
                    {
                        id: 'price_transfer',
                        title: (inputs) => inputs.isJointOwnership ? '부동산 전체를 얼마에 양도하셨나요?' : '얼마에 양도하셨나요?',
                        subtitle: (inputs) => inputs.isJointOwnership 
                            ? '계약서상 부동산 전체의 실제 양도가액을 입력해주세요. (세금은 50:50 지분으로 알아서 나누어 계산합니다. 단위: 만원)'
                            : '양수인에게 받은 실제 금액을 입력해주세요. 단위는 만원입니다.',
                        type: 'currency_group',
                        condition: (inputs) => inputs.assetCategory !== 'stock' && inputs.acquisitionMethod === 'real',
                        fields: (inputs) => [
                            { id: 'transferPrice', label: inputs.isJointOwnership ? '부동산 전체 양도가액' : '양도가액' }
                        ]
                    },
                    {
                        id: 'residencyPeriod',
                        title: '실거주 기간은 얼마나 되나요?',
                        subtitle: '1세대 1주택 비과세와 고가주택 장기보유특별공제를 판단할 때 필요합니다.',
                        type: 'range',
                        condition: (inputs) => this.shouldAskResidencyPeriod(inputs),
                        min: 0,
                        max: 30,
                        unit: '년',
                        defaultValue: 2
                    },
                    {
                        id: 'price_acquisition_detail',
                        title: (inputs) => inputs.isJointOwnership ? '부동산 전체의 취득 비용을 입력해주세요.' : '취득에 들어간 비용을 입력해주세요.',
                        subtitle: (inputs) => inputs.isJointOwnership
                            ? '계약서상 부동산 전체의 순수 취득가액과 취득세, 중개수수료 등을 입력해주세요. (세금은 50:50 지분으로 알아서 나누어 계산합니다. 단위: 만원)'
                            : '순수 취득가액 다음에 취득세 등(등기비용 포함), 중개수수료, 법무사 수수료를 입력합니다. 비워두면 0원으로 처리합니다. 단위는 만원입니다.',
                        type: 'currency_group',
                        condition: (inputs) => inputs.assetCategory !== 'stock' && inputs.acquisitionMethod === 'real',
                        fields: (inputs) => {
                            let acqLabel = '순수 취득가액';
                            if (inputs.assetCategory === 'right' && inputs.rightType === 'membership') {
                                if (inputs.membershipType === 'original') {
                                    acqLabel = '기존 주택 취득가액 + 납부 청산금';
                                } else {
                                    acqLabel = '입주권 매입가액 + 납부 청산금';
                                }
                            } else if (inputs.assetCategory === 'right' && inputs.rightType === 'ticket') {
                                acqLabel = '분양권 매입가액(프리미엄 포함) + 불입액';
                            }
                            if (inputs.isJointOwnership) {
                                acqLabel = '부동산 전체 ' + acqLabel;
                            }
                            return [
                                { id: 'acqPrice_real', label: acqLabel },
                                { id: 'acqTax', label: inputs.isJointOwnership ? '전체 취득세 등(등기비용 포함)' : '취득세 등(등기비용 포함)' },
                                {
                                    id: 'acqBrokerFee',
                                    label: inputs.isJointOwnership ? '전체 취득 중개수수료' : '취득 중개수수료',
                                    detailFields: [
                                        { id: 'acqBrokerBizNo', label: '사업자번호', type: 'text', placeholder: '예: 123-45-67890' },
                                        { id: 'acqBrokerPaidDate', label: '지급일', type: 'date' }
                                    ]
                                },
                                {
                                    id: 'acqLegalFee',
                                    label: inputs.isJointOwnership ? '전체 법무사 수수료' : '법무사 수수료',
                                    detailFields: [
                                        { id: 'acqLegalBizNo', label: '법무사 사업자번호', type: 'text', placeholder: '예: 123-45-67890' },
                                        { id: 'acqLegalPaidDate', label: '지급일', type: 'date' }
                                    ]
                                }
                            ];
                        }
                    },
                    {
                        id: 'price_expenses_detail',
                        title: (inputs) => inputs.isJointOwnership ? '부동산 전체의 양도 비용과 큰 수리비용이 있었나요?' : '집을 팔 때 들었던 비용과 큰 수리비용이 있었나요?',
                        subtitle: (inputs) => inputs.isJointOwnership
                            ? '부동산 전체 기준의 필요경비(중개수수료, 세무대리비, 자본적 지출 수리비 등)를 입력해주세요. 지분별 안분은 자동 적용됩니다. 단위는 만원입니다.'
                            : '베란다 확장, 보일러 교체, 샷시 설치 등 뼈대를 고친 큰 수리비용(자본적 지출)만 세금에서 빼줍니다. (도배, 장판 교체 등 단순 수리비는 제외됩니다) 영수증이 있어야 인정됩니다. 단위는 만원입니다.',
                        type: 'currency_group',
                        condition: (inputs) => inputs.assetCategory !== 'stock' && inputs.acquisitionMethod === 'real',
                        fields: (inputs) => [
                            {
                                id: 'sellBrokerFee',
                                label: inputs.isJointOwnership ? '부동산 전체 양도 중개수수료' : '집 팔 때 낸 부동산 중개수수료',
                                detailFields: [
                                    { id: 'sellBrokerBizNo', label: '사업자번호', type: 'text', placeholder: '예: 123-45-67890' },
                                    { id: 'sellBrokerPaidDate', label: '지급일', type: 'date' }
                                ]
                            },
                            { 
                                id: 'sellTaxFee', 
                                label: inputs.isJointOwnership ? '전체 세무사 등 신고대행 수수료' : '세무사 등 신고대행 수수료' 
                            },
                            {
                                id: 'capitalExpenditure',
                                label: inputs.isJointOwnership ? '부동산 전체 큰 수리비용 (자본적 지출)' : '큰 수리비용 (자본적 지출)',
                                detailFields: [
                                    { id: 'capitalExpenditureBizNo', label: '수리업체 사업자번호', type: 'text', placeholder: '예: 123-45-67890' },
                                    { id: 'capitalExpenditurePaidDate', label: '지급일', type: 'date' }
                                ]
                            }
                        ]
                    },
                    {
                        id: 'doMixedUseApportionment',
                        title: '겸용주택의 양도가액과 취득가액을 주택/상가로 나누어 계산하시겠습니까?',
                        subtitle: '주택 면적이 상가 면적보다 크고, 12억 원 이하인 경우 보통 건물 전체를 주택으로 보아 나누지 않고 전체 금액으로 신고합니다.',
                        type: 'button',
                        condition: (inputs) => (inputs.specialCases || []).includes('mixed_use_building'),
                        options: [
                            { label: '아니오, 전체 금액으로 계산할게요', detail: '기준시가 입력 생략', value: 'no', icon: '전' },
                            { label: '예, 주택과 상가를 나누어 계산할게요', detail: '기준시가 입력 필요', value: 'yes', icon: '분' }
                        ]
                    },
                    {
                        id: 'mixedUseStdPrice',
                        title: '양도 당시 주택·상가 각각의 기준시가를 입력해주세요.',
                        subtitle: '양도가액과 양도 시 필요경비를 안분할 때 사용합니다. 단위는 만원입니다.',
                        helper: '기준시가는 국세청 홈택스 또는 국토교통부 부동산공시가격에서 확인할 수 있습니다. 주택부분 양도가액 = 전체 양도가액 × (주택 기준시가 ÷ 전체 기준시가)',
                        type: 'currency_group',
                        condition: (inputs) => (inputs.specialCases || []).includes('mixed_use_building') && inputs.doMixedUseApportionment === 'yes',
                        fields: [
                            { id: 'mixedUseHouseStdPrice', label: '양도 당시 주택 부분 기준시가' },
                            { id: 'mixedUseCommercialStdPrice', label: '양도 당시 상가 부분 기준시가' }
                        ]
                    },
                    {
                        id: 'mixedUseStdPriceAtAcq',
                        title: '취득 당시 주택·상가 각각의 기준시가를 입력해주세요.',
                        subtitle: '취득가액과 취득 시 필요경비를 안분할 때 사용합니다. 단위는 만원입니다.',
                        helper: '취득 당시의 기준시가(공시가격)입니다. 취득가액 안분: 전체 취득가액 × (취득 당시 주택 기준시가 ÷ 취득 당시 전체 기준시가)',
                        type: 'currency_group',
                        condition: (inputs) => (inputs.specialCases || []).includes('mixed_use_building') && inputs.doMixedUseApportionment === 'yes',
                        fields: [
                            { id: 'mixedUseHouseStdPriceAtAcq', label: '취득 당시 주택 부분 기준시가' },
                            { id: 'mixedUseCommercialStdPriceAtAcq', label: '취득 당시 상가 부분 기준시가' }
                        ]
                    },
                    {
                        id: 'price_estimated',
                        title: (inputs) => inputs.isJointOwnership ? '부동산 전체 기준의 금액들을 입력해주세요.' : '기준시가를 입력해주세요.',
                        subtitle: (inputs) => inputs.isJointOwnership
                            ? '부동산 전체의 양도가액과 기준시가를 입력해주세요. 지분 계산은 자동으로 이루어집니다. 단위는 만원입니다.'
                            : '취득가액 증빙이 없을 때의 단순 계산입니다. 단위는 만원입니다.',
                        type: 'currency_group',
                        condition: (inputs) => inputs.assetCategory !== 'stock' && inputs.acquisitionMethod === 'estimated',
                        fields: (inputs) => [
                            { id: 'transferPrice', label: inputs.isJointOwnership ? '부동산 전체 양도가액' : '양도가액' },
                            { id: 'transferTaxBase', label: '양도 당시 기준시가 (전체 기준)' },
                            { id: 'acquisitionTaxBase', label: '취득 당시 기준시가 (전체 기준)' }
                        ]
                    },
                    {
                        id: 'stock_price_summary',
                        title: '주식등 금액을 합산해서 입력해주세요.',
                        subtitle: '간편신고서의 금액 칸에 옮겨 적을 총액 기준입니다. 단위는 만원입니다.',
                        type: 'currency_group',
                        condition: (inputs) => inputs.assetCategory === 'stock',
                        fields: [
                            { id: 'transferPrice', label: '총 양도가액' },
                            { id: 'acquisitionPrice', label: '총 취득가액' },
                            { id: 'necessaryExpenses', label: '수수료 등 필요경비' }
                        ]
                    }
                ]
            }
        };
    }

    init() {
        this.introScreen = document.getElementById('intro-screen');
        this.wizardScreen = document.getElementById('wizard-screen');
        this.resultScreen = document.getElementById('result-screen');
        this.reviewScreen = document.getElementById('rejection-screen');
        this.questionContainer = document.getElementById('question-container');
        this.phaseTitleDisplay = document.getElementById('phase-title-display');
        this.wizardProgressText = document.getElementById('wizard-progress-text');

        this.phaseEls = {
            1: document.getElementById('phase-1'),
            2: document.getElementById('phase-2'),
            3: document.getElementById('phase-3')
        };

        document.getElementById('start-btn')?.addEventListener('click', () => this.startWizard());
        document.getElementById('prev-btn')?.addEventListener('click', () => this.prevStep());
        document.getElementById('restart-btn')?.addEventListener('click', () => this.reset());
        document.getElementById('restart-bouncer-btn')?.addEventListener('click', () => this.reset());

        this.updatePhaseIndicator();
        this.updateWizardMeta();
    }

    startWizard() {
        this.currentPhase = 1;
        this.currentStepInPhase = 0;
        this.showScreen(this.wizardScreen);
        this.renderQuestion();
    }

    showScreen(screen) {
        [this.introScreen, this.wizardScreen, this.resultScreen, this.reviewScreen].forEach((node) => {
            node.classList.remove('active');
            node.classList.add('hidden');
        });

        screen.classList.remove('hidden');
        screen.classList.add('active');
    }

    updatePhaseIndicator() {
        Object.values(this.phaseEls).forEach((el) => {
            el.classList.remove('active', 'completed');
        });

        for (let i = 1; i <= 3; i += 1) {
            if (i < this.currentPhase) {
                this.phaseEls[i].classList.add('completed');
            } else if (i === this.currentPhase) {
                this.phaseEls[i].classList.add('active');
            }
        }
    }

    updateWizardMeta(question, totalQuestions) {
        const phaseData = this.phases[this.currentPhase];
        if (this.phaseTitleDisplay) {
            this.phaseTitleDisplay.textContent = phaseData?.title || '사례 분류';
        }

        if (this.wizardProgressText) {
            if (question && totalQuestions) {
                this.wizardProgressText.textContent = `${this.currentStepInPhase + 1} / ${totalQuestions} 단계`;
            } else {
                this.wizardProgressText.textContent = '생활언어로 차근차근 확인합니다.';
            }
        }
    }

    getCurrentQuestions() {
        const phaseData = this.phases[this.currentPhase];
        return phaseData.questions.filter((question) => !question.condition || question.condition(this.inputs));
    }

    getQuestionText(value) {
        return typeof value === 'function' ? value(this.inputs) : value;
    }

    renderQuestion() {
        this.updatePhaseIndicator();

        const effectiveQuestions = this.getCurrentQuestions();
        if (this.currentStepInPhase >= effectiveQuestions.length) {
            if (this.currentPhase < 3) {
                this.currentPhase += 1;
                this.currentStepInPhase = 0;
                this.renderQuestion();
            } else {
                this.calculateAndShowResult();
            }
            return;
        }

        const question = effectiveQuestions[this.currentStepInPhase];
        this.updateWizardMeta(question, effectiveQuestions.length);

        this.questionContainer.innerHTML = '';

        // Auto-detect adjusted area when rendering the question
        if (question.id === 'isAdjustedAreaAtAcquisition' && this.inputs.address && this.inputs.buyDate) {
            const detection = this.detectAdjustedArea(this.inputs.address, this.inputs.buyDate);
            if (detection.status === 'detected' && !this.inputs._autoDetected_isAdjustedAreaAtAcquisition) {
                this.inputs.isAdjustedAreaAtAcquisition = detection.isAdjusted ? 'yes' : 'no';
                this.inputs._autoDetected_isAdjustedAreaAtAcquisition = true; // Mark as auto-detected once
            }
        }
        
        if (question.id === 'isAdjustedAreaAtTransfer' && this.inputs.address && this.inputs.sellDate) {
            const detection = this.detectAdjustedArea(this.inputs.address, this.inputs.sellDate);
            if (detection.status === 'detected' && !this.inputs._autoDetected_isAdjustedAreaAtTransfer) {
                this.inputs.isAdjustedAreaAtTransfer = detection.isAdjusted ? 'yes' : 'no';
                this.inputs._autoDetected_isAdjustedAreaAtTransfer = true;
            }
        }

        const slide = document.createElement('div');
        slide.className = 'question-slide active';

        const meta = document.createElement('div');
        meta.className = 'question-meta';
        meta.textContent = `${this.currentStepInPhase + 1} / ${effectiveQuestions.length}`;
        slide.appendChild(meta);

        const title = document.createElement('h3');
        title.className = 'question-title';
        title.textContent = this.getQuestionText(question.title);
        slide.appendChild(title);

        const subtitleText = this.getQuestionText(question.subtitle);
        if (subtitleText) {
            const subtitle = document.createElement('p');
            subtitle.className = 'question-subtitle';
            subtitle.textContent = subtitleText;
            slide.appendChild(subtitle);
        }

        const helperText = this.getQuestionText(question.helper);
        if (helperText) {
            const helper = document.createElement('div');
            helper.className = 'helper-box';
            helper.textContent = helperText;
            slide.appendChild(helper);
        }

        const content = document.createElement('div');
        content.className = 'question-content';

        switch (question.type) {
            case 'button':
                this.renderButtonType(content, question);
                break;
            case 'checklist':
                this.renderChecklist(content, question);
                break;
            case 'text':
                this.renderTextInput(content, question);
                break;
            case 'date_single':
                this.renderDateSingle(content, question);
                break;
            case 'date_group':
                this.renderDateGroup(content, question);
                break;
            case 'range':
                this.renderRange(content, question);
                break;
            case 'currency_group':
                this.renderCurrencyGroup(content, question);
                break;
            default:
                break;
        }

        slide.appendChild(content);
        this.questionContainer.appendChild(slide);
    }

    renderButtonType(container, question) {
        const grid = document.createElement('div');
        grid.className = 'options-grid';
        const options = typeof question.options === 'function'
            ? question.options(this.inputs)
            : question.options;

        options.forEach((option) => {
            const button = document.createElement('button');
            button.className = 'option-card';
            if (this.inputs[question.id] === option.value) {
                button.classList.add('selected');
            }

            button.innerHTML = `
                <span class="option-icon">${option.icon || ''}</span>
                <span class="option-copy">
                    <strong>${option.label}</strong>
                    ${option.detail ? `<small>${option.detail}</small>` : ''}
                </span>
            `;

            button.addEventListener('click', () => {
                this.inputs[question.id] = option.value;
                let shouldContinue = true;
                if (question.onSelect) {
                    shouldContinue = question.onSelect(this.inputs, option.value) !== false;
                }
                if (shouldContinue) {
                    this.nextStep();
                }
            });

            grid.appendChild(button);
        });

        container.appendChild(grid);
    }

    renderChecklist(container, question) {
        const list = document.createElement('div');
        list.className = 'checklist-container';
        const options = typeof question.options === 'function'
            ? question.options(this.inputs)
            : question.options;

        options.forEach((option) => {
            const item = document.createElement('label');
            item.className = 'checklist-item';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = option.value;
            if ((this.inputs[question.id] || []).includes(option.value)) {
                checkbox.checked = true;
            }

            const label = document.createElement('span');
            label.textContent = option.label;

            item.appendChild(checkbox);
            item.appendChild(label);
            list.appendChild(item);
        });

        container.appendChild(list);

        const emptySelectionHint = this.getQuestionText(question.emptySelectionHint);
        if (emptySelectionHint) {
            const helper = document.createElement('p');
            helper.className = 'field-helper';
            helper.textContent = emptySelectionHint;
            container.appendChild(helper);
        }

        const nextButton = document.createElement('button');
        nextButton.className = 'btn-primary large';
        nextButton.textContent = '다음';
        nextButton.addEventListener('click', () => {
            const selected = Array.from(list.querySelectorAll('input:checked')).map((node) => node.value);
            this.inputs[question.id] = selected;
            this.nextStep();
        });

        container.appendChild(nextButton);
    }

    renderTextInput(container, question) {
        const wrapper = document.createElement('div');
        wrapper.className = 'stack';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'text-input';
        input.placeholder = question.placeholder || '';
        input.value = this.inputs[question.id] || '';
        input.addEventListener('input', (event) => {
            this.inputs[question.id] = event.target.value;
        });

        const nextButton = document.createElement('button');
        nextButton.className = 'btn-primary large';
        nextButton.textContent = '다음';
        nextButton.addEventListener('click', () => this.nextStep());

        this.bindAdvanceOnEnter([input], nextButton);

        wrapper.appendChild(input);
        wrapper.appendChild(nextButton);
        container.appendChild(wrapper);
    }

    bindAdvanceOnEnter(fields, submitButton) {
        const focusableFields = fields.filter((field) => field && typeof field.addEventListener === 'function');

        focusableFields.forEach((field, index) => {
            field.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter' || event.isComposing) {
                    return;
                }

                event.preventDefault();

                const nextField = focusableFields.slice(index + 1).find((candidate) => !candidate.disabled);
                if (nextField) {
                    nextField.focus();
                    if (typeof nextField.select === 'function' && nextField.type !== 'date') {
                        nextField.select();
                    }
                    return;
                }

                submitButton.click();
            });
        });
    }

    createDateSelectorField(field, {
        required = false,
        compact = false,
        showHelper = !required,
        labelClassName = 'input-label'
    } = {}) {
        const wrapper = document.createElement('div');
        wrapper.className = compact ? 'stack compact' : 'stack';

        if (field.label) {
            const label = document.createElement('label');
            label.className = labelClassName;
            label.textContent = field.label;
            wrapper.appendChild(label);
        }

        const row = document.createElement('div');
        row.className = 'date-triple-row';

        // 8자리 입력 (수동 입력 및 복사/붙여넣기 지원 컨테이너)
        const textInputWrap = document.createElement('div');
        textInputWrap.className = 'date-text-wrap';
        
        const textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.className = 'text-input date-text-input';
        textInput.placeholder = 'YYYYMMDD';
        textInput.inputMode = 'numeric';
        textInput.maxLength = 8;
        textInput.autocomplete = 'off';
        
        textInputWrap.appendChild(textInput);

        // 연/월/일 셀렉트 박스 컨테이너
        const selectWrap = document.createElement('div');
        selectWrap.className = 'date-select-wrap';

        const yearSelect = document.createElement('select');
        yearSelect.className = 'text-input date-select';
        yearSelect.innerHTML = '<option value="">연도</option>';
        const currentYear = new Date().getFullYear();
        for (let y = currentYear; y >= 1970; y--) {
            yearSelect.innerHTML += `<option value="${y}">${y}년</option>`;
        }

        const monthSelect = document.createElement('select');
        monthSelect.className = 'text-input date-select';
        monthSelect.innerHTML = '<option value="">월</option>';
        for (let m = 1; m <= 12; m++) {
            const mm = String(m).padStart(2, '0');
            monthSelect.innerHTML += `<option value="${mm}">${m}월</option>`;
        }

        const daySelect = document.createElement('select');
        daySelect.className = 'text-input date-select';
        daySelect.innerHTML = '<option value="">일</option>';
        for (let d = 1; d <= 31; d++) {
            const dd = String(d).padStart(2, '0');
            daySelect.innerHTML += `<option value="${dd}">${d}일</option>`;
        }

        selectWrap.appendChild(yearSelect);
        selectWrap.appendChild(monthSelect);
        selectWrap.appendChild(daySelect);

        // 상태 연동 함수
        const setValue = (nextValue) => {
            this.inputs[field.id] = nextValue;
            
            if (nextValue && nextValue.length >= 10) {
                const parts = nextValue.split('-');
                textInput.value = parts.join('');
                yearSelect.value = parts[0];
                monthSelect.value = parts[1];
                daySelect.value = parts[2];
            } else {
                textInput.value = '';
                yearSelect.value = '';
                monthSelect.value = '';
                daySelect.value = '';
            }
        };

        const initialValue = this.normalizeDateText(this.inputs[field.id]) || '';
        setValue(initialValue);

        const validate = () => {
            const y = yearSelect.value;
            const m = monthSelect.value;
            const d = daySelect.value;
            const fieldLabel = field.validationLabel || field.label || '날짜';

            if (!y && !m && !d && !textInput.value.trim()) {
                if (required) {
                    return {
                        ok: false,
                        message: `${fieldLabel}을(를) 입력해주세요.`,
                        input: textInput
                    };
                }
                setValue('');
                return { ok: true };
            }

            if (!y || !m || !d) {
                 return {
                    ok: false,
                    message: `${fieldLabel}의 연도, 월, 일을 모두 선택해주세요.`,
                    input: !y ? yearSelect : (!m ? monthSelect : daySelect)
                };
            }

            if (!this.isValidDateParts(y, m, d)) {
                return {
                    ok: false,
                    message: `${fieldLabel}에 올바르지 않은 날짜가 입력되었습니다.`,
                    input: daySelect
                };
            }

            const normalized = this.composeDateValue(y, m, d);
            setValue(normalized);
            return { ok: true };
        };

        // 8자리 텍스트 입력 처리
        textInput.addEventListener('input', (e) => {
            let rawValue = e.target.value.replace(/[^\d]/g, '');
            textInput.value = rawValue;

            if (rawValue.length === 8) {
                const y = rawValue.slice(0, 4);
                const m = rawValue.slice(4, 6);
                const d = rawValue.slice(6, 8);
                
                if (this.isValidDateParts(y, m, d)) {
                    yearSelect.value = y;
                    monthSelect.value = m;
                    daySelect.value = d;
                    this.inputs[field.id] = this.composeDateValue(y, m, d);
                }
            } else {
                yearSelect.value = '';
                monthSelect.value = '';
                daySelect.value = '';
                this.inputs[field.id] = '';
            }
        });

        // 셀렉트 박스 변경 처리
        const handleSelectChange = () => {
            const y = yearSelect.value;
            const m = monthSelect.value;
            const d = daySelect.value;
            
            if (y && m && d) {
                if (this.isValidDateParts(y, m, d)) {
                    textInput.value = `${y}${m}${d}`;
                    this.inputs[field.id] = this.composeDateValue(y, m, d);
                } else {
                    this.inputs[field.id] = '';
                }
            } else {
                this.inputs[field.id] = '';
            }
        };

        yearSelect.addEventListener('change', handleSelectChange);
        monthSelect.addEventListener('change', handleSelectChange);
        daySelect.addEventListener('change', handleSelectChange);

        row.appendChild(textInputWrap);
        row.appendChild(selectWrap);
        wrapper.appendChild(row);

        if (showHelper) {
            const helper = document.createElement('p');
            helper.className = 'field-helper';
            helper.textContent = required
                ? '8자리 숫자(예: 20250101)를 입력하거나 연/월/일을 선택하세요.'
                : '8자리 숫자(예: 20250101)를 입력하거나 연/월/일을 선택하세요. 비워두면 입력하지 않은 것으로 처리합니다.';
            wrapper.appendChild(helper);
        }

        return {
            element: wrapper,
            inputs: [textInput, yearSelect, monthSelect, daySelect],
            enterInput: textInput,
            validate
        };
    }

    composeDateValue(year, month, day) {
        if (!year || !month || !day) return '';
        return [
            String(year).padStart(4, '0'),
            String(month).padStart(2, '0'),
            String(day).padStart(2, '0')
        ].join('-');
    }

    normalizeDateText(value) {
        const rawValue = String(value || '').trim();
        if (!rawValue) return '';

        let year = '';
        let month = '';
        let day = '';

        const match = rawValue.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
        if (match) {
            [, year, month, day] = match;
        } else {
            const digitsOnly = rawValue.replace(/[^\d]/g, '');
            if (digitsOnly.length !== 8) {
                return '';
            }

            year = digitsOnly.slice(0, 4);
            month = digitsOnly.slice(4, 6);
            day = digitsOnly.slice(6, 8);
        }

        if (!this.isValidDateParts(year, month, day)) {
            return '';
        }

        return this.composeDateValue(year, month, day);
    }

    isValidDateParts(year, month, day) {
        const normalized = this.composeDateValue(year, month, day);
        if (!normalized) {
            return false;
        }

        const date = this.toDate(normalized);
        return Boolean(
            date
            && date.getFullYear() === Number(year)
            && date.getMonth() + 1 === Number(month)
            && date.getDate() === Number(day)
        );
    }

    renderDateSingle(container, question) {
        const wrapper = document.createElement('div');
        wrapper.className = 'stack';

        const dateField = this.createDateSelectorField(
            { id: question.id, validationLabel: question.title },
            { required: true, showHelper: true }
        );
        wrapper.appendChild(dateField.element);

        const nextButton = document.createElement('button');
        nextButton.className = 'btn-primary large';
        nextButton.textContent = '다음';
        nextButton.addEventListener('click', () => {
            const validation = dateField.validate();
            if (!validation.ok) {
                alert(validation.message);
                validation.input?.focus();
                return;
            }
            this.nextStep();
        });

        this.bindAdvanceOnEnter([dateField.enterInput], nextButton);

        wrapper.appendChild(nextButton);
        container.appendChild(wrapper);
    }

    renderDateGroup(container, question) {
        const wrapper = document.createElement('div');
        wrapper.className = 'stack';
        const dateFields = [];

        const fields = typeof question.fields === 'function' ? question.fields(this.inputs) : question.fields;
        fields.forEach((field) => {
            const dateField = this.createDateSelectorField(
                field,
                {
                    required: field.id !== 'contractDate',
                    showHelper: field.id === 'contractDate'
                }
            );
            dateFields.push(dateField);
            wrapper.appendChild(dateField.element);
        });

        const nextButton = document.createElement('button');
        nextButton.className = 'btn-primary large';
        nextButton.textContent = '다음';
        nextButton.addEventListener('click', () => {
            for (const dateField of dateFields) {
                const validation = dateField.validate();
                if (!validation.ok) {
                    alert(validation.message);
                    validation.input?.focus();
                    return;
                }
            }

            const buyDate = this.toDate(this.inputs.buyDate);
            const sellDate = this.toDate(this.inputs.sellDate);

            if (sellDate < buyDate) {
                alert('양도일은 취득일보다 뒤여야 합니다.');
                return;
            }

            const diffDays = Math.ceil((sellDate - buyDate) / (1000 * 60 * 60 * 24));
            const diffYears = diffDays / 365.25;
            this.inputs.holdingPeriod = Number(diffYears.toFixed(2));
            this.nextStep();
        });

        this.bindAdvanceOnEnter(
            dateFields.map((dateField) => dateField.enterInput),
            nextButton
        );

        wrapper.appendChild(nextButton);
        container.appendChild(wrapper);
    }

    renderRange(container, question) {
        if (this.inputs[question.id] === undefined) {
            this.inputs[question.id] = question.defaultValue;
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'stack';

        const valueDisplay = document.createElement('div');
        valueDisplay.className = 'range-value';

        const updateDisplay = () => {
            valueDisplay.textContent = `${this.inputs[question.id]} ${question.unit}`;
        };

        const input = document.createElement('input');
        input.type = 'range';
        input.className = 'range-input';
        input.min = question.min;
        input.max = question.max;
        input.value = this.inputs[question.id];
        input.addEventListener('input', (event) => {
            this.inputs[question.id] = Number(event.target.value);
            updateDisplay();
        });

        const nextButton = document.createElement('button');
        nextButton.className = 'btn-primary large';
        nextButton.textContent = '다음';
        nextButton.addEventListener('click', () => this.nextStep());

        this.bindAdvanceOnEnter([input], nextButton);

        updateDisplay();
        wrapper.appendChild(valueDisplay);
        wrapper.appendChild(input);
        wrapper.appendChild(nextButton);
        container.appendChild(wrapper);
    }

    renderCurrencyGroup(container, question) {
        const wrapper = document.createElement('div');
        wrapper.className = 'stack';
        const enterFields = [];
        const dateFields = [];

        const fields = typeof question.fields === 'function' ? question.fields(this.inputs) : question.fields;
        fields.forEach((field) => {
            const fieldWrap = document.createElement('div');
            fieldWrap.className = 'stack compact';

            const label = document.createElement('label');
            label.className = 'input-label';
            label.textContent = field.label;

            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'text-input';
            input.placeholder = '금액 (만원)';
            input.value = this.inputs[field.id] > 0 ? this.inputs[field.id] / 10000 : '';
            input.addEventListener('input', (event) => {
                this.inputs[field.id] = Number(event.target.value || 0) * 10000;
            });
            enterFields.push(input);

            fieldWrap.appendChild(label);
            fieldWrap.appendChild(input);

            if (field.detailFields?.length) {
                const detailGrid = document.createElement('div');
                detailGrid.className = 'expense-detail-grid';

                field.detailFields.forEach((detailField) => {
                    const detailWrap = document.createElement('div');
                    detailWrap.className = 'stack compact';

                    if (detailField.type === 'date') {
                        const detailDateField = this.createDateSelectorField(
                            detailField,
                            {
                                compact: true,
                                showHelper: false,
                                labelClassName: 'input-label detail-label'
                            }
                        );

                        detailWrap.appendChild(detailDateField.element);
                        enterFields.push(detailDateField.enterInput);
                        dateFields.push(detailDateField);
                    } else {
                        const detailLabel = document.createElement('label');
                        detailLabel.className = 'input-label detail-label';
                        detailLabel.textContent = detailField.label;

                        const detailInput = document.createElement('input');
                        detailInput.type = detailField.type || 'text';
                        detailInput.className = 'text-input detail-input';
                        detailInput.placeholder = detailField.placeholder || '';
                        detailInput.value = this.inputs[detailField.id] || '';
                        detailInput.addEventListener('input', (event) => {
                            this.inputs[detailField.id] = event.target.value;
                        });

                        detailWrap.appendChild(detailLabel);
                        detailWrap.appendChild(detailInput);
                        enterFields.push(detailInput);
                    }

                    detailGrid.appendChild(detailWrap);
                });

                fieldWrap.appendChild(detailGrid);
            }

            wrapper.appendChild(fieldWrap);
        });

        const nextButton = document.createElement('button');
        nextButton.className = 'btn-primary large';
        const isLastStep = this.currentStepInPhase === this.getCurrentQuestions().length - 1;
        nextButton.textContent = isLastStep ? '결과 보기' : '다음';
        nextButton.addEventListener('click', () => {
            for (const dateField of dateFields) {
                const validation = dateField.validate();
                if (!validation.ok) {
                    alert(validation.message);
                    validation.input?.focus();
                    return;
                }
            }

            fields.forEach((field) => {
                this.inputs[field.id] = Number(this.inputs[field.id] || 0);
            });

            if (fields.some((field) => field.id === 'transferPrice') && !this.inputs.transferPrice) {
                alert('양도가액을 입력해주세요.');
                return;
            }
            this.nextStep();
        });

        this.bindAdvanceOnEnter(enterFields, nextButton);

        wrapper.appendChild(nextButton);
        container.appendChild(wrapper);
    }

    nextStep() {
        this.currentStepInPhase += 1;
        this.renderQuestion();
    }

    prevStep() {
        if (this.currentStepInPhase > 0) {
            this.currentStepInPhase -= 1;
            this.renderQuestion();
            return;
        }

        if (this.currentPhase > 1) {
            this.currentPhase -= 1;
            const previousQuestions = this.getCurrentQuestions();
            this.currentStepInPhase = Math.max(0, previousQuestions.length - 1);
            this.renderQuestion();
            return;
        }

        this.showScreen(this.introScreen);
    }

    calculateAndShowResult() {
        if (this.inputs.assetCategory !== 'stock' && this.inputs.acquisitionMethod === 'real') {
            this.inputs.acquisitionPrice =
                (this.inputs.acqPrice_real || 0)
                + (this.inputs.acqTax || 0)
                + (this.inputs.acqBrokerFee || 0)
                + (this.inputs.acqLegalFee || 0);

            this.inputs.necessaryExpenses =
                (this.inputs.sellBrokerFee || 0)
                + (this.inputs.sellTaxFee || 0)
                + (this.inputs.capitalExpenditure || 0);
        }

        const result = this.calculator.calculate(this.inputs);
        this.renderResult(result);
        this.showScreen(this.resultScreen);
    }

    renderResult(result) {
        this.lastResult = result;

        const fmt = (value) => `${Math.floor(value).toLocaleString('ko-KR')}원`;

        const statusBadge = document.getElementById('result-status-badge');
        const headline = document.getElementById('result-headline');
        const subheadline = document.getElementById('result-subheadline');

        statusBadge.className = `status-badge ${result.analysis.tone}`;
        statusBadge.textContent = result.analysis.statusLabel;
        headline.textContent = result.analysis.headline;
        subheadline.textContent = result.analysis.subheadline;

        document.getElementById('total-tax-display').textContent = fmt(result.totalTax);
        document.getElementById('profit-display').textContent = fmt(result.capitalGains);
        document.getElementById('taxable-gains-display').textContent = fmt(result.taxableGains);
        document.getElementById('tax-rate-display').textContent = result.isNonTaxable && !result.isHighValue
            ? '비과세'
            : `${Math.round(result.taxRate * 100)}%`;
        document.getElementById('deduction-display').textContent = result.longTermRate > 0
            ? `${Math.round(result.longTermRate * 100)}%`
            : '-';

        const savingsContainer = document.getElementById('savings-banner-container');
        if (result.savingsFromGracePeriod > 0) {
            savingsContainer.innerHTML = `
                <div class="savings-banner">
                    <div class="savings-title">💡 다주택 중과 유예 혜택 적용됨!</div>
                    <div class="savings-amount-box">
                        <span class="savings-sub">이번 양도로 아낀 세금</span>
                        <strong class="savings-amount">${fmt(result.savingsFromGracePeriod)}</strong>
                    </div>
                    <div class="savings-desc">만약 중과 유예 종료(26.5.10.) 이후 양도했다면 가산된 중과세율이 적용되어 <strong>${fmt(result.hypotheticalHeavyTax)}</strong>을 납부해야 했습니다.</div>
                </div>
            `;
        } else {
            savingsContainer.innerHTML = '';
        }

        this.renderSimpleList(
            document.getElementById('case-chip-list'),
            result.analysis.summaryChips,
            'chip'
        );
        this.renderSimpleList(
            document.getElementById('decision-path-list'),
            result.analysis.decisionPath,
            'list'
        );
        this.renderSimpleList(
            document.getElementById('caution-list'),
            result.analysis.cautions.length ? result.analysis.cautions : ['현재 입력 기준에서 추가 검토 경고는 없습니다.'],
            'list'
        );
        this.renderSimpleList(
            document.getElementById('document-list'),
            result.analysis.documents,
            'list'
        );

        this.renderFilingGuide(result.filingGuide, result);
        this.renderScenarios(result.scenarios);

        this.renderNonTaxableChecklist(result.nonTaxableChecklist);
        this.renderCalculationSteps(result.calculationSteps);
    }

    renderNonTaxableChecklist(checks) {
        const section = document.getElementById('nontaxable-checklist-section');
        const container = document.getElementById('nontaxable-checklist');
        container.innerHTML = '';

        if (!checks || checks.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = '';

        checks.forEach((check) => {
            const item = document.createElement('div');
            item.className = 'checklist-result-item';

            const icon = document.createElement('span');
            icon.className = 'checklist-icon';
            if (check.pass === true) {
                icon.textContent = '✅';
            } else if (check.pass === false) {
                icon.textContent = '❌';
            } else {
                icon.textContent = '⚠️';
            }

            const content = document.createElement('div');
            content.className = 'checklist-content';

            const label = document.createElement('strong');
            label.className = 'checklist-label';
            label.textContent = check.label;

            const detail = document.createElement('span');
            detail.className = 'checklist-detail';
            detail.textContent = check.detail;

            content.appendChild(label);
            content.appendChild(detail);
            item.appendChild(icon);
            item.appendChild(content);
            container.appendChild(item);
        });
    }

    renderCalculationSteps(steps) {
        const container = document.getElementById('calc-steps-container');
        container.innerHTML = '';

        if (!steps || steps.length === 0) return;

        steps.forEach((step) => {
            const card = document.createElement('div');
            card.className = 'calc-step-card';

            const header = document.createElement('div');
            header.className = 'calc-step-header';

            const stepNum = document.createElement('span');
            stepNum.className = 'calc-step-num';
            stepNum.textContent = `${step.step}`;

            const labelEl = document.createElement('strong');
            labelEl.className = 'calc-step-label';
            labelEl.textContent = step.label;

            header.appendChild(stepNum);
            header.appendChild(labelEl);

            const body = document.createElement('div');
            body.className = 'calc-step-body';

            const formulaEl = document.createElement('span');
            formulaEl.className = 'calc-step-formula';
            formulaEl.textContent = step.formula;

            const resultEl = document.createElement('strong');
            resultEl.className = 'calc-step-result';
            resultEl.textContent = `= ${step.result}`;

            body.appendChild(formulaEl);
            body.appendChild(resultEl);

            card.appendChild(header);
            card.appendChild(body);

            if (step.note) {
                const noteEl = document.createElement('p');
                noteEl.className = 'calc-step-note';
                noteEl.textContent = step.note;
                card.appendChild(noteEl);
            }

            container.appendChild(card);
        });
    }

    renderSimpleList(container, items, mode) {
        container.innerHTML = '';
        items.forEach((item) => {
            const node = document.createElement(mode === 'chip' ? 'span' : 'li');
            node.className = mode === 'chip' ? 'result-chip' : '';
            node.textContent = item;
            container.appendChild(node);
        });
    }

    renderScenarios(scenarios) {
        const list = document.getElementById('scenario-list');
        list.innerHTML = '';

        scenarios.forEach((scenario) => {
            const card = document.createElement('div');
            card.className = `scenario-card ${scenario.tone || 'info'}`;

            const title = document.createElement('strong');
            title.textContent = scenario.title;

            const detail = document.createElement('p');
            detail.textContent = scenario.detail;

            card.appendChild(title);
            card.appendChild(detail);
            list.appendChild(card);
        });
    }

    renderFilingGuide(guide, result) {
        const card = document.getElementById('filing-guide-card');
        const lineList = document.getElementById('filing-line-list');
        const manualList = document.getElementById('manual-field-list');
        const draftText = this.buildFilingDraftText(guide);
        const autoFillNote = this.hwpxFormFiller.getAvailabilityNote(guide);

        card.innerHTML = '';
        lineList.innerHTML = '';
        manualList.innerHTML = '';

        const wrap = document.createElement('div');
        wrap.className = 'filing-guide-card';

        const header = document.createElement('div');
        header.className = 'filing-guide-head';

        const badge = document.createElement('span');
        badge.className = 'filing-form-badge';
        badge.textContent = `별지 제${guide.formCode}호 서식`;

        const title = document.createElement('strong');
        title.className = 'filing-guide-title';
        title.textContent = guide.title;

        const reason = document.createElement('p');
        reason.className = 'filing-guide-desc';
        reason.textContent = guide.reason;

        header.appendChild(badge);
        header.appendChild(title);
        header.appendChild(reason);
        wrap.appendChild(header);

        const actionRow = document.createElement('div');
        actionRow.className = 'filing-action-row';
        [
            { label: '원본 PDF 다운로드', path: guide.pdfPath, filename: guide.pdfDownloadName },
            { label: '원본 HWPX 다운로드', path: guide.hwpxPath, filename: guide.hwpxDownloadName }
        ].forEach((item) => {
            const link = document.createElement('a');
            link.className = 'filing-link-btn';
            link.href = encodeURI(item.path);
            link.download = item.filename || '';
            link.textContent = item.label;
            actionRow.appendChild(link);
        });
        wrap.appendChild(actionRow);

        const prefillBox = document.createElement('div');
        prefillBox.className = 'filing-prefill-box';

        const prefillTitle = document.createElement('strong');
        prefillTitle.className = 'filing-prefill-title';
        prefillTitle.textContent = '자동입력 초안';

        const prefillDesc = document.createElement('p');
        prefillDesc.className = 'filing-prefill-desc';
        let prefillDescText = '';
        if (this.hwpxFormFiller.canAutoFill(guide)) {
            if (guide.formCode === '84의4') {
                prefillDescText = '별지84의4 간편신고서(HWPX)는 앱에서 받은 값과 계산값을 실제 양식 칸에 넣어서 내려받을 수 있습니다.';
            } else {
                prefillDescText = '해당 서식(HWPX)은 현재 빈 원본 양식 다운로드만 제공합니다. 자동입력 초안은 복사 기능이나 TXT 저장을 이용해주세요.';
            }
        } else {
            prefillDescText = '공식 PDF/HWPX 원본은 위에서 내려받고, 현재 계산값은 아래 순서대로 자동 정리된 초안으로 복사하거나 TXT로 저장할 수 있습니다.';
        }
        prefillDesc.textContent = prefillDescText;

        const prefillActionRow = document.createElement('div');
        prefillActionRow.className = 'filing-action-row';

        const copyButton = document.createElement('button');
        copyButton.type = 'button';
        copyButton.className = 'filing-link-btn';
        copyButton.textContent = '입력 초안 복사';
        copyButton.addEventListener('click', async () => {
            const copied = await this.copyTextToClipboard(draftText);
            if (!copied) {
                alert('복사에 실패했습니다. 다른 브라우저에서 다시 시도해주세요.');
                return;
            }

            const originalLabel = copyButton.textContent;
            copyButton.textContent = '복사됨';
            window.setTimeout(() => {
                copyButton.textContent = originalLabel;
            }, 1500);
        });

        const downloadButton = document.createElement('button');
        downloadButton.type = 'button';
        downloadButton.className = 'filing-link-btn';
        downloadButton.textContent = '입력 초안 TXT 다운로드';
        downloadButton.addEventListener('click', () => {
            const baseName = (guide.hwpxDownloadName || guide.pdfDownloadName || guide.title || '양도소득세_서식')
                .replace(/\.(pdf|hwpx)$/i, '')
                .replace(/\s+/g, '_');
            this.downloadTextFile(`${baseName}_자동입력초안.txt`, draftText);
        });

        if (!autoFillNote) {
            const isAutoFillReady = guide.formCode === '84의4';
            const hwpxBtnLabel = isAutoFillReady ? '자동채움 HWPX 다운로드' : '빈 양식 HWPX 다운로드 (원본)';
            
            const hwpxButton = document.createElement('button');
            hwpxButton.type = 'button';
            hwpxButton.className = 'filing-link-btn';
            hwpxButton.textContent = hwpxBtnLabel;
            hwpxButton.addEventListener('click', async () => {
                const originalLabel = hwpxButton.textContent;
                hwpxButton.disabled = true;
                hwpxButton.textContent = '서식 생성 중...';

                try {
                    await this.hwpxFormFiller.downloadAutoFilledForm({
                        guide,
                        inputs: this.inputs,
                        result,
                        calculator: this.calculator
                    });

                    hwpxButton.textContent = '다운로드됨';
                    window.setTimeout(() => {
                        hwpxButton.textContent = originalLabel;
                        hwpxButton.disabled = false;
                    }, 1600);
                } catch (error) {
                    hwpxButton.textContent = hwpxBtnLabel;
                    hwpxButton.disabled = false;
                    alert(error?.message || 'HWPX 생성에 실패했습니다.');
                }
            });
            prefillActionRow.appendChild(hwpxButton);
        }

        prefillActionRow.appendChild(copyButton);
        prefillActionRow.appendChild(downloadButton);
        prefillBox.appendChild(prefillTitle);
        prefillBox.appendChild(prefillDesc);
        prefillBox.appendChild(prefillActionRow);

        if (autoFillNote) {
            const note = document.createElement('p');
            note.className = 'filing-prefill-desc';
            note.textContent = autoFillNote;
            prefillBox.appendChild(note);
        }

        wrap.appendChild(prefillBox);

        const filePath = document.createElement('p');
        filePath.className = 'filing-guide-path';
        filePath.textContent = `서식 원본 다운로드 경로: PDF ${guide.pdfPath} / HWPX ${guide.hwpxPath}`;
        wrap.appendChild(filePath);

        const notes = document.createElement('ul');
        notes.className = 'bullet-list filing-note-list';
        guide.notes.forEach((note) => {
            const item = document.createElement('li');
            item.textContent = note;
            notes.appendChild(item);
        });
        wrap.appendChild(notes);
        card.appendChild(wrap);

        guide.lines.forEach((line) => {
            const item = document.createElement('div');
            item.className = 'filing-line-item';

            const label = document.createElement('span');
            label.className = 'filing-line-label';
            label.textContent = line.label;

            const value = document.createElement('strong');
            value.className = 'filing-line-value';
            value.textContent = line.value;

            item.appendChild(label);
            item.appendChild(value);
            lineList.appendChild(item);
        });

        this.renderSimpleList(manualList, guide.manualFields, 'list');
    }

    buildFilingDraftText(guide) {
        const autoFilledLines = guide.lines
            .map((line) => `${line.label}: ${line.value}`)
            .join('\n');
        const manualLines = guide.manualFields
            .map((field) => `- ${field}`)
            .join('\n');

        return [
            `${guide.title} 자동입력 초안`,
            `대상 서식: 별지 제${guide.formCode}호`,
            '',
            '[자동 정리된 값]',
            autoFilledLines,
            '',
            '[직접 확인이 필요한 항목]',
            manualLines
        ].join('\n');
    }

    async copyTextToClipboard(text) {
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
                return true;
            }
        } catch (error) {
            // Fall back to the legacy copy path below when clipboard API is unavailable.
        }

        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', 'readonly');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();

        try {
            return document.execCommand('copy');
        } catch (error) {
            return false;
        } finally {
            document.body.removeChild(textarea);
        }
    }

    downloadTextFile(filename, contents) {
        const blob = new Blob([contents], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
    }

    showReview(reasons) {
        const reasonBox = document.getElementById('rejection-reasons');
        reasonBox.innerHTML = '';

        const list = document.createElement('ul');
        reasons.forEach((reason) => {
            const item = document.createElement('li');
            item.textContent = reason;
            list.appendChild(item);
        });

        reasonBox.appendChild(list);
        this.showScreen(this.reviewScreen);
    }

    reset() {
        this.inputs = this.getInitialInputs();
        this.lastResult = null;
        this.currentPhase = 1;
        this.currentStepInPhase = 0;
        this.updatePhaseIndicator();
        this.updateWizardMeta();
        this.showScreen(this.introScreen);
    }

    toDate(value) {
        if (!value) return null;

        const date = value instanceof Date ? value : new Date(`${value}T00:00:00`);
        return Number.isNaN(date.getTime()) ? null : date;
    }
}

window.app = new App();
