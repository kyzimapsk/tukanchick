import * as Phaser from "phaser";
import {EventBus} from "../scene/bus/EventBus";
import {EventsEnum} from "../enums/events.enum";
import {MapConfig} from "../entity/mapConfig";
import {Hexagon} from "../entity/hexagon";
import {PlayerInfo} from "../entity/playerInfo";
import {ScenesEnum} from "../enums/scenes.enum";
import {IslandEnum} from "../enums/islands.enum";
import {Assets} from "../assets";
import {MapInfo} from "../entity/mapInfo";
import {buildRoad, createPlayer, initBoard, RoadResult} from "../game/board";
import {generateMapInfo} from "../game/map-generator";
import {StandingDto} from "../multiplayer/protocol";
import {ScoreSceneData} from "../scene/map/score.scene";

export abstract class Director {

    mapConfig: MapConfig

    playerInfo: PlayerInfo

    // карта текущей игры: классическая из ассетов или сгенерированная
    mapInfo: MapInfo

    constructor(protected game: Phaser.Game) {
        EventBus.clear()


        // начало игры
        EventBus.on(EventsEnum.START_GAME, this.startGame, this)

        EventBus.on(EventsEnum.START_ROUND, this.startRound, this)
        EventBus.on(EventsEnum.START_TURN, this.startTurn, this)
        EventBus.on(EventsEnum.END_TURN, this.endTurn, this)
        EventBus.on(EventsEnum.END_ROUND, this.endRound, this)

        EventBus.on(EventsEnum.MAKE_ROAD, this.makeRoad, this)
        EventBus.on(EventsEnum.SKIP_TURN, this.skipTurn, this)

        EventBus.on(EventsEnum.SCORE_CLOSED, this.scoreClosed, this)
        EventBus.on(EventsEnum.CLOSE_GAME, this.closeGame, this)
        //
        EventBus.on(EventsEnum.INITIALIZE_MAP_AFTER, this.initializeMapAfter, this)
    }

    protected initializeMapAfter() {
    }

    protected startGame(mapConfig: MapConfig) {
    }

    protected startRound() {
    }

    protected startTurn() {
    }

    protected endTurn() {
    }

    protected endRound() {
    }

    protected skipTurn() {
    }

    protected scoreClosed() {
    }

    protected makeRoad(hexes: Hexagon[]): RoadResult | null {
        if (!hexes || hexes.length < 2 || !hexes[0] || !hexes[1]) {
            return null
        }
        return this.applyRoad(hexes[0].index, hexes[1].index)
    }

    protected closeGame() {
        this.game.scene.stop(ScenesEnum.SCORE)
        this.game.scene.stop(ScenesEnum.MAP_CONTROLS)
        this.game.scene.stop(ScenesEnum.MAP)

        this.game.scene.start(ScenesEnum.MAIN_MENU)
    }

    /**
     * Создаёт игрока и его карту
     */
    protected initBoard(mapConfig: MapConfig, townRoll: number, playerName: string) {
        this.mapConfig = mapConfig
        this.playerInfo = createPlayer(playerName)

        const mapInfoAsset = mapConfig.island == IslandEnum.GRANDE ? Assets.MAPINFO_ISLAND_GRANDE : Assets.MAPINFO_ISLAND_PETIT
        const baseMapInfo: MapInfo = this.game.cache.json.get(mapInfoAsset)

        this.mapInfo = mapConfig.seed ? generateMapInfo(baseMapInfo, mapConfig.seed) : baseMapInfo

        initBoard(this.playerInfo, this.mapInfo, townRoll)
    }

    protected showMap() {
        this.game.scene.stop(ScenesEnum.MAIN_MENU)
        this.game.scene.stop(ScenesEnum.LOBBY)

        this.game.scene.start(ScenesEnum.MAP, this.mapConfig)
    }

    protected showScoreScreen(standings?: StandingDto[], selfId?: number) {
        this.game.scene.start(ScenesEnum.SCORE, {playerInfo: this.playerInfo, standings, selfId} as ScoreSceneData)
    }

    /**
     * Строит дорогу по правилам и оповещает сцены о результате
     */
    protected applyRoad(a: number, b: number): RoadResult | null {
        const result = buildRoad(this.playerInfo, a, b, this.mapConfig.roundCount)
        if (!result) {
            return null
        }

        EventBus.emit(EventsEnum.DRAW_ROAD, this.playerInfo.hexagons.get(a), this.playerInfo.hexagons.get(b))

        result.connectedArtifacts.forEach((hex) => EventBus.emit(EventsEnum.CONNECT_ARTIFACT, hex))
        if (result.bonusRoadGained > 0) {
            EventBus.emit(EventsEnum.BONUS_ROAD)
        }
        result.connectedTowns.forEach((towns) => EventBus.emit(EventsEnum.CONNECT_TOWN, towns[0], towns[1]))

        EventBus.emit(EventsEnum.MAKE_ROAD_AFTER)

        return result
    }
}
