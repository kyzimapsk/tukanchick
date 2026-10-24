import * as Phaser from "phaser";
import {ScenesEnum} from "../../enums/scenes.enum";
import {Button} from "../../controls/button";
import {EventsEnum} from "../../enums/events.enum";
import {PlayerInfo} from "../../entity/playerInfo";
import {Assets} from "../../assets";
import {Image} from "../../controls/image";
import {EventBus} from "../bus/EventBus";
import {Hexagon} from "../../entity/hexagon";
import {TownLetters} from "../../enums/townLetters";
import {ArtifactsEnum} from "../../enums/artifacts.enum";
import {ControlsInfo} from "../../entity/controlsInfo";
import {fitCamera, hudLayout, HudLayout} from "../../scale/screen";
import {Point} from "../../entity/point";

/**
 * Позиции блоков панели в виртуальных координатах для широкого и узкого (портретного) экрана
 */
interface PanelPositions {
    grounds: Point[]
    deck: Point
    // точка, от которой откладываются смещения из controls.info.json
    artifacts: Point
    towns: Point
    status: Point
    bonusRoad: Point
}

function panelPositions(layout: HudLayout): PanelPositions {
    const centerX = layout.width / 2

    if (layout.narrow) {
        return {
            grounds: [{x: centerX - 60, y: 5}, {x: centerX + 60, y: 5}],
            deck: {x: centerX, y: 125},
            artifacts: {x: 30, y: 175},
            towns: {x: 360, y: 175},
            status: {x: centerX, y: 340},
            bonusRoad: {x: centerX, y: 100},
        }
    }
    return {
        grounds: [{x: centerX - 70, y: 5}, {x: centerX + 70, y: 5}],
        deck: {x: centerX, y: 125},
        artifacts: {x: 100, y: 10},
        towns: {x: 660, y: 10},
        status: {x: centerX, y: 180},
        bonusRoad: {x: centerX, y: 100},
    }
}

// смещения в controls.info.json заданы относительно центра панели шириной 1000
const ARTIFACTS_OFFSET_X = 400
const TOWNS_OFFSET_X = -200

export default class ControlsScene extends Phaser.Scene {

    playerInfo: PlayerInfo

    groundA: Image
    groundB: Image

    bonusRoad: Button

    artifactSplash: Image

    roundLabel: Button
    nextTurnLabel: Button

    roundCount: Button
    deckSizeCount: Button
    turnCount: Button

    skipButton: Button

    statusText: Phaser.GameObjects.Text

    statusMessage: string = ""

    artifactZones: Map<string, Image>

    controlsInfo: ControlsInfo

    layout: HudLayout

    constructor() {
        super(ScenesEnum.MAP_CONTROLS)

        this.groundA = new Image(this).preloadAtlasExtern(Assets.GROUNDS_IMAGE)
        this.groundB = new Image(this).preloadAtlasExtern(Assets.GROUNDS_IMAGE)

        this.bonusRoad = new Button(this).preloadExtern(Assets.SAND_1)

        this.artifactSplash = new Image(this).preloadAtlasExtern(Assets.STAFF_IMAGE)

        this.roundLabel = new Button(this).preloadExtern(Assets.SAND_1)
        this.nextTurnLabel = new Button(this).preloadExtern(Assets.SAND_1)

        this.roundCount = new Button(this).preloadExtern(Assets.SAND_1)
        this.deckSizeCount = new Button(this)
        this.turnCount = new Button(this).preloadExtern(Assets.SAND_1)

        this.skipButton = new Button(this).preloadExtern(Assets.SAND_1)

        this.artifactZones = new Map()

        for (const a in ArtifactsEnum) {
            if (!a.toString().startsWith("TOWN")) {
                for (let p = 0; p < 3; ++p) {
                    const key: string = a + p.toString()
                    this.artifactZones.set(key, new Image(this).preloadAtlasExtern(Assets.STAFF_IMAGE))
                }
            }
        }
        for (const t in TownLetters) {
            this.artifactZones.set(t, new Image(this).preloadAtlasExtern(Assets.STAFF_IMAGE))
        }
    }

    preload() {
        const playerInfo = this.scene.settings.data as PlayerInfo
        if (playerInfo !== this.playerInfo) {
            // новая игра
            this.statusMessage = ""
        }
        this.playerInfo = playerInfo
    }

    create() {
        const {width: screenWidth, height: screenHeight} = this.scale.gameSize
        this.layout = hudLayout(screenWidth, screenHeight)

        const panelWidth = this.layout.width
        const panelHeight = this.layout.height
        const positions = panelPositions(this.layout)

        // фон тянется на всю ширину экрана при любом соотношении сторон
        this.add.rectangle(panelWidth / 2, 0, 100000, panelHeight, 0xe6cf98, 0.85).setOrigin(0.5, 0)

        this.roundLabel.create(0, 0, "ROUND").setDisplaySize(80, 50).setTextFont(20, "black")
        this.roundCount.create(0, 50, "ROUND_COUNT").setDisplaySize(80, 50).setTextFont(40, "black")

        this.nextTurnLabel.create(panelWidth, 0, "TURN")
            .setOrigin(1, 0).setDisplaySize(100, 50).setTextFont(20, "red")
        this.turnCount.create(panelWidth, 50, "TURN")
            .setOrigin(1, 0).setDisplaySize(100, 50).setTextFont(40, "red")

        this.skipButton.create(panelWidth, 105, "SKIP", () => EventBus.emit(EventsEnum.SKIP_TURN))
            .setOrigin(1, 0).setDisplaySize(100, 45).setTextFont(26, "black", "bold")

        this.deckSizeCount.create(positions.deck.x, positions.deck.y, "_")
            .setOrigin(0.5, 0).setTextFont(32, "green", "bold")


        this.groundA.createAtlas(positions.grounds[0].x, positions.grounds[0].y).setOrigin(0.5, 0).imageGO.setScale(0.5)
        this.groundB.createAtlas(positions.grounds[1].x, positions.grounds[1].y).setOrigin(0.5, 0).imageGO.setScale(0.5)

        this.controlsInfo = this.cache.json.get(Assets.CONTROLS_INFO)

        for (const a of this.controlsInfo.artifacts) {
            for (let p = 0; p < a.points.length; ++p) {
                const key: string = a.artifact.toString() + p.toString()
                const img = this.artifactZones.get(key)
                img.createAtlas(positions.artifacts.x + ARTIFACTS_OFFSET_X + a.points[p].x, positions.artifacts.y + a.points[p].y, a.artifact)
                    .imageGO.setScale(0.4).setVisible(false)
            }
        }
        for (const t of this.controlsInfo.towns) {
            const img = this.artifactZones.get(t.letter)
            img.createAtlas(positions.towns.x + TOWNS_OFFSET_X + t.point.x, positions.towns.y + t.point.y, "TOWN_" + t.letter)
                .imageGO.setScale(0.4).setVisible(false)

        }

        this.statusText = this.add.text(positions.status.x, positions.status.y, this.statusMessage)
            .setOrigin(0.5, 0.5).setFontSize(22).setFontStyle('bold')
            .setColor("#ffffff").setStroke("#000000", 4)

        this.bonusRoad.create(positions.bonusRoad.x, positions.bonusRoad.y, '_').setOrigin(0.5, 0.5)
            .setDisplaySize(440, 90).setTextFont(60, "blue")
            .setAlphaImage(0.5).setVisible(false)

        this.artifactSplash.createAtlas(panelWidth / 2, panelHeight + 20).setOrigin(0.5, 0)
            .setVisible(false)


        EventBus.onScene(this, EventsEnum.START_ROUND_AFTER, this.onStartTurn)
        EventBus.onScene(this, EventsEnum.START_TURN_AFTER, this.onStartTurn)
        EventBus.onScene(this, EventsEnum.MAKE_ROAD_AFTER, this.onMakeRoad)

        EventBus.onScene(this, EventsEnum.CONNECT_ARTIFACT, this.onConnectArtifact)
        EventBus.onScene(this, EventsEnum.CONNECT_TOWN, this.onConnectTown)
        EventBus.onScene(this, EventsEnum.BONUS_ROAD, this.updateRoadCounter)
        EventBus.onScene(this, EventsEnum.STATUS, this.setStatus)

        this.onStartTurn();
        if (!this.playerInfo.readyTouch) {
            this.onMakeRoad()
        }
        this.refreshConnected()

        this.fit()
        this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this)
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this))
    }

    private onResize() {
        const {width, height} = this.scale.gameSize
        if (hudLayout(width, height).narrow !== this.layout.narrow) {
            // сменилась ориентация экрана - пересобираем панель в другой раскладке
            this.scene.restart(this.playerInfo)
        } else {
            this.fit()
        }
    }

    private fit() {
        const {width, height} = this.scale.gameSize
        this.layout = hudLayout(width, height)
        fitCamera(this, this.layout.width, this.layout.height, "top", this.layout.zoom)
    }

    private onStartTurn() {

        this.turnCount.setText(this.playerInfo.turn.toString())

        if (this.playerInfo.groundA) {
            this.groundA.changeFrame(this.playerInfo.groundA).setVisible(true)
            this.groundB.changeFrame(this.playerInfo.groundB).setVisible(true)
        } else {
            this.groundA.setVisible(false)
            this.groundB.setVisible(false)
        }

        this.updateRoundCount()
        this.updateRoadCounter()
        this.updateSkip()
    }

    private onMakeRoad() {
        this.updateRoadCounter()
        this.updateSkip()

        this.groundA.setAlphaImage(0.5)
        this.groundB.setAlphaImage(0.5)
    }


    private updateRoundCount() {
        this.roundCount.setText(this.playerInfo.round.toString())

    }

    private updateRoadCounter() {
        this.deckSizeCount.setText(this.playerInfo.deckSize.toString())

        this.bonusRoad.setText(`FREE-ROAD ${this.playerInfo.bonusRoad}`)
        this.bonusRoad.setVisible(this.playerInfo.bonusRoad > 0)
    }

    private updateSkip() {
        this.skipButton.setDisable(!this.playerInfo.readyTouch)
    }

    private setStatus(message: string) {
        this.statusMessage = message || ""
        this.statusText?.setText(this.statusMessage)
    }

    /**
     * Отметки соединённых артефактов и городов строятся по состоянию игрока,
     * поэтому одновременное соединение нескольких артефактов одного типа тоже отображается верно
     */
    private refreshConnected() {
        this.controlsInfo.artifacts.forEach((a) => {
            const count = this.playerInfo.artifactConnected.get(a.artifact) || 0
            for (let p = 0; p < a.points.length; ++p) {
                this.artifactZones.get(a.artifact.toString() + p.toString())?.setVisible(p < count)
            }
        })
        this.controlsInfo.towns.forEach((t) => {
            this.artifactZones.get(t.letter)?.setVisible(this.playerInfo.townLetterConnected.has(t.letter))
        })
    }

    private onConnectArtifact(hex: Hexagon) {
        this.refreshConnected()

        this.artifactSplash.changeFrame(hex.artifact).setAlphaImage(1).setVisible(true)

        this.hideArtifactSplash()
    }


    private onConnectTown(townHexes: Hexagon[]) {
        const letter = townHexes[0].townLetter
        this.refreshConnected()

        this.artifactSplash.changeFrame(`TOWN_${letter}`).setAlphaImage(1).setVisible(true)

        this.hideArtifactSplash()
    }

    private hideArtifactSplash() {
        this.time.delayedCall(400, () => {
            this.artifactSplash.setAlphaImage(0.7)
        })
        this.time.delayedCall(800, () => {
            this.artifactSplash.setVisible(false)
        })
    }


}
