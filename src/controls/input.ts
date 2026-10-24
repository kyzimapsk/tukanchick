import DOMElement = Phaser.GameObjects.DOMElement;
import {FONT, TEXT_COLOR} from "../ui/theme";

export class Input {

    element: DOMElement

    onChange: Function

    constructor(protected scene: Phaser.Scene) {

    }

    preload() {
        return this
    }

    create(x: number, y: number, width: number, height: number, fontColor: string = TEXT_COLOR.ink, backgroundColor: string = '#fbf4e2') {
        const style = `
        box-sizing: border-box;
        width: ${width}px; height: ${height}px;
        padding: 0 14px;
        font-family: ${FONT.replace(/"/g, "'")};
        font-size: ${Math.round(height * 0.5)}px;
        font-weight: bold;
        letter-spacing: 1px;
        color: ${fontColor};
        background-color: ${backgroundColor};
        border: 2px solid #6b4423;
        border-radius: 10px;
        box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.15);
        outline: none;
        `

        // это div содеражщий в себе input
        this.element = this.scene.add.dom(x, y).createFromHTML(`<input type="text" style="${style}">`).setOrigin(0, 0);

        this.element.addListener('input')
        this.element.on('input', (e: any) => {
            if (this.onChange) {
                this.onChange(e.target.value)
            }
        })

        return this
    }

    setText(text: string) {
        const inputElement = this.element?.node.firstElementChild as HTMLInputElement
        inputElement.value = text ?? ''

        return this
    }

    setPlaceholder(placeholder: string) {
        const inputElement = this.element?.node.firstElementChild as HTMLInputElement
        inputElement.placeholder = placeholder
        return this
    }

    setMaxLength(maxLength: number) {
        const inputElement = this.element?.node.firstElementChild as HTMLInputElement
        inputElement.maxLength = maxLength
        return this
    }

    getText() {
        const inputElement = this.element?.node.firstElementChild as HTMLInputElement
        return inputElement.value
    }

    setOrigin(x?: number, y?: number) {
        this.element?.setOrigin(x, y)
        return this
    }

    setVisible(visible: boolean) {
        this.element?.setVisible(visible)
        return this
    }

    setAlpha(alpha?: number) {
        this.element?.setAlpha(alpha)
        return this
    }

}

