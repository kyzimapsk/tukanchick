import * as Phaser from "phaser";
import {IslandEnum} from "../../enums/islands.enum";
import {ScenesEnum} from "../../enums/scenes.enum";
import {Button} from "../../controls/button";
import {Assets} from "../../assets";
import {Image} from "../../controls/image";
import {startSinglePlayer} from "../../index";
import {LobbyConfig} from "../../entity/lobbyConfig";
import {client} from "../../multiplayer/client";
import {keepFitted} from "../../scale/screen";

// размер logo.jpg - виртуальное разрешение меню
export const MENU_WIDTH = 880
export const MENU_HEIGHT = 881

export default class MainMenuScene extends Phaser.Scene {

    background: Image

    petitButton: Button
    grandeButton: Button

    multiplayerButton: Button

    fullscreenButton: Button

    enableNet: boolean

    constructor() {
        super(ScenesEnum.MAIN_MENU)

        this.background = new Image(this).preloadExtern(Assets.MENU_LOGO)
        this.petitButton = new Button(this).preloadAtlasExtern(Assets.STAFF_IMAGE)
        this.grandeButton = new Button(this).preloadAtlasExtern(Assets.STAFF_IMAGE)

        this.multiplayerButton = new Button(this).preloadExtern(Assets.SAND_1)
        this.fullscreenButton = new Button(this).preloadExtern(Assets.SAND_1)

        this.enableNet = true

    }

    create() {

        this.background.create(0, 0)
        const width = MENU_WIDTH
        const height = MENU_HEIGHT

        let buttonWidth = 600 * 0.5
        let buttonHeight = 200 * 0.5
        let buttonSpace = 10

        // single

        let petitButtonHeght = height * 0.3
        this.petitButton.create(width * 0.5, petitButtonHeght,
            null,
            () => startSinglePlayer(IslandEnum.PETIT)
        ).changeFrame('ISLA_PETIT').setDisplaySize(buttonWidth, buttonHeight)
            .setOrigin(0.5)

        let grandeButtonHeght = petitButtonHeght + buttonHeight + buttonSpace
        this.grandeButton.create(width * 0.5, grandeButtonHeght,
            null,
            () => startSinglePlayer(IslandEnum.GRANDE)
        ).changeFrame('ISLA_GRANDE').setDisplaySize(buttonWidth, buttonHeight)
            .setOrigin(0.5)


        let multiplayerHeight = grandeButtonHeght + (buttonHeight + buttonSpace) * 2
        this.multiplayerButton.create(width * 0.5, multiplayerHeight,
            "MULTIPLAYER",
            () => this.scene.launch(ScenesEnum.LOBBY, {parentWidth: width, parentHeight: height} as LobbyConfig)
        ).setDisplaySize(buttonWidth, buttonHeight)
            .setOrigin(0.5)
            .setTextFont(30, "black", "bold")
            .setDisable(true)

        if (this.sys.game.device.fullscreen.available) {
            this.fullscreenButton.create(width - buttonSpace, buttonSpace,
                "FULLSCREEN",
                () => this.scale.toggleFullscreen()
            ).setDisplaySize(150, 50)
                .setOrigin(1, 0)
                .setTextFont(20, "black", "bold")
        }

        if (this.enableNet) {
            client
                .connect()
                .onOpen(() => {
                    this.multiplayerButton.setDisable(false)
                })
                .onClose(() => {
                    this.multiplayerButton.setDisable(true)
                })
        }


        this.add.text(0, 0, "ver " + APP_VERSION).setOrigin(0).setFontSize(20).setFontStyle('bold').setColor('white')

        keepFitted(this, width, height)
    }
}
