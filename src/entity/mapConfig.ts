import {IslandEnum} from "../enums/islands.enum";


export interface MapConfig {
    island: IslandEnum

    roundCount: number

    // раскладка городов (в мультиплеере задаётся сервером)
    townRoll?: number

    // зерно случайной карты; не задано - классическая карта острова
    seed?: number
}
