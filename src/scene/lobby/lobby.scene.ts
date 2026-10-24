import * as Phaser from "phaser";
import {ScenesEnum} from "../../enums/scenes.enum";
import {Button} from "../../controls/button";
import {Assets} from "../../assets";
import {startMultiPlayer} from "../../index";
import {roundCountFor} from "../../game/board";
import {LobbyConfig} from "../../entity/lobbyConfig";
import {Input} from "../../controls/input";
import {CommandsEnum} from "../../multiplayer/commands.enum";
import {Table} from "../../controls/Table";
import {EventBus} from "../bus/EventBus";
import {EventsEnum} from "../../enums/events.enum";
import {IslandEnum} from "../../enums/islands.enum";
import {MapConfig} from "../../entity/mapConfig";
import {client} from "../../multiplayer/client";
import {
    ErrorDto,
    GameStateDto,
    JoinToLobbyDto,
    LOBBY_ID_LENGTH,
    LobbyDto,
    MemberDto,
    NAME_MAX_LENGTH
} from "../../multiplayer/protocol";
import {keepFitted} from "../../scale/screen";
import {copyText} from "../../controls/clipboard";

const NICKNAME_KEY = 'user_nick_name'

function loadNickname(): string {
    try {
        return localStorage.getItem(NICKNAME_KEY) || ''
    } catch (e) {
        return ''
    }
}

function saveNickname(nick: string) {
    try {
        localStorage.setItem(NICKNAME_KEY, nick)
    } catch (e) {
        // приватный режим браузера - просто не запоминаем
    }
}

export default class LobbyScene extends Phaser.Scene {

    config: LobbyConfig

    nicknameLabel: Phaser.GameObjects.Text
    nicknameTextBox: Input
    commonCaptionText: Button


    createLobbyButton: Button
    joinLobbyButton: Button

    createdLobbyIdText: Button
    copyLobbyIdButton: Button
    joinLobbyCaptionText: Button
    joinLobbyIdTextBox: Input

    partyMemberTable: Table

    startPetitButton: Button
    startGrandeButton: Button
    exitButton: Button

    selfId: number

    lobbyId: string

    constructor() {
        super(ScenesEnum.LOBBY)

        this.nicknameTextBox = new Input(this)
        this.commonCaptionText = new Button(this)


        this.createLobbyButton = new Button(this).preloadExtern(Assets.SAND_1)
        this.joinLobbyButton = new Button(this).preloadExtern(Assets.SAND_1)

        this.createdLobbyIdText = new Button(this)
        this.copyLobbyIdButton = new Button(this).preloadExtern(Assets.SAND_1)
        this.joinLobbyCaptionText = new Button(this)
        this.joinLobbyIdTextBox = new Input(this)

        this.partyMemberTable = new Table(this)


        this.startPetitButton = new Button(this).preloadExtern(Assets.SAND_1)
        this.startGrandeButton = new Button(this).preloadExtern(Assets.SAND_1)
        this.exitButton = new Button(this).preloadExtern(Assets.SAND_1)
    }

    preload() {
        this.config = this.scene.settings.data as LobbyConfig;
    }

    create() {
        this.selfId = undefined
        this.lobbyId = undefined

        const centerX = this.config.parentWidth / 2
        const leftX = 40
        const topY = 40

        const width = this.config.parentWidth - leftX * 2;
        const height = this.config.parentHeight - topY * 2;

        const botY = topY + height

        // затемняет меню под лобби на любом размере экрана
        this.add.rectangle(centerX, this.config.parentHeight / 2, 100000, 100000, 0x000000, 0.6)
        this.add.rectangle(this.config.parentWidth / 2, this.config.parentHeight / 2, width, height, 0x000000, 0.9).setOrigin(0.5, 0.5)

        let buttonSpace = 10
        let buttonWidth = width / 2 - buttonSpace * 2
        let buttonHeight = 50

        let leftColumnCenterX = leftX + buttonSpace + buttonWidth / 2
        let rightColumnCenterX = centerX + buttonSpace + buttonWidth / 2

        // nickname
        let nicknamePostY = topY + buttonSpace + buttonHeight / 2


        this.nicknameLabel = this.add.text(leftColumnCenterX, nicknamePostY, "Nickname:").setFontSize(30).setFontStyle('bold').setOrigin(0.5)

        this.nicknameTextBox.create(rightColumnCenterX, nicknamePostY, buttonWidth, buttonHeight, 'white', 'gray').setOrigin(0.5)
        this.nicknameTextBox.setMaxLength(NAME_MAX_LENGTH)
        this.nicknameTextBox.setText(loadNickname())

        this.nicknameTextBox.onChange = (newNick: string) => saveNickname(newNick)


        // common caption
        let commonCaptionPosY = nicknamePostY + buttonHeight + buttonSpace + buttonSpace

        this.commonCaptionText.create(centerX, commonCaptionPosY, "CREATE LOBBY OR PUT LOBBY ID TO JOIN").setTextFont(26, 'white', 'bold').setOrigin(0.5)


        // buttons create/join
        let buttonCreateOrJoinPosY = commonCaptionPosY + buttonHeight + buttonSpace + buttonSpace

        this.createLobbyButton.create(leftColumnCenterX, buttonCreateOrJoinPosY,
            "CREATE LOBBY", () => this.createLobby()
        ).setDisplaySize(buttonWidth, buttonHeight)
            .setOrigin(0.5)
            .setTextFont(30, "black", "bold")


        this.joinLobbyButton.create(rightColumnCenterX, buttonCreateOrJoinPosY,
            "JOIN LOBBY", () => this.joinLobby()
        ).setDisplaySize(buttonWidth, buttonHeight)
            .setOrigin(0.5, 0.5)
            .setTextFont(30, "black", "bold")


        // text for created or joined lobby id
        let textLobbyIdPosY = buttonCreateOrJoinPosY + buttonHeight + buttonSpace

        this.createdLobbyIdText.create(centerX, textLobbyIdPosY, "__").setTextFont(30, 'white', 'bold').setOrigin(0.5)
            .setVisible(false)

        // хост копирует ID и отправляет его остальным игрокам
        this.copyLobbyIdButton.create(rightColumnCenterX + buttonWidth / 2 - 80, textLobbyIdPosY,
            "COPY", () => this.copyLobbyId()
        ).setDisplaySize(150, buttonHeight - 6)
            .setOrigin(0.5)
            .setTextFont(26, "black", "bold")
            .setVisible(false)

        this.joinLobbyCaptionText.create(leftColumnCenterX, textLobbyIdPosY, "JOIN TO ").setTextFont(30, 'white', 'bold').setOrigin(0.5)
        this.joinLobbyIdTextBox.create(rightColumnCenterX, textLobbyIdPosY, buttonWidth, buttonHeight, 'white', 'SlateGray').setOrigin(0.5)
        this.joinLobbyIdTextBox.setMaxLength(LOBBY_ID_LENGTH)

        // party members
        let exitButtonPosY = botY - buttonHeight

        let partyMemberTablePosY = textLobbyIdPosY + buttonHeight + buttonSpace
        let partyMemberTableHeight = exitButtonPosY - partyMemberTablePosY - buttonHeight

        this.partyMemberTable.create(centerX, partyMemberTablePosY, width - buttonSpace * 2, partyMemberTableHeight).setOrigin(0.5, 0)


        let thirdWidth = width / 3

        let bottomButtonWidth = thirdWidth - buttonSpace * 3

        let startPetitCenterPosX = leftX + thirdWidth - thirdWidth / 2
        this.startPetitButton.create(startPetitCenterPosX, exitButtonPosY,
            "START PETIT", () => this.startGame(IslandEnum.PETIT)
        ).setDisplaySize(bottomButtonWidth, buttonHeight)
            .setOrigin(0.5)
            .setTextFont(26, "black", "bold")
            .setVisible(false)

        let startGrandeCenterPosX = leftX + thirdWidth * 2 - thirdWidth / 2
        this.startGrandeButton.create(startGrandeCenterPosX, exitButtonPosY,
            "START GRANDE", () => this.startGame(IslandEnum.GRANDE)
        ).setDisplaySize(bottomButtonWidth, buttonHeight)
            .setOrigin(0.5)
            .setTextFont(26, "black", "bold")
            .setVisible(false)

        let exitCenterPosX = leftX + width - thirdWidth / 2
        this.exitButton.create(exitCenterPosX, exitButtonPosY,
            "EXIT", () => this.exit()
        ).setDisplaySize(bottomButtonWidth, buttonHeight)
            .setOrigin(0.5)
            .setTextFont(30, "black", "bold")


        this.scene.pause(ScenesEnum.MAIN_MENU) // переделать на popup panel


        client.onReceive<LobbyDto>(CommandsEnum.CREATE_LOBBY_SUCCESS, (data) => this.createLobbySuccess(data))
        client.onReceive<LobbyDto>(CommandsEnum.JOIN_TO_LOBBY_SUCCESS, (data) => this.joinLobbySuccess(data))
        client.onReceive<LobbyDto>(CommandsEnum.JOIN_PARTY_MEMBER_SUCCESS, (data) => this.refreshLobbyMembers(data))
        client.onReceive<LobbyDto>(CommandsEnum.LEAVE_PARTY_MEMBER_SUCCESS, (data) => this.refreshLobbyMembers(data))
        client.onReceive(CommandsEnum.CLOSE_LOBBY_SUCCESS, () => this.closeLobbySuccess())
        client.onReceive<LobbyDto>(CommandsEnum.START_GAME_SUCCESS, (data) => this.startGameSuccess(data))
        client.onReceive<ErrorDto>(CommandsEnum.ERROR, (data) => this.showMessage(String(data.message)))

        keepFitted(this, this.config.parentWidth, this.config.parentHeight)
    }

    private nickname(): string | null {
        const name = this.nicknameTextBox.getText().trim()
        if (!name) {
            this.showMessage("ENTER NICKNAME")
            return null
        }
        return name
    }

    private showMessage(text: string) {
        this.commonCaptionText.setText(text)
    }

    createLobby() {
        const name = this.nickname()
        if (name) {
            client.send(CommandsEnum.CREATE_LOBBY, {name} as MemberDto)
        }
    }

    createLobbySuccess(lobbyDto: LobbyDto) {
        this.createdLobbyIdText.setText(`HOST LOBBY ID: ${lobbyDto.lobbyId}`).setVisible(true)
        // текст сдвигается влево, справа от него - кнопка копирования
        this.createdLobbyIdText.textGO.setX(this.config.parentWidth / 2 - 90)
        this.lobbyId = lobbyDto.lobbyId
        this.copyLobbyIdButton.setVisible(true)
        this.onJoined(lobbyDto)
        this.enableHostControls()
    }

    joinLobby() {
        const name = this.nickname()
        const lobbyId = this.joinLobbyIdTextBox.getText().trim().toUpperCase()
        if (!name) {
            return
        }
        if (lobbyId.length != LOBBY_ID_LENGTH) {
            this.showMessage("PUT LOBBY ID TO JOIN")
            return
        }
        client.send(CommandsEnum.JOIN_TO_LOBBY,
            {
                lobbyId,
                member: {name} as MemberDto
            } as JoinToLobbyDto
        )
    }

    joinLobbySuccess(lobbyDto: LobbyDto) {
        this.createdLobbyIdText.setText(`JOIN SUCCESS: ${lobbyDto.lobbyId}`).setVisible(true)
        this.onJoined(lobbyDto)
        this.showMessage("WAITING FOR HOST TO START")
    }

    private onJoined(lobbyDto: LobbyDto) {
        this.selfId = lobbyDto.you
        this.disableControlsAfterJoin()
        this.refreshLobbyMembers(lobbyDto)
        this.nicknameLabel.setVisible(false)
        this.nicknameTextBox.setVisible(false)
        startMultiPlayer(this.selfId, this.nicknameTextBox.getText().trim())
    }

    async copyLobbyId() {
        if (!this.lobbyId) {
            return
        }
        const copied = await copyText(this.lobbyId)
        this.copyLobbyIdButton.setText(copied ? "COPIED!" : "FAILED")
        this.time.delayedCall(1500, () => this.copyLobbyIdButton.setText("COPY"))
    }

    closeLobbySuccess() {
        this.exit()
    }

    startGameSuccess(lobbyDto: LobbyDto) {
        const state = lobbyDto.gameState
        EventBus.emit(EventsEnum.START_GAME, {
            island: state.island,
            roundCount: state.roundCount || roundCountFor(state.island),
            townRoll: state.townRoll,
        } as MapConfig)
    }

    enableHostControls() {
        this.startPetitButton.setVisible(true)
        this.startGrandeButton.setVisible(true)
        this.showMessage("WAITING FOR PLAYERS")
    }

    disableControlsAfterJoin() {
        this.createLobbyButton.setDisable(true)
        this.joinLobbyButton.setDisable(true)
        this.joinLobbyCaptionText.setVisible(false)
        this.joinLobbyIdTextBox.setVisible(false)
    }

    refreshLobbyMembers(lobbyDto: LobbyDto) {
        const stringData: string[][] = []

        lobbyDto.members?.forEach((m) => {
            const line: string[] = []
            line.push(String(m.name))
            line.push([m.host ? "HOST" : "", m.memberId === this.selfId ? "YOU" : ""].filter(s => s).join(", "))

            stringData.push(line)
        })

        this.partyMemberTable.setData(stringData)
    }


    exit() {
        client.send(CommandsEnum.CLOSE_MULTIPLAYER)
        this.scene.stop(ScenesEnum.LOBBY)
        this.scene.resume(ScenesEnum.MAIN_MENU)
    }

    startGame(island: IslandEnum) {
        client.send(CommandsEnum.FORCE_START, {island} as GameStateDto)
    }
}
