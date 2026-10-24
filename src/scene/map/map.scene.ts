import * as Phaser from "phaser";
import {MapConfig} from "../../entity/mapConfig";
import {IslandEnum} from "../../enums/islands.enum";
import {Assets} from "../../assets";
import {ScenesEnum} from "../../enums/scenes.enum";
import {Hexagon} from "../../entity/hexagon";
import {PlayerInfo} from "../../entity/playerInfo";
import {EventsEnum} from "../../enums/events.enum";
import {ArtifactsEnum} from "../../enums/artifacts.enum";
import {ArtifactMapZone} from "../../entity/artifactMapZone";
import {MapInfo} from "../../entity/mapInfo";
import {Button} from "../../controls/button";
import {ScoreZonesEnum} from "../../enums/scoreZones.enum";
import {TownLetters} from "../../enums/townLetters";
import {TownMapZone} from "../../entity/townMapZone";
import MapCamera from "./camera";
import {EventBus} from "../bus/EventBus";
import {director} from "../../index";
import {sharpenTexts} from "../../scale/screen";
import {Point} from "../../entity/point";
import Graphics = Phaser.GameObjects.Graphics;

export default class MapScene extends Phaser.Scene {

    mapConfig: MapConfig

    graphics: Graphics

    artifactMapZones: Map<ArtifactsEnum, ArtifactMapZone>

    polygonGeoms: Map<number, Phaser.Geom.Polygon>

    polygonGameObjects: Map<number, Phaser.GameObjects.Polygon>

    // гексы при соединении перетаскиванием
    hexA: Hexagon
    hexB: Hexagon

    //очки
    scoreZones: Button[]

    //города
    townZones: Map<TownLetters, TownMapZone>

    get playerInfo(): PlayerInfo {
        return director.playerInfo
    }


    constructor() {
        super(ScenesEnum.MAP);

        this.scoreZones = []
        for (const z in ScoreZonesEnum) {
            this.scoreZones[z] = new Button(this)
        }

    }

    preload() {
        this.mapConfig = this.getConfigOrDefault()
    }

    create() {

        const mapAssertTextureName = this.mapConfig.island == IslandEnum.GRANDE ?  Assets.MAP_ISLAND_GRANDE : Assets.MAP_ISLAND_PETIT;
        const mapAssertInfoName = this.mapConfig.island == IslandEnum.GRANDE ?  Assets.MAPINFO_ISLAND_GRANDE : Assets.MAPINFO_ISLAND_PETIT;

        const map = this.add.image(0, 0, mapAssertTextureName).setOrigin(0, 0)

        const mapInfo: MapInfo = this.cache.json.get(mapAssertInfoName)

        this.artifactMapZones = new Map()
        mapInfo.artifacts.forEach((z) => this.artifactMapZones.set(z.artifact, z))

        this.townZones = new Map()
        mapInfo.towns.forEach((z) => this.townZones.set(z.letter, z))

        this.graphics = this.add.graphics();

        this.polygonGeoms = new Map()

        this.polygonGameObjects = new Map()

        this.hexA = null
        this.hexB = null

        //----

        const camera = new MapCamera(this, map.width, map.height)

        //----

        this.playerInfo.hexagons.forEach((h: Hexagon, index: number) => {

                const polygonGeom = new Phaser.Geom.Polygon(h.points)
                const polygonGameObject = this.add.polygon(0, 0, h.points).setOrigin(0, 0)

                this.polygonGeoms.set(h.index, polygonGeom)
                this.polygonGameObjects.set(h.index, polygonGameObject)

                //this.drawHexagons(h)

                this.drawTownLetter(h)

                polygonGameObject
                    .setInteractive(polygonGeom,
                        (hitArea: Phaser.Geom.Polygon, x: number, y: number) => this.playerInfo.readyTouch && !camera.getDragging() && hitArea.contains(x, y))
                    .on('pointerdown', (pointer: Phaser.Input.Pointer) => {
                        if (camera.getDragging()) {
                            this.clearSelected()
                        } else if (pointer.leftButtonDown()) {
                            this.hexA = h
                            this.addToSelected(h)
                        }
                    })
                    .on('pointerup', (pointer: Phaser.Input.Pointer) => {
                        if (camera.getDragging()) {
                            this.clearSelected()
                        } else if (pointer.leftButtonReleased() && this.hexA) {
                            this.hexB = h
                            EventBus.emit(EventsEnum.MAKE_ROAD, this.hexA, this.hexB)
                            this.clearSelected()
                        }
                    })
                    .on('pointerover', () => {
                        if (camera.getDragging()) {
                            this.clearSelected()
                        } else {
                            this.addToSelected(h)
                        }
                    })
                    .on('pointerout', () => {
                        if (this.hexA != h && this.hexB != h) {
                            this.removeFromSelected(h)
                        }
                    })
            }
        )

        // отпустили палец/кнопку не над гексом - выбор сбрасывается
        this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, () => this.clearSelected())
        this.input.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
            if (over.length == 0) {
                this.clearSelected()
            }
        })

        //----

        for (const z in ScoreZonesEnum) {
            if (mapInfo.scores[z]?.x) {
                this.scoreZones[z].create(mapInfo.scores[z].x, mapInfo.scores[z].y, "___").setTextFont(80, "black")
            }
        }

        sharpenTexts(this, 2)

        //----


        EventBus.onScene(this, EventsEnum.DRAW_ROAD, this.drawRoad)

        EventBus.onScene(this, EventsEnum.END_ROUND_AFTER, this.drawScore)


        EventBus.onScene(this, EventsEnum.CONNECT_ARTIFACT, this.onConnectArtifact)
        EventBus.onScene(this, EventsEnum.CONNECT_TOWN, this.onConnectTown)
        EventBus.onScene(this, EventsEnum.MARK_HEXAGON, this.markHexagon)


        //----
        EventBus.emit(EventsEnum.INITIALIZE_MAP_AFTER)
    }

    update(time: number, delta: number) {


    }

    private addToSelected(hex: Hexagon) {
        hex.isSelected = true
        this.markHexagon(hex)
    }

    private removeFromSelected(hex: Hexagon) {
        hex.isSelected = false
        this.markHexagon(hex)
    }

    private markHexagon(hex: Hexagon) {
        const pgo = this.polygonGameObjects.get(hex.index)

        if (pgo) {
            if (hex.isSelected) {
                pgo.setFillStyle(0x61b65f, 0.6)
            } else if (hex.artifactConnected) {
                pgo.setFillStyle(0xcccc00, 0.4)
            } else {
                pgo.isFilled = false
            }
        }
    }

    private clearSelected() {
        this.playerInfo.hexagons.forEach((hex, index) => {
            this.removeFromSelected(hex)
        })
        this.hexA = null
        this.hexB = null
    }

    private drawRoad(hexes: Hexagon[]) {

        const pointA = this.hexagonCenter(hexes[0])
        const pointB = this.hexagonCenter(hexes[1])

        this.add.line(0, 0, pointA.x, pointA.y, pointB.x, pointB.y, 0xff0000).setOrigin(0, 0)
            .setLineWidth(3, 3)

    }

    private onConnectArtifact(hex: Hexagon) {

        this.markHexagon(hex)
        this.drawArtifactFound(hex.artifact)

    }


    private drawArtifactFound(artifact: ArtifactsEnum) {

        const conCount = this.playerInfo.artifactConnected.get(artifact)
        const points = this.artifactMapZones.get(artifact)?.points

        if (conCount > 0 && points && points.length > 0) {
            this.graphics.lineStyle(4, 0x00ff00, 1);

            for (let i = 0; i < conCount; ++i) {
                this.graphics.strokeCircle(points[i].x, points[i].y, 45);
            }
        }

    }


    private onConnectTown(townHexes: Hexagon[]) {

        // подсветить гексы на карте
        this.markHexagon(townHexes[0])
        this.markHexagon(townHexes[1])

        // обвести на боковой панеле
        const letter = townHexes[0].townLetter

        const point = this.townZones.get(letter).point
        this.graphics.lineStyle(4, 0x00ff00, 1);
        this.graphics.strokeCircle(point.x, point.y, 45);
    }


    private drawScore() {

        // рисуем на боковой панельке подсчитанные очки
        for (const z in ScoreZonesEnum) {
            const score = this.playerInfo.scores[z]
            if (score !== undefined && score !== null) {
                this.scoreZones[z].setText(score.toString())
            }
        }
    }

    private hexagonCenter(hexagon: Hexagon): Point {
        return {
            x: hexagon.points[0].x,
            y: hexagon.points[0].y + (hexagon.points[3].y - hexagon.points[0].y) / 2
        }
    }


    private drawTownLetter(hexagon: Hexagon) {
        if (hexagon.townLetter) {

            const x = hexagon.points[5].x + (hexagon.points[1].x - hexagon.points[5].x) / 3
            const y = hexagon.points[0].y + (hexagon.points[2].y - hexagon.points[0].y) / 3

            this.add.text(x, y, hexagon.townLetter)
                .setOrigin(0, 0)
                .setColor("#000000")
                .setFontStyle("bold")
                .setFontSize(100)
        }
    }

    private drawHexagons(hexagon: Hexagon) {
        for (let i = 0; i < hexagon.points.length; ++i) {
            let a = hexagon.points[i];
            let b = i + 1 < hexagon.points.length ? hexagon.points[i + 1] : hexagon.points[0]

            this.add.line(0, 0, a.x, a.y, b.x, b.y, 0xff0000).setOrigin(0, 0)
        }
        //

        this.add.text(hexagon.points[0].x - 10, hexagon.points[0].y + 10, hexagon.index.toString())
            .setOrigin(0, 0)
            .setColor("#000000")
            .setFontSize(50)

        /*this.add.text(hexagon.points[0].x - 60, hexagon.points[0].y + 50, hexagon.ground)
            .setOrigin(0, 0)
            .setColor("#000000")
            .setFontSize(50)*/

        /*
        this.add.text(hexagon.points[0].x - 60, hexagon.points[0].y + 50, hexagon.artifact)
            .setOrigin(0, 0)
            .setColor("#000000")
            .setFontSize(50)
        */

    }

    private getConfigOrDefault(): MapConfig {
        const res = this.scene.settings.data as MapConfig;
        return res?.island ? res : {
            island: IslandEnum.PETIT,
            roundCount: 2
        }
    }
}
