import {PlayerInfo} from "../entity/playerInfo";
import {MapInfo} from "../entity/mapInfo";
import {Hexagon} from "../entity/hexagon";
import {GroundsEnum} from "../enums/grounds.enum";
import {ArtifactsEnum} from "../enums/artifacts.enum";
import {TownLetters} from "../enums/townLetters";
import {ScoreZonesEnum} from "../enums/scoreZones.enum";
import TownSpawner from "./town-spawner";
import {IslandEnum} from "../enums/islands.enum";

/**
 * Правила игры для одного игрока (одной карты).
 * Модуль не зависит от Phaser: его используют и клиент, и сервер мультиплеера,
 * поэтому сервер проверяет ходы ровно по тем же правилам, что и клиент.
 */

export interface RoadResult {
    // новые подключенные к сети артефакты
    connectedArtifacts: Hexagon[]

    // новые соединённые пары городов
    connectedTowns: Hexagon[][]

    // сколько бонусных дорог получено этим ходом
    bonusRoadGained: number

    // ход игрока закончен (основная и все бонусные дороги построены)
    turnEnded: boolean
}

export function roundCountFor(island: IslandEnum): number {
    return island == IslandEnum.GRANDE ? 3 : 2
}

export function createPlayer(name: string): PlayerInfo {
    return {
        deckSize: 0,
        gameEnd: false,
        readyTouch: false,
        name: name, turn: 0, round: 0, bonusRoad: 0, turnComplete: false, scores: [],
        artifactConnected: new Map(),
        townLetterConnected: new Set(),
        roads: new Map(),
        townNets: new Map(),
        hexagons: new Map(),
        townByLetter: new Map(),
        artifactScores: new Map(),
        townScores: new Map(),
    }
}

/**
 * Заполняет состояние игрока данными карты.
 * Гексы копируются: mapInfo лежит в кэше и переиспользуется следующей игрой.
 */
export function initBoard(player: PlayerInfo, mapInfo: MapInfo, townRoll: number) {
    const townSpawner = new TownSpawner(townRoll)

    for (const letter in TownLetters) {
        player.townByLetter.set(letter as TownLetters, [])
    }

    mapInfo.artifacts.forEach((z) => player.artifactScores.set(z.artifact, z.score))
    mapInfo.towns.forEach((z) => player.townScores.set(z.letter, z.score))

    mapInfo.hexagons.forEach((source) => {
        const h: Hexagon = {
            index: source.index,
            points: source.points.map((p) => ({x: p.x, y: p.y})),
            neighbours: [...source.neighbours],
            ground: source.ground,
            artifact: source.artifact,
        }
        player.hexagons.set(h.index, h)

        if (isTown(h.artifact)) {
            const townNumber = Number(h.artifact.substring(5))
            h.net = townNumber
            h.townLetter = townSpawner.getByNumber(townNumber)
            player.townNets.set(h.net, h.index)
            player.townByLetter.get(h.townLetter).push(h)
        }
    })
}

export function startRound(player: PlayerInfo) {
    player.round += 1
    player.turn = 0
}

export function startTurn(player: PlayerInfo, groundA: GroundsEnum, groundB: GroundsEnum, deckSize: number) {
    player.groundA = groundA
    player.groundB = groundB

    player.turn++
    player.turnComplete = false
    player.bonusRoad = 0
    player.readyTouch = true

    player.deckSize = deckSize
}

export function canBuildRoad(player: PlayerInfo, a: number, b: number): boolean {
    if (!player.readyTouch) {
        return false
    }

    const hexA = player.hexagons.get(a)
    const hexB = player.hexagons.get(b)

    // есть ли выбор
    if (!hexA || !hexB || a === b) {
        return false
    }

    //проверить соседство
    if (!hexA.neighbours.includes(b)) {
        return false
    }

    // такая дорога уже есть
    if (player.roads.get(a)?.has(b)) {
        return false
    }

    // бонусная дорога строится в любом месте, обычная - по выпавшим картам
    if (player.turnComplete && player.bonusRoad > 0) {
        return true
    }

    const aa = sameGround(player.groundA, hexA.ground)
    const ab = sameGround(player.groundA, hexB.ground)
    const ba = sameGround(player.groundB, hexA.ground)
    const bb = sameGround(player.groundB, hexB.ground)

    return (aa && bb) || (ab && ba)
}

/**
 * Строит дорогу, если ход допустим. Возвращает null, если нельзя.
 */
export function buildRoad(player: PlayerInfo, a: number, b: number, roundCount: number): RoadResult | null {
    if (!canBuildRoad(player, a, b)) {
        return null
    }

    const result: RoadResult = {
        connectedArtifacts: [],
        connectedTowns: [],
        bonusRoadGained: 0,
        turnEnded: false,
    }

    if (!player.turnComplete) {
        player.turnComplete = true
    } else {
        player.bonusRoad -= 1
    }

    addToRoads(player, a, b)
    recalcRoadNet(player, roundCount, result)
    checkTownConnection(player, result)

    if (player.bonusRoad <= 0) {
        player.bonusRoad = 0
        player.readyTouch = false
        result.turnEnded = true
    }

    return result
}

/**
 * Пропуск хода (нет подходящего места или игрок не хочет строить).
 * Неиспользованные бонусные дороги сгорают.
 */
export function skipTurn(player: PlayerInfo): boolean {
    if (!player.readyTouch) {
        return false
    }
    player.turnComplete = true
    player.bonusRoad = 0
    player.readyTouch = false
    return true
}

export function calculateRoundScore(player: PlayerInfo) {
    let currentScore = 0

    //артефакты
    player.artifactConnected.forEach((count, artifact) => {
        const scores = player.artifactScores.get(artifact) || []
        for (let i = 0; i < count && i < scores.length; ++i) {
            currentScore += scores[i]
        }
    })

    player.scores[player.round - 1] = currentScore
}

export function calculateTotalScore(player: PlayerInfo) {
    let total = 0

    //calc town
    player.townLetterConnected.forEach(letter => {
        total += player.townScores.get(letter) || 0
    })
    player.scores[ScoreZonesEnum.TOWN] = total

    // todo: calc bonus

    // calc round sum
    total += player.scores[ScoreZonesEnum.ROUND0] || 0
    total += player.scores[ScoreZonesEnum.ROUND1] || 0
    total += player.scores[ScoreZonesEnum.ROUND2] || 0

    player.scores[ScoreZonesEnum.TOTAL] = total
}

/**
 * Завершает раунд: считает очки и, если раунд последний, итог игры
 */
export function endRound(player: PlayerInfo, roundCount: number) {
    calculateRoundScore(player)

    if (player.round >= roundCount) {
        player.gameEnd = true
        calculateTotalScore(player)
    }
}

export function isTown(artifact: ArtifactsEnum) {
    return !!artifact?.startsWith("TOWN_")
}

export function isObject(artifact: ArtifactsEnum) {
    return !!artifact && !isTown(artifact)
}

function sameGround(a: GroundsEnum, b: GroundsEnum): boolean {
    return a === b || a === GroundsEnum.JOKER || b === GroundsEnum.JOKER
}

function addToRoads(player: PlayerInfo, a: number, b: number) {
    if (!player.roads.has(a)) {
        player.roads.set(a, new Set())
    }
    if (!player.roads.has(b)) {
        player.roads.set(b, new Set())
    }

    player.roads.get(a).add(b)
    player.roads.get(b).add(a)
}

function recalcRoadNet(player: PlayerInfo, roundCount: number, result: RoadResult) {

    player.townNets.forEach((townHexId, netId) => {
        const h = player.hexagons.get(townHexId)

        if (netId == h.net) {
            // эта часть сети ещё ни к кому не присоеденена
            // можно запускать поиск

            const queue: Hexagon[] = []

            const visited = new Set<number>()
            queue.push(h)
            visited.add(h.index)

            while (queue.length > 0) {
                const currHex = queue.pop()

                player.roads.get(currHex.index)?.forEach((conIndex) => {
                        const conHex = player.hexagons.get(conIndex)

                        if (!conHex.net || conHex.net > currHex.net) {

                            //регистрация коннекта артефакта
                            checkNewArtifact(player, conHex, roundCount, result)

                            conHex.net = currHex.net
                            visited.add(conIndex)
                            queue.push(conHex)
                        } else if (conHex.net === currHex.net && !visited.has(conIndex)) {
                            visited.add(conIndex)
                            queue.push(conHex)
                        }
                    }
                )
            }
        }
    })
}

function checkNewArtifact(player: PlayerInfo, hex: Hexagon, roundCount: number, result: RoadResult) {
    if (isObject(hex.artifact) && !hex.artifactConnected) {
        hex.artifactConnected = true

        const count = (player.artifactConnected.get(hex.artifact) || 0) + 1
        player.artifactConnected.set(hex.artifact, count)

        if (count == roundCount) {
            // все артефакты этого типа соединены - выдать дополнительную дорогу
            player.bonusRoad += 1
            result.bonusRoadGained += 1
        }

        result.connectedArtifacts.push(hex)
    }
}

function checkTownConnection(player: PlayerInfo, result: RoadResult) {
    const townLetterConnected = player.townLetterConnected

    player.townByLetter.forEach((towns: Hexagon[], letter: TownLetters) => {
        if (!townLetterConnected.has(letter) && towns.length == 2) {
            if (towns[0].net && towns[0].net === towns[1].net) {
                townLetterConnected.add(letter)
                towns[0].artifactConnected = true
                towns[1].artifactConnected = true

                result.connectedTowns.push(towns)
            }
        }
    })
}
