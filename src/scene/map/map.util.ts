import {Hexagon} from "../../entity/hexagon";
import {IslandEnum} from "../../enums/islands.enum";

export function calculatePoints(firstHex: Hexagon, island: IslandEnum): Hexagon[] {

    const allHexagons: Hexagon[] = [firstHex]
    //  let firstHex = this.hexagons[0]

    let diffLineX = firstHex.points[1].x - firstHex.points[5].x


    let diffNextLineX = firstHex.points[5].x - firstHex.points[0].x
    let diffNextLineY = firstHex.points[4].y - firstHex.points[0].y

    // отсутп, т.к. гекс для образца - не первый
    if (island == IslandEnum.GRANDE) {
        firstHex.points.forEach((p) => {
                p.x -= diffLineX
                p.x -= diffNextLineX * 2
                p.y -= diffNextLineY * 2
            }
        )
    }

    // высчитываем все гексы
    for (let i = 1; i < 14; ++i) {

        let prevHex = firstHex

        for (let j = 1; j < 12; ++j) {
            let curHex: Hexagon = {
                index: allHexagons.length,
                points: prevHex.points.map((p) => ({x: p.x + diffLineX, y: p.y})),
                neighbours: [],
                ground: undefined,
                artifact: undefined,
            }
            allHexagons.push(curHex)
            prevHex = curHex
        }


        const nextLineFirstHex: Hexagon = {
            index: allHexagons.length,
            points: firstHex.points.map((p) => ({x: p.x + diffNextLineX, y: p.y + diffNextLineY})),
            neighbours: [],
            ground: undefined,
            artifact: undefined,

        }
        allHexagons.push(nextLineFirstHex)

        firstHex = nextLineFirstHex
    }


    /// определяем отрезки с правильными гексами
    const trueLines = island == IslandEnum.PETIT ? [
        [0, 4],
        [12, 17],
        [24, 30],
        [36, 43],
        [48, 56],
        [61, 69],
        [74, 81],
        [86, 93],
        [98, 105],
        [113, 115],
        [117, 118],
    ] : [
        [4, 4],
        [16, 17],
        [24, 30],
        [36, 43],
        [48, 56],
        [60, 69],
        [72, 82],
        [85, 94],
        [97, 107],
        [110, 119],
        [122, 131],
        [135, 143],
        [149, 154],
    ]


    const trueHexagonsIndex = new Set<number>(
        allHexagons.filter((h) => {
            for (const b of trueLines) {
                if (b[0] <= h.index && b[1] >= h.index) {
                    return true
                }
            }
            return false
        }).map((h) => h.index)
    )

    //выбираем првильные гексы
    const trueHexagons = allHexagons.filter((h) => trueHexagonsIndex.has(h.index))

    //вычисляем соседей
    const neighbourDiff = [-12, +1, +13, +12, -1, -13]
    for (let i = 0; i < trueHexagons.length; ++i) {
        trueHexagons[i].neighbours = neighbourDiff
            .map((d) => d + trueHexagons[i].index)
            .filter((n) => trueHexagonsIndex.has(n))


    }

    // возвращаем правильные гексы
    return trueHexagons
}
