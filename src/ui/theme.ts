import * as Phaser from "phaser";

/**
 * Общий стиль интерфейса в цветах поля игры: пергамент, коричневые чернила, дерево,
 * акценты листа очков. Всё рисуется графикой, поэтому чёткое при любом разрешении.
 */

export const FONT = 'Georgia, "Times New Roman", serif'

export const COLOR = {
    parchment: 0xf2e3c2,
    parchmentDark: 0xe2cd9f,
    wood: 0x6b4423,
    woodLight: 0x8d5f35,
    woodDark: 0x21160d,
    brass: 0xc89b62,
    ink: 0x4a2f17,
    orange: 0xf0962b,
    green: 0x6fae3e,
    red: 0xb3402a,
    shadow: 0x000000,
}

export const TEXT_COLOR = {
    ink: "#4a2f17",
    inkSoft: "#8a6a45",
    parchment: "#f2e3c2",
    white: "#ffffff",
}

// цвета земель с поля: песок, лес, скалы, вода
export const GROUND_COLORS = [0xe6cf8f, 0x8db35a, 0xa99a8b, 0x5ea7c8]

export function textStyle(size: number, color: string = TEXT_COLOR.ink, bold: boolean = true): Phaser.Types.GameObjects.Text.TextStyle {
    return {fontFamily: FONT, fontSize: `${size}px`, fontStyle: bold ? "bold" : "normal", color}
}

export function hexPoints(cx: number, cy: number, r: number): Phaser.Math.Vector2[] {
    const points = []
    for (let i = 0; i < 6; ++i) {
        const angle = Phaser.Math.DegToRad(60 * i - 90)
        points.push(new Phaser.Math.Vector2(cx + r * Math.cos(angle), cy + r * Math.sin(angle)))
    }
    return points
}

/**
 * Пергаментная карточка с тенью и двойной деревянной рамкой
 */
export function drawPanel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, alpha: number = 1) {
    g.fillStyle(COLOR.shadow, 0.35 * alpha).fillRoundedRect(x + 4, y + 8, w, h, 18)
    g.fillStyle(COLOR.parchment, alpha).fillRoundedRect(x, y, w, h, 18)
    g.lineStyle(3, COLOR.wood, 0.9 * alpha).strokeRoundedRect(x + 8, y + 8, w - 16, h - 16, 12)
    g.lineStyle(1, COLOR.wood, 0.35 * alpha).strokeRoundedRect(x + 14, y + 14, w - 28, h - 28, 8)
    return g
}

/**
 * Деревянная рамка вокруг картинки
 */
export function drawFrame(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, border: number = 14) {
    g.fillStyle(COLOR.shadow, 0.45).fillRoundedRect(x - border + 6, y - border + 10, w + border * 2, h + border * 2, 16)
    g.fillStyle(COLOR.wood, 1).fillRoundedRect(x - border, y - border, w + border * 2, h + border * 2, 16)
    g.lineStyle(2, COLOR.brass, 0.7).strokeRoundedRect(x - border + 5, y - border + 5, w + border * 2 - 10, h + border * 2 - 10, 12)
    g.lineStyle(3, COLOR.woodDark, 0.8).strokeRect(x - 1, y - 1, w + 2, h + 2)
    return g
}
