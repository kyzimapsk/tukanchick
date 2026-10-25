import {randomInt} from "crypto";
import {IslandEnum} from "../../src/enums/islands.enum";
import {MapInfo} from "../../src/entity/mapInfo";
import {CommandsEnum} from "../../src/multiplayer/commands.enum";
import {
    BaseDto,
    LOBBY_ID_LENGTH,
    LOBBY_MAX_MEMBERS,
    LobbyDto,
    MemberDto,
    NAME_MAX_LENGTH
} from "../../src/multiplayer/protocol";
import {Game, Send} from "./game";
import {generateMapInfo} from "../../src/game/map-generator";
import {randomSeed} from "../../src/game/random";

export interface Member {
    memberId: number
    name: string
    send: Send
    lobby?: Lobby
}

export class Lobby {
    members: Member[] = []
    game: Game = null

    constructor(readonly id: string, public host: Member) {
    }

    dto(): LobbyDto {
        return {
            lobbyId: this.id,
            members: this.members.map((m): MemberDto => ({memberId: m.memberId, name: m.name, host: m === this.host})),
        }
    }

    broadcast(command: CommandsEnum, data?: BaseDto, except?: Member) {
        this.members.forEach((m) => {
            if (m !== except) {
                m.send(command, data)
            }
        })
    }
}

// без похожих символов (0/O, 1/I), чтобы id было удобно диктовать
const LOBBY_ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const MAX_LOBBIES = 1000

/**
 * Обрезает ник и убирает управляющие символы; null - если ник некорректный
 */
export function sanitizeName(value: unknown): string | null {
    if (typeof value !== "string") {
        return null
    }
    const name = value.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g, "").trim()
    if (name.length < 1) {
        return null
    }
    return Array.from(name).slice(0, NAME_MAX_LENGTH).join("")
}

export function isLobbyId(value: unknown): value is string {
    return typeof value === "string" && value.length === LOBBY_ID_LENGTH && [...value].every((c) => LOBBY_ID_ALPHABET.includes(c))
}

export class LobbyManager {

    private lobbies = new Map<string, Lobby>()

    constructor(private mapInfos: Map<IslandEnum, MapInfo>) {
    }

    get size() {
        return this.lobbies.size
    }

    create(member: Member, name: unknown) {
        const cleanName = sanitizeName(name)
        if (!cleanName) {
            return this.error(member, "BAD NICKNAME")
        }
        if (this.lobbies.size >= MAX_LOBBIES) {
            return this.error(member, "SERVER IS FULL")
        }

        this.leave(member)
        member.name = cleanName

        const lobby = new Lobby(this.newLobbyId(), member)
        this.lobbies.set(lobby.id, lobby)
        lobby.members.push(member)
        member.lobby = lobby

        member.send(CommandsEnum.CREATE_LOBBY_SUCCESS, {...lobby.dto(), you: member.memberId})
    }

    join(member: Member, lobbyId: unknown, name: unknown) {
        const cleanName = sanitizeName(name)
        if (!cleanName) {
            return this.error(member, "BAD NICKNAME")
        }
        const id = typeof lobbyId === "string" ? lobbyId.trim().toUpperCase() : null
        const lobby = isLobbyId(id) ? this.lobbies.get(id) : undefined
        if (!lobby) {
            return this.error(member, "LOBBY NOT FOUND")
        }
        if (lobby === member.lobby) {
            return
        }
        if (lobby.game) {
            return this.error(member, "GAME ALREADY STARTED")
        }
        if (lobby.members.length >= LOBBY_MAX_MEMBERS) {
            return this.error(member, "LOBBY IS FULL")
        }

        this.leave(member)
        member.name = cleanName
        lobby.members.push(member)
        member.lobby = lobby

        member.send(CommandsEnum.JOIN_TO_LOBBY_SUCCESS, {...lobby.dto(), you: member.memberId})
        lobby.broadcast(CommandsEnum.JOIN_PARTY_MEMBER_SUCCESS, lobby.dto(), member)
    }

    start(member: Member, island: unknown, randomMap: unknown) {
        const lobby = member.lobby
        if (!lobby || lobby.host !== member) {
            return this.error(member, "ONLY HOST CAN START")
        }
        if (lobby.game) {
            return this.error(member, "GAME ALREADY STARTED")
        }
        if (island !== IslandEnum.PETIT && island !== IslandEnum.GRANDE) {
            return this.error(member, "UNKNOWN ISLAND")
        }

        // зерно выбирает сервер, клиенты строят по нему ту же карту
        const seed = randomMap === true ? randomSeed() : undefined
        const baseMapInfo = this.mapInfos.get(island)
        const mapInfo = seed ? generateMapInfo(baseMapInfo, seed) : baseMapInfo

        lobby.game = new Game(island, mapInfo, lobby.members, () => this.onGameEnd(lobby), seed)

        lobby.broadcast(CommandsEnum.START_GAME_SUCCESS, {...lobby.dto(), gameState: lobby.game.state})
    }

    ready(member: Member) {
        member.lobby?.game?.ready(member.memberId)
    }

    makeRoad(member: Member, a: unknown, b: unknown, round: unknown, turn: unknown) {
        if (!Number.isInteger(a) || !Number.isInteger(b)) {
            return this.error(member, "BAD MOVE")
        }
        const optionalInt = (v: unknown) => Number.isInteger(v) ? v as number : undefined
        member.lobby?.game?.makeRoad(member.memberId, a as number, b as number, optionalInt(round), optionalInt(turn))
    }

    skip(member: Member) {
        member.lobby?.game?.skip(member.memberId)
    }

    /**
     * Выход из лобби: по кнопке, при закрытии соединения или переходе в другое лобби
     */
    leave(member: Member) {
        const lobby = member.lobby
        if (!lobby) {
            return
        }
        member.lobby = undefined
        lobby.members = lobby.members.filter((m) => m !== member)

        if (lobby.members.length == 0) {
            lobby.game?.finish()
            this.lobbies.delete(lobby.id)
            return
        }

        if (!lobby.game && lobby.host === member) {
            // хост ушёл до начала игры - лобби распускается
            lobby.broadcast(CommandsEnum.CLOSE_LOBBY_SUCCESS)
            lobby.members.forEach((m) => m.lobby = undefined)
            lobby.members = []
            this.lobbies.delete(lobby.id)
            return
        }

        if (lobby.host === member) {
            lobby.host = lobby.members[0]
        }
        lobby.game?.removePlayer(member.memberId)
        lobby.broadcast(CommandsEnum.LEAVE_PARTY_MEMBER_SUCCESS, {
            ...lobby.dto(),
            left: {memberId: member.memberId, name: member.name},
        })
    }

    private onGameEnd(lobby: Lobby) {
        // партия сыграна - лобби больше не нужно; игроки выходят из него сами кнопкой EXIT
        lobby.members.forEach((m) => m.lobby = undefined)
        lobby.members = []
        this.lobbies.delete(lobby.id)
    }

    private newLobbyId(): string {
        let id: string
        do {
            id = ""
            for (let i = 0; i < LOBBY_ID_LENGTH; ++i) {
                id += LOBBY_ID_ALPHABET[randomInt(LOBBY_ID_ALPHABET.length)]
            }
        } while (this.lobbies.has(id))
        return id
    }

    private error(member: Member, message: string) {
        member.send(CommandsEnum.ERROR, {message})
    }
}
