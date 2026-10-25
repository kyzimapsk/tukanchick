import http from "http";
import fs from "fs";
import path from "path";
import {RawData, WebSocket, WebSocketServer} from "ws";
import {IslandEnum} from "../../src/enums/islands.enum";
import {MapInfo} from "../../src/entity/mapInfo";
import {CommandsEnum} from "../../src/multiplayer/commands.enum";
import {BaseDto, JoinToLobbyDto, Message, RoadDto} from "../../src/multiplayer/protocol";
import {LobbyManager, Member} from "./lobby-manager";

/**
 * Сервер игры: раздаёт собранный клиент (dist) и обслуживает мультиплеер по websocket на /exchange.
 *
 * Переменные окружения:
 *   PORT             - порт (5000)
 *   HOST             - интерфейс (0.0.0.0)
 *   STATIC_DIR       - каталог со сборкой клиента (<repo>/dist); пустая строка - не раздавать статику
 *   ALLOWED_ORIGINS  - через запятую, с каких сайтов можно подключаться к websocket (по умолчанию - только с того же хоста)
 */

const ROOT = path.resolve(__dirname, "../../../..")

const PORT = Number(process.env.PORT) || 5000
const HOST = process.env.HOST || "0.0.0.0"
const STATIC_DIR = process.env.STATIC_DIR === "" ? null : path.resolve(process.env.STATIC_DIR || path.join(ROOT, "dist"))
const ASSETS_DIR = path.join(ROOT, "assets")
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter((s) => s)

const MAX_CONNECTIONS = 1000
const MAX_MESSAGE_BYTES = 4 * 1024
// пропавший без закрытия соединения игрок (сеть, сон телефона) замечается за 1-2 интервала
const HEARTBEAT_MS = 10 * 1000

// не больше RATE_BURST сообщений подряд и RATE_PER_SECOND в среднем
const RATE_BURST = 20
const RATE_PER_SECOND = 10


function loadMapInfo(file: string): MapInfo {
    return JSON.parse(fs.readFileSync(path.join(ASSETS_DIR, file), "utf8"))
}

const lobbies = new LobbyManager(new Map([
    [IslandEnum.PETIT, loadMapInfo("isla-petit.info.json")],
    [IslandEnum.GRANDE, loadMapInfo("isla-grante.info.json")],
]))


// ---------------- static ----------------

const CONTENT_TYPES: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".txt": "text/plain; charset=utf-8",
}

const SECURITY_HEADERS: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": [
        "default-src 'self'",
        "script-src 'self'",
        // Phaser DOMElement задаёт стили инлайном
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "connect-src 'self' ws: wss:",
        "frame-ancestors 'none'",
        "base-uri 'none'",
        "form-action 'none'",
    ].join("; "),
}

function realDir(dir: string | null): string | null {
    try {
        return dir ? fs.realpathSync(dir) : null
    } catch (e) {
        console.warn(`[server] static dir ${dir} not found, run "npm run build" first`)
        return null
    }
}

const STATIC_REAL_DIR = realDir(STATIC_DIR)

function sendStatus(res: http.ServerResponse, status: number) {
    res.writeHead(status, {...SECURITY_HEADERS, "Content-Type": "text/plain; charset=utf-8"})
    res.end(http.STATUS_CODES[status])
}

function resolveStaticPath(urlPath: string): string | null {
    let decoded: string
    try {
        decoded = decodeURIComponent(urlPath)
    } catch (e) {
        return null
    }
    if (decoded.includes("\0")) {
        return null
    }

    const filePath = path.resolve(STATIC_DIR, "." + path.posix.normalize("/" + decoded))
    if (filePath !== STATIC_DIR && !filePath.startsWith(STATIC_DIR + path.sep)) {
        return null
    }
    return filePath
}

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse) {
    if (!STATIC_REAL_DIR) {
        return sendStatus(res, 404)
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
        res.setHeader("Allow", "GET, HEAD")
        return sendStatus(res, 405)
    }

    const urlPath = new URL(req.url || "/", "http://localhost").pathname
    let filePath = resolveStaticPath(urlPath.endsWith("/") ? urlPath + "index.html" : urlPath)
    if (!filePath) {
        return sendStatus(res, 400)
    }

    fs.realpath(filePath, (err, realPath) => {
        // символическая ссылка не должна выводить за пределы каталога
        if (err || !realPath.startsWith(STATIC_REAL_DIR + path.sep)) {
            return sendStatus(res, 404)
        }
        fs.stat(realPath, (statErr, stat) => {
            if (statErr || !stat.isFile()) {
                return sendStatus(res, 404)
            }

            const ext = path.extname(realPath).toLowerCase()
            res.writeHead(200, {
                ...SECURITY_HEADERS,
                "Content-Type": CONTENT_TYPES[ext] || "application/octet-stream",
                "Content-Length": stat.size,
                "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600",
            })
            if (req.method === "HEAD") {
                return res.end()
            }
            fs.createReadStream(realPath).on("error", () => res.destroy()).pipe(res)
        })
    })
}


// ---------------- websocket ----------------

const server = http.createServer(serveStatic)

const wss = new WebSocketServer({noServer: true, maxPayload: MAX_MESSAGE_BYTES})

function originAllowed(req: http.IncomingMessage): boolean {
    const origin = req.headers.origin
    if (!origin) {
        // не браузер (боты, тесты) - Origin не присылают
        return true
    }
    if (ALLOWED_ORIGINS.length > 0) {
        return ALLOWED_ORIGINS.includes(origin)
    }
    try {
        return new URL(origin).host === req.headers.host
    } catch (e) {
        return false
    }
}

server.on("upgrade", (req, socket, head) => {
    const pathname = new URL(req.url || "/", "http://localhost").pathname

    if (pathname !== "/exchange" || !originAllowed(req) || wss.clients.size >= MAX_CONNECTIONS) {
        socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n")
        socket.destroy()
        return
    }

    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req))
})

let nextMemberId = 1

interface Connection {
    ws: WebSocket
    member: Member
    alive: boolean
    tokens: number
    lastRefill: number
}

function takeToken(conn: Connection): boolean {
    const now = Date.now()
    conn.tokens = Math.min(RATE_BURST, conn.tokens + (now - conn.lastRefill) / 1000 * RATE_PER_SECOND)
    conn.lastRefill = now
    if (conn.tokens < 1) {
        return false
    }
    conn.tokens -= 1
    return true
}

function parseMessage(raw: RawData, isBinary: boolean): Message | null {
    if (isBinary) {
        return null
    }
    try {
        const message = JSON.parse(raw.toString())
        if (!message || typeof message !== "object" || typeof message.command !== "string") {
            return null
        }
        if (message.data !== undefined && (typeof message.data !== "object" || message.data === null)) {
            return null
        }
        return message
    } catch (e) {
        return null
    }
}

function handle(member: Member, command: CommandsEnum, data: BaseDto = {}) {
    switch (command) {
        case CommandsEnum.CREATE_LOBBY:
            return lobbies.create(member, (data as { name?: unknown }).name)

        case CommandsEnum.JOIN_TO_LOBBY: {
            const dto = data as JoinToLobbyDto
            return lobbies.join(member, dto.lobbyId, typeof dto.member === "object" ? dto.member?.name : undefined)
        }

        case CommandsEnum.FORCE_START: {
            const dto = data as { island?: unknown, randomMap?: unknown }
            return lobbies.start(member, dto.island, dto.randomMap)
        }

        case CommandsEnum.READY_TO_START:
            return lobbies.ready(member)

        case CommandsEnum.MAKE_ROAD: {
            const dto = data as RoadDto
            return lobbies.makeRoad(member, dto.a, dto.b, dto.round, dto.turn)
        }

        case CommandsEnum.SKIP_TURN:
            return lobbies.skip(member)

        case CommandsEnum.CLOSE_MULTIPLAYER:
            return lobbies.leave(member)

        default:
            member.send(CommandsEnum.ERROR, {message: "UNKNOWN COMMAND"})
    }
}

wss.on("connection", (ws: WebSocket) => {
    const member: Member = {
        memberId: nextMemberId++,
        name: "",
        send: (command, data) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({command, data}))
            }
        },
    }
    const conn: Connection = {ws, member, alive: true, tokens: RATE_BURST, lastRefill: Date.now()}

    ws.on("pong", () => conn.alive = true)

    ws.on("message", (raw, isBinary) => {
        if (!takeToken(conn)) {
            ws.close(1008, "rate limit")
            return
        }
        const message = parseMessage(raw, isBinary)
        if (!message) {
            member.send(CommandsEnum.ERROR, {message: "BAD MESSAGE"})
            return
        }
        try {
            handle(member, message.command, message.data)
        } catch (e) {
            console.error("[server] command failed", message.command, e)
            member.send(CommandsEnum.ERROR, {message: "SERVER ERROR"})
        }
    })

    ws.on("close", () => {
        heartbeat.delete(ws)
        lobbies.leave(member)
    })
    ws.on("error", () => ws.terminate())

    heartbeat.set(ws, conn)
})

const heartbeat = new Map<WebSocket, Connection>()

const heartbeatTimer = setInterval(() => {
    heartbeat.forEach((conn, ws) => {
        if (ws.readyState === WebSocket.CLOSED) {
            heartbeat.delete(ws)
            return
        }
        if (!conn.alive) {
            // клиент пропал без закрытия соединения
            ws.terminate()
            heartbeat.delete(ws)
            return
        }
        conn.alive = false
        ws.ping()
    })
}, HEARTBEAT_MS)

wss.on("close", () => clearInterval(heartbeatTimer))

server.listen(PORT, HOST, () => {
    console.log(`[server] http://${HOST}:${PORT}  websocket: /exchange  static: ${STATIC_DIR ?? "disabled"}`)
})

function shutdown() {
    wss.clients.forEach((ws) => ws.close(1001, "server shutdown"))
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 3000).unref()
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
