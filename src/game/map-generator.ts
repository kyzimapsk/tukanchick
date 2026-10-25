import {MapInfo} from "../entity/mapInfo";
import {Hexagon} from "../entity/hexagon";
import {GroundsEnum} from "../enums/grounds.enum";
import {ArtifactsEnum} from "../enums/artifacts.enum";
import {createRandom, getRandom, Random, shuffleArray} from "./random";
import {Point} from "../entity/point";

/**
 * Генератор случайной раскладки острова.
 *
 * Форма острова (гексы и их соседство) берётся у базовой карты, а земли, деревни
 * и достопримечательности расставляются заново по тем же принципам, что на настоящих картах:
 *  - земли в тех же пропорциях: ~1/3 песок, ~1/4 лес, ~1/5 скалы, остальное вода;
 *  - 10 деревень только на побережье, не на воде, равномерно по кругу острова;
 *  - достопримечательности каждого типа (по числу раундов) - в основном внутри острова и вразброс;
 *  - особые гексы никогда не стоят вплотную друг к другу.
 *
 * Результат полностью определяется зерном: клиенты и сервер строят одну и ту же карту.
 * Поэтому здесь только арифметика без тригонометрии - она одинакова в любом движке JS.
 */

const TOWN_COUNT = 10

// на маленьком острове жадная расстановка иногда упирается в нехватку места - тогда пробуем заново
const ATTEMPTS = 200

export function generateMapInfo(base: MapInfo, seed: number): MapInfo {
    for (let attempt = 0; attempt < ATTEMPTS; ++attempt) {
        const result = tryGenerate(base, createRandom(seed + attempt * 7919), true)
        if (result) {
            return result
        }
    }
    // не удалось соблюсти все правила - допускаем соседство особых гексов
    return tryGenerate(base, createRandom(seed), false)
}

function tryGenerate(base: MapInfo, random: Random, strict: boolean): MapInfo | null {
    const hexagons: Hexagon[] = base.hexagons.map((h) => ({
        index: h.index,
        points: h.points.map((p) => ({x: p.x, y: p.y})),
        neighbours: [...h.neighbours],
        ground: undefined as GroundsEnum,
        artifact: undefined as ArtifactsEnum,
    }))
    const byIndex = new Map(hexagons.map((h) => [h.index, h]))

    assignGrounds(hexagons, random)

    // особый гекс и его соседи заняты: особые гексы не стоят вплотную
    const blocked = new Set<number>()
    const occupy = (hex: Hexagon, artifact: ArtifactsEnum) => {
        hex.artifact = artifact
        blocked.add(hex.index)
        hex.neighbours.forEach((n) => blocked.add(n))
    }

    const towns = placeTowns(hexagons, random, blocked, strict)
    if (!towns) {
        return null
    }
    towns.forEach((hex, i) => occupy(hex, `TOWN_${i + 1}` as ArtifactsEnum))

    if (!placeLandmarks(base, hexagons, byIndex, random, blocked, occupy, strict)) {
        return null
    }

    return {
        hexagons,
        artifacts: base.artifacts.map((z) => ({artifact: z.artifact, score: [...z.score], points: [] as Point[]})),
        towns: base.towns.map((t) => ({letter: t.letter, score: t.score, point: null as Point})),
        scores: [],
        generated: true,
    }
}

function assignGrounds(hexagons: Hexagon[], random: Random) {
    const n = hexagons.length
    const sand = Math.round(n * 0.33)
    const forest = Math.round(n * 0.27)
    const rock = Math.round(n * 0.22)
    const water = n - sand - forest - rock

    const grounds: GroundsEnum[] = [
        ...Array(sand).fill(GroundsEnum.SAND),
        ...Array(forest).fill(GroundsEnum.FOREST),
        ...Array(rock).fill(GroundsEnum.ROCK),
        ...Array(water).fill(GroundsEnum.WATER),
    ]
    shuffleArray(grounds, random)
    hexagons.forEach((h, i) => h.ground = grounds[i])
}

function center(hex: Hexagon) {
    const sum = hex.points.reduce((acc, p) => ({x: acc.x + p.x, y: acc.y + p.y}), {x: 0, y: 0})
    return {x: sum.x / hex.points.length, y: sum.y / hex.points.length}
}

/**
 * Монотонный аналог угла в диапазоне [0, 4) без тригонометрии
 */
function pseudoAngle(dx: number, dy: number): number {
    const p = dx / (Math.abs(dx) + Math.abs(dy) || 1)
    return dy < 0 ? 3 + p : 1 - p
}

function pick<T>(items: T[], random: Random): T | undefined {
    return items.length > 0 ? items[getRandom(items.length, random)] : undefined
}

/**
 * Деревни по побережью: остров делится на 10 секторов, в каждом - одна деревня
 */
function placeTowns(hexagons: Hexagon[], random: Random, blocked: Set<number>, strict: boolean): Hexagon[] | null {
    const centers = hexagons.map(center)
    const islandCenter = {
        x: centers.reduce((s, c) => s + c.x, 0) / centers.length,
        y: centers.reduce((s, c) => s + c.y, 0) / centers.length,
    }

    const rotation = random() * 4
    const angleOf = (hex: Hexagon) => {
        const c = center(hex)
        return (pseudoAngle(c.x - islandCenter.x, c.y - islandCenter.y) - rotation + 8) % 4
    }

    const coast = hexagons.filter((h) => h.neighbours.length < 6 && h.ground !== GroundsEnum.WATER)
    const chosen: Hexagon[] = []
    const free = (h: Hexagon) => !blocked.has(h.index) && !chosen.some((c) => c === h || c.neighbours.includes(h.index))

    const sector = 4 / TOWN_COUNT
    for (let s = 0; s < TOWN_COUNT; ++s) {
        const hex = pick(coast.filter((h) => free(h) && angleOf(h) >= s * sector && angleOf(h) < (s + 1) * sector), random)
        if (hex) {
            chosen.push(hex)
        }
    }

    // в каком-то секторе не нашлось места - добираем по всему побережью, затем по всему острову
    while (chosen.length < TOWN_COUNT) {
        const hex = pick(coast.filter(free), random)
            ?? pick(hexagons.filter((h) => free(h) && h.ground !== GroundsEnum.WATER), random)
            ?? (strict ? undefined : pick(hexagons.filter((h) => !chosen.includes(h) && h.ground !== GroundsEnum.WATER), random))
        if (!hex) {
            return null
        }
        chosen.push(hex)
    }

    // номера по кругу острова
    return chosen.sort((a, b) => angleOf(a) - angleOf(b))
}

function distances(byIndex: Map<number, Hexagon>, from: Hexagon): Map<number, number> {
    const result = new Map<number, number>([[from.index, 0]])
    const queue = [from]
    while (queue.length > 0) {
        const hex = queue.shift()
        const d = result.get(hex.index)
        hex.neighbours.forEach((n) => {
            if (!result.has(n)) {
                result.set(n, d + 1)
                queue.push(byIndex.get(n))
            }
        })
    }
    return result
}

function placeLandmarks(base: MapInfo, hexagons: Hexagon[], byIndex: Map<number, Hexagon>, random: Random,
                        blocked: Set<number>, occupy: (hex: Hexagon, artifact: ArtifactsEnum) => void,
                        strict: boolean): boolean {

    const landmarks: ArtifactsEnum[] = []
    base.artifacts.forEach((z) => z.score.forEach(() => landmarks.push(z.artifact)))
    shuffleArray(landmarks, random)

    const placed = new Map<ArtifactsEnum, Hexagon[]>()

    for (const artifact of landmarks) {
        const same = placed.get(artifact) || []
        const sameDistances = same.map((h) => distances(byIndex, h))
        const farFromSame = (h: Hexagon) => sameDistances.every((d) => (d.get(h.index) ?? 99) >= 3)

        const free = hexagons.filter((h) => !blocked.has(h.index))
        const inland = free.filter((h) => h.neighbours.length == 6)

        // от строгих условий к мягким: внутри острова и далеко от таких же -> где угодно свободно
        const hex = pick(inland.filter(farFromSame), random)
            ?? pick(free.filter(farFromSame), random)
            ?? pick(inland, random)
            ?? pick(free, random)
            ?? (strict ? undefined : pick(hexagons.filter((h) => !h.artifact), random))
        if (!hex) {
            return false
        }

        occupy(hex, artifact)
        placed.set(artifact, [...same, hex])
    }
    return true
}
