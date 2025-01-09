import { CodeBuilder, SourceAnnotation, SourceAnnotationType, SourceLocation } from 'decompiler';

export type AddressRange = {
    startAddress: number;
    endAddress: number;
};

export type PixelCoord = {
    x: number;
    y: number;
};

export type CharSize = {
    width: number;
    height: number;
};

export function lineSelectionMapToTextRange(map: Map<number, Set<number>>): SourceLocation[] {
    const textRanges: SourceLocation[] = [];

    for (const [line, selectedCols] of map.entries()) {
        const sortedCols = Array.from(selectedCols.values()).sort((a, b) => a - b);
        let startCol = sortedCols[0];
        let lastCol = sortedCols[0];

        if (sortedCols.length === 1) {
            textRanges.push({
                startLine: line,
                endLine: line,
                startColumn: startCol,
                endColumn: lastCol,

                // Don't care about these
                startOffset: 0,
                endOffset: 0
            });

            continue;
        }

        for (let i = 1; i < sortedCols.length; i++) {
            const curCol = sortedCols[i];

            if (curCol !== lastCol + 1) {
                textRanges.push({
                    startLine: line,
                    endLine: line,
                    startColumn: startCol,
                    endColumn: lastCol,

                    // Don't care about these
                    startOffset: 0,
                    endOffset: 0
                });

                startCol = curCol;
                lastCol = curCol;
            }

            lastCol = curCol;
        }

        if (startCol !== lastCol) {
            textRanges.push({
                startLine: line,
                endLine: line,
                startColumn: startCol,
                endColumn: lastCol,

                // Don't care about these
                startOffset: 0,
                endOffset: 0
            });
        }
    }

    return textRanges;
}

export function addressRangeToTextRange(range: AddressRange, decompilation: CodeBuilder): SourceLocation[] {
    const lineSelMap = new Map<number, Set<number>>();

    const markSelection = (line: number, startCol: number, endCol: number, lineRange: SourceLocation) => {
        let set = lineSelMap.get(line);
        if (!set) {
            set = new Set<number>();
            lineSelMap.set(line, set);
        }

        for (let i = startCol; i < endCol && i < lineRange.endColumn; i++) set.add(i);
    };

    for (let addr = range.startAddress; addr < range.endAddress; addr += 4) {
        const locs = decompilation.getLocationsForAddress(addr);
        locs.forEach(loc => {
            if (loc.startLine != loc.endLine) {
                for (let l = loc.startLine; l < loc.endLine; l++) {
                    const range = decompilation.lineRanges.get(l);
                    if (!range) continue;

                    markSelection(
                        l,
                        l === loc.startLine ? loc.startColumn : range.startColumn,
                        l === loc.endLine - 1 ? loc.endColumn : range.endColumn,
                        range
                    );
                }
            } else {
                const range = decompilation.lineRanges.get(loc.startLine);
                if (range) markSelection(loc.startLine, loc.startColumn, loc.endColumn, range);
            }
        });
    }

    return lineSelectionMapToTextRange(lineSelMap);
}

export function pixelRangeToTextRange(
    downPos: PixelCoord,
    curPos: PixelCoord,
    charSize: CharSize,
    decompilation: CodeBuilder
): SourceLocation[] {
    const minX = Math.min(downPos.x, curPos.x);
    const minY = Math.min(downPos.y, curPos.y);
    const maxX = Math.max(downPos.x, curPos.x);
    const maxY = Math.max(downPos.y, curPos.y);

    const startLine = Math.floor(minY / charSize.height) + 1;
    const startColumn = Math.floor(minX / charSize.width) + 1;
    const endLine = Math.ceil(maxY / charSize.height) + 1;
    const endColumn = Math.ceil(maxX / charSize.width) + 1;

    const lineSelMap = new Map<number, Set<number>>();
    const markSelection = (line: number, startCol: number, endCol: number, lineRange: SourceLocation) => {
        let set = lineSelMap.get(line);
        if (!set) {
            set = new Set<number>();
            lineSelMap.set(line, set);
        }

        for (let i = startCol; i < endCol && i < lineRange.endColumn; i++) set.add(i);
    };

    if (startLine != endLine) {
        for (let l = startLine; l < endLine; l++) {
            const range = decompilation.lineRanges.get(l);
            if (!range) continue;

            markSelection(
                l,
                l === startLine ? startColumn : range.startColumn,
                l === endLine - 1 ? endColumn : range.endColumn,
                range
            );
        }
    } else {
        const range = decompilation.lineRanges.get(startLine);
        if (range) markSelection(startLine, startColumn, endColumn, range);
    }

    return lineSelectionMapToTextRange(lineSelMap);
}

export function getAnnotationLength(annotation: SourceAnnotation) {
    switch (annotation.type) {
        case SourceAnnotationType.Variable:
            return annotation.variable.name?.length || 0;
        case SourceAnnotationType.DataType:
            return annotation.dataType.name.length;
        case SourceAnnotationType.Function:
            return annotation.func.name.length;
        case SourceAnnotationType.Keyword:
        case SourceAnnotationType.Literal:
        case SourceAnnotationType.Punctuation:
        case SourceAnnotationType.Comment:
        case SourceAnnotationType.PlainText:
            return annotation.content.length;
        case SourceAnnotationType.Whitespace:
            return annotation.length;
    }
}
