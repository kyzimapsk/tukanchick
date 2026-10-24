import DOMElement = Phaser.GameObjects.DOMElement;

export class Input {

    element: DOMElement

    onChange: Function

    constructor(protected scene: Phaser.Scene) {

    }

    preload() {
        return this
    }

    create(x: number, y: number, width: number, height: number, fontColor: string = 'black', backgroundColor: string = 'white') {
        const style = `
        width: ${width}px; height: ${height}px; 
        font-size: ${height}px;
        color:${fontColor}; 
        background-color:${backgroundColor};
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

