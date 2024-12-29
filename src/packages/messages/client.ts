export type ClientMessagePayloads = {
    pong: {
        message: string;
    };
};
export type ClientMessageType = keyof ClientMessagePayloads;
