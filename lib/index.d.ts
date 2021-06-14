/// <reference types="node" />
import { Socket } from "net";
import TypedEmitter from "typed-emitter";
export interface RconOptions {
    /**
     * Maximum time in milliseconds to connect until an error is thrown.
     * @default 5000
     */
    connectTimeout?: number;
    /**
     * Maximum time in milliseconds for a packet response to arrive before
     * an error is thrown.
     * @default 5000 ms
     */
    timeout?: number;
    /**
     * Close connection on packet timeout.
     * @default false
     */
    closeOnTimeout?: boolean;
    /**
     * Maximum number of parallel requests. Most minecraft servers can
     * only reliably process one packet at a time.
     * @default 1
     */
    maxPending?: number;
}
interface Events {
    connect(): void;
    authenticated(): void;
    error(error: Error): void;
    end(): void;
}
declare const RconClient_base: new () => TypedEmitter<Events>;
export declare class RconClient extends RconClient_base {
    options: RconOptions;
    static connect(host: string, port: number, password: string, options?: RconOptions): Promise<RconClient>;
    socket: Socket;
    authenticated: boolean;
    nextRequestId: number;
    private sendQueue;
    private callbacks;
    constructor(options?: RconOptions);
    connect(host: string, port: number, password: string): Promise<void>;
    end(): Promise<void>;
    send(command: string): Promise<string>;
    sendRaw(buffer: Buffer): Promise<Buffer>;
    private sendPacket;
    private handlePacket;
}
export {};
