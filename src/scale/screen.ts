import * as Phaser from "phaser";

/**
 * Масштабирование под устройство.
 *
 * Canvas рисуется в физических пикселях экрана (CSS-размер * devicePixelRatio), а затем
 * ужимается обратно через zoom Scale Manager'а - так картинка чёткая на retina/мобильных.
 * Каждая UI-сцена вёрстается в своём "виртуальном" разрешении и вписывается в экран камерой
 * (fitCamera), поэтому выглядит одинаково на телефоне, планшете и мониторе.
 */

// выше 2 разница почти не видна, а нагрузка на GPU растёт квадратично
const MAX_PIXEL_RATIO = 2

export function pixelRatio(): number {
    return Math.min(Math.max(window.devicePixelRatio || 1, 1), MAX_PIXEL_RATIO)
}

function parentSize(parent: HTMLElement) {
    return {
        width: Math.max(parent.clientWidth, 1),
        height: Math.max(parent.clientHeight, 1),
    }
}

export function scaleConfig(parent: HTMLElement): Phaser.Types.Core.ScaleConfig {
    const dpr = pixelRatio()
    const {width, height} = parentSize(parent)

    return {
        mode: Phaser.Scale.NONE,
        autoCenter: Phaser.Scale.Center.NO_CENTER,
        width: Math.floor(width * dpr),
        height: Math.floor(height * dpr),
        zoom: 1 / dpr,
    }
}

/**
 * Подгоняет размер canvas под окно: поворот экрана, ресайз окна, перенос на монитор с другим DPR
 */
export function installAutoResize(game: Phaser.Game, parent: HTMLElement) {
    let pending = false

    const apply = () => {
        pending = false

        const dpr = pixelRatio()
        const {width, height} = parentSize(parent)
        const w = Math.floor(width * dpr)
        const h = Math.floor(height * dpr)

        if (Math.abs(game.scale.zoom - 1 / dpr) > 1e-6) {
            game.scale.setZoom(1 / dpr)
        }
        if (w !== game.scale.width || h !== game.scale.height) {
            game.scale.resize(w, h)
        }
    }

    const schedule = () => {
        if (!pending) {
            pending = true
            requestAnimationFrame(apply)
        }
    }

    window.addEventListener("resize", schedule)
    window.visualViewport?.addEventListener("resize", schedule)
    // на iOS размеры после поворота обновляются с задержкой
    window.addEventListener("orientationchange", () => setTimeout(schedule, 150))

    // смена devicePixelRatio (окно перенесли на другой монитор, изменили масштаб браузера)
    const watchPixelRatio = () => {
        const media = window.matchMedia?.(`(resolution: ${window.devicePixelRatio}dppx)`)
        media?.addEventListener?.("change", () => {
            schedule()
            watchPixelRatio()
        }, {once: true})
    }
    watchPixelRatio()
}

export type Align = "center" | "top"

/**
 * Вписывает область width x height (виртуальные координаты сцены) в экран целиком.
 * align = "top" прижимает область к верхнему краю, иначе центрирует.
 */
export function fitCamera(scene: Phaser.Scene, width: number, height: number, align: Align = "center", maxZoom: number = Infinity): number {
    const {width: screenWidth, height: screenHeight} = scene.scale.gameSize
    const camera = scene.cameras.main

    camera.setViewport(0, 0, screenWidth, screenHeight)

    const zoom = Math.min(screenWidth / width, screenHeight / height, maxZoom)
    camera.setZoom(zoom)

    const centerY = align === "top" ? screenHeight / zoom / 2 : height / 2
    camera.centerOn(width / 2, centerY)

    sharpenTexts(scene, zoom)

    return zoom
}

/**
 * fitCamera + автоматический пересчёт при изменении размера экрана
 */
export function keepFitted(scene: Phaser.Scene, width: number, height: number, align: Align = "center", maxZoom: number = Infinity) {
    const fit = () => fitCamera(scene, width, height, align, maxZoom)
    fit()

    scene.scale.on(Phaser.Scale.Events.RESIZE, fit)
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.scale.off(Phaser.Scale.Events.RESIZE, fit))
}

/**
 * Текст растеризуется в текстуру, поэтому при увеличении камерой его надо рисовать в большем разрешении
 */
export function sharpenTexts(scene: Phaser.Scene, zoom: number) {
    const resolution = Math.min(Math.max(1, Math.ceil(zoom)), 4)

    scene.children.list.forEach((go) => {
        if (go instanceof Phaser.GameObjects.Text && go.style.resolution !== resolution) {
            go.setResolution(resolution)
        }
    })
}


export interface HudLayout {
    // портретная раскладка (в две строки)
    narrow: boolean

    // виртуальный размер панели
    width: number
    height: number

    zoom: number

    // высота панели в пикселях экрана
    screenHeight: number
}

/**
 * Раскладка панели управления; общая для ControlsScene и камеры карты (карта рисуется под панелью)
 */
export function hudLayout(screenWidth: number, screenHeight: number): HudLayout {
    const narrow = screenWidth / screenHeight < 1

    const width = narrow ? 560 : 1000
    const height = narrow ? 290 : 160

    // панель занимает не больше 30% высоты и не крупнее "1 виртуальный px = 1.2 css px"
    const zoom = Math.min(screenWidth / width, screenHeight * 0.3 / height, pixelRatio() * 1.2)

    return {narrow, width, height, zoom, screenHeight: Math.ceil(height * zoom)}
}
