/**
 * Копирует текст в буфер обмена.
 * Clipboard API есть только на https/localhost; иначе - старый способ через скрытое поле ввода.
 * Вызывать прямо из обработчика клика: браузер разрешает запись в буфер только по действию пользователя.
 */
export async function copyText(text: string): Promise<boolean> {
    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(text)
            return true
        } catch (e) {
            // нет разрешения - пробуем запасной способ
        }
    }

    const field = document.createElement("textarea")
    field.value = text
    field.setAttribute("readonly", "")
    field.style.position = "fixed"
    field.style.opacity = "0"
    document.body.appendChild(field)
    field.select()

    let copied = false
    try {
        copied = document.execCommand("copy")
    } catch (e) {
        copied = false
    }
    document.body.removeChild(field)
    return copied
}
