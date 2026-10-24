import * as Phaser from "phaser";
import {ScenesEnum} from "../../enums/scenes.enum";
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
import {keepFitted, pixelRatio} from "../../scale/screen";
import {copyText} from "../../controls/clipboard";
import {COLOR, drawPanel, TEXT_COLOR, textStyle} from "../../ui/theme";
import {WoodButton} from "../../ui/wood-button";

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

// отступ карточки лобби от краёв меню
const PANEL_MARGIN = 60

export default class LobbyScene extends Phaser.Scene {

    config: LobbyConfig

    nicknameLabel: Phaser.GameObjects.Text
    nicknameTextBox: Input

    messageText: Phaser.GameObjects.Text

    // выбор: создать лобби или войти по ID
    chooseObjects: Phaser.GameObjects.GameObject[]
    createLobbyButton: WoodButton
    joinLobbyButton: WoodButton
    joinLobbyIdTextBox: Input

    // после входа в лобби
    lobbyIdCaption: Phaser.GameObjects.Text
    lobbyIdText: Phaser.GameObjects.Text
    copyLobbyIdButton: WoodButton

    partyMemberTable: Table

    startPetitButton: WoodButton
    startGrandeButton: WoodButton
    exitButton: WoodButton

    selfId: number

    lobbyId: string

    constructor() {
        super(ScenesEnum.LOBBY)

        this.nicknameTextBox = new Input(this)
        this.joinLobbyIdTextBox = new Input(this)
        this.partyMemberTable = new Table(this)
    }

    preload() {
        this.config = this.scene.settings.data as LobbyConfig;
    }

    create() {
        this.selfId = undefined
        this.lobbyId = undefined

        const width = this.config.parentWidth
        const height = this.config.parentHeight
        const centerX = width / 2

        const panelX = PANEL_MARGIN
        const panelY = PANEL_MARGIN
        const panelWidth = width - PANEL_MARGIN * 2
        const panelHeight = height - PANEL_MARGIN * 2

        const left = panelX + 50
        const contentWidth = panelWidth - 100
        const leftColumnX = left + contentWidth / 4
        const rightColumnX = left + contentWidth * 3 / 4
        const columnWidth = contentWidth / 2 - 30

        // затемняет меню под лобби на любом размере экрана
        this.add.rectangle(centerX, height / 2, 100000, 100000, COLOR.shadow, 0.6)
        drawPanel(this.add.graphics(), panelX, panelY, panelWidth, panelHeight)

        this.add.text(centerX, panelY + 62, "MULTIPLAYER", textStyle(38)).setOrigin(0.5).setLetterSpacing(4)
        this.messageText = this.add.text(centerX, panelY + 106, "", {...textStyle(18, TEXT_COLOR.inkSoft, false), fontStyle: "italic"})
            .setOrigin(0.5)

        // nickname
        const nicknameY = panelY + 168
        this.nicknameLabel = this.caption(leftColumnX, nicknameY, "YOUR NICKNAME")
        this.nicknameTextBox.create(rightColumnX, nicknameY, columnWidth, 50).setOrigin(0.5)
        this.nicknameTextBox.setMaxLength(NAME_MAX_LENGTH)
        this.nicknameTextBox.setPlaceholder("Nickname")
        this.nicknameTextBox.setText(loadNickname())
        this.nicknameTextBox.onChange = (newNick: string) => saveNickname(newNick)

        // создать или войти
        const chooseY = panelY + 240
        const divider = this.add.graphics()
            .lineStyle(1, COLOR.wood, 0.3).lineBetween(centerX, chooseY, centerX, chooseY + 150)
            .lineStyle(1, COLOR.wood, 0.3).lineBetween(left, chooseY - 20, left + contentWidth, chooseY - 20)

        const newGameCaption = this.caption(leftColumnX, chooseY + 10, "NEW GAME")
        const joinCaption = this.caption(rightColumnX, chooseY + 10, "JOIN A GAME")

        this.createLobbyButton = new WoodButton(this, leftColumnX, chooseY + 95, columnWidth, 60, "CREATE LOBBY",
            () => this.createLobby(), "wood", 24)

        this.joinLobbyIdTextBox.create(rightColumnX, chooseY + 65, columnWidth, 50).setOrigin(0.5)
        this.joinLobbyIdTextBox.setMaxLength(LOBBY_ID_LENGTH)
        this.joinLobbyIdTextBox.setPlaceholder("Lobby ID")
        this.joinLobbyButton = new WoodButton(this, rightColumnX, chooseY + 130, columnWidth, 50, "JOIN LOBBY",
            () => this.joinLobby(), "parchment", 22)

        this.chooseObjects = [divider, newGameCaption, joinCaption]

        // ID лобби после входа: хост копирует его и отправляет остальным
        this.lobbyIdCaption = this.caption(centerX, chooseY + 10, "LOBBY ID").setVisible(false)
        this.lobbyIdText = this.add.text(centerX, chooseY + 70, "", textStyle(52)).setOrigin(0.5).setLetterSpacing(8)
            .setVisible(false)
        this.copyLobbyIdButton = new WoodButton(this, centerX, chooseY + 135, 180, 44, "COPY",
            () => this.copyLobbyId(), "parchment", 18).setVisible(false)

        // игроки
        // до 6 игроков по ~42px - таблица заканчивается выше нижних кнопок
        const playersY = panelY + 420
        this.caption(left, playersY, "PLAYERS").setOrigin(0, 0.5)
        this.partyMemberTable.create(centerX, playersY + 22, contentWidth, 300).setOrigin(0.5, 0)

        // кнопки внизу
        const bottomY = panelY + panelHeight - 70
        const thirdWidth = contentWidth / 3
        const bottomButtonWidth = thirdWidth - 20

        this.startPetitButton = new WoodButton(this, left + thirdWidth / 2, bottomY, bottomButtonWidth, 56, "START PETIT",
            () => this.startGame(IslandEnum.PETIT), "wood", 22).setVisible(false)
        this.startGrandeButton = new WoodButton(this, left + thirdWidth * 1.5, bottomY, bottomButtonWidth, 56, "START GRANDE",
            () => this.startGame(IslandEnum.GRANDE), "wood", 22).setVisible(false)
        this.exitButton = new WoodButton(this, left + thirdWidth * 2.5, bottomY, bottomButtonWidth, 56, "EXIT",
            () => this.exit(), "parchment", 22)

        this.showMessage("Create a lobby or enter its ID to join")


        this.scene.pause(ScenesEnum.MAIN_MENU) // переделать на popup panel


        client.onReceive<LobbyDto>(CommandsEnum.CREATE_LOBBY_SUCCESS, (data) => this.createLobbySuccess(data))
        client.onReceive<LobbyDto>(CommandsEnum.JOIN_TO_LOBBY_SUCCESS, (data) => this.joinLobbySuccess(data))
        client.onReceive<LobbyDto>(CommandsEnum.JOIN_PARTY_MEMBER_SUCCESS, (data) => this.refreshLobbyMembers(data))
        client.onReceive<LobbyDto>(CommandsEnum.LEAVE_PARTY_MEMBER_SUCCESS, (data) => this.refreshLobbyMembers(data))
        client.onReceive(CommandsEnum.CLOSE_LOBBY_SUCCESS, () => this.closeLobbySuccess())
        client.onReceive<LobbyDto>(CommandsEnum.START_GAME_SUCCESS, (data) => this.startGameSuccess(data))
        client.onReceive<ErrorDto>(CommandsEnum.ERROR, (data) => this.showMessage(String(data.message)))

        keepFitted(this, width, height, "center", pixelRatio())
    }

    private caption(x: number, y: number, text: string) {
        return this.add.text(x, y, text, textStyle(15, TEXT_COLOR.inkSoft)).setOrigin(0.5).setLetterSpacing(3)
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
        this.messageText.setText(text)
    }

    createLobby() {
        const name = this.nickname()
        if (name) {
            client.send(CommandsEnum.CREATE_LOBBY, {name} as MemberDto)
        }
    }

    createLobbySuccess(lobbyDto: LobbyDto) {
        this.onJoined(lobbyDto)
        this.copyLobbyIdButton.setVisible(true)
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
        this.onJoined(lobbyDto)
        this.showMessage("WAITING FOR HOST TO START")
    }

    private onJoined(lobbyDto: LobbyDto) {
        this.selfId = lobbyDto.you
        this.lobbyId = lobbyDto.lobbyId

        this.lobbyIdText.setText(String(lobbyDto.lobbyId)).setVisible(true)
        this.lobbyIdCaption.setVisible(true)

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
        this.showMessage("Send the lobby ID to your friends, then start the game")
    }

    disableControlsAfterJoin() {
        this.createLobbyButton.setVisible(false)
        this.joinLobbyButton.setVisible(false)
        this.joinLobbyIdTextBox.setVisible(false)
        this.chooseObjects.forEach((go) => (go as unknown as Phaser.GameObjects.Components.Visible).setVisible(false))
    }

    refreshLobbyMembers(lobbyDto: LobbyDto) {
        const stringData: string[][] = []

        lobbyDto.members?.forEach((m) => {
            const line: string[] = []
            line.push(String(m.name))
            line.push([m.host ? "HOST" : "", m.memberId === this.selfId ? "YOU" : ""].filter(s => s).join(" · "))

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
