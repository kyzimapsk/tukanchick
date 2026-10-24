import * as Phaser from "phaser";
import Pointer = Phaser.Input.Pointer;
import {hudLayout} from "../../scale/screen";

/**
 * Камера карты:
 *  - карта вписывается в область под панелью управления;
 *  - колесо мыши - зум к курсору;
 *  - правая/средняя кнопка мыши или два пальца - перемещение;
 *  - щипок двумя пальцами - зум вокруг центра жеста.
 */
export default class MapCamera {

    dragging: boolean = false;

    minZoom: number;
    maxZoom: number;

    private camera: Phaser.Cameras.Scene2D.Camera

    // перетаскивание мышью
    private dragStart: { x: number, y: number, scrollX: number, scrollY: number } = null

    // жест двумя пальцами
    private pinchStart: { distance: number, zoom: number, worldX: number, worldY: number } = null

    constructor(private scene: Phaser.Scene, private mapWidth: number, private mapHeight: number) {

        this.camera = scene.cameras.main

        scene.input.mouse?.disableContextMenu()

        this.fit(true)

        const onResize = () => this.fit(false)
        scene.scale.on(Phaser.Scale.Events.RESIZE, onResize)
        scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.scale.off(Phaser.Scale.Events.RESIZE, onResize))

        scene.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Pointer) => this.onPointerDown(pointer))
        scene.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Pointer) => this.onPointerMove(pointer))
        scene.input.on(Phaser.Input.Events.POINTER_UP, () => this.onPointerUp())
        scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, () => this.onPointerUp())
        scene.input.on(Phaser.Input.Events.POINTER_WHEEL, (pointer: Pointer, over: any, dx: number, dy: number) => {
            this.zoomAt(this.camera.zoom * Math.exp(-dy * 0.0015), pointer.x, pointer.y)
        });
    }

    /**
     * Пересчитывает область вывода и пределы зума под текущий размер экрана
     */
    fit(reset: boolean) {
        const {width, height} = this.scene.scale.gameSize
        const top = Math.min(hudLayout(width, height).screenHeight, height - 1)

        const center = this.toWorld(this.camera.x + this.camera.width / 2, this.camera.y + this.camera.height / 2)

        this.camera.setViewport(0, top, width, height - top)

        // минимум - карта видна целиком; максимум - заметно крупнее родного размера картинки
        this.minZoom = Math.min(this.camera.width / this.mapWidth, this.camera.height / this.mapHeight)
        this.maxZoom = Math.max(this.minZoom * 1.01, 2)

        if (reset) {
            this.setZoom(this.minZoom)
            this.camera.centerOn(this.mapWidth / 2, this.mapHeight / 2)
        } else {
            this.setZoom(this.camera.zoom)
            this.camera.centerOn(center.x, center.y)
        }
    }

    setZoom(newZoom: number) {
        newZoom = Phaser.Math.Clamp(newZoom, this.minZoom, this.maxZoom)
        this.camera.setZoom(newZoom)
        this.updateBounds()
    }

    /**
     * Зум с сохранением точки карты под экранной координатой (x, y)
     */
    zoomAt(newZoom: number, x: number, y: number) {
        const before = this.toWorld(x, y)
        this.setZoom(newZoom)
        const after = this.toWorld(x, y)

        this.camera.scrollX += before.x - after.x
        this.camera.scrollY += before.y - after.y
    }

    /**
     * Экранные координаты -> координаты карты.
     * Camera.getWorldPoint использует матрицу прошлого кадра и врёт сразу после setZoom.
     */
    private toWorld(x: number, y: number) {
        const c = this.camera
        return {
            x: (x - c.x - c.width / 2) / c.zoom + c.scrollX + c.width / 2,
            y: (y - c.y - c.height / 2) / c.zoom + c.scrollY + c.height / 2,
        }
    }

    getDragging() {
        return this.dragging
    }

    /**
     * Если карта меньше экрана - расширяем границы, чтобы она стояла по центру, а не прилипала к краю
     */
    private updateBounds() {
        const visibleWidth = this.camera.width / this.camera.zoom
        const visibleHeight = this.camera.height / this.camera.zoom

        const padX = Math.max(0, (visibleWidth - this.mapWidth) / 2)
        const padY = Math.max(0, (visibleHeight - this.mapHeight) / 2)

        this.camera.setBounds(-padX, -padY, this.mapWidth + padX * 2, this.mapHeight + padY * 2)
    }

    private activeTouches(): Pointer[] {
        const input = this.scene.input
        return [input.pointer1, input.pointer2].filter((p) => p?.isDown)
    }

    private onPointerDown(pointer: Pointer) {
        const touches = this.activeTouches()

        if (touches.length >= 2) {
            this.dragging = true
            this.dragStart = null

            const [a, b] = touches
            const midX = (a.x + b.x) / 2
            const midY = (a.y + b.y) / 2
            const world = this.toWorld(midX, midY)

            this.pinchStart = {
                distance: Math.max(Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y), 1),
                zoom: this.camera.zoom,
                worldX: world.x,
                worldY: world.y,
            }
        } else if (pointer.rightButtonDown() || pointer.middleButtonDown()) {
            this.dragging = true
            this.dragStart = {x: pointer.x, y: pointer.y, scrollX: this.camera.scrollX, scrollY: this.camera.scrollY}
        }
    }

    private onPointerMove(pointer: Pointer) {
        if (this.pinchStart) {
            const touches = this.activeTouches()
            if (touches.length < 2) {
                return
            }
            const [a, b] = touches
            const distance = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y)
            const midX = (a.x + b.x) / 2
            const midY = (a.y + b.y) / 2

            this.setZoom(this.pinchStart.zoom * distance / this.pinchStart.distance)

            // точка карты, бывшая под центром жеста, остаётся под ним - это даёт и зум, и перемещение
            const world = this.toWorld(midX, midY)
            this.camera.scrollX += this.pinchStart.worldX - world.x
            this.camera.scrollY += this.pinchStart.worldY - world.y

        } else if (this.dragStart && pointer.isDown) {
            this.camera.scrollX = this.dragStart.scrollX - (pointer.x - this.dragStart.x) / this.camera.zoom
            this.camera.scrollY = this.dragStart.scrollY - (pointer.y - this.dragStart.y) / this.camera.zoom
        }
    }

    private onPointerUp() {
        if (this.activeTouches().length < 2) {
            this.pinchStart = null
        }

        const anyDown = this.scene.input.manager.pointers.some((p) => p.isDown)
        if (!anyDown) {
            this.dragging = false
            this.dragStart = null
            this.pinchStart = null
        }
    }

}
