import {getRandom} from "./random";
import {TownLetters} from "../enums/townLetters";

export default class TownSpawner {

    static readonly ROLLS: string[] = [
        'ADCBDACEBE',
        'DCEADCBAEB',
        'ECAEBDABDC',
        'BDCAEBEDCA',
        'DBACECDAEB',
        'BACBDCEAED',
        'EADBCEBDAC',
        'ACBDCDEBAE',
        'DADBAECECB',
        'CAECBADEBD',
        'EBDBACAECD',
        'CEBAEDCDAB',
        'BEDCBADECA',
    ]

    items: TownLetters[]

    /**
     * @param rollIndex номер раскладки городов; в мультиплеере выбирается сервером, чтобы у всех она совпадала
     */
    constructor(rollIndex: number = TownSpawner.randomRoll()) {
        const roll = TownSpawner.ROLLS[rollIndex] ?? TownSpawner.ROLLS[0]

        this.items = []
        for (let i = 0; i < roll.length; ++i) {
            this.items.push(roll.charAt(i) as TownLetters)
        }
    }

    static randomRoll(): number {
        return getRandom(TownSpawner.ROLLS.length)
    }

    public getByNumber(n: number): TownLetters {
        return this.items[n - 1];
    }
}
