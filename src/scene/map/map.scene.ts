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
import {COLOR, TEXT_COLOR, textStyle} from "../../ui/theme";
import {isTown} from "../../game/board";
import {Point} from "../../entity/point";
import Graphics = Phaser.GameObjects.Graphics;

export default class MapScene extends Phaser.Scene {

    mapConfig: MapConfig

    graphics: Graphics

    roads: Graphics

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

        const mapInfo: MapInfo = director.mapInfo

        const bounds = mapInfo.generated ? this.drawGeneratedIsland(mapInfo) : this.drawClassicIsland()

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

        const camera = new MapCamera(this, bounds.width, bounds.height, bounds.x, bounds.y)

        //----

        this.playerInfo.hexagons.forEach((h: Hexagon, index: number) => {

                const polygonGeom = new Phaser.Geom.Polygon(h.points)
                const polygonGameObject = this.add.polygon(0, 0, h.points).setOrigin(0, 0)

                this.polygonGeoms.set(h.index, polygonGeom)
                this.polygonGameObjects.set(h.index, polygonGameObject)

                //this.drawHexagons(h)

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

        // слои: подсветка гексов -> дороги -> буквы деревень
        this.roads = this.add.graphics()
        this.playerInfo.hexagons.forEach((h) => this.drawTownLetter(h))

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
                this.scoreZones[z].create(mapInfo.scores[z].x, mapInfo.scores[z].y, "").setTextFont(72, TEXT_COLOR.ink, "bold")
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

    /**
     * Классический остров: картинка с нарисованными гексами и листом очков сбоку
     */
    private drawClassicIsland(): Phaser.Geom.Rectangle {
        const texture = this.mapConfig.island == IslandEnum.GRANDE ? Assets.MAP_ISLAND_GRANDE : Assets.MAP_ISLAND_PETIT
        const map = this.add.image(0, 0, texture).setOrigin(0, 0)
        return new Phaser.Geom.Rectangle(0, 0, map.width, map.height)
    }

    /**
     * Сгенерированный остров рисуется кодом: берег, плитки земель по форме гексов,
     * достопримечательности и деревни. Возвращает границы карты для камеры.
     */
    private drawGeneratedIsland(mapInfo: MapInfo): Phaser.Geom.Rectangle {
        const hexes = mapInfo.hexagons
        const allPoints = hexes.flatMap((h) => h.points)
        const margin = 160

        const minX = Math.min(...allPoints.map((p) => p.x))
        const maxX = Math.max(...allPoints.map((p) => p.x))
        const minY = Math.min(...allPoints.map((p) => p.y))
        const maxY = Math.max(...allPoints.map((p) => p.y))
        const bounds = new Phaser.Geom.Rectangle(minX - margin, minY - margin, maxX - minX + margin * 2, maxY - minY + margin * 2)

        const centerOf = (h: Hexagon) => ({
            x: h.points.reduce((s, p) => s + p.x, 0) / h.points.length,
            y: h.points.reduce((s, p) => s + p.y, 0) / h.points.length,
        })
        const scaled = (h: Hexagon, k: number) => {
            const c = centerOf(h)
            return h.points.map((p) => ({x: c.x + (p.x - c.x) * k, y: c.y + (p.y - c.y) * k}))
        }

        // пергамент вокруг и мягкий берег
        const ground = this.add.graphics()
        ground.fillStyle(COLOR.parchment, 1).fillRect(bounds.x - 5000, bounds.y - 5000, bounds.width + 10000, bounds.height + 10000)
        hexes.forEach((h) => ground.fillStyle(0xdcc596, 1).fillPoints(scaled(h, 1.3), true))
        hexes.forEach((h) => ground.fillStyle(0xc9a76a, 1).fillPoints(scaled(h, 1.1), true))

        this.add.image(bounds.x, bounds.y, this.paintTiles(hexes, bounds)).setOrigin(0, 0)

        const grid = this.add.graphics().lineStyle(3, COLOR.wood, 0.35)
        hexes.forEach((h) => grid.strokePoints(h.points, true))

        // достопримечательности и деревни
        const icons = this.add.graphics()
        hexes.forEach((h) => {
            const c = centerOf(h)
            if (isTown(h.artifact)) {
                // хижина на причале с поля игры; буква деревни - в левом верхнем углу гекса
                icons.fillStyle(COLOR.shadow, 0.25).fillEllipse(c.x + 18, c.y + 74, 110, 26)
                this.add.image(c.x + 18, c.y + 22, Assets.STAFF_IMAGE, "VILLAGE").setScale(0.64)
            } else if (h.artifact) {
                icons.fillStyle(COLOR.shadow, 0.25).fillEllipse(c.x, c.y + 52, 96, 26)
                const icon = this.add.image(c.x, c.y, Assets.STAFF_IMAGE, h.artifact)
                icon.setScale(Math.min(130 / icon.frame.width, 130 / icon.frame.height))
            }
        })

        return bounds
    }

    /**
     * Плитки земель собираются в одну текстуру один раз: каждая обрезается по своему гексу
     * (в атласе у плиток чёрные углы), а на кадр рисуется всего одна картинка
     */
    private paintTiles(hexes: Hexagon[], bounds: Phaser.Geom.Rectangle): string {
        const key = "generated-island-tiles"
        if (this.textures.exists(key)) {
            this.textures.remove(key)
        }

        const canvasTexture = this.textures.createCanvas(key, Math.ceil(bounds.width), Math.ceil(bounds.height))
        const ctx = canvasTexture.context
        const atlas = this.textures.get(Assets.GROUNDS_IMAGE)
        const source = atlas.getSourceImage() as CanvasImageSource

        hexes.forEach((h) => {
            const xs = h.points.map((p) => p.x - bounds.x)
            const ys = h.points.map((p) => p.y - bounds.y)
            const left = Math.min(...xs), right = Math.max(...xs)
            const top = Math.min(...ys), bottom = Math.max(...ys)
            const frame = atlas.get(h.ground)

            ctx.save()
            ctx.beginPath()
            h.points.forEach((p, i) => i == 0
                ? ctx.moveTo(p.x - bounds.x, p.y - bounds.y)
                : ctx.lineTo(p.x - bounds.x, p.y - bounds.y))
            ctx.closePath()
            ctx.clip()
            ctx.drawImage(source, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight,
                left - 2, top - 2, right - left + 4, bottom - top + 4)
            ctx.restore()
        })

        canvasTexture.refresh()
        return key
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
                pgo.setFillStyle(COLOR.orange, 0.45).setStrokeStyle(8, COLOR.wood, 0.9)
            } else if (hex.artifactConnected) {
                pgo.setFillStyle(COLOR.green, 0.32).setStrokeStyle(6, COLOR.green, 0.9)
            } else {
                pgo.isFilled = false
                pgo.isStroked = false
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

        const a = this.hexagonCenter(hexes[0])
        const b = this.hexagonCenter(hexes[1])

        // тропа: тёмная окантовка, красная дорога, точки-стоянки в центрах гексов
        this.roads
            .lineStyle(28, COLOR.woodDark, 0.45).lineBetween(a.x, a.y + 4, b.x, b.y + 4)
            .lineStyle(18, COLOR.red, 1).lineBetween(a.x, a.y, b.x, b.y)
            .lineStyle(4, COLOR.parchment, 0.55).lineBetween(a.x, a.y, b.x, b.y)

        for (const p of [a, b]) {
            this.roads.fillStyle(COLOR.woodDark, 1).fillCircle(p.x, p.y, 16)
                .fillStyle(COLOR.red, 1).fillCircle(p.x, p.y, 11)
        }

    }

    private onConnectArtifact(hex: Hexagon) {

        this.markHexagon(hex)
        this.drawArtifactFound(hex.artifact)

    }


    private drawArtifactFound(artifact: ArtifactsEnum) {

        const conCount = this.playerInfo.artifactConnected.get(artifact)
        const points = this.artifactMapZones.get(artifact)?.points

        if (conCount > 0 && points && points.length > 0) {
            for (let i = 0; i < conCount && i < points.length; ++i) {
                this.markFound(points[i])
            }
        }

    }


    private onConnectTown(townHexes: Hexagon[]) {

        // подсветить гексы на карте
        this.markHexagon(townHexes[0])
        this.markHexagon(townHexes[1])

        // обвести на боковой панеле
        const letter = townHexes[0].townLetter

        this.markFound(this.townZones.get(letter).point)
    }

    /**
     * Отметка на листе очков сбоку карты: зелёный круг, как обводят ручкой
     */
    private markFound(point: Point) {
        if (!point) {
            // у сгенерированной карты нет листа очков сбоку
            return
        }
        this.graphics
            .fillStyle(COLOR.green, 0.18).fillCircle(point.x, point.y, 44)
            .lineStyle(7, COLOR.green, 0.95).strokeCircle(point.x, point.y, 44)
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
        if (hexagon.townLetter && director.mapInfo.generated) {
            // на сгенерированной карте в центре гекса хижина - буква уходит в левый верхний угол
            const c = this.hexagonCenter(hexagon)
            this.add.text(c.x - 52, c.y - 58, hexagon.townLetter, textStyle(72))
                .setOrigin(0.5)
                .setStroke(TEXT_COLOR.parchment, 10)
        } else if (hexagon.townLetter) {

            const x = hexagon.points[5].x + (hexagon.points[1].x - hexagon.points[5].x) / 3
            const y = hexagon.points[0].y + (hexagon.points[2].y - hexagon.points[0].y) / 3

            this.add.text(x, y, hexagon.townLetter, textStyle(96))
                .setOrigin(0, 0)
                .setStroke(TEXT_COLOR.parchment, 12)
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
