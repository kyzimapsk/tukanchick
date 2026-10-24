import * as Phaser from "phaser";
import {ScenesEnum} from "../../enums/scenes.enum";
import {EventsEnum} from "../../enums/events.enum";
import {PlayerInfo} from "../../entity/playerInfo";
import {EventBus} from "../bus/EventBus";
import {ScoreZonesEnum} from "../../enums/scoreZones.enum";
import {StandingDto} from "../../multiplayer/protocol";
import {keepFitted, pixelRatio} from "../../scale/screen";
import {COLOR, drawPanel, TEXT_COLOR, textStyle} from "../../ui/theme";
import {WoodButton} from "../../ui/wood-button";

export interface ScoreSceneData {
    playerInfo: PlayerInfo

    // результаты всех игроков (мультиплеер)
    standings?: StandingDto[]

    selfId?: number
}

const WIDTH = 640
const PANEL_MARGIN = 20
const ROW_HEIGHT = 52
const STANDING_HEIGHT = 42

const ROMAN = ["I", "II", "III"]

// золото, серебро, бронза
const MEDALS = [0xd4a017, 0xa8a8a8, 0xb87333]

export default class ScoreScene extends Phaser.Scene {

    playerInfo: PlayerInfo

    standings: StandingDto[]

    selfId: number

    constructor() {
        super(ScenesEnum.SCORE)
    }

    preload() {
        const data = this.scene.settings.data as ScoreSceneData
        this.playerInfo = data.playerInfo
        this.standings = data.standings
        this.selfId = data.selfId
    }

    create() {
        const gameEnd = this.playerInfo.gameEnd
        // по правилам раундов столько же, сколько на карте достопримечательностей каждого типа
        const roundCount = this.playerInfo.artifactScores.values().next().value?.length || 2
        const standings = this.standings?.length > 0 ? this.sortedStandings() : []

        const scoreRows = roundCount + (gameEnd ? 2 : 0)
        const standingsHeight = standings.length > 0 ? 50 + standings.length * STANDING_HEIGHT : 0
        const height = 160 + scoreRows * ROW_HEIGHT + 20 + standingsHeight + 110

        const centerX = WIDTH / 2

        // затемнение карты на экране любого размера
        this.add.rectangle(centerX, height / 2, 100000, 100000, COLOR.shadow, 0.55)
        drawPanel(this.add.graphics(), PANEL_MARGIN, PANEL_MARGIN, WIDTH - PANEL_MARGIN * 2, height - PANEL_MARGIN * 2)

        const title = gameEnd ? "GAME OVER" : `ROUND ${this.playerInfo.round} COMPLETE`
        this.add.text(centerX, 82, title, textStyle(34)).setOrigin(0.5).setLetterSpacing(3)
        this.add.text(centerX, 120, gameEnd ? "final score" : "points for connected landmarks",
            {...textStyle(17, TEXT_COLOR.inkSoft, false), fontStyle: "italic"}).setOrigin(0.5)

        // очки
        const left = PANEL_MARGIN + 50
        const right = WIDTH - PANEL_MARGIN - 50
        let y = 160 + ROW_HEIGHT / 2

        const g = this.add.graphics()

        for (let i = 0; i < roundCount; ++i) {
            const played = i < this.playerInfo.round
            const score = this.playerInfo.scores[i]
            this.scoreRow(g, left, right, y, ROMAN[i], COLOR.orange, `ROUND ${ROMAN[i]}`,
                played ? String(score ?? 0) : "—", played)
            y += ROW_HEIGHT
        }

        if (gameEnd) {
            this.scoreRow(g, left, right, y, "V", COLOR.green, "VILLAGES",
                String(this.playerInfo.scores[ScoreZonesEnum.TOWN] ?? 0), true)
            y += ROW_HEIGHT

            g.lineStyle(2, COLOR.wood, 0.6).lineBetween(left, y - ROW_HEIGHT / 2 + 2, right, y - ROW_HEIGHT / 2 + 2)
            this.add.text(left, y, "TOTAL", textStyle(24)).setOrigin(0, 0.5).setLetterSpacing(3)
            this.add.text(right, y, String(this.playerInfo.scores[ScoreZonesEnum.TOTAL] ?? 0), textStyle(40, TEXT_COLOR.ink))
                .setOrigin(1, 0.5)
            y += ROW_HEIGHT
        }

        // игроки (мультиплеер)
        if (standings.length > 0) {
            y += 10
            this.add.text(centerX, y, "PLAYERS", textStyle(15, TEXT_COLOR.inkSoft)).setOrigin(0.5).setLetterSpacing(3)
            y += 36

            const scoreIndex = gameEnd ? ScoreZonesEnum.TOTAL : this.playerInfo.round - 1
            standings.forEach((s, i) => {
                const isSelf = s.memberId === this.selfId
                if (isSelf) {
                    g.fillStyle(COLOR.parchmentDark, 0.8).fillRoundedRect(left - 12, y - STANDING_HEIGHT / 2 + 3, right - left + 24, STANDING_HEIGHT - 6, 8)
                }
                g.fillStyle(MEDALS[i] ?? COLOR.parchmentDark, 1).fillCircle(left + 14, y, 14)
                g.lineStyle(1.5, COLOR.wood, 0.8).strokeCircle(left + 14, y, 14)
                this.add.text(left + 14, y, String(i + 1), textStyle(16, i < 3 ? TEXT_COLOR.white : TEXT_COLOR.ink)).setOrigin(0.5)

                this.add.text(left + 42, y, String(s.name) + (isSelf ? "  (you)" : ""), textStyle(22, TEXT_COLOR.ink, isSelf))
                    .setOrigin(0, 0.5)
                this.add.text(right, y, String(s.scores?.[scoreIndex] ?? 0), textStyle(24)).setOrigin(1, 0.5)
                y += STANDING_HEIGHT
            })
        }

        new WoodButton(this, centerX, height - PANEL_MARGIN - 62, 240, 58, gameEnd ? "EXIT" : "NEXT ROUND",
            () => this.onNext(), "wood", 24)

        keepFitted(this, WIDTH, height, "center", pixelRatio() * 1.5)
    }

    private scoreRow(g: Phaser.GameObjects.Graphics, left: number, right: number, y: number,
                     badge: string, badgeColor: number, label: string, value: string, active: boolean) {
        const alpha = active ? 1 : 0.45

        g.fillStyle(badgeColor, alpha).fillCircle(left + 16, y, 16)
        g.lineStyle(1.5, COLOR.wood, 0.8 * alpha).strokeCircle(left + 16, y, 16)
        this.add.text(left + 16, y, badge, textStyle(badge.length > 2 ? 12 : 15, TEXT_COLOR.white)).setOrigin(0.5).setAlpha(alpha)

        this.add.text(left + 46, y, label, textStyle(20)).setOrigin(0, 0.5).setLetterSpacing(2).setAlpha(alpha)
        this.add.text(right, y, value, textStyle(30)).setOrigin(1, 0.5).setAlpha(alpha)

        // пунктирная направляющая между подписью и числом, как в листе очков
        g.lineStyle(1, COLOR.wood, 0.3 * alpha)
        for (let x = left + 200; x < right - 70; x += 10) {
            g.lineBetween(x, y + 8, x + 4, y + 8)
        }
    }

    /**
     * По итоговому счёту в конце игры, иначе по очкам последнего раунда
     */
    private sortedStandings(): StandingDto[] {
        const scoreIndex = this.playerInfo.gameEnd ? ScoreZonesEnum.TOTAL : this.playerInfo.round - 1
        const score = (s: StandingDto) => s.scores?.[scoreIndex] ?? 0
        return [...this.standings].sort((a, b) => score(b) - score(a))
    }


    onNext() {
        this.scene.stop()

        EventBus.emit(EventsEnum.SCORE_CLOSED)
    }

}
