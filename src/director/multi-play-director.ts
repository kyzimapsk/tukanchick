import * as Phaser from "phaser";
import {Director} from "./director";
import {ScenesEnum} from "../enums/scenes.enum";
import {MapConfig} from "../entity/mapConfig";
import {EventBus} from "../scene/bus/EventBus";
import {EventsEnum} from "../enums/events.enum";
import {Hexagon} from "../entity/hexagon";
import * as board from "../game/board";
import {RoadResult} from "../game/board";
import {client} from "../multiplayer/client";
import {CommandsEnum} from "../multiplayer/commands.enum";
import {ErrorDto, LobbyDto, RoadDto, RoundEndDto, TurnDto, TurnProgressDto} from "../multiplayer/protocol";

/**
 * Мультиплеер: все игроки одновременно строят дороги на своих картах,
 * карты местности и раскладку городов раздаёт сервер (одинаковые для всех).
 * Сервер проверяет каждый ход теми же правилами (game/board) и ведёт общий счёт.
 */
export class MultiPlayDirector extends Director {

    private gameEnd = false

    private readonly onConnectionLost = () => {
        EventBus.emit(EventsEnum.STATUS, "CONNECTION LOST")
        this.game.scene.getScene(ScenesEnum.MAP)?.time.delayedCall(1500, () => EventBus.emit(EventsEnum.CLOSE_GAME))
    }

    constructor(game: Phaser.Game, private selfId: number, private nickname: string) {
        super(game)
    }

    protected startGame(mapConfig: MapConfig) {
        this.initBoard(mapConfig, mapConfig.townRoll, this.nickname)

        client
            .onReceive<TurnDto>(CommandsEnum.START_TURN, (data) => this.onServerTurn(data))
            .onReceive<TurnProgressDto>(CommandsEnum.TURN_PROGRESS, (data) => this.onTurnProgress(data))
            .onReceive<RoadDto>(CommandsEnum.ROAD_REJECTED, () => this.onRoadRejected())
            .onReceive<RoundEndDto>(CommandsEnum.END_ROUND, (data) => this.onRoundEnd(data))
            .onReceive<LobbyDto>(CommandsEnum.LEAVE_PARTY_MEMBER_SUCCESS, () => EventBus.emit(EventsEnum.STATUS, "A PLAYER LEFT THE GAME"))
            .onReceive<ErrorDto>(CommandsEnum.ERROR, (data) => EventBus.emit(EventsEnum.STATUS, String(data.message)))
            .onClose(this.onConnectionLost)

        this.showMap()
    }

    protected initializeMapAfter() {
        this.game.scene.start(ScenesEnum.MAP_CONTROLS, this.playerInfo)

        this.waitForOthers()
        client.send(CommandsEnum.READY_TO_START)
    }

    private onServerTurn(dto: TurnDto) {
        if (dto.round !== this.playerInfo.round) {
            this.playerInfo.round = dto.round - 1
            board.startRound(this.playerInfo)
            EventBus.emit(EventsEnum.START_ROUND_AFTER)
        }

        board.startTurn(this.playerInfo, dto.groundA, dto.groundB, dto.deckSize)
        this.playerInfo.turn = dto.turn

        EventBus.emit(EventsEnum.STATUS, "YOUR MOVE")
        EventBus.emit(EventsEnum.START_TURN_AFTER)
    }

    protected makeRoad(hexes: Hexagon[]): RoadResult | null {
        const result = super.makeRoad(hexes)
        if (result) {
            client.send(CommandsEnum.MAKE_ROAD, {
                a: hexes[0].index,
                b: hexes[1].index,
                round: this.playerInfo.round,
                turn: this.playerInfo.turn,
            } as RoadDto)
            if (result.turnEnded) {
                this.waitForOthers()
            }
        }
        return result
    }

    protected skipTurn() {
        if (board.skipTurn(this.playerInfo)) {
            client.send(CommandsEnum.SKIP_TURN)
            EventBus.emit(EventsEnum.MAKE_ROAD_AFTER)
            this.waitForOthers()
        }
    }

    private onTurnProgress(dto: TurnProgressDto) {
        if (!this.playerInfo.readyTouch) {
            this.waitForOthers(dto)
        }
    }

    private onRoadRejected() {
        // клиент и сервер считают по одним правилам, сюда попадаем только при рассинхронизации
        EventBus.emit(EventsEnum.STATUS, "MOVE REJECTED BY SERVER")
    }

    private onRoundEnd(dto: RoundEndDto) {
        board.endRound(this.playerInfo, this.mapConfig.roundCount)
        this.playerInfo.gameEnd = dto.gameEnd
        this.gameEnd = dto.gameEnd

        EventBus.emit(EventsEnum.END_ROUND_AFTER)

        this.showScoreScreen(dto.standings, this.selfId)
    }

    protected scoreClosed() {
        if (this.gameEnd) {
            EventBus.emit(EventsEnum.CLOSE_GAME)
        } else {
            this.waitForOthers()
            client.send(CommandsEnum.READY_TO_START)
        }
    }

    protected closeGame() {
        client.offClose(this.onConnectionLost)
        client.offReceive(
            CommandsEnum.START_TURN, CommandsEnum.TURN_PROGRESS, CommandsEnum.ROAD_REJECTED,
            CommandsEnum.END_ROUND, CommandsEnum.LEAVE_PARTY_MEMBER_SUCCESS, CommandsEnum.ERROR,
        )
        client.send(CommandsEnum.CLOSE_MULTIPLAYER)

        super.closeGame()
    }

    private waitForOthers(progress?: TurnProgressDto) {
        const counter = progress ? ` ${progress.done}/${progress.total}` : ""
        EventBus.emit(EventsEnum.STATUS, `WAITING FOR OTHER PLAYERS${counter}`)
    }
}
