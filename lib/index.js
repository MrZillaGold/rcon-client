"use strict";
// export * from "./rcon"
Object.defineProperty(exports, "__esModule", { value: true });
exports.RconClient = void 0;
const net_1 = require("net");
const events_1 = require("events");
const packet_1 = require("./packet");
const splitter_1 = require("./splitter");
const queue_1 = require("./queue");
const defaultOptions = {
    connectTimeout: 5000,
    timeout: 5000,
    maxPending: 1
};
class RconClient extends events_1.EventEmitter {
    constructor(options = {}) {
        var _a, _b, _c;
        super();
        this.options = options;
        this.authenticated = false;
        this.nextRequestId = 0;
        this.sendQueue = new queue_1.PromiseQueue(this.options.maxPending);
        this.callbacks = new Map();
        this.setMaxListeners(0);
        this.options.timeout = (_a = options.timeout) !== null && _a !== void 0 ? _a : defaultOptions.timeout;
        this.options.connectTimeout = (_b = options.connectTimeout) !== null && _b !== void 0 ? _b : defaultOptions.connectTimeout;
        this.options.maxPending = (_c = options.maxPending) !== null && _c !== void 0 ? _c : defaultOptions.maxPending;
        this.socket = new net_1.Socket();
        this.socket.on("error", error => this.emit("error", error));
        this.socket.on("close", () => this.emit("end"));
        this.socket.setNoDelay(true);
    }
    static async connect(host, port, password, options) {
        const rcon = new RconClient(options);
        await rcon.connect(host, port, password);
        return rcon;
    }
    async connect(host, port, password) {
        if (this.socket.writable || this.socket.destroyed) {
            throw new Error("connect called twice");
        }
        await new Promise((resolve, reject) => {
            this.socket.setTimeout(this.options.connectTimeout, () => {
                this.socket.destroy();
                reject(new Error("Connection timed out"));
            });
            this.on("error", reject);
            this.socket.connect({ host, port }, () => {
                this.socket.setTimeout(0);
                this.off("error", reject);
                resolve();
            });
        });
        this.emit("connect");
        this.socket
            .pipe(splitter_1.createSplitter())
            .on("data", this.handlePacket.bind(this));
        const packet = await this.sendPacket(packet_1.PacketType.Auth, Buffer.from(password));
        if (packet.id != this.nextRequestId - 1 || packet.id == -1) {
            this.socket.destroy();
            throw new Error("Authentication failed");
        }
        this.authenticated = true;
        this.emit("authenticated");
    }
    async end() {
        if (!this.socket.writable)
            return;
        this.socket.end();
        await new Promise(resolve => this.once("end", resolve));
    }
    async send(command) {
        const payload = await this.sendRaw(Buffer.from(command, "utf-8"));
        return payload.toString("utf-8");
    }
    async sendRaw(buffer) {
        const packet = await this.sendPacket(packet_1.PacketType.Command, buffer);
        return packet.payload;
    }
    async sendPacket(type, payload) {
        const id = this.nextRequestId++;
        return await this.sendQueue.add(() => new Promise((resolve, reject) => {
            if (!this.socket.writable)
                throw new Error("Socket closed or not connected");
            if (type == packet_1.PacketType.Command && !this.authenticated)
                throw new Error("Client not yet authenticated");
            this.socket.write(packet_1.encodePacket({ id, type, payload }));
            const onEnd = () => {
                clearTimeout(timeout);
                reject(new Error("Connection closed"));
            };
            this.on("end", onEnd);
            const timeout = setTimeout(() => {
                if (type == packet_1.PacketType.Auth) {
                    this.socket.destroy();
                    reject(new Error("Authentication timed out"));
                }
                else {
                    if (this.options.closeOnTimeout)
                        this.socket.destroy();
                    reject(new Error(`Packet with id ${id} timed out`));
                }
            }, this.options.timeout);
            this.callbacks.set(id, packet => {
                this.off("end", onEnd);
                clearTimeout(timeout);
                resolve(packet);
            });
        }));
    }
    handlePacket(data) {
        const packet = packet_1.decodePacket(data);
        const id = this.authenticated ? packet.id : this.nextRequestId - 1;
        const handler = this.callbacks.get(packet.id);
        if (this.authenticated && packet.type != packet_1.PacketType.CommandResponse) {
            throw new Error("Received invalid packet type");
        }
        if (handler) {
            handler(packet);
            this.callbacks.delete(id);
        }
        else {
            throw new Error("Unexpected response packet");
        }
    }
}
exports.RconClient = RconClient;
