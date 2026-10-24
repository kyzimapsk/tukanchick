import {Director} from "./director";
import {EventBus} from "../scene/bus/EventBus";
import {EventsEnum} from "../enums/events.enum";
import {ScenesEnum} from "../enums/scenes.enum";
import {MapConfig} from "../entity/mapConfig";
import Deck from "../game/deck";
import {Hexagon} from "../entity/hexagon";
import TownSpawner from "../game/town-spawner";
import * as board from "../game/board";
import {RoadResult} from "../game/board";

export class SinglePlayDirector extends Director {

    // колода кароточек с землями
    deck: Deck

    protected startGame(mapConfig: MapConfig) {
        this.initBoard(mapConfig, TownSpawner.randomRoll(), "PLAYER")
        this.showMap()
    }

    protected initializeMapAfter() {
        this.game.scene.start(ScenesEnum.MAP_CONTROLS, this.playerInfo)

        EventBus.emit(EventsEnum.START_ROUND)
    }

    protected startRound() {
        this.deck = new Deck()
        board.startRound(this.playerInfo)

        EventBus.emit(EventsEnum.START_ROUND_AFTER)
        EventBus.emit(EventsEnum.START_TURN)
    }


    protected startTurn() {
        const groundA = this.deck.pop()
        const groundB = this.deck.pop()

        board.startTurn(this.playerInfo, groundA, groundB, this.deck.size())

        EventBus.emit(EventsEnum.START_TURN_AFTER)
    }

    protected makeRoad(hexes: Hexagon[]): RoadResult | null {
        const result = super.makeRoad(hexes)
        if (result?.turnEnded) {
            EventBus.emit(EventsEnum.END_TURN)
        }
        return result
    }

    protected skipTurn() {
        if (board.skipTurn(this.playerInfo)) {
            EventBus.emit(EventsEnum.MAKE_ROAD_AFTER)
            EventBus.emit(EventsEnum.END_TURN)
        }
    }


    protected endTurn() {
        const mapScene = this.game.scene.getScene(ScenesEnum.MAP)

        if (this.deck.isRoundOver()) {
            EventBus.emitDelayed(mapScene, 300, EventsEnum.END_ROUND)
        } else {
            EventBus.emitDelayed(mapScene, 300, EventsEnum.START_TURN)
        }
    }


    protected endRound() {
        board.endRound(this.playerInfo, this.mapConfig.roundCount)

        EventBus.emit(EventsEnum.END_ROUND_AFTER)

        this.showScoreScreen()
    }

    protected scoreClosed() {
        if (this.playerInfo.gameEnd) {
            EventBus.emit(EventsEnum.CLOSE_GAME)
        } else {
            EventBus.emit(EventsEnum.START_ROUND)
        }
    }
}
