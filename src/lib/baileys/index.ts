import { baileysManager } from './client';
import { handleBaileysIncomingMessage } from './handler';

baileysManager.setMessageHandler(handleBaileysIncomingMessage);

export * from './client';
export * from './handler';
export { baileysManager };
