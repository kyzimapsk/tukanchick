import * as Phaser from "phaser";
import {ScenesEnum} from "../../enums/scenes.enum";
import {Assets} from "../../assets";
import {keepFitted, pixelRatio} from "../../scale/screen";
import {COLOR, drawPanel, FONT, GROUND_COLORS, hexPoints, TEXT_COLOR} from "../../ui/theme";

// карточка 640x340 в центре области с полями, чтобы на больших экранах она не растягивалась до краёв
const WIDTH = 680
const HEIGHT = 380
const CARD_WIDTH = 640
const CARD_HEIGHT = 340
const CARD_X = (WIDTH - CARD_WIDTH) / 2
const CARD_Y = (HEIGHT - CARD_HEIGHT) / 2

// картинок ещё нет - всё рисуется графикой, шрифт системный
const INK = TEXT_COLOR.ink
const INK_SOFT = TEXT_COLOR.inkSoft
const GROUNDS = GROUND_COLORS

const HEX_COUNT = 8
const HEX_RADIUS = 22
const HEX_STEP = 58
const TRAIL_Y = CARD_Y + 205

export default class LoadScene extends Phaser.Scene {

    private trail: Phaser.GameObjects.Graphics

    private percentText: Phaser.GameObjects.Text

    constructor() {
        super(ScenesEnum.LOAD_SCREEN)
    }

    preload() {
        this.cameras.main.setBackgroundColor(COLOR.woodDark)

        drawPanel(this.add.graphics(), CARD_X, CARD_Y, CARD_WIDTH, CARD_HEIGHT)

        this.add.text(WIDTH / 2, CARD_Y + 82, "TRAILS OF TUCANA", {fontFamily: FONT, fontSize: "40px", fontStyle: "bold", color: INK})
            .setOrigin(0.5).setLetterSpacing(3)
        this.add.text(WIDTH / 2, CARD_Y + 126, "preparing the island...", {fontFamily: FONT, fontSize: "18px", fontStyle: "italic", color: INK_SOFT})
            .setOrigin(0.5)

        this.trail = this.add.graphics()
        this.percentText = this.add.text(WIDTH / 2, CARD_Y + 268, "0%", {fontFamily: FONT, fontSize: "18px", fontStyle: "bold", color: INK_SOFT})
            .setOrigin(0.5).setLetterSpacing(2)

        this.drawTrail(0)
        this.load.on(Phaser.Loader.Events.PROGRESS, (value: number) => this.drawTrail(value))

        // не крупнее ~1.4 css px на виртуальный пиксель
        keepFitted(this, WIDTH, HEIGHT, "center", pixelRatio() * 1.4)

        // images
        this.load.image(Assets.MENU_LOGO, Assets.MENU_LOGO);
        this.load.image(Assets.MAP_ISLAND_PETIT, Assets.MAP_ISLAND_PETIT);
        this.load.image(Assets.MAP_ISLAND_GRANDE, Assets.MAP_ISLAND_GRANDE);

        // atlas
        this.load.atlas(Assets.GROUNDS_IMAGE,Assets.GROUNDS_IMAGE, Assets.GROUNDS_JSON);
        this.load.atlas(Assets.STAFF_IMAGE,Assets.STAFF_IMAGE, Assets.STAFF_JSON);

        // configs
        this.load.json(Assets.CONTROLS_INFO, Assets.CONTROLS_INFO)
        this.load.json(Assets.MAPINFO_ISLAND_PETIT, Assets.MAPINFO_ISLAND_PETIT)
        this.load.json(Assets.MAPINFO_ISLAND_GRANDE, Assets.MAPINFO_ISLAND_GRANDE)

    }

    create() {
        this.scene.start(ScenesEnum.MAIN_MENU)
    }

    /**
     * Тропа из гексов: по мере загрузки гексы по очереди закрашиваются землями
     */
    private drawTrail(progress: number) {
        const g = this.trail.clear()
        const startX = WIDTH / 2 - (HEX_COUNT - 1) * HEX_STEP / 2
        const filled = progress * HEX_COUNT

        // пунктир дороги между гексами
        for (let i = 0; i < HEX_COUNT - 1; ++i) {
            const done = i + 1 <= filled
            const x1 = startX + i * HEX_STEP + HEX_RADIUS
            const x2 = startX + (i + 1) * HEX_STEP - HEX_RADIUS
            g.lineStyle(3, done ? COLOR.red : COLOR.wood, done ? 0.9 : 0.25)
            for (let x = x1 + 2; x < x2 - 2; x += 8) {
                g.lineBetween(x, TRAIL_Y, Math.min(x + 4, x2 - 2), TRAIL_Y)
            }
        }

        for (let i = 0; i < HEX_COUNT; ++i) {
            const x = startX + i * HEX_STEP
            const points = hexPoints(x, TRAIL_Y, HEX_RADIUS)
            const fill = Phaser.Math.Clamp(filled - i, 0, 1)

            g.fillStyle(COLOR.wood, 0.08).fillPoints(points, true)
            if (fill > 0) {
                g.fillStyle(COLOR.shadow, 0.2 * fill).fillPoints(hexPoints(x + 1, TRAIL_Y + 3, HEX_RADIUS), true)
                g.fillStyle(GROUNDS[i % GROUNDS.length], fill).fillPoints(points, true)
            }
            g.lineStyle(2, COLOR.wood, fill > 0 ? 0.9 : 0.35).strokePoints(points, true)
        }

        this.percentText?.setText(`${Math.round(progress * 100)}%`)
    }
}
