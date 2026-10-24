import * as Phaser from "phaser";
import {ScenesEnum} from "../../enums/scenes.enum";
import {Button} from "../../controls/button";
import {EventsEnum} from "../../enums/events.enum";
import {PlayerInfo} from "../../entity/playerInfo";
import {Assets} from "../../assets";
import {Image} from "../../controls/image";
import {EventBus} from "../bus/EventBus";
import {ScoreZonesEnum} from "../../enums/scoreZones.enum";
import {StandingDto} from "../../multiplayer/protocol";
import {keepFitted} from "../../scale/screen";

export interface ScoreSceneData {
    playerInfo: PlayerInfo

    // результаты всех игроков (мультиплеер)
    standings?: StandingDto[]

    selfId?: number
}

const WIDTH = 820

export default class ScoreScene extends Phaser.Scene {

    playerInfo: PlayerInfo

    standings: StandingDto[]

    selfId: number

    back: Image

    next: Button

    message: Button

    //очки
    scoreZones: Button[]


    constructor() {
        super(ScenesEnum.SCORE)

        this.back = new Image(this).preloadExtern(Assets.SCORES_IMAGE)

        this.message = new Button(this).preloadExtern(Assets.SAND_1)
        this.next = new Button(this).preloadExtern(Assets.SAND_1)

        this.scoreZones = []
        for (const z in ScoreZonesEnum) {
            this.scoreZones[z] = new Button(this)
        }

    }

    preload() {
        const data = this.scene.settings.data as ScoreSceneData
        this.playerInfo = data.playerInfo
        this.standings = data.standings
        this.selfId = data.selfId
    }

    create() {
        const hasStandings = this.standings?.length > 0
        const height = hasStandings ? 780 : 600

        const centerX = WIDTH / 2;
        const centerY = 290;

        // затемнение карты на экране любого размера
        this.add.rectangle(centerX, height / 2, 100000, 100000, 0x000000, 0.5)

        this.back.create(centerX, centerY).setOrigin(0.5, 0.5).imageGO.setScale(0.7)

        this.message.create(centerX, 30, "___").setOrigin(0.5, 0)
            .setDisplaySize(400, 50).setTextFont(40, "blue")


        let posY = centerY - 100

        this.scoreZones[ScoreZonesEnum.ROUND0].create(centerX - 150, posY - 20, "___").setTextFont(50, "black")
        this.scoreZones[ScoreZonesEnum.ROUND1].create(centerX - 150, posY + 80, "___").setTextFont(50, "black")
        this.scoreZones[ScoreZonesEnum.ROUND2].create(centerX - 150, posY + 180, "___").setTextFont(50, "black")
        this.scoreZones[ScoreZonesEnum.TOWN].create(centerX + 100, posY - 20, "___").setTextFont(50, "black")
        this.scoreZones[ScoreZonesEnum.TOTAL].create(centerX + 100, posY + 180, "___").setTextFont(50, "black")

        if (hasStandings) {
            this.add.text(centerX, 490, this.standingsText())
                .setOrigin(0.5, 0).setFontSize(26).setFontStyle('bold').setAlign('center')
                .setColor('#ffffff').setStroke('#000000', 4).setLineSpacing(6)
        }

        this.next.create(centerX, height - 60, 'NEXT', () => this.onNext()).setOrigin(0.5, 0.5)
            .setDisplaySize(190, 80).setTextFont(60, "blue")


        this.show();

        keepFitted(this, WIDTH, height)
    }

    show() {
        // score by rounds
        for (let i = 0; i < 3; ++i) {
            const roundScore = this.playerInfo.scores[i]?.toString()
            if (roundScore) {
                this.scoreZones[i].setText(roundScore)
            } else {
                this.scoreZones[i].setText("")
            }
        }

        if (this.playerInfo.gameEnd) {
            this.scoreZones[ScoreZonesEnum.TOWN].setText(String(this.playerInfo.scores[ScoreZonesEnum.TOWN] ?? 0))
            this.scoreZones[ScoreZonesEnum.TOTAL].setText(String(this.playerInfo.scores[ScoreZonesEnum.TOTAL] ?? 0))


            this.message.setText("GAME END")
            this.next.setText("EXIT")
        } else {
            this.scoreZones[ScoreZonesEnum.TOWN].setText("")
            this.scoreZones[ScoreZonesEnum.TOTAL].setText("")

            this.message.setText(`ROUND ${this.playerInfo.round} COMPLETE`)
            this.next.setText("NEXT")
        }
    }

    /**
     * Таблица игроков: по итоговому счёту в конце игры, иначе по очкам последнего раунда
     */
    private standingsText(): string {
        const scoreIndex = this.playerInfo.gameEnd ? ScoreZonesEnum.TOTAL : this.playerInfo.round - 1
        const score = (s: StandingDto) => s.scores?.[scoreIndex] ?? 0

        return [...this.standings]
            .sort((a, b) => score(b) - score(a))
            .map((s, i) => `${i + 1}. ${s.name}${s.memberId === this.selfId ? " (YOU)" : ""}  -  ${score(s)}`)
            .join("\n")
    }


    onNext() {
        this.scene.stop()

        EventBus.emit(EventsEnum.SCORE_CLOSED)
    }

}
