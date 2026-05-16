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
            filename += '_원본';
            alert('별지84의5 주식등 양도소득세 간편신고서는 현재 빈 원본 양식만 다운로드됩니다. (자동채움 기능 준비 중)');
        } else if (guide.formCode === '84') {
            updatedSectionXml = this.fillStandardSection(sectionXml, { inputs, result, calculator });
            filename += '_원본';
            alert('별지84 양도소득과세표준신고서는 현재 빈 원본 양식만 다운로드됩니다. (자동채움 기능 준비 중)');
        }

        const updatedBytes = this.textEncoder.encode(updatedSectionXml);
        sectionEntry.data = updatedBytes;
        sectionEntry.compressionMethod = 0;
        sectionEntry.compressedSize = updatedBytes.length;
        sectionEntry.uncompressedSize = updatedBytes.length;
        sectionEntry.crc32 = this.calculateCrc32(updatedBytes);

        this.downloadBinaryFile(`${filename}.hwpx`, archive.build());
    }

    fillSimpleStockSection(sectionXml, context) {
        // 우선 원본 그대로 반환 (추후 HWPX 내부 표 위치 파악 후 채움 로직 작성)
        return sectionXml;
    }

    fillStandardSection(sectionXml, context) {
        // 우선 원본 그대로 반환 (추후 HWPX 내부 표 위치 파악 후 채움 로직 작성)
        return sectionXml;
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

        this.setCellText(mainTable, 4, 3, inputs.sellerName || '');
        this.setCellText(mainTable, 11, 2, inputs.address || '');
        this.setCellText(mainTable, 13, 2, this.formatDate(inputs.sellDate, calculator));
        this.setCellText(mainTable, 13, 9, this.formatDate(inputs.buyDate, calculator));
        this.setCellText(mainTable, 11, 16, this.formatPeriod(inputs.holdingPeriod));
        this.setCellText(mainTable, 13, 16, inputs.type === 'house' ? this.formatPeriod(inputs.residencyPeriod) : '');
        this.setCellText(mainTable, 14, 16, result.isHighValue ? this.formatPeriod(inputs.residencyPeriod) : '');

        this.setCellText(calcTable, 0, 1, this.formatAmount(result.transferPrice));
        this.setCellText(calcTable, 1, 4, this.formatAmount(inputs.acqPrice_real));
        this.setCellText(calcTable, 2, 1, this.formatAmount(result.acquisitionCost));
        this.setCellText(calcTable, 3, 4, this.formatAmount(inputs.acqTax));
        this.setCellText(calcTable, 4, 4, this.formatAmount(inputs.acqBrokerFee));
        this.setCellText(calcTable, 4, 5, this.formatDate(inputs.acqBrokerPaidDate, calculator));
        this.setCellText(calcTable, 4, 6, inputs.acqBrokerBizNo || '');
        this.setCellText(calcTable, 6, 4, this.formatAmount(inputs.acqLegalFee));
        this.setCellText(calcTable, 6, 5, this.formatDate(inputs.acqLegalPaidDate, calculator));
        this.setCellText(calcTable, 6, 6, inputs.acqLegalBizNo || '');
        this.setCellText(calcTable, 7, 4, this.formatAmount(result.acquisitionCost));

        this.setCellText(calcTable, 5, 1, this.formatAmount(result.necessaryExpenses));
        this.setCellText(calcTable, 11, 4, this.formatAmount(inputs.capitalExpenditure));
        this.setCellText(calcTable, 11, 5, this.formatDate(inputs.capitalExpenditurePaidDate, calculator));
        this.setCellText(calcTable, 11, 6, inputs.capitalExpenditureBizNo || '');
        this.setCellText(calcTable, 14, 4, this.formatAmount(inputs.sellTaxFee));
        this.setCellText(calcTable, 16, 4, this.formatAmount(inputs.sellBrokerFee));
        this.setCellText(calcTable, 16, 5, this.formatDate(inputs.sellBrokerPaidDate, calculator));
        this.setCellText(calcTable, 16, 6, inputs.sellBrokerBizNo || '');
        this.setCellText(calcTable, 17, 4, this.formatAmount(result.necessaryExpenses));

        this.setCellText(calcTable, 7, 1, this.formatAmount(result.capitalGains));
        this.setCellText(calcTable, 10, 1, this.formatAmount(result.longTermDeduction));
        this.setCellText(calcTable, 13, 1, this.formatAmount(result.incomeAmount));
        this.setCellText(calcTable, 15, 1, this.formatAmount(result.basicDeductionTotal));
        this.setCellText(calcTable, 18, 1, this.formatAmount(result.taxBaseTotal));
        this.setCellText(calcTable, 22, 1, this.formatDisplayTaxRate(inputs, result, calculator));
        this.setCellText(calcTable, 24, 1, this.formatAmount(result.calculatedTax));
        this.setCellText(calcTable, 33, 1, this.formatAmount(result.totalTax));
        this.setCellText(calcTable, 34, 1, this.formatInstallmentAmount(result.totalTax));

        const serializer = new XMLSerializer();
        const serialized = serializer.serializeToString(documentNode);
        return serialized.startsWith('<?xml') ? serialized : `${xmlDeclaration}${serialized}`;
    }

    findTableByTexts(root, requiredTexts) {
        const tables = Array.from(root.getElementsByTagName('*')).filter((node) => node.localName === 'tbl');
        const normalizedTexts = requiredTexts.map((text) => this.normalizeText(text));

        return tables.find((table) => {
            const tableText = this.normalizeText(table.textContent);
            return normalizedTexts.every((text) => tableText.includes(text));
        }) || null;
    }

    setCellText(table, row, col, text) {
        const cell = this.findCell(table, row, col);
        if (!cell) {
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

    formatInstallmentAmount(totalTax) {
        if (!totalTax || totalTax <= 10000000) {
            return '';
        }

        if (totalTax <= 20000000) {
            return this.formatAmount(totalTax - 10000000);
        }

        return `${this.formatAmount(Math.floor(totalTax / 2))} 이내`;
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
