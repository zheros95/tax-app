class SimpleZipArchive {
    constructor(entries) {
        this.entries = entries;
    }

    static parse(bytes, decoder) {
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const eocdOffset = this.findEndOfCentralDirectory(view, bytes.length);
        const entryCount = view.getUint16(eocdOffset + 10, true);
        const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);
        const entries = [];

        let offset = centralDirectoryOffset;

        for (let index = 0; index < entryCount; index += 1) {
            if (view.getUint32(offset, true) !== 0x02014b50) {
                throw new Error('HWPX 중앙 디렉터리 형식을 읽지 못했습니다.');
            }

            const versionMadeBy = view.getUint16(offset + 4, true);
            const versionNeeded = view.getUint16(offset + 6, true);
            const flags = view.getUint16(offset + 8, true);
            const compressionMethod = view.getUint16(offset + 10, true);
            const modTime = view.getUint16(offset + 12, true);
            const modDate = view.getUint16(offset + 14, true);
            const crc32 = view.getUint32(offset + 16, true) >>> 0;
            const compressedSize = view.getUint32(offset + 20, true);
            const uncompressedSize = view.getUint32(offset + 24, true);
            const fileNameLength = view.getUint16(offset + 28, true);
            const centralExtraLength = view.getUint16(offset + 30, true);
            const commentLength = view.getUint16(offset + 32, true);
            const diskNumberStart = view.getUint16(offset + 34, true);
            const internalAttributes = view.getUint16(offset + 36, true);
            const externalAttributes = view.getUint32(offset + 38, true);
            const localHeaderOffset = view.getUint32(offset + 42, true);

            const fileNameStart = offset + 46;
            const centralExtraStart = fileNameStart + fileNameLength;
            const commentStart = centralExtraStart + centralExtraLength;

            const fileNameBytes = bytes.slice(fileNameStart, fileNameStart + fileNameLength);
            const centralExtra = bytes.slice(centralExtraStart, centralExtraStart + centralExtraLength);
            const commentBytes = bytes.slice(commentStart, commentStart + commentLength);
            const name = decoder.decode(fileNameBytes);

            if (view.getUint32(localHeaderOffset, true) !== 0x04034b50) {
                throw new Error(`HWPX 로컬 헤더를 읽지 못했습니다: ${name}`);
            }

            const localFileNameLength = view.getUint16(localHeaderOffset + 26, true);
            const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
            const localExtraStart = localHeaderOffset + 30 + localFileNameLength;
            const dataStart = localExtraStart + localExtraLength;

            entries.push({
                name,
                fileNameBytes,
                centralExtra,
                commentBytes,
                localExtra: bytes.slice(localExtraStart, localExtraStart + localExtraLength),
                versionMadeBy,
                versionNeeded,
                flags,
                compressionMethod,
                modTime,
                modDate,
                crc32,
                compressedSize,
                uncompressedSize,
                diskNumberStart,
                internalAttributes,
                externalAttributes,
                data: bytes.slice(dataStart, dataStart + compressedSize)
            });

            offset = commentStart + commentLength;
        }

        return new SimpleZipArchive(entries);
    }

    static findEndOfCentralDirectory(view, byteLength) {
        const minimumOffset = Math.max(0, byteLength - 0xffff - 22);

        for (let offset = byteLength - 22; offset >= minimumOffset; offset -= 1) {
            if (view.getUint32(offset, true) === 0x06054b50) {
                return offset;
            }
        }

        throw new Error('HWPX 끝 레코드를 찾지 못했습니다.');
    }

    getEntry(name) {
        return this.entries.find((entry) => entry.name === name) || null;
    }

    build() {
        const localParts = [];
        let offset = 0;

        this.entries.forEach((entry) => {
            entry.localHeaderOffset = offset;

            const localHeader = new Uint8Array(30);
            const localView = new DataView(localHeader.buffer);
            const normalizedFlags = entry.flags & ~0x0008;

            localView.setUint32(0, 0x04034b50, true);
            localView.setUint16(4, entry.versionNeeded, true);
            localView.setUint16(6, normalizedFlags, true);
            localView.setUint16(8, entry.compressionMethod, true);
            localView.setUint16(10, entry.modTime, true);
            localView.setUint16(12, entry.modDate, true);
            localView.setUint32(14, entry.crc32 >>> 0, true);
            localView.setUint32(18, entry.compressedSize, true);
            localView.setUint32(22, entry.uncompressedSize, true);
            localView.setUint16(26, entry.fileNameBytes.length, true);
            localView.setUint16(28, entry.localExtra.length, true);

            localParts.push(localHeader, entry.fileNameBytes, entry.localExtra, entry.data);
            offset += localHeader.length + entry.fileNameBytes.length + entry.localExtra.length + entry.data.length;
        });

        const centralOffset = offset;
        const centralParts = [];

        this.entries.forEach((entry) => {
            const centralHeader = new Uint8Array(46);
            const centralView = new DataView(centralHeader.buffer);
            const normalizedFlags = entry.flags & ~0x0008;

            centralView.setUint32(0, 0x02014b50, true);
            centralView.setUint16(4, entry.versionMadeBy, true);
            centralView.setUint16(6, entry.versionNeeded, true);
            centralView.setUint16(8, normalizedFlags, true);
            centralView.setUint16(10, entry.compressionMethod, true);
            centralView.setUint16(12, entry.modTime, true);
            centralView.setUint16(14, entry.modDate, true);
            centralView.setUint32(16, entry.crc32 >>> 0, true);
            centralView.setUint32(20, entry.compressedSize, true);
            centralView.setUint32(24, entry.uncompressedSize, true);
            centralView.setUint16(28, entry.fileNameBytes.length, true);
            centralView.setUint16(30, entry.centralExtra.length, true);
            centralView.setUint16(32, entry.commentBytes.length, true);
            centralView.setUint16(34, entry.diskNumberStart, true);
            centralView.setUint16(36, entry.internalAttributes, true);
            centralView.setUint32(38, entry.externalAttributes, true);
            centralView.setUint32(42, entry.localHeaderOffset, true);

            centralParts.push(centralHeader, entry.fileNameBytes, entry.centralExtra, entry.commentBytes);
            offset += centralHeader.length + entry.fileNameBytes.length + entry.centralExtra.length + entry.commentBytes.length;
        });

        const centralSize = offset - centralOffset;
        const eocd = new Uint8Array(22);
        const eocdView = new DataView(eocd.buffer);

        eocdView.setUint32(0, 0x06054b50, true);
        eocdView.setUint16(4, 0, true);
        eocdView.setUint16(6, 0, true);
        eocdView.setUint16(8, this.entries.length, true);
        eocdView.setUint16(10, this.entries.length, true);
        eocdView.setUint32(12, centralSize, true);
        eocdView.setUint32(16, centralOffset, true);
        eocdView.setUint16(20, 0, true);

        return SimpleZipArchive.concat([...localParts, ...centralParts, eocd]);
    }

    static concat(parts) {
        const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
        const merged = new Uint8Array(totalLength);
        let offset = 0;

        parts.forEach((part) => {
            merged.set(part, offset);
            offset += part.length;
        });

        return merged;
    }
}

class HWPXFormFiller {
    constructor() {
        this.textEncoder = new TextEncoder();
        this.textDecoder = new TextDecoder('utf-8');
        this.crcTable = this.buildCrcTable();
        this.fileInput = null;
    }

    canAutoFill(guide) {
        return Boolean(guide && ['84', '84의4', '84의5'].includes(guide.formCode) && guide.hwpxPath);
    }

    isEnvironmentSupported() {
        return (
            typeof DOMParser !== 'undefined'
            && typeof XMLSerializer !== 'undefined'
            && typeof DecompressionStream !== 'undefined'
        );
    }

    getAvailabilityNote(guide) {
        if (!this.canAutoFill(guide)) {
            return '현재 이 서식은 HWPX 다운로드를 지원하지 않습니다.';
        }

        if (!this.isEnvironmentSupported()) {
            return '이 브라우저에서는 HWPX 서식 다운로드를 지원하지 않습니다.';
        }

        return '';
    }

    async downloadAutoFilledForm({ guide, inputs, result, calculator }) {
        if (!this.canAutoFill(guide)) {
            throw new Error('지원하지 않는 서식입니다.');
        }

        if (!this.isEnvironmentSupported()) {
            throw new Error('이 브라우저에서는 HWPX 서식 다운로드가 지원되지 않습니다.');
        }

        this.fillStats = { filled: 0, missed: [] };

        const source = await this.resolveArchiveSource(guide);
        const archive = SimpleZipArchive.parse(new Uint8Array(source.arrayBuffer), this.textDecoder);
        const sectionEntry = archive.getEntry('Contents/section0.xml');

        if (!sectionEntry) {
            throw new Error('서식 내부 section0.xml을 찾지 못했습니다.');
        }

        const sectionXml = await this.readZipEntryText(sectionEntry);
        let updatedSectionXml = sectionXml;
        let filename = (guide.hwpxDownloadName || '양도소득세_서식.hwpx')
            .replace(/\.hwpx$/i, '')
            .replace(/\s+/g, '_');

        if (guide.formCode === '84의4') {
            updatedSectionXml = this.fillSimpleRealEstateSection(sectionXml, { inputs, result, calculator });
            filename += '_자동채움';
        } else if (guide.formCode === '84의5') {
            updatedSectionXml = this.fillSimpleStockSection(sectionXml, { inputs, result, calculator });
            filename += '_자동채움';
        } else if (guide.formCode === '84') {
            updatedSectionXml = this.fillStandardSection(sectionXml, { inputs, result, calculator });
            filename += '_자동채움';
            // 부표1(section2) 도 채움
            const section2Entry = archive.getEntry('Contents/section2.xml');
            if (section2Entry) {
                const section2Xml = await this.readZipEntryText(section2Entry);
                const updatedSection2Xml = this.fillStandardAppendixSection(section2Xml, { inputs, result, calculator });
                const updated2Bytes = this.textEncoder.encode(updatedSection2Xml);
                section2Entry.data = updated2Bytes;
                section2Entry.compressionMethod = 0;
                section2Entry.compressedSize = updated2Bytes.length;
                section2Entry.uncompressedSize = updated2Bytes.length;
                section2Entry.crc32 = this.calculateCrc32(updated2Bytes);
            }
        }

        const updatedBytes = this.textEncoder.encode(updatedSectionXml);
        sectionEntry.data = updatedBytes;
        sectionEntry.compressionMethod = 0;
        sectionEntry.compressedSize = updatedBytes.length;
        sectionEntry.uncompressedSize = updatedBytes.length;
        sectionEntry.crc32 = this.calculateCrc32(updatedBytes);

        this.downloadBinaryFile(`${filename}.hwpx`, archive.build());

        return { filename: `${filename}.hwpx`, ...this.fillStats };
    }

    fillSimpleStockSection(sectionXml, context) {
        const xmlDeclarationMatch = sectionXml.match(/^<\?xml[^>]+\?>\s*/);
        const xmlDeclaration = xmlDeclarationMatch?.[0] || '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>';
        const parser = new DOMParser();
        const documentNode = parser.parseFromString(sectionXml, 'application/xml');

        if (documentNode.getElementsByTagName('parsererror').length > 0) {
            throw new Error('서식 XML을 해석하지 못했습니다.');
        }

        const mainTable = this.findTableByTexts(documentNode, ['양도인', '양도가액', '필요경비']);

        if (!mainTable) {
            throw new Error('자동채움 대상 서식 위치를 찾지 못했습니다.');
        }

        const { inputs, result, calculator } = context;
        const totalNecessaryExpenses = Math.floor((result.acquisitionCost || 0) + (result.necessaryExpenses || 0));

        // Section 1: 양도인 정보
        this.setCellText(mainTable, 4, 11, inputs.sellerName || '');

        // Section 3: 주식 상세내역 (주식1 = row 14)
        this.setCellText(mainTable, 14, 32, this.formatDate(inputs.sellDate, calculator));
        this.setCellText(mainTable, 14, 44, this.formatDate(inputs.buyDate, calculator));

        const nationalTax = this.getNationalTax(result);

        // Section 4: 양도소득금액 계산 (합계=row20, 주식1=row21)
        for (const row of [20, 21]) {
            this.setCellText(mainTable, row, 8, this.formatAmount(result.transferPrice));       // ⑪ 양도가액
            this.setCellText(mainTable, row, 19, this.formatAmount(result.acquisitionCost));    // ⑬ 취득가액
            this.setCellText(mainTable, row, 23, this.formatAmount(result.necessaryExpenses));  // ⑭ 기타 필요경비
            this.setCellText(mainTable, row, 28, this.formatAmount(totalNecessaryExpenses));    // ⑮ 합계(⑬+⑭)
            this.setCellText(mainTable, row, 35, this.formatAmount(result.capitalGains));       // ⑯ 양도소득금액
            this.setCellText(mainTable, row, 41, this.formatAmount(result.incomeAmount));       // ⑰ 과세대상
        }

        // Section 5: 세액 계산 (헤더=row25, 값=row26)
        this.setCellText(mainTable, 26, 0, this.formatAmount(result.basicDeductionTotal));      // ⑲ 양도소득기본공제
        this.setCellText(mainTable, 26, 4, this.formatAmount(result.taxBaseTotal));             // ⑳ 과세표준
        this.setCellText(mainTable, 26, 12, this.formatDisplayTaxRate(inputs, result, calculator)); // 세율
        this.setCellText(mainTable, 26, 15, this.formatAmount(result.calculatedTax));           // 산출세액
        if (result.filingPenalty && result.filingPenalty.total > 0) {
            this.setCellText(mainTable, 26, 25, this.formatAmount(result.filingPenalty.total)); // 가산세
        }
        this.setCellText(mainTable, 26, 37, this.formatAmount(nationalTax));                    // 납부할 세액(국세)
        this.setCellText(mainTable, 26, 51, this.formatAmount(nationalTax));                    // 납부세액(분납 없음 기준)

        // Section 6: 필요경비 상세내역 (합계=row31, 주식1=row32)
        for (const row of [31, 32]) {
            this.setCellText(mainTable, row, 3, this.formatAmount(result.acquisitionCost));     // 6-1 취득가액 합계
            this.setCellText(mainTable, row, 6, this.formatAmount(result.acquisitionCost));     // 매입가액
            this.setCellText(mainTable, row, 26, this.formatAmount(result.necessaryExpenses));  // 6-2 기타 필요경비 합계
        }

        // Section 7: 가산세 상세내역 (합계=row31)
        if (result.filingPenalty && result.filingPenalty.total > 0) {
            this.setCellText(mainTable, 31, 40, this.formatAmount(result.filingPenalty.total));      // 합계
            this.setCellText(mainTable, 31, 47, this.formatAmount(result.filingPenalty.noFiling));   // 무신고
            this.setCellText(mainTable, 31, 49, this.formatAmount(result.filingPenalty.latePayment)); // 납부지연
        }

        const serializer = new XMLSerializer();
        const serialized = serializer.serializeToString(documentNode);
        return serialized.startsWith('<?xml') ? serialized : `${xmlDeclaration}${serialized}`;
    }

    fillStandardSection(sectionXml, context) {
        const xmlDeclarationMatch = sectionXml.match(/^<\?xml[^>]+\?>\s*/);
        const xmlDeclaration = xmlDeclarationMatch?.[0] || '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>';
        const parser = new DOMParser();
        const documentNode = parser.parseFromString(sectionXml, 'application/xml');

        if (documentNode.getElementsByTagName('parsererror').length > 0) {
            throw new Error('서식 XML을 해석하지 못했습니다.');
        }

        const mainTable = this.findTableByTexts(documentNode, ['성명', '주민등록번호', '납부할 세액']);

        if (!mainTable) {
            throw new Error('자동채움 대상 서식 위치를 찾지 못했습니다.');
        }

        const { inputs, result, calculator } = context;

        // Section I: 신고인(양도인) 정보
        this.setCellText(mainTable, 5, 5, inputs.sellerName || '');
        this.setCellText(mainTable, 7, 5, inputs.address || '');

        // Section II: 양수인 - 양도자산 소재지
        this.setCellText(mainTable, 10, 11, inputs.address || '');

        // Section III: 양도소득과세표준 및 세액 계산 (합계 col=5, 국내분 col=10)
        const nationalTax = this.getNationalTax(result);
        const surchargeTotal = this.getSurchargeTotal(result);

        // row 13: ④ 양도소득금액
        this.setCellText(mainTable, 13, 5, this.formatAmount(result.incomeAmount));
        this.setCellText(mainTable, 13, 10, this.formatAmount(result.incomeAmount));
        // row 16: ⑦ 양도소득기본공제
        this.setCellText(mainTable, 16, 5, this.formatAmount(result.basicDeductionTotal));
        this.setCellText(mainTable, 16, 10, this.formatAmount(result.basicDeductionTotal));
        // row 17: ⑧ 과세표준 = (④+⑤-⑥-⑦)
        this.setCellText(mainTable, 17, 5, this.formatAmount(result.taxBaseTotal));
        this.setCellText(mainTable, 17, 10, this.formatAmount(result.taxBaseTotal));
        // row 18: ⑨ 세율
        this.setCellText(mainTable, 18, 5, this.formatDisplayTaxRate(inputs, result, calculator));
        this.setCellText(mainTable, 18, 10, this.formatDisplayTaxRate(inputs, result, calculator));
        // row 19: ⑩ 산출세액
        this.setCellText(mainTable, 19, 5, this.formatAmount(result.calculatedTax));
        this.setCellText(mainTable, 19, 10, this.formatAmount(result.calculatedTax));
        // row 20: ⑪ 감면세액 (8년 자경농지 감면 등)
        if (result.taxReduction && result.taxReduction.amount > 0) {
            this.setCellText(mainTable, 20, 5, this.formatAmount(result.taxReduction.amount));
            this.setCellText(mainTable, 20, 10, this.formatAmount(result.taxReduction.amount));
        }
        // rows 25~28: ⑯ 가산세 (무신고 / 납부지연 / 기장불성실 등 / 계)
        if (result.filingPenalty && result.filingPenalty.total > 0) {
            this.setCellText(mainTable, 25, 5, this.formatAmount(result.filingPenalty.noFiling));
            this.setCellText(mainTable, 25, 10, this.formatAmount(result.filingPenalty.noFiling));
            this.setCellText(mainTable, 26, 5, this.formatAmount(result.filingPenalty.latePayment));
            this.setCellText(mainTable, 26, 10, this.formatAmount(result.filingPenalty.latePayment));
        }
        if (result.conversionSurcharge > 0) {
            this.setCellText(mainTable, 27, 5, this.formatAmount(result.conversionSurcharge));
            this.setCellText(mainTable, 27, 10, this.formatAmount(result.conversionSurcharge));
        }
        if (surchargeTotal > 0) {
            this.setCellText(mainTable, 28, 5, this.formatAmount(surchargeTotal));
            this.setCellText(mainTable, 28, 10, this.formatAmount(surchargeTotal));
        }
        // row 30: ⑱ 납부할 세액 (⑩-⑪-…+⑯-⑰) — 국세분(지방소득세 제외)
        this.setCellText(mainTable, 30, 5, this.formatAmount(nationalTax));
        this.setCellText(mainTable, 30, 10, this.formatAmount(nationalTax));
        // row 31: ⑲ 분납(물납)할 세액 — 분납은 선택사항이라 비워 둔다
        // row 32: ⑳ 납부세액 (분납하지 않는 경우 ⑱과 동일)
        this.setCellText(mainTable, 32, 5, this.formatAmount(nationalTax));
        this.setCellText(mainTable, 32, 10, this.formatAmount(nationalTax));

        const serializer = new XMLSerializer();
        const serialized = serializer.serializeToString(documentNode);
        return serialized.startsWith('<?xml') ? serialized : `${xmlDeclaration}${serialized}`;
    }

    fillStandardAppendixSection(sectionXml, context) {
        // 별지84 부표1: 양도소득금액 계산명세서 (section2.xml, 첫 번째 표)
        const xmlDeclarationMatch = sectionXml.match(/^<\?xml[^>]+\?>\s*/);
        const xmlDeclaration = xmlDeclarationMatch?.[0] || '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>';
        const parser = new DOMParser();
        const documentNode = parser.parseFromString(sectionXml, 'application/xml');

        if (documentNode.getElementsByTagName('parsererror').length > 0) {
            return sectionXml;
        }

        const calcTable = this.findTableByTexts(documentNode, ['양도소득금액 계산명세서', '양도가액', '양도차익']);

        if (!calcTable) {
            return sectionXml;
        }

        const { inputs, result, calculator } = context;
        const taxableGains = result.taxableGains ?? result.capitalGains;
        const nonTaxableGains = Math.max(0, (result.capitalGains || 0) - (taxableGains || 0));

        // 거래일 정보 (첫 번째 거래 슬롯 col=11, 합계 col=8)
        this.setCellText(calcTable, 10, 11, this.formatDate(inputs.sellDate, calculator));
        this.setCellText(calcTable, 11, 11, this.formatDate(inputs.buyDate, calculator));

        // 1세대1주택 비과세 대상 — ⑨ 보유기간 / ⑩ 거주기간
        this.setCellText(calcTable, 18, 11, this.formatPeriod(inputs.holdingPeriod));
        if (inputs.type === 'house') {
            this.setCellText(calcTable, 19, 11, this.formatPeriod(inputs.residencyPeriod));
        }

        // 양도소득금액 계산 - 합계(col=8)와 첫 번째 거래(col=11)
        for (const col of [8, 11]) {
            this.setCellText(calcTable, 22, col, this.formatAmount(result.transferPrice));
            this.setCellText(calcTable, 23, col, this.formatAmount(result.acquisitionCost));
            this.setCellText(calcTable, 26, col, this.formatAmount(result.necessaryExpenses));
            this.setCellText(calcTable, 27, col, this.formatAmount(result.capitalGains));
            if (nonTaxableGains > 0) {
                this.setCellText(calcTable, 28, col, this.formatAmount(nonTaxableGains));
            }
            this.setCellText(calcTable, 29, col, this.formatAmount(taxableGains));
            this.setCellText(calcTable, 30, col, this.formatAmount(result.longTermDeduction));
            this.setCellText(calcTable, 32, col, this.formatAmount(result.incomeAmount));
        }
        // 취득가액 종류 (첫 번째 거래 슬롯)
        this.setCellText(calcTable, 24, 11, inputs.acquisitionMethod === 'estimated' ? '환산취득가액' : '실지거래가액');
        // ⑲ 세액감면대상 소득금액 (8년 자경 등 감면 적용 시)
        if (result.taxReduction && result.taxReduction.amount > 0) {
            this.setCellText(calcTable, 33, 8, this.formatAmount(result.incomeAmount));
            this.setCellText(calcTable, 33, 11, this.formatAmount(result.incomeAmount));
        }

        const serializer = new XMLSerializer();
        const serialized = serializer.serializeToString(documentNode);
        return serialized.startsWith('<?xml') ? serialized : `${xmlDeclaration}${serialized}`;
    }

    async resolveArchiveSource(guide) {
        try {
            const response = await fetch(encodeURI(guide.hwpxPath));
            if (!response.ok) {
                throw new Error('원본 HWPX를 불러오지 못했습니다.');
            }

            return {
                arrayBuffer: await response.arrayBuffer()
            };
        } catch (error) {
            const file = await this.requestArchiveFile();
            return {
                arrayBuffer: await file.arrayBuffer()
            };
        }
    }

    requestArchiveFile() {
        if (!this.fileInput) {
            this.fileInput = document.createElement('input');
            this.fileInput.type = 'file';
            this.fileInput.accept = '.hwpx,application/zip,application/octet-stream';
            this.fileInput.style.display = 'none';
            document.body.appendChild(this.fileInput);
        }

        const input = this.fileInput;

        return new Promise((resolve, reject) => {
            const onChange = () => {
                const [file] = Array.from(input.files || []);
                input.value = '';

                if (!file) {
                    reject(new Error('원본 HWPX 파일이 선택되지 않았습니다.'));
                    return;
                }

                resolve(file);
            };

            input.addEventListener('change', onChange, { once: true });
            input.click();
        });
    }

    async readZipEntryText(entry) {
        if (entry.compressionMethod === 0) {
            return this.textDecoder.decode(entry.data);
        }

        if (entry.compressionMethod !== 8) {
            throw new Error(`지원하지 않는 압축 방식입니다: ${entry.name}`);
        }

        const stream = new Blob([entry.data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        const decompressed = await new Response(stream).arrayBuffer();
        return this.textDecoder.decode(decompressed);
    }

    fillSimpleRealEstateSection(sectionXml, context) {
        const xmlDeclarationMatch = sectionXml.match(/^<\?xml[^>]+\?>\s*/);
        const xmlDeclaration = xmlDeclarationMatch?.[0] || '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>';
        const parser = new DOMParser();
        const documentNode = parser.parseFromString(sectionXml, 'application/xml');

        if (documentNode.getElementsByTagName('parsererror').length > 0) {
            throw new Error('서식 XML을 해석하지 못했습니다.');
        }

        const mainTable = this.findTableByTexts(documentNode, ['① 양도인', '⑤ 양도일', '⑦ 보유기간']);
        const calcTable = this.findTableByTexts(documentNode, ['⑩양도가액', '⑪ 취득가액', '⑭ 장기보유']);

        if (!mainTable || !calcTable) {
            throw new Error('자동채움 대상 서식 위치를 찾지 못했습니다.');
        }

        const { inputs, result, calculator } = context;

        // ── 인적사항·거래일 (바깥 정보 표) ──
        this.setCellText(mainTable, 4, 3, inputs.sellerName || '');
        this.setCellText(mainTable, 11, 2, inputs.address || '');
        this.setCellText(mainTable, 13, 2, this.formatDate(inputs.sellDate, calculator));
        this.setCellText(mainTable, 13, 9, this.formatDate(inputs.buyDate, calculator));
        this.setCellText(mainTable, 11, 16, this.formatPeriod(inputs.holdingPeriod));
        this.setCellText(mainTable, 13, 16, inputs.type === 'house' ? this.formatPeriod(inputs.residencyPeriod) : '');
        this.setCellText(mainTable, 14, 16, result.isHighValue ? this.formatPeriod(inputs.residencyPeriod) : '');

        // ── 왼쪽 세액 흐름 (중첩 계산표: 라벨 c0, 값 c1) — 2025.3.21 개정 서식 기준 ──
        const nationalTax = this.getNationalTax(result);
        const surchargeTotal = this.getSurchargeTotal(result);

        this.setCellText(calcTable, 0, 1, this.formatAmount(result.transferPrice));            // ⑩ 양도가액
        this.setCellText(calcTable, 2, 1, this.formatAmount(result.acquisitionCost));          // ⑪ 취득가액
        this.setCellText(calcTable, 5, 1, this.formatAmount(result.necessaryExpenses));        // ⑫ 필요경비
        this.setCellText(calcTable, 7, 1, this.formatAmount(result.capitalGains));             // ⑬ 양도차익
        this.setCellText(calcTable, 10, 1, this.formatAmount(result.longTermDeduction));       // ⑭ 장기보유특별공제
        this.setCellText(calcTable, 13, 1, this.formatAmount(result.incomeAmount));            // ⑮ 양도소득금액
        this.setCellText(calcTable, 15, 1, this.formatAmount(result.basicDeductionTotal));     // ⑯ 기본공제
        this.setCellText(calcTable, 18, 1, this.formatAmount(result.taxBaseTotal));            // ⑰ 과세표준
        this.setCellText(calcTable, 22, 1, this.formatDisplayTaxRate(inputs, result, calculator)); // ⑱ 세율
        this.setCellText(calcTable, 24, 1, this.formatAmount(result.calculatedTax));           // ⑲ 산출세액
        if (surchargeTotal > 0) {
            this.setCellText(calcTable, 32, 1, this.formatAmount(surchargeTotal));             // ㉒ 가산세(오른쪽 ㉘합계)
        }
        this.setCellText(calcTable, 33, 1, this.formatAmount(nationalTax));                    // ㉓ 납부할세액(⑲-⑳-㉑+㉒)
        this.setCellText(calcTable, 35, 1, this.formatAmount(nationalTax));                    // ㉕ 납부세액(분납 없음 기준)

        // ── 오른쪽 ⑪ 취득가액 상세 ──
        this.setCellText(calcTable, 1, 4, this.formatAmount(inputs.acqPrice_real));            // 매입금액
        this.setCellText(calcTable, 3, 4, this.formatAmount(inputs.acqTax));                   // 취득ㆍ등록세
        this.setCellText(calcTable, 4, 4, this.formatAmount(inputs.acqBrokerFee));             // 매입부대비용
        this.setCellText(calcTable, 4, 5, this.formatDate(inputs.acqBrokerPaidDate, calculator));
        this.setCellText(calcTable, 4, 6, inputs.acqBrokerBizNo || '');
        this.setCellText(calcTable, 6, 4, this.formatAmount(inputs.acqLegalFee));              // 추가 경비(법무 등)
        this.setCellText(calcTable, 6, 5, this.formatDate(inputs.acqLegalPaidDate, calculator));
        this.setCellText(calcTable, 6, 6, inputs.acqLegalBizNo || '');
        this.setCellText(calcTable, 8, 4, this.formatAmount(result.acquisitionCost));          // 합계 → 왼쪽 ⑪

        // ── 오른쪽 ⑫ 필요경비 상세 ──
        this.setCellText(calcTable, 11, 4, this.formatAmount(inputs.capitalExpenditure));      // 자본적지출
        this.setCellText(calcTable, 11, 5, this.formatDate(inputs.capitalExpenditurePaidDate, calculator));
        this.setCellText(calcTable, 11, 6, inputs.capitalExpenditureBizNo || '');
        this.setCellText(calcTable, 14, 4, this.formatAmount(inputs.sellTaxFee));              // 기타비용
        this.setCellText(calcTable, 16, 4, this.formatAmount(inputs.sellBrokerFee));           // 중개수수료 등
        this.setCellText(calcTable, 16, 5, this.formatDate(inputs.sellBrokerPaidDate, calculator));
        this.setCellText(calcTable, 16, 6, inputs.sellBrokerBizNo || '');
        this.setCellText(calcTable, 17, 4, this.formatAmount(result.necessaryExpenses));       // 합계 → 왼쪽 ⑫

        // ── 오른쪽 가산세 상세 ──
        if (result.filingPenalty && result.filingPenalty.total > 0) {
            this.setCellFirst(calcTable, [[20, 4], [21, 4]], this.formatAmount(result.filingPenalty.noFiling)); // 무(과소)신고
            this.setCellText(calcTable, 23, 4, this.formatAmount(result.filingPenalty.latePayment));            // 납부지연
        }
        if (result.conversionSurcharge > 0) {
            this.setCellText(calcTable, 25, 4, this.formatAmount(result.conversionSurcharge)); // 기장불성실 등(환산취득가액 가산세)
        }
        if (surchargeTotal > 0) {
            this.setCellText(calcTable, 26, 4, this.formatAmount(surchargeTotal));             // ㉘ 합계 → 왼쪽 ㉒
        }

        const serializer = new XMLSerializer();
        const serialized = serializer.serializeToString(documentNode);
        return serialized.startsWith('<?xml') ? serialized : `${xmlDeclaration}${serialized}`;
    }

    findTableByTexts(root, requiredTexts) {
        const tables = Array.from(root.getElementsByTagName('*')).filter((node) => node.localName === 'tbl');
        const normalizedTexts = requiredTexts.map((text) => this.normalizeText(text));

        // 서식에 표가 중첩되어 있어(바깥 레이아웃 표가 안쪽 표 텍스트를 모두 포함)
        // 일치하는 표 중 내용이 가장 짧은 안쪽 표를 선택해야 셀 주소가 맞는다.
        const matches = tables
            .map((table) => ({ table, text: this.normalizeText(table.textContent) }))
            .filter(({ text }) => normalizedTexts.every((required) => text.includes(required)))
            .sort((a, b) => a.text.length - b.text.length);

        return matches.length > 0 ? matches[0].table : null;
    }

    getNationalTax(result) {
        if (typeof result.nationalTax === 'number') {
            return result.nationalTax;
        }
        return (result.decisionTax ?? result.calculatedTax ?? 0) + (result.conversionSurcharge || 0);
    }

    getSurchargeTotal(result) {
        return (result.conversionSurcharge || 0) + ((result.filingPenalty && result.filingPenalty.total) || 0);
    }

    // 서식 개정으로 셀 주소가 한 칸씩 다를 수 있는 곳은 후보 주소를 순서대로 시도
    setCellFirst(table, addresses, text) {
        if (text === null || text === undefined || text === '') {
            return;
        }
        for (const [row, col] of addresses) {
            if (this.findCell(table, row, col)) {
                this.setCellText(table, row, col, text);
                return;
            }
        }
        if (this.fillStats) {
            this.fillStats.missed.push(`r${addresses[0][0]}c${addresses[0][1]}`);
        }
    }

    setCellText(table, row, col, text) {
        if (text === null || text === undefined || text === '') {
            return; // 값이 없으면 서식의 안내 문구를 그대로 둔다
        }

        const cell = this.findCell(table, row, col);
        if (!cell) {
            if (this.fillStats) {
                this.fillStats.missed.push(`r${row}c${col}`);
            }
            return;
        }

        const subList = this.getDirectChildren(cell, 'subList')[0];
        if (!subList) {
            return;
        }

        const templateParagraph = this.getDirectChildren(subList, 'p')[0];
        if (!templateParagraph) {
            return;
        }

        const runTemplate = this.getDirectChildren(templateParagraph, 'run')[0];
        const lineSegTemplate = this.getDirectChildren(templateParagraph, 'linesegarray')[0];
        const namespaceUri = templateParagraph.namespaceURI;
        const documentNode = templateParagraph.ownerDocument;

        const paragraph = templateParagraph.cloneNode(false);
        const run = runTemplate ? runTemplate.cloneNode(false) : documentNode.createElementNS(namespaceUri, 'hp:run');
        if (!run.getAttribute('charPrIDRef')) {
            run.setAttribute('charPrIDRef', '30');
        }

        const textNode = documentNode.createElementNS(namespaceUri, 'hp:t');
        textNode.textContent = text || '';
        run.appendChild(textNode);

        this.removeChildren(subList);
        paragraph.appendChild(run);

        if (lineSegTemplate) {
            paragraph.appendChild(lineSegTemplate.cloneNode(true));
        }

        subList.appendChild(paragraph);

        if (this.fillStats) {
            this.fillStats.filled += 1;
        }
    }

    findCell(table, row, col) {
        const rows = this.getDirectChildren(table, 'tr');

        for (const rowNode of rows) {
            const cells = this.getDirectChildren(rowNode, 'tc');

            for (const cell of cells) {
                const address = this.getDirectChildren(cell, 'cellAddr')[0];
                if (!address) {
                    continue;
                }

                const currentRow = Number(address.getAttribute('rowAddr'));
                const currentCol = Number(address.getAttribute('colAddr'));
                if (currentRow === row && currentCol === col) {
                    return cell;
                }
            }
        }

        return null;
    }

    getDirectChildren(node, localName) {
        return Array.from(node.childNodes || []).filter(
            (child) => child.nodeType === Node.ELEMENT_NODE && child.localName === localName
        );
    }

    removeChildren(node) {
        while (node.firstChild) {
            node.removeChild(node.firstChild);
        }
    }

    formatAmount(value) {
        if (value === null || value === undefined || value === '') {
            return '';
        }

        return Math.floor(Number(value || 0)).toLocaleString('ko-KR');
    }

    formatDate(dateLike, calculator) {
        if (!dateLike) {
            return '';
        }

        const formatted = calculator?.formatDate ? calculator.formatDate(dateLike) : '';
        return formatted === '-' ? '' : formatted;
    }

    formatPeriod(value) {
        if (!value && value !== 0) {
            return '';
        }

        return `${Number(value).toFixed(1)}년`;
    }

    formatDisplayTaxRate(inputs, result, calculator) {
        if (calculator?.getDisplayTaxRate) {
            return calculator.getDisplayTaxRate(inputs, result);
        }

        return result.isNonTaxable ? '비과세' : `${Math.round((result.taxRate || 0) * 100)}%`;
    }

    normalizeText(text) {
        return (text || '').replace(/\s+/g, '');
    }

    downloadBinaryFile(filename, bytes) {
        const blob = new Blob([bytes], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
    }

    buildCrcTable() {
        const table = new Uint32Array(256);

        for (let index = 0; index < 256; index += 1) {
            let current = index;

            for (let bit = 0; bit < 8; bit += 1) {
                current = (current & 1) ? (0xedb88320 ^ (current >>> 1)) : (current >>> 1);
            }

            table[index] = current >>> 0;
        }

        return table;
    }

    calculateCrc32(bytes) {
        let crc = 0xffffffff;

        for (const byte of bytes) {
            crc = this.crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
        }

        return (crc ^ 0xffffffff) >>> 0;
    }
}
