import {PlayerInfo} from "../../src/entity/playerInfo";
import {MapInfo} from "../../src/entity/mapInfo";
import {IslandEnum} from "../../src/enums/islands.enum";
import * as board from "../../src/game/board";
import Deck from "../../src/game/deck";
import TownSpawner from "../../src/game/town-spawner";
import {CommandsEnum} from "../../src/multiplayer/commands.enum";
import {BaseDto, GameStateDto, RoundEndDto, StandingDto, TurnDto, TurnProgressDto} from "../../src/multiplayer/protocol";

export type Send = (command: CommandsEnum, data?: BaseDto) => void

interface GamePlayer {
    memberId: number
    name: string
    send: Send
    info: PlayerInfo

    // закончил текущий ход
    done: boolean

    // загрузил карту / закрыл экран очков
    ready: boolean
}

enum Phase {
    // ждём, пока все загрузят карту или закроют экран очков
    WAITING_READY,
    TURN,
    ENDED,
}

// зависший игрок не должен останавливать игру для остальных
const TURN_TIMEOUT_MS = 3 * 60 * 1000
const READY_TIMEOUT_MS = 2 * 60 * 1000

/**
 * Серверная партия. Карты местности и раскладку городов выбирает сервер,
 * каждый ход игрока проверяется и применяется к его копии карты теми же правилами, что и на клиенте.
 */
export class Game {

    readonly roundCount: number

    readonly townRoll: number

    private players = new Map<number, GamePlayer>()

    private deck: Deck

    private round = 0

    private turn = 0

    private phase = Phase.WAITING_READY

    private timer: NodeJS.Timeout = null

    constructor(readonly island: IslandEnum, mapInfo: MapInfo, members: { memberId: number, name: string, send: Send }[],
                private onEnd: () => void) {
        this.roundCount = board.roundCountFor(island)
        this.townRoll = TownSpawner.randomRoll()

        members.forEach((m) => {
            const info = board.createPlayer(m.name)
            board.initBoard(info, mapInfo, this.townRoll)
            this.players.set(m.memberId, {...m, info, done: false, ready: false})
        })

        this.startTimer(READY_TIMEOUT_MS, () => this.forceReady())
    }

    get state(): GameStateDto {
        return {island: this.island, roundCount: this.roundCount, townRoll: this.townRoll}
    }

    get ended() {
        return this.phase === Phase.ENDED
    }

    ready(memberId: number) {
        const player = this.players.get(memberId)
        if (!player || this.phase !== Phase.WAITING_READY) {
            return
        }
        player.ready = true
        this.checkAllReady()
    }

    makeRoad(memberId: number, a: number, b: number, round?: number, turn?: number) {
        const player = this.players.get(memberId)
        if (!player || this.phase !== Phase.TURN || player.done) {
            return
        }
        if ((round !== undefined && round !== this.round) || (turn !== undefined && turn !== this.turn)) {
            // сообщение от прошлого хода
            return
        }

        const result = board.buildRoad(player.info, a, b, this.roundCount)
        if (!result) {
            player.send(CommandsEnum.ROAD_REJECTED, {a, b})
            return
        }
        if (result.turnEnded) {
            this.markDone(player)
        }
    }

    skip(memberId: number) {
        const player = this.players.get(memberId)
        if (!player || this.phase !== Phase.TURN || player.done) {
            return
        }
        board.skipTurn(player.info)
        this.markDone(player)
    }

    removePlayer(memberId: number) {
        if (!this.players.delete(memberId)) {
            return
        }
        if (this.players.size == 0) {
            this.finish()
            return
        }

        if (this.phase === Phase.TURN) {
            this.broadcastProgress()
            this.checkAllDone()
        } else if (this.phase === Phase.WAITING_READY) {
            this.checkAllReady()
        }
    }

    finish() {
        this.phase = Phase.ENDED
        this.stopTimer()
        this.onEnd()
    }

    private checkAllReady() {
        if ([...this.players.values()].every((p) => p.ready)) {
            this.startRound()
        }
    }

    private forceReady() {
        this.players.forEach((p) => p.ready = true)
        this.checkAllReady()
    }

    private startRound() {
        this.round++
        this.turn = 0
        this.deck = new Deck()

        this.players.forEach((p) => {
            p.ready = false
            board.startRound(p.info)
        })

        this.startTurn()
    }

    private startTurn() {
        this.phase = Phase.TURN
        this.turn++

        const groundA = this.deck.pop()
        const groundB = this.deck.pop()
        const deckSize = this.deck.size()

        const dto: TurnDto = {round: this.round, turn: this.turn, groundA, groundB, deckSize}

        this.players.forEach((p) => {
            p.done = false
            board.startTurn(p.info, groundA, groundB, deckSize)
            p.send(CommandsEnum.START_TURN, dto)
        })

        this.startTimer(TURN_TIMEOUT_MS, () => this.forceEndTurn())
    }

    private markDone(player: GamePlayer) {
        player.done = true
        this.broadcastProgress()
        this.checkAllDone()
    }

    private broadcastProgress() {
        const players = [...this.players.values()]
        const dto: TurnProgressDto = {done: players.filter((p) => p.done).length, total: players.length}
        players.forEach((p) => p.send(CommandsEnum.TURN_PROGRESS, dto))
    }

    private forceEndTurn() {
        this.players.forEach((p) => {
            if (!p.done) {
                board.skipTurn(p.info)
                p.done = true
            }
        })
        this.checkAllDone()
    }

    private checkAllDone() {
        if (this.phase !== Phase.TURN || ![...this.players.values()].every((p) => p.done)) {
            return
        }

        if (this.deck.isRoundOver()) {
            this.endRound()
        } else {
            this.startTurn()
        }
    }

    private endRound() {
        this.players.forEach((p) => board.endRound(p.info, this.roundCount))

        const gameEnd = this.round >= this.roundCount

        const standings: StandingDto[] = [...this.players.values()].map((p) => ({
            memberId: p.memberId,
            name: p.name,
            scores: [...p.info.scores],
        }))
        const dto: RoundEndDto = {round: this.round, gameEnd, standings}
        this.players.forEach((p) => p.send(CommandsEnum.END_ROUND, dto))

        if (gameEnd) {
            this.finish()
        } else {
            this.phase = Phase.WAITING_READY
            this.startTimer(READY_TIMEOUT_MS, () => this.forceReady())
        }
    }

    private startTimer(ms: number, fn: () => void) {
        this.stopTimer()
        this.timer = setTimeout(fn, ms)
        this.timer.unref?.()
    }

    private stopTimer() {
        if (this.timer) {
            clearTimeout(this.timer)
            this.timer = null
        }
    }
}
