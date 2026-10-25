export type Random = () => number

export function shuffleArray(array: any[], random: Random = Math.random) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}


/**
 * Целое случайное [ 0 ; max ) - max не включается
 */
export function getRandom(max: number, random: Random = Math.random): number {
    return Math.floor(random() * max);
}

/**
 * Генератор с зерном (mulberry32): одно и то же зерно даёт одну и ту же последовательность
 * в любом браузере и на сервере - на этом держится одинаковая случайная карта у всех игроков.
 * Только целочисленные операции, без тригонометрии, чтобы результат не зависел от движка JS.
 */
export function createRandom(seed: number): Random {
    let a = seed >>> 0
    return () => {
        a = (a + 0x6D2B79F5) >>> 0
        let t = a
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

export function randomSeed(): number {
    return getRandom(0x7fffffff) + 1
}
