export function shuffleArray(array: any[]) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}


/**
 * Целое случайное [ 0 ; max ) - max не включается
 */
export function getRandom(max: number): number {
    return Math.floor(Math.random() * max);
}
