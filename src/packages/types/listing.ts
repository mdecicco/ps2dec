type GoToAddress = {
    type: 'gotoAddress';
    address: number;
};

export type ClickAction = GoToAddress;

export type RowSegment = {
    content: string;
    clickAction: ClickAction | null;
    style: Record<string, any>;
};

export type RenderedRow = {
    consumedSize: number;
    segments: RowSegment[];
};
