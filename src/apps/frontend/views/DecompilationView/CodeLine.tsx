import { CodeBuilder, SourceAnnotation, SourceAnnotationType } from 'decompiler';

import { DataTypeHover, FunctionHover, LiteralHover, VariableHover } from 'apps/frontend/components';
import { useFunctions } from 'apps/frontend/hooks/useFunctions';
import Messager from 'apps/frontend/message';

type CodeLineProps = {
    line: number;
    decompilation: CodeBuilder;
    annotations: SourceAnnotation[];
};

export const CodeLine: React.FC<CodeLineProps> = ({ line, decompilation, annotations }) => {
    const functions = useFunctions();
    return (
        <div style={{ display: 'flex', flexDirection: 'row', width: '100%' }}>
            {annotations.map((annotation, idx) => {
                switch (annotation.type) {
                    case SourceAnnotationType.Variable:
                        return (
                            <VariableHover key={idx} variable={annotation.variable} storage={annotation.storage}>
                                <span key={idx}>{annotation.variable.name}</span>
                            </VariableHover>
                        );
                    case SourceAnnotationType.DataType:
                        return (
                            <DataTypeHover key={idx} dataType={annotation.dataType}>
                                <span style={{ color: 'pink' }}>{annotation.dataType.name}</span>
                            </DataTypeHover>
                        );
                    case SourceAnnotationType.Function:
                        return (
                            <FunctionHover key={idx} func={annotation.func}>
                                <span
                                    key={idx}
                                    style={{ color: '#509663', cursor: 'pointer' }}
                                    onDoubleClick={() => {
                                        Messager.send('gotoAddress', annotation.func.address);
                                    }}
                                >
                                    {annotation.func.name}
                                </span>
                            </FunctionHover>
                        );
                    case SourceAnnotationType.Keyword:
                        return (
                            <span key={idx} style={{ color: '#6c78b8' }}>
                                {annotation.content}
                            </span>
                        );
                    case SourceAnnotationType.Literal:
                        return (
                            <LiteralHover
                                key={idx}
                                literal={annotation.content}
                                dataType={annotation.dataType}
                                value={annotation.value}
                            >
                                <span key={idx} style={{ color: '#bd2b2b' }}>
                                    {annotation.content}
                                </span>
                            </LiteralHover>
                        );
                    case SourceAnnotationType.Punctuation:
                        return (
                            <span key={idx} style={{ color: '#6e6a5e' }}>
                                {annotation.content}
                            </span>
                        );
                    case SourceAnnotationType.Comment:
                        return (
                            <span key={idx} style={{ color: '#6e6a5e' }}>
                                {annotation.content}
                            </span>
                        );
                    case SourceAnnotationType.Whitespace:
                        if (annotation.length === 0) return null;
                        return <span key={idx}>{'\u00A0'.repeat(annotation.length)}</span>;
                    case SourceAnnotationType.PlainText:
                        return (
                            <span key={idx} style={{ color: '#d5d7e3' }}>
                                {annotation.content}
                            </span>
                        );
                }
            })}
        </div>
    );
};
