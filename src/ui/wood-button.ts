import * as Phaser from "phaser";
import {COLOR, FONT, TEXT_COLOR} from "./theme";

export type WoodButtonVariant = "wood" | "parchment"

/**
 * Кнопка в стиле игры: деревянная (основная) или пергаментная (второстепенная)
 */
export class WoodButton {

    private readonly graphics: Phaser.GameObjects.Graphics
    private readonly text: Phaser.GameObjects.Text
    private readonly zone: Phaser.GameObjects.Zone

    private enabled = true
    private hover = false
    private visible = true

    constructor(private scene: Phaser.Scene, private x: number, private y: number,
                private width: number, private height: number,
                label: string, onClick: () => void,
                private variant: WoodButtonVariant = "wood", fontSize: number = 22) {

        this.graphics = scene.add.graphics()
        this.text = scene.add.text(x, y, label, {
            fontFamily: FONT,
            fontSize: `${fontSize}px`,
            fontStyle: "bold",
            color: variant == "wood" ? TEXT_COLOR.parchment : TEXT_COLOR.ink,
        }).setOrigin(0.5).setLetterSpacing(2)

        this.zone = scene.add.zone(x, y, width, height).setInteractive({useHandCursor: true})
        this.zone.on(Phaser.Input.Events.POINTER_OVER, () => {
            this.hover = true
            this.draw()
        })
        this.zone.on(Phaser.Input.Events.POINTER_OUT, () => {
            this.hover = false
            this.draw()
        })
        this.zone.on(Phaser.Input.Events.POINTER_UP, () => {
            if (this.enabled && this.visible) {
                onClick()
            }
        })

        this.draw()
    }

    setText(label: string) {
        this.text.setText(label)
        return this
    }

    setEnabled(enabled: boolean) {
        this.enabled = enabled
        this.draw()
        return this
    }

    setVisible(visible: boolean) {
        this.visible = visible
        this.graphics.setVisible(visible)
        this.text.setVisible(visible)
        if (visible) {
            this.zone.setInteractive()
        } else {
            this.zone.disableInteractive()
        }
        return this
    }

    private draw() {
        const {x, y, width: w, height: h} = this
        const r = Math.min(12, h / 3)
        const highlight = this.enabled && this.hover

        const fill = this.variant == "wood"
            ? (highlight ? COLOR.woodLight : COLOR.wood)
            : (highlight ? 0xfaf0d8 : COLOR.parchment)
        const inner = this.variant == "wood" ? COLOR.brass : COLOR.wood

        this.graphics.clear()
            .fillStyle(COLOR.shadow, 0.3).fillRoundedRect(x - w / 2 + 1, y - h / 2 + 3, w, h, r)
            .fillStyle(fill, 1).fillRoundedRect(x - w / 2, y - h / 2, w, h, r)
            .lineStyle(2, inner, 0.8).strokeRoundedRect(x - w / 2 + 3, y - h / 2 + 3, w - 6, h - 6, Math.max(r - 2, 2))

        if (this.variant == "parchment") {
            this.graphics.lineStyle(2, COLOR.wood, 1).strokeRoundedRect(x - w / 2, y - h / 2, w, h, r)
        }

        this.graphics.setAlpha(this.enabled ? 1 : 0.4)
        this.text.setAlpha(this.enabled ? 1 : 0.6)
    }
}
