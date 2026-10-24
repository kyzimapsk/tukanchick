import * as Phaser from "phaser";
import {ScenesEnum} from "../../enums/scenes.enum";
import {EventsEnum} from "../../enums/events.enum";
import {PlayerInfo} from "../../entity/playerInfo";
import {Assets} from "../../assets";
import {EventBus} from "../bus/EventBus";
import {Hexagon} from "../../entity/hexagon";
import {TownLetters} from "../../enums/townLetters";
import {ArtifactsEnum} from "../../enums/artifacts.enum";
import {fitCamera, hudLayout, HudLayout} from "../../scale/screen";
import {Point} from "../../entity/point";

// палитра поля игры: пергамент, коричневые чернила, акценты листа очков
const COLOR = {
    parchment: 0xf2e3c2,
    parchmentDark: 0xe2cd9f,
    wood: 0x6b4423,
    woodLight: 0x8d5f35,
    ink: 0x4a2f17,
    orange: 0xf0962b,
    green: 0x6fae3e,
    red: 0xb3402a,
    shadow: 0x000000,
}
const INK = "#4a2f17"
const INK_SOFT = "#8a6a45"
const PARCHMENT = "#f2e3c2"
const FONT = 'Georgia, "Times New Roman", serif'

const LANDMARKS: ArtifactsEnum[] = [
    ArtifactsEnum.OBELISK, ArtifactsEnum.BOOK, ArtifactsEnum.TUCAN, ArtifactsEnum.COALA, ArtifactsEnum.DRAGON,
]
const LANDMARK_STEP = 46
const VILLAGE_STEP = 40

// карточка земли 200x234 в атласе, на панели в половину
const CARD_SCALE = 0.5
const CARD_RADIUS = 56

/**
 * Позиции блоков панели в виртуальных координатах
 */
interface PanelPositions {
    round: Point
    landmarks: Point
    cards: Point
    villages: Point
    turn: Point
}

function panelPositions(layout: HudLayout): PanelPositions {
    if (layout.narrow) {
        return {
            round: {x: 60, y: 0},
            cards: {x: layout.width / 2, y: 0},
            turn: {x: layout.width - 70, y: 0},
            landmarks: {x: 30, y: 150},
            villages: {x: 340, y: 150},
        }
    }
    return {
        round: {x: 70, y: 0},
        landmarks: {x: 130, y: 0},
        cards: {x: layout.width / 2, y: 0},
        villages: {x: 655, y: 0},
        turn: {x: layout.width - 70, y: 0},
    }
}

function hexPoints(cx: number, cy: number, r: number): Phaser.Math.Vector2[] {
    const points = []
    for (let i = 0; i < 6; ++i) {
        const angle = Phaser.Math.DegToRad(60 * i - 90)
        points.push(new Phaser.Math.Vector2(cx + r * Math.cos(angle), cy + r * Math.sin(angle)))
    }
    return points
}

/**
 * Подпись-плашка со скруглёнными краями, подстраивается под длину текста
 */
class Pill {
    private readonly container: Phaser.GameObjects.Container
    private readonly background: Phaser.GameObjects.Graphics
    private readonly text: Phaser.GameObjects.Text

    constructor(scene: Phaser.Scene, x: number, y: number, private fill: number, color: string) {
        this.background = scene.add.graphics()
        this.text = scene.add.text(0, 0, "", {fontFamily: FONT, fontSize: "19px", fontStyle: "bold", color})
            .setOrigin(0.5)
        this.container = scene.add.container(x, y, [this.background, this.text]).setVisible(false)
    }

    get height() {
        return 34
    }

    get visible() {
        return this.container.visible
    }

    setY(y: number) {
        this.container.setY(y)
        return this
    }

    show(message: string) {
        this.text.setText(message)
        const width = this.text.width + 32

        this.background.clear()
            .fillStyle(COLOR.shadow, 0.25).fillRoundedRect(-width / 2 + 2, -this.height / 2 + 3, width, this.height, this.height / 2)
            .fillStyle(this.fill, 0.95).fillRoundedRect(-width / 2, -this.height / 2, width, this.height, this.height / 2)

        this.container.setVisible(!!message)
        return this
    }
}

export default class ControlsScene extends Phaser.Scene {

    playerInfo: PlayerInfo

    layout: HudLayout

    statusMessage: string = ""

    private roundText: Phaser.GameObjects.Text
    private roundTotalText: Phaser.GameObjects.Text
    private turnText: Phaser.GameObjects.Text
    private deckText: Phaser.GameObjects.Text

    private cards: Phaser.GameObjects.Image[]

    private skipButton: { graphics: Phaser.GameObjects.Graphics, text: Phaser.GameObjects.Text, zone: Phaser.GameObjects.Zone, x: number, y: number, enabled: boolean, hover: boolean }

    private landmarkIcons: Map<ArtifactsEnum, Phaser.GameObjects.Image>
    private landmarkDots: Map<ArtifactsEnum, Phaser.GameObjects.Graphics>
    private landmarkDotsOrigin: Map<ArtifactsEnum, Point>

    private villages: Map<TownLetters, { circle: Phaser.GameObjects.Graphics, text: Phaser.GameObjects.Text, x: number, y: number }>

    private bonusPill: Pill
    private noticePill: Pill
    private statusPill: Pill

    private noticeTimer: Phaser.Time.TimerEvent

    private artifactSplash: Phaser.GameObjects.Image

    constructor() {
        super(ScenesEnum.MAP_CONTROLS)
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

        const positions = panelPositions(this.layout)

        this.drawBackground()
        this.createRound(positions.round)
        this.createLandmarks(positions.landmarks)
        this.createCards(positions.cards)
        this.createVillages(positions.villages)
        this.createTurn(positions.turn)

        // плашки под панелью, поверх карты
        this.bonusPill = new Pill(this, this.layout.width / 2, 0, COLOR.orange, "#ffffff")
        this.noticePill = new Pill(this, this.layout.width / 2, 0, COLOR.red, "#ffffff")
        this.statusPill = new Pill(this, this.layout.width / 2, 0, COLOR.ink, PARCHMENT)

        this.artifactSplash = this.add.image(this.layout.width / 2, this.layout.height + 110, Assets.STAFF_IMAGE, ArtifactsEnum.OBELISK)
            .setOrigin(0.5, 0).setVisible(false)


        EventBus.onScene(this, EventsEnum.START_ROUND_AFTER, this.onStartTurn)
        EventBus.onScene(this, EventsEnum.START_TURN_AFTER, this.onStartTurn)
        EventBus.onScene(this, EventsEnum.MAKE_ROAD_AFTER, this.onMakeRoad)

        EventBus.onScene(this, EventsEnum.CONNECT_ARTIFACT, this.onConnectArtifact)
        EventBus.onScene(this, EventsEnum.CONNECT_TOWN, this.onConnectTown)
        EventBus.onScene(this, EventsEnum.BONUS_ROAD, this.updateRoadCounter)
        EventBus.onScene(this, EventsEnum.STATUS, this.setStatus)
        EventBus.onScene(this, EventsEnum.NOTICE, this.showNotice)

        this.onStartTurn()
        if (!this.playerInfo.readyTouch) {
            this.onMakeRoad()
        }
        this.refreshConnected()
        this.setStatus(this.statusMessage)

        this.fit()
        this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this)
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this))
    }

    // ---------------- построение ----------------

    private drawBackground() {
        const height = this.layout.height
        const g = this.add.graphics()

        // на всю ширину экрана при любом соотношении сторон
        const left = -50000
        const full = 100000

        // мягкая тень на карту
        for (let i = 0; i < 4; ++i) {
            g.fillStyle(COLOR.shadow, 0.08).fillRect(left, height, full, 3 + i * 3)
        }

        g.fillStyle(COLOR.parchment, 1).fillRect(left, 0, full, height)
        g.fillStyle(COLOR.parchmentDark, 0.6).fillRect(left, height * 0.55, full, height * 0.45)

        // деревянная кромка
        g.fillStyle(COLOR.wood, 1).fillRect(left, height - 6, full, 6)
        g.fillStyle(COLOR.woodLight, 1).fillRect(left, height - 6, full, 2)

        if (this.layout.narrow) {
            // разделитель двух строк панели
            g.lineStyle(1, COLOR.wood, 0.25).lineBetween(16, 148, this.layout.width - 16, 148)
        }
    }

    private caption(x: number, y: number, text: string) {
        return this.add.text(x, y, text, {fontFamily: FONT, fontSize: "13px", fontStyle: "bold", color: INK_SOFT})
            .setOrigin(0.5, 0).setLetterSpacing(2)
    }

    private createRound(p: Point) {
        this.caption(p.x, p.y + 14, "ROUND")
        this.roundText = this.add.text(p.x - 4, p.y + 78, "1", {fontFamily: FONT, fontSize: "56px", fontStyle: "bold", color: INK})
            .setOrigin(1, 0.5)
        this.roundTotalText = this.add.text(p.x, p.y + 90, "/ 2", {fontFamily: FONT, fontSize: "22px", color: INK_SOFT})
            .setOrigin(0, 0.5)
    }

    private createTurn(p: Point) {
        this.caption(p.x, p.y + 14, "TURN")
        this.turnText = this.add.text(p.x, p.y + 64, "1", {fontFamily: FONT, fontSize: "44px", fontStyle: "bold", color: INK})
            .setOrigin(0.5)

        const x = p.x
        const y = p.y + 118
        const graphics = this.add.graphics()
        const text = this.add.text(x, y, "SKIP", {fontFamily: FONT, fontSize: "20px", fontStyle: "bold", color: PARCHMENT})
            .setOrigin(0.5).setLetterSpacing(2)
        const zone = this.add.zone(x, y, 116, 40).setInteractive({useHandCursor: true})

        this.skipButton = {graphics, text, zone, x, y, enabled: true, hover: false}

        zone.on(Phaser.Input.Events.POINTER_OVER, () => this.drawSkip({hover: true}))
        zone.on(Phaser.Input.Events.POINTER_OUT, () => this.drawSkip({hover: false}))
        zone.on(Phaser.Input.Events.POINTER_UP, () => {
            if (this.skipButton.enabled) {
                EventBus.emit(EventsEnum.SKIP_TURN)
            }
        })
        this.drawSkip({})
    }

    private drawSkip(state: { hover?: boolean, enabled?: boolean }) {
        const b = this.skipButton
        b.hover = state.hover ?? b.hover
        b.enabled = state.enabled ?? b.enabled

        const w = 112, h = 38
        const fill = b.enabled && b.hover ? COLOR.woodLight : COLOR.wood

        b.graphics.clear()
            .fillStyle(COLOR.shadow, 0.3).fillRoundedRect(b.x - w / 2 + 1, b.y - h / 2 + 3, w, h, 10)
            .fillStyle(fill, 1).fillRoundedRect(b.x - w / 2, b.y - h / 2, w, h, 10)
            .lineStyle(2, 0xc89b62, 0.8).strokeRoundedRect(b.x - w / 2 + 3, b.y - h / 2 + 3, w - 6, h - 6, 8)

        b.graphics.setAlpha(b.enabled ? 1 : 0.35)
        b.text.setAlpha(b.enabled ? 1 : 0.5)
    }

    private createCards(p: Point) {
        const cy = p.y + 66
        const offsets = [-60, 60]

        const g = this.add.graphics()
        offsets.forEach((dx) => {
            const points = hexPoints(p.x + dx, cy, CARD_RADIUS + 3)
            g.fillStyle(COLOR.shadow, 0.25).fillPoints(points.map(v => new Phaser.Math.Vector2(v.x + 2, v.y + 4)), true)
            g.fillStyle(COLOR.wood, 1).fillPoints(points, true)
        })

        this.cards = offsets.map((dx) => {
            const card = this.add.image(p.x + dx, cy, Assets.GROUNDS_IMAGE).setScale(CARD_SCALE)

            // в атласе у карточек чёрные углы - оставляем только шестиугольник
            const maskShape = this.make.graphics({}, false)
            maskShape.fillStyle(0xffffff).fillPoints(hexPoints(p.x + dx, cy, CARD_RADIUS), true)
            card.setMask(maskShape.createGeometryMask())

            return card
        })

        this.deckText = this.add.text(p.x, p.y + 140, "", {fontFamily: FONT, fontSize: "15px", fontStyle: "bold", color: INK_SOFT})
            .setOrigin(0.5).setLetterSpacing(1)
    }

    private createLandmarks(p: Point) {
        this.landmarkIcons = new Map()
        this.landmarkDots = new Map()
        this.landmarkDotsOrigin = new Map()

        const width = LANDMARK_STEP * LANDMARKS.length
        this.caption(p.x + width / 2, p.y + 14, "LANDMARKS")

        LANDMARKS.forEach((artifact, i) => {
            const x = p.x + LANDMARK_STEP * i + LANDMARK_STEP / 2

            const icon = this.add.image(x, p.y + 68, Assets.STAFF_IMAGE, artifact)
            icon.setScale(Math.min(42 / icon.frame.width, 44 / icon.frame.height))
            this.landmarkIcons.set(artifact, icon)

            this.landmarkDots.set(artifact, this.add.graphics())
            this.landmarkDotsOrigin.set(artifact, {x, y: p.y + 108})
        })
    }

    private createVillages(p: Point) {
        this.villages = new Map()

        const letters = Object.values(TownLetters)
        const width = VILLAGE_STEP * letters.length
        this.caption(p.x + width / 2, p.y + 14, "VILLAGES")

        letters.forEach((letter, i) => {
            const x = p.x + VILLAGE_STEP * i + VILLAGE_STEP / 2
            const y = p.y + 72
            const circle = this.add.graphics()
            const text = this.add.text(x, y, letter, {fontFamily: FONT, fontSize: "20px", fontStyle: "bold", color: INK})
                .setOrigin(0.5)
            this.villages.set(letter, {circle, text, x, y})
        })
    }

    // ---------------- обновление ----------------

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
        this.turnText.setText(this.playerInfo.turn.toString())
        this.roundText.setText(Math.max(this.playerInfo.round, 1).toString())

        // по правилам раундов столько же, сколько на карте достопримечательностей каждого типа
        const roundCount = this.playerInfo.artifactScores.values().next().value?.length || 2
        this.roundTotalText.setText(`/ ${roundCount}`)

        const grounds = [this.playerInfo.groundA, this.playerInfo.groundB]
        this.cards.forEach((card, i) => {
            if (grounds[i]) {
                card.setFrame(grounds[i]).setAlpha(1).setVisible(true)
            } else {
                card.setVisible(false)
            }
        })

        this.updateRoadCounter()
        this.drawSkip({enabled: this.playerInfo.readyTouch})
    }

    private onMakeRoad() {
        this.updateRoadCounter()
        this.drawSkip({enabled: this.playerInfo.readyTouch})

        this.cards.forEach((card) => card.setAlpha(0.4))
    }

    private updateRoadCounter() {
        const deck = this.playerInfo.deckSize
        this.deckText.setText(`${deck} CARD${deck == 1 ? "" : "S"} LEFT`)

        const bonus = this.playerInfo.bonusRoad
        this.bonusPill.show(bonus > 0 ? `+${bonus} FREE ROAD` : "")
        this.layoutPills()
    }

    private setStatus(message: string) {
        this.statusMessage = message || ""
        this.statusPill?.show(this.statusMessage)
        this.layoutPills()
    }

    private showNotice(message: string) {
        this.noticePill.show(message)
        this.layoutPills()

        this.noticeTimer?.remove()
        this.noticeTimer = this.time.delayedCall(6000, () => {
            this.noticePill.show("")
            this.layoutPills()
        })
    }

    /**
     * Плашки под панелью идут стопкой: бонусная дорога, уведомление, статус
     */
    private layoutPills() {
        if (!this.bonusPill || !this.noticePill || !this.statusPill) {
            return
        }
        let y = this.layout.height + 28
        for (const pill of [this.bonusPill, this.noticePill, this.statusPill]) {
            pill.setY(y)
            if (pill.visible) {
                y += pill.height + 8
            }
        }
    }

    /**
     * Отметки соединённых артефактов и городов строятся по состоянию игрока
     */
    private refreshConnected() {
        LANDMARKS.forEach((artifact) => {
            const total = this.playerInfo.artifactScores.get(artifact)?.length || 0
            const connected = this.playerInfo.artifactConnected.get(artifact) || 0

            this.landmarkIcons.get(artifact).setAlpha(connected > 0 ? 1 : 0.45)

            const origin = this.landmarkDotsOrigin.get(artifact)
            const dots = this.landmarkDots.get(artifact).clear()
            const step = 13
            const startX = origin.x - (total - 1) * step / 2
            for (let i = 0; i < total; ++i) {
                const filled = i < connected
                dots.fillStyle(filled ? COLOR.orange : COLOR.parchmentDark, 1).fillCircle(startX + i * step, origin.y, 5)
                dots.lineStyle(1.5, filled ? COLOR.wood : COLOR.woodLight, filled ? 1 : 0.5).strokeCircle(startX + i * step, origin.y, 5)
            }
        })

        this.villages.forEach((v, letter) => {
            const connected = this.playerInfo.townLetterConnected.has(letter)
            v.circle.clear()
            if (connected) {
                v.circle.fillStyle(COLOR.green, 1).fillCircle(v.x, v.y, 16)
                    .lineStyle(2, COLOR.wood, 1).strokeCircle(v.x, v.y, 16)
                v.text.setColor("#ffffff").setAlpha(1)
            } else {
                v.circle.fillStyle(COLOR.parchmentDark, 1).fillCircle(v.x, v.y, 16)
                    .lineStyle(1.5, COLOR.woodLight, 0.5).strokeCircle(v.x, v.y, 16)
                v.text.setColor(INK).setAlpha(0.45)
            }
        })
    }

    private onConnectArtifact(hex: Hexagon) {
        this.refreshConnected()
        this.splash(hex.artifact)
    }

    private onConnectTown(townHexes: Hexagon[]) {
        this.refreshConnected()
        this.splash(`TOWN_${townHexes[0].townLetter}`)
    }

    private splash(frame: string) {
        this.artifactSplash.setFrame(frame).setAlpha(1).setScale(0.8).setVisible(true)

        this.tweens.killTweensOf(this.artifactSplash)
        this.tweens.add({
            targets: this.artifactSplash,
            scale: 1,
            duration: 250,
            ease: "Back.easeOut",
        })
        this.tweens.add({
            targets: this.artifactSplash,
            alpha: 0,
            delay: 600,
            duration: 300,
            onComplete: () => this.artifactSplash.setVisible(false),
        })
    }

}
