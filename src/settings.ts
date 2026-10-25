/**
 * Настройки игрока, которые запоминаются в браузере
 */

const RANDOM_MAP_KEY = 'random_map'

export function isRandomMap(): boolean {
    try {
        return localStorage.getItem(RANDOM_MAP_KEY) === '1'
    } catch (e) {
        return false
    }
}

export function setRandomMap(value: boolean) {
    try {
        localStorage.setItem(RANDOM_MAP_KEY, value ? '1' : '0')
    } catch (e) {
        // приватный режим браузера - просто не запоминаем
    }
}
