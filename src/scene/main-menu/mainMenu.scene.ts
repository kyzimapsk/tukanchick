import * as Phaser from "phaser";
import {IslandEnum} from "../../enums/islands.enum";
import {ScenesEnum} from "../../enums/scenes.enum";
import {Button} from "../../controls/button";
import {Assets} from "../../assets";
import {Image} from "../../controls/image";
import {startSinglePlayer} from "../../index";
import {LobbyConfig} from "../../entity/lobbyConfig";
import {client} from "../../multiplayer/client";
import {keepFitted, pixelRatio} from "../../scale/screen";
import {COLOR, drawFrame, textStyle} from "../../ui/theme";
import {WoodButton} from "../../ui/wood-button";

// logo.jpg 880x881 в деревянной рамке - виртуальное разрешение меню (и лобби поверх него)
const LOGO_WIDTH = 880
const LOGO_HEIGHT = 881
const BORDER = 30
export const MENU_WIDTH = LOGO_WIDTH + BORDER * 2
export const MENU_HEIGHT = LOGO_HEIGHT + BORDER * 2

export default class MainMenuScene extends Phaser.Scene {

    background: Image

    petitButton: Button
    grandeButton: Button

    multiplayerButton: WoodButton

    enableNet: boolean

    constructor() {
        super(ScenesEnum.MAIN_MENU)

        this.background = new Image(this).preloadExtern(Assets.MENU_LOGO)
        this.petitButton = new Button(this).preloadAtlasExtern(Assets.STAFF_IMAGE)
        this.grandeButton = new Button(this).preloadAtlasExtern(Assets.STAFF_IMAGE)

        this.enableNet = true

    }

    create() {
        this.cameras.main.setBackgroundColor(COLOR.woodDark)

        drawFrame(this.add.graphics(), BORDER, BORDER, LOGO_WIDTH, LOGO_HEIGHT, 18)
        this.background.create(BORDER, BORDER)

        const centerX = MENU_WIDTH / 2

        let buttonWidth = 600 * 0.5
        let buttonHeight = 200 * 0.5
        let buttonSpace = 10

        // single

        let petitButtonHeght = BORDER + LOGO_HEIGHT * 0.3
        this.petitButton.create(centerX, petitButtonHeght,
            null,
            () => startSinglePlayer(IslandEnum.PETIT)
        ).changeFrame('ISLA_PETIT').setDisplaySize(buttonWidth, buttonHeight)
            .setOrigin(0.5)

        let grandeButtonHeght = petitButtonHeght + buttonHeight + buttonSpace
        this.grandeButton.create(centerX, grandeButtonHeght,
            null,
            () => startSinglePlayer(IslandEnum.GRANDE)
        ).changeFrame('ISLA_GRANDE').setDisplaySize(buttonWidth, buttonHeight)
            .setOrigin(0.5)


        let multiplayerHeight = grandeButtonHeght + (buttonHeight + buttonSpace) * 2
        this.multiplayerButton = new WoodButton(this, centerX, multiplayerHeight, 280, 64, "MULTIPLAYER",
            () => this.scene.launch(ScenesEnum.LOBBY, {parentWidth: MENU_WIDTH, parentHeight: MENU_HEIGHT} as LobbyConfig),
            "wood", 28
        ).setEnabled(false)

        if (this.sys.game.device.fullscreen.available) {
            new WoodButton(this, BORDER + LOGO_WIDTH - 90, BORDER + 32, 160, 42, "FULLSCREEN",
                () => this.scale.toggleFullscreen(), "parchment", 16)
        }

        if (this.enableNet) {
            client
                .connect()
                .onOpen(() => {
                    this.multiplayerButton.setEnabled(true)
                })
                .onClose(() => {
                    this.multiplayerButton.setEnabled(false)
                })
        }


        this.add.text(centerX, MENU_HEIGHT - BORDER / 2 + 1, "ver " + APP_VERSION, textStyle(13, "#c89b62"))
            .setOrigin(0.5).setLetterSpacing(2)

        // картинка меню - растр 880x881: не растягиваем её крупнее родного размера, чтобы не мылилась
        keepFitted(this, MENU_WIDTH, MENU_HEIGHT, "center", pixelRatio())
    }
}
