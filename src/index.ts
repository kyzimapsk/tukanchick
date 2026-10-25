import * as Phaser from "phaser";
import MapScene from "./scene/map/map.scene";
import MainMenuScene from "./scene/main-menu/mainMenu.scene";
import ScoreScene from "./scene/map/score.scene";
import ControlsScene from "./scene/map/controls.scene";
import LobbyScene from "./scene/lobby/lobby.scene";
import {Director} from "./director/director";
import {IslandEnum} from "./enums/islands.enum";
import {SinglePlayDirector} from "./director/single-play-director";
import {MapConfig} from "./entity/mapConfig";
import {MultiPlayDirector} from "./director/multi-play-director";
import {EventBus} from "./scene/bus/EventBus";
import {EventsEnum} from "./enums/events.enum";
import LoadScene from "./scene/load/load.scene";
import {installAutoResize, scaleConfig} from "./scale/screen";
import {roundCountFor} from "./game/board";
import {randomSeed} from "./game/random";
import {isRandomMap} from "./settings";

const parent = document.getElementById('main-screen')

const config = {
    type: Phaser.AUTO,
    parent,
    fullscreenTarget: parent,
    // тёмное дерево вокруг карты и меню вместо чёрного
    backgroundColor: '#21160d',
    scene: [LoadScene, MainMenuScene, MapScene, ControlsScene, ScoreScene, LobbyScene],
    scale: scaleConfig(parent),
    input: {
        activePointers: 3,
    },
    dom: {
        createContainer: true
    }

} as Phaser.Types.Core.GameConfig;

export const game = new Phaser.Game(config);

installAutoResize(game, parent)

export let director: Director = null

export function startSinglePlayer(island: IslandEnum) {

    director = new SinglePlayDirector(game)

    EventBus.emit(EventsEnum.START_GAME, {
        island,
        roundCount: roundCountFor(island),
        seed: isRandomMap() ? randomSeed() : undefined,
    } as MapConfig)
}

export function startMultiPlayer(selfId: number, nickname: string) {

    director = new MultiPlayDirector(game, selfId, nickname)
}
