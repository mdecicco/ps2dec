export type MainMessagePayloads = {
    ping: {
        message: string;
    };
};
export type MainMessageType = keyof MainMessagePayloads;
