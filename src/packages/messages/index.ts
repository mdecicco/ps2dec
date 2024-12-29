import { ClientMessagePayloads, ClientMessageType } from 'packages/messages/client';
import { MainMessagePayloads, MainMessageType } from 'packages/messages/main';

export * from './client';
export * from './main';

export type ClientMessage<Type extends ClientMessageType> = {
    type: ClientMessageType;
    payload: ClientMessagePayloads[Type];
};

export type MainMessage<Type extends MainMessageType> = {
    type: MainMessageType;
    payload: MainMessagePayloads[Type];
};
