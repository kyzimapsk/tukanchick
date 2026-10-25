import {CommandsEnum} from "./commands.enum";
import {IslandEnum} from "../enums/islands.enum";
import {GroundsEnum} from "../enums/grounds.enum";

export const NAME_MAX_LENGTH = 16
export const LOBBY_ID_LENGTH = 6
export const LOBBY_MAX_MEMBERS = 6

export interface BaseDto {
}

export interface Message {
    command: CommandsEnum

    data?: BaseDto
}

export interface MemberDto extends BaseDto {
    memberId?: number
    name?: string
    host?: boolean
}

export interface GameStateDto extends BaseDto {
    island: IslandEnum
    roundCount?: number
    // раскладка городов, общая для всех игроков
    townRoll?: number
    // хост просит случайную карту (FORCE_START)
    randomMap?: boolean
    // зерно случайной карты: по нему все строят одинаковый остров (START_GAME_SUCCESS)
    seed?: number
}

export interface LobbyDto extends BaseDto {
    lobbyId?: string
    members?: MemberDto[]
    // id получателя сообщения
    you?: number
    // кто покинул лобби/игру (в LEAVE_PARTY_MEMBER_SUCCESS)
    left?: MemberDto
    gameState?: GameStateDto
}

export interface JoinToLobbyDto extends BaseDto {
    lobbyId?: string
    member?: MemberDto
}

export interface RoadDto extends BaseDto {
    a: number
    b: number
    // ход, к которому относится дорога: запоздавшее сообщение не попадёт в следующий ход
    round?: number
    turn?: number
}

export interface TurnDto extends BaseDto {
    round: number
    turn: number
    groundA: GroundsEnum
    groundB: GroundsEnum
    deckSize: number
}

export interface TurnProgressDto extends BaseDto {
    done: number
    total: number
}

export interface StandingDto extends BaseDto {
    memberId: number
    name: string
    scores: number[]
}

export interface RoundEndDto extends BaseDto {
    round: number
    gameEnd: boolean
    standings: StandingDto[]
}

export interface ErrorDto extends BaseDto {
    message: string
}
