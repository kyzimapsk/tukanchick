import * as Phaser from "phaser";
import {ScenesEnum} from "../../enums/scenes.enum";
import {Assets} from "../../assets";
import {keepFitted} from "../../scale/screen";

const WIDTH = 600
const HEIGHT = 200

export default class LoadScene extends Phaser.Scene {

    constructor() {
        super(ScenesEnum.LOAD_SCREEN)
    }

    preload() {
        this.add.text(WIDTH / 2, 60, "LOADING...").setOrigin(0.5).setFontSize(40).setFontStyle('bold').setColor('red')

        this.add.rectangle(WIDTH / 2, 130, 400, 24).setStrokeStyle(2, 0xffffff)
        const bar = this.add.rectangle(WIDTH / 2 - 198, 130, 0, 20, 0xffffff).setOrigin(0, 0.5)
        this.load.on(Phaser.Loader.Events.PROGRESS, (value: number) => bar.width = 396 * value)

        keepFitted(this, WIDTH, HEIGHT)

        // images
        this.load.image(Assets.MENU_LOGO, Assets.MENU_LOGO);
        this.load.image(Assets.SAND_1, Assets.SAND_1);
        this.load.image(Assets.SCORES_IMAGE, Assets.SCORES_IMAGE);
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
}
