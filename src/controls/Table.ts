import DOMElement = Phaser.GameObjects.DOMElement;
import {FONT, TEXT_COLOR} from "../ui/theme";

export class Table {

    element: DOMElement

    constructor(protected scene: Phaser.Scene) {

    }

    preload() {
        return this
    }

    create(x: number, y: number, width: number, height: number) {
        const style = `
        width: ${width}px; max-height: ${height}px;
        border-collapse: collapse;
        font-family: ${FONT.replace(/"/g, "'")};
        font-size: 24px;
        color: ${TEXT_COLOR.ink};
        `

        this.element = this.scene.add.dom(x, y).createFromHTML(`<table style="${style}"></table>`).setOrigin(0, 0);

        return this
    }

    setData(data: string[][]) {
        this.clearTable()

        const tableElement = this.element?.node.firstElementChild as HTMLTableElement

        for (let r = 0; r < data.length; ++r) {
            const row = tableElement.insertRow()
            for (let c = 0; c < data[r].length; ++c) {
                const cell = row.insertCell(c)
                cell.textContent = data[r][c]

                cell.style.borderBottom = "1px solid rgba(107, 68, 35, 0.35)"
                cell.style.padding = "4px 14px"
                cell.style.height = "34px"
                cell.style.background = r % 2 ? "rgba(226, 205, 159, 0.45)" : "transparent"
                if (c > 0) {
                    // второй столбец - пометки HOST / YOU
                    cell.style.textAlign = "right"
                    cell.style.fontSize = "16px"
                    cell.style.fontWeight = "bold"
                    cell.style.letterSpacing = "2px"
                    cell.style.color = TEXT_COLOR.inkSoft
                } else {
                    cell.style.fontWeight = "bold"
                }

            }
        }

        return this
    }

    clearTable() {
        const tableElement = this.element?.node.firstElementChild as HTMLTableElement

        while (tableElement.rows.length > 0) {
            tableElement.deleteRow(0);
        }

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

