import {BaseDto, Message} from "./protocol";
import {CommandsEnum} from "./commands.enum";

/**
 * Адрес сервера: задаётся при сборке (MULTIPLAYER_URL), иначе тот же хост, что и у страницы.
 * На https-странице используется wss, иначе браузер заблокирует соединение.
 */
function serverUrl(): string {
    if (MULTIPLAYER_URL) {
        return MULTIPLAYER_URL
    }
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    return `${protocol}//${window.location.host}/exchange`
}

export default class Client {

    socket: WebSocketExt

    constructor() {
    }

    connect() {
        this.socket?.terminate();

        this.socket = new WebSocketExt(serverUrl());

        return this
    }

    get connected(): boolean {
        return !!this.socket?.isOpen
    }

    onOpen(fn: Function) {
        this.socket.events.get("open").push(fn)
        return this
    }

    /**
     * Вешает толко одно событие на одну комманду
     */
    onReceive<T extends BaseDto>(command: CommandsEnum, fn: (data: T) => any) {
        this.socket.receiveEvents.set(command, fn)
        return this
    }

    offReceive(...commands: CommandsEnum[]) {
        commands.forEach(c => this.socket.receiveEvents.delete(c))
        return this
    }

    onClose(fn: Function) {
        this.socket.events.get("close").push(fn)
        return this
    }

    offClose(fn: Function) {
        const list = this.socket.events.get("close")
        const i = list.indexOf(fn)
        if (i >= 0) {
            list.splice(i, 1)
        }
        return this
    }

    send(command: CommandsEnum, data?: BaseDto) {
        this.socket?.sendMsg({command, data} as Message)
        return this
    }

}


class WebSocketExt {
    ident: any

    events: Map<string, Function[]>

    receiveEvents: Map<string, (data: BaseDto) => any>

    socket: WebSocket

    debug: boolean = false

    private reconnectDelay = 1000

    private static readonly MAX_RECONNECT_DELAY = 30000

    constructor(private url: string) {
        this.clearClientListeners()
        this.create()
    }

    get isOpen(): boolean {
        return this.socket?.readyState === WebSocket.OPEN
    }

    create() {

        this.socket = new WebSocket(this.url)

        this.ident = Date.now()
        this.socket.onopen = (e) => {
            if (this.debug) {
                console.log("[socket opened]", this.ident);
            }
            this.reconnectDelay = 1000
            this.events.get("open").forEach(fn => fn(e))
        };
        this.socket.onmessage = (event: MessageEvent) => {
            if (this.debug)
                console.log("[socket received]", event.data);
            this.dispatch(event.data)
        };
        this.socket.onclose = (e) => this.socketOnClose(e, true)
        this.socket.onerror = (e) => {
            if (this.debug) {
                console.error("socket error");
                console.error(e)
            }
            this.events.get("error").forEach(fn => fn(e))
        };

        if (this.debug)
            console.log("[socket create]", this.ident);
    }

    clearSocketListeners() {
        this.socket.onopen = null
        this.socket.onmessage = null
        this.socket.onclose = null
        this.socket.onerror = null
    }

    clearClientListeners() {
        this.events = new Map()
        this.events.set("open", [])
        this.events.set("close", [])
        this.events.set("error", [])

        this.receiveEvents = new Map()
    }


    close() {
        if (this.debug)
            console.log("[socket closing]", this.ident);
        if (this.socket) {
            this.clearSocketListeners()
            this.socket.onclose = (e) => this.socketOnClose(e, false)
            this.socket.close()
            this.socket = null
        }
        return this
    }

    terminate() {
        if (this.debug)
            console.log("[socket terminating]", this.ident);
        this.clearClientListeners()
        this.close()
    }

    private socketOnClose(e: CloseEvent, reconnectFlag: boolean) {
        if (this.debug)
            console.log("[socket closed]", this.ident, e.code, reconnectFlag);
        this.events.get("close").forEach(fn => fn(e))
        if (reconnectFlag) {
            this.reconnect()
        }
    }


    private dispatch(raw: unknown) {
        if (typeof raw !== "string") {
            return
        }

        let message: Message
        try {
            message = JSON.parse(raw)
        } catch (e) {
            console.warn("[socket] malformed message")
            return
        }
        if (!message || typeof message.command !== "string") {
            return
        }

        const fn = this.receiveEvents.get(message.command)
        if (fn) {
            try {
                fn(message.data || {})
            } catch (e) {
                console.error(`[socket] handler for ${message.command} failed`, e)
            }
        }
    }


    sendMsg(message: Message) {
        if (this.isOpen) {
            this.socket.send(JSON.stringify(message))
            if (this.debug)
                console.log("[socket sent]", message);
        }
        return this
    }


    private reconnect() {
        const delay = this.reconnectDelay
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, WebSocketExt.MAX_RECONNECT_DELAY)
        setTimeout(() => {
            // за время ожидания сокет могли закрыть вручную
            if (this.socket && this.socket.readyState === WebSocket.CLOSED) {
                this.create()
            }
        }, delay)
    }

}

export const client = new Client()
