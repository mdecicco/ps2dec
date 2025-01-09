import { DecompVariable } from 'decompiler';
import { FunctionCode } from 'packages/decompiler/input';
import { VersionedLocation } from '../common';
import { DataType, Func, Method, PointerType, TypeProperty } from '../typesys';
import { SerializedValue, Value } from '../value';

export type SourceLocation = {
    startOffset: number;
    endOffset: number;
    startLine: number;
    endLine: number;
    startColumn: number;
    endColumn: number;
};

export type VariableStorage = {
    location: VersionedLocation;
    startAddress: number;
    endAddress: number;
};

export enum SourceAnnotationType {
    Variable,
    DataType,
    Function,
    Keyword,
    Literal,
    Punctuation,
    Comment,
    Whitespace,
    PlainText
}

export type VariableAnnotation = {
    type: SourceAnnotationType.Variable;
    variable: DecompVariable;
    storage: VariableStorage;
};

export type SerializedVariableAnnotation = {
    type: SourceAnnotationType.Variable;
    variable: SerializedValue;
};

export type DataTypeAnnotation = {
    type: SourceAnnotationType.DataType;
    dataType: DataType;
};

export type SerializedDataTypeAnnotation = {
    type: SourceAnnotationType.DataType;
    dataTypeId: number;
    dataTypeName: string;
};

export type FunctionAnnotation = {
    type: SourceAnnotationType.Function;
    func: Func | Method;
};

export type SerializedFunctionAnnotation = {
    type: SourceAnnotationType.Function;
    funcId: number;
    funcName: string;
};

export type KeywordAnnotation = {
    type: SourceAnnotationType.Keyword;
    content: string;
};

export type LiteralAnnotation = {
    type: SourceAnnotationType.Literal;
    content: string;
    value: bigint;
    dataType: DataType;
};

export type PunctuationAnnotation = {
    type: SourceAnnotationType.Punctuation;
    content: string;
};

export type CommentAnnotation = {
    type: SourceAnnotationType.Comment;
    content: string;
};

export type WhitespaceAnnotation = {
    type: SourceAnnotationType.Whitespace;
    length: number;
    isNewLine: boolean;
};

export type PlainTextAnnotation = {
    type: SourceAnnotationType.PlainText;
    content: string;
};

export type SourceAnnotation =
    | VariableAnnotation
    | DataTypeAnnotation
    | FunctionAnnotation
    | KeywordAnnotation
    | LiteralAnnotation
    | PunctuationAnnotation
    | CommentAnnotation
    | WhitespaceAnnotation
    | PlainTextAnnotation;

export type SerializedSourceAnnotation =
    | SerializedVariableAnnotation
    | SerializedDataTypeAnnotation
    | SerializedFunctionAnnotation
    | KeywordAnnotation
    | LiteralAnnotation
    | PunctuationAnnotation
    | CommentAnnotation
    | WhitespaceAnnotation
    | PlainTextAnnotation;

export type SerializedDecompilation = {
    code: string;
    addressLocationMap: [number, SourceLocation[]][];
    locationAddressMap: [SourceLocation, number[]][];
    variableStorageMap: [SerializedValue, VariableStorage[]][];
    lineAnnotationMap: [number, SerializedSourceAnnotation[]][];
    lineRanges: [number, SourceLocation][];
    annotations: SerializedSourceAnnotation[];
};

export type CodeBuilderOptions = {
    tabWidth: number;
    maxLineLength: number;
};

interface IGenerator {
    generate(code: CodeBuilder): void;
}

interface IImmediate {
    type: DataType;
    value: bigint;
    toString(): string;
}

function sourceLocationIntersects(loc: SourceLocation, other: SourceLocation) {
    if (loc.startOffset < other.startOffset && loc.endOffset < other.startOffset) return false;
    if (loc.startOffset > other.endOffset && loc.endOffset > other.endOffset) return false;
    return true;
}

export class CodeBuilder {
    private m_code: string;
    private m_addressLocationMap: Map<number, SourceLocation[]>;
    private m_locationAddressMap: Map<SourceLocation, number[]>;
    private m_variableStorageMap: Map<DecompVariable, VariableStorage[]>;
    private m_lineAnnotationMap: Map<number, SourceAnnotation[]>;
    private m_lineRanges: Map<number, SourceLocation>;
    private m_annotations: SourceAnnotation[];
    private m_indent: number;
    private m_currentLine: number;
    private m_currentColumn: number;
    private m_currentAddressStack: number[];
    private m_func: FunctionCode;
    private m_options: CodeBuilderOptions;

    constructor(func: FunctionCode, options?: Partial<CodeBuilderOptions>) {
        this.m_code = '';
        this.m_addressLocationMap = new Map();
        this.m_locationAddressMap = new Map();
        this.m_variableStorageMap = new Map();
        this.m_lineAnnotationMap = new Map();
        this.m_lineRanges = new Map();
        this.m_annotations = [];
        this.m_indent = 0;
        this.m_currentLine = 1;
        this.m_currentColumn = 1;
        this.m_currentAddressStack = [];
        this.m_func = func;
        this.m_options = {
            tabWidth: 4,
            maxLineLength: 120,
            ...options
        };

        this.m_lineRanges.set(this.m_currentLine, {
            startOffset: this.m_code.length,
            endOffset: this.m_code.length,
            startLine: this.m_currentLine,
            endLine: this.m_currentLine,
            startColumn: 1,
            endColumn: 1
        });
    }

    get code() {
        return this.m_code;
    }

    get annotations() {
        return this.m_annotations;
    }

    get lineCount() {
        return this.m_lineRanges.size;
    }

    get lineRanges() {
        return this.m_lineRanges;
    }

    getLineAnnotations(line: number) {
        return this.m_lineAnnotationMap.get(line) || [];
    }

    getAddressesForLocation(location: SourceLocation) {
        const addresses: number[] = [];

        for (const [addr, locs] of this.m_addressLocationMap) {
            if (locs.some(l => sourceLocationIntersects(l, location))) {
                addresses.push(addr);
            }
        }

        return addresses;
    }

    getLocationsForAddress(address: number): SourceLocation[] {
        return this.m_addressLocationMap.get(address) || [];
    }

    indent() {
        this.m_indent++;
    }

    unindent() {
        this.m_indent--;
        if (this.m_indent < 0) this.m_indent = 0;
    }

    newLine(count: number = 1) {
        if (this.annotations.length > 1) {
            const possibleNewLine = this.annotations[this.annotations.length - 1];
            if (possibleNewLine.type === SourceAnnotationType.Whitespace) {
                if (possibleNewLine.isNewLine) {
                    // only allow one of these in a row
                    return;
                }
            }
        }

        for (let i = 0; i < count; i++) {
            this.m_code += '\n';
            this.m_currentLine++;
            this.m_currentColumn = 1;

            this.m_lineRanges.set(this.m_currentLine, {
                startOffset: this.m_code.length,
                endOffset: this.m_code.length,
                startLine: this.m_currentLine,
                endLine: this.m_currentLine,
                startColumn: 1,
                endColumn: 1
            });

            this.add({
                type: SourceAnnotationType.Whitespace,
                length: 0,
                isNewLine: true
            });
        }
    }

    pushAddress(address: number) {
        this.m_currentAddressStack.push(address);
    }

    popAddress() {
        this.m_currentAddressStack.pop();
    }

    variable(variable: DecompVariable) {
        let storage: VariableStorage | null = null;

        const currentAddress = this.m_currentAddressStack[this.m_currentAddressStack.length - 1];

        const locations = variable.versions.entries;
        for (const [location, versions] of locations) {
            versions.forEach(version => {
                const def = this.m_func.getDefOf({ value: location, version });
                const uses = this.m_func.getUsesOf(def);
                uses.sort((a, b) => b.instruction.address - a.instruction.address);

                const startAddress = def.instruction?.address || this.m_func.entry.startAddress;
                const endAddress = uses.length > 0 ? uses[0].instruction.address : startAddress;
                if (startAddress <= currentAddress && endAddress >= currentAddress) {
                    storage = {
                        location: { value: location, version },
                        startAddress,
                        endAddress
                    };
                }
            });
        }

        if (!storage) {
            console.log(variable.toString());
            // throw new Error(`Definition of variable ${variable.name} not found at current address ${currentAddress}`);
        }

        this.add({
            type: SourceAnnotationType.Variable,
            variable,
            storage: storage || {
                location: { value: locations[0][0], version: locations[0][1][0] },
                startAddress: 0,
                endAddress: 0
            }
        });
    }

    dataType(dataType: DataType) {
        this.add({
            type: SourceAnnotationType.DataType,
            dataType
        });
    }

    func(func: Func | Method) {
        this.add({
            type: SourceAnnotationType.Function,
            func
        });
    }

    keyword(keyword: string) {
        this.add({
            type: SourceAnnotationType.Keyword,
            content: keyword
        });
    }

    literal(literal: string, dataType: DataType, value: bigint) {
        this.add({
            type: SourceAnnotationType.Literal,
            content: literal,
            value,
            dataType
        });
    }

    immediate(value: IImmediate) {
        this.add({
            type: SourceAnnotationType.Literal,
            content: value.toString(),
            value: value.value,
            dataType: value.type
        });
    }

    punctuation(punctuation: string) {
        this.add({
            type: SourceAnnotationType.Punctuation,
            content: punctuation
        });
    }

    comment(comment: string) {
        const lines = comment.split('\n');
        if (lines.length === 1) {
            this.add({
                type: SourceAnnotationType.Comment,
                content: `/* ${comment} */`
            });
        } else {
            this.add({
                type: SourceAnnotationType.Comment,
                content: '/*'
            });
            lines.forEach(line => {
                this.newLine();
                this.add({
                    type: SourceAnnotationType.Comment,
                    content: ` * ${line}`
                });
            });
            this.newLine();
            this.add({
                type: SourceAnnotationType.Comment,
                content: ' */'
            });
        }
    }

    whitespace(length: number) {
        this.add({
            type: SourceAnnotationType.Whitespace,
            length,
            isNewLine: false
        });
    }

    plainText(text: string) {
        this.add({
            type: SourceAnnotationType.PlainText,
            content: text
        });
    }

    expression(expr: IGenerator | null) {
        if (!expr) return;
        expr.generate(this);
    }

    propertyAccess(type: DataType, propertyOrUndefinedOffset: TypeProperty | { offset: number; asType: DataType }) {
        if ('asType' in propertyOrUndefinedOffset) {
            this.add({
                type: SourceAnnotationType.PlainText,
                content: `field_0x${propertyOrUndefinedOffset.offset.toString(16)}`
            });
        } else {
            this.add({
                type: SourceAnnotationType.PlainText,
                content: `${propertyOrUndefinedOffset.name}`
            });
        }
    }

    arrayAccess(type: DataType, text: string) {
        this.add({
            type: SourceAnnotationType.PlainText,
            content: text
        });
    }

    miscReference(text: string) {
        this.add({
            type: SourceAnnotationType.PlainText,
            content: text
        });
    }

    functionHeader(func: Func | Method) {
        const sig = func.signature;
        this.dataType(sig.returnType);
        this.whitespace(1);
        if (func instanceof Method) {
            const thisType = func.signature.thisType as PointerType;
            this.dataType(thisType.pointsTo);
            this.punctuation('::');
        }
        this.func(func);
        this.punctuation('(');
        this.m_func.arguments.forEach((arg, idx) => {
            if (idx > 0) this.punctuation(', ');
            this.dataType(arg.type);
            this.whitespace(1);
            this.variable(arg);
        });
        this.punctuation(') {');
        this.indent();
        this.newLine();
    }

    functionFooter() {
        this.unindent();
        this.newLine();
        this.punctuation('}');
    }

    serialize(): SerializedDecompilation {
        const serializeAnnotation = (a: SourceAnnotation): SerializedSourceAnnotation => {
            switch (a.type) {
                case SourceAnnotationType.Variable:
                    return { type: SourceAnnotationType.Variable, variable: a.variable.serialize() };
                case SourceAnnotationType.DataType:
                    return {
                        type: SourceAnnotationType.DataType,
                        dataTypeId: a.dataType.id,
                        dataTypeName: a.dataType.name
                    };
                case SourceAnnotationType.Function:
                    return { type: SourceAnnotationType.Function, funcId: a.func.id, funcName: a.func.name };
                default:
                    return a;
            }
        };
        return {
            code: this.m_code,
            addressLocationMap: Array.from(this.m_addressLocationMap.entries()),
            locationAddressMap: Array.from(this.m_locationAddressMap.entries()),
            variableStorageMap: Array.from(this.m_variableStorageMap.entries()).map(([value, storage]) => [
                value.serialize(),
                storage
            ]),
            lineAnnotationMap: Array.from(this.m_lineAnnotationMap.entries()).map(([line, annotations]) => [
                line,
                annotations.map(serializeAnnotation)
            ]),
            lineRanges: Array.from(this.m_lineRanges.entries()),
            annotations: this.m_annotations.map(serializeAnnotation)
        };
    }

    private add(annotation: SourceAnnotation) {
        if (this.m_currentColumn === 1 && this.m_indent > 0 && annotation.type !== SourceAnnotationType.Whitespace) {
            this.add({
                type: SourceAnnotationType.Whitespace,
                length: this.m_options.tabWidth * this.m_indent,
                isNewLine: false
            });
            this.m_currentColumn = 1 + this.m_options.tabWidth * this.m_indent;
        }

        this.m_annotations.push(annotation);
        const lineAnnotations = this.m_lineAnnotationMap.get(this.m_currentLine);
        if (lineAnnotations) {
            lineAnnotations.push(annotation);
            this.m_lineAnnotationMap.set(this.m_currentLine, lineAnnotations);
        } else {
            this.m_lineAnnotationMap.set(this.m_currentLine, [annotation]);
        }

        if (annotation.type === SourceAnnotationType.Variable) {
            this.mapVariableStorage(annotation.variable);
        }

        let startLine = this.m_currentLine;
        let startColumn = this.m_currentColumn;
        let startOffset = this.m_code.length;

        let newText = this.renderAnnotation(annotation);
        if (startColumn === 1 && newText.trim().length === 0) return;

        const lines = newText.split('\n');

        lines.forEach((line, idx) => {
            if (idx > 0) this.newLine();
            if (line.length === 0) return;
            this.m_code += line;
            this.m_currentColumn += line.length;
        });

        const srcLoc = {
            startOffset: startOffset,
            endOffset: this.m_code.length,
            startLine: startLine,
            endLine: this.m_currentLine,
            startColumn: startColumn,
            endColumn: this.m_currentColumn
        };

        const seenAddresses = new Set<number>();
        this.m_currentAddressStack.forEach(addr => {
            if (seenAddresses.has(addr)) return;
            seenAddresses.add(addr);

            const addrLocMap = this.m_addressLocationMap.get(addr);
            if (addrLocMap) {
                addrLocMap.push(srcLoc);
                this.m_addressLocationMap.set(addr, addrLocMap);
            } else {
                this.m_addressLocationMap.set(addr, [srcLoc]);
            }

            const locAddrMap = this.m_locationAddressMap.get(srcLoc);
            if (locAddrMap) {
                locAddrMap.push(addr);
                this.m_locationAddressMap.set(srcLoc, locAddrMap);
            } else {
                this.m_locationAddressMap.set(srcLoc, [addr]);
            }
        });

        const lineRange = this.m_lineRanges.get(this.m_currentLine)!;
        lineRange.endOffset = srcLoc.endOffset;
        lineRange.endLine = srcLoc.endLine;
        lineRange.endColumn = srcLoc.endColumn;
    }

    private renderAnnotation(annotation: SourceAnnotation) {
        let str = '';
        switch (annotation.type) {
            case SourceAnnotationType.Variable:
                str += annotation.variable.name!;
                break;
            case SourceAnnotationType.DataType:
                str += annotation.dataType.name;
                break;
            case SourceAnnotationType.Function:
                str += annotation.func.name;
                break;
            case SourceAnnotationType.Keyword:
            case SourceAnnotationType.Literal:
            case SourceAnnotationType.Punctuation:
            case SourceAnnotationType.Comment:
                str += annotation.content;
                break;
            case SourceAnnotationType.PlainText:
                str += annotation.content;
                break;
            case SourceAnnotationType.Whitespace:
                if (!annotation.isNewLine) {
                    str += ' '.repeat(annotation.length);
                }
                break;
        }

        return str;
    }

    private mapVariableStorage(variable: DecompVariable) {
        let storage = this.m_variableStorageMap.get(variable);
        if (storage) {
            // Each variable only needs to be mapped once
            return;
        }

        storage = [];
        this.m_variableStorageMap.set(variable, storage);

        const locations = variable.versions.entries;
        for (const [location, versions] of locations) {
            versions.forEach(version => {
                const def = this.m_func.getDefOf({ value: location, version });
                const uses = this.m_func.getUsesOf(def);
                uses.sort((a, b) => b.instruction.address - a.instruction.address);

                const startAddress = def.instruction?.address || this.m_func.entry.startAddress;
                const endAddress = uses.length > 0 ? uses[0].instruction.address : startAddress;

                storage.push({
                    location: { value: location, version },
                    startAddress,
                    endAddress
                });
            });
        }
    }
}

export class Decompilation {
    private m_code: string;
    private m_addressLocationMap: Map<number, SourceLocation[]>;
    private m_locationAddressMap: Map<SourceLocation, number[]>;
    private m_variableStorageMap: Map<Value, VariableStorage[]>;
    private m_lineAnnotationMap: Map<number, SerializedSourceAnnotation[]>;
    private m_lineRanges: Map<number, SourceLocation>;
    private m_annotations: SerializedSourceAnnotation[];

    constructor(fromSerialized: SerializedDecompilation /* , funcDb: IFunctionDatabase */) {
        this.m_code = fromSerialized.code;
        this.m_addressLocationMap = new Map(fromSerialized.addressLocationMap);
        this.m_locationAddressMap = new Map(fromSerialized.locationAddressMap);
        this.m_variableStorageMap = new Map(
            fromSerialized.variableStorageMap.map(([value, storage]) => [Value.deserialize(value), storage])
        );
        this.m_lineAnnotationMap = new Map(fromSerialized.lineAnnotationMap);
        this.m_lineRanges = new Map(fromSerialized.lineRanges);
        this.m_annotations = fromSerialized.annotations;
        /*
        this.m_annotations = fromSerialized.annotations.map(a => {
            switch (a.type) {
                case SourceAnnotationType.Variable:
                    return { type: SourceAnnotationType.Variable, variable: Value.deserialize(a.variable) };
                case SourceAnnotationType.DataType:
                    return {
                        type: SourceAnnotationType.DataType,
                        dataType: TypeSystem.get().getType(a.dataTypeId)
                    };
                case SourceAnnotationType.Function:
                    const func = funcDb.findFunctionById(a.funcId);
                    if (!func) throw new Error(`Function with id ${a.funcId} not found`);

                    return {
                        type: SourceAnnotationType.Function,
                        func
                    };
                default:
                    return a;
            }
        });
        */
    }

    get code() {
        return this.m_code;
    }

    get annotations() {
        return this.m_annotations;
    }

    get lineCount() {
        return this.m_lineRanges.size;
    }

    get lineRanges() {
        return this.m_lineRanges;
    }

    getLineAnnotations(line: number) {
        return this.m_lineAnnotationMap.get(line) || [];
    }

    getAddressesForLocation(location: SourceLocation) {
        const addresses: number[] = [];

        for (const [addr, locs] of this.m_addressLocationMap) {
            if (locs.some(l => sourceLocationIntersects(l, location))) {
                addresses.push(addr);
            }
        }

        return addresses;
    }

    getLocationsForAddress(address: number): SourceLocation[] {
        return this.m_addressLocationMap.get(address) || [];
    }
}
