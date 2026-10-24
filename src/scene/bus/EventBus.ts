import * as Phaser from "phaser";
import {EventsEnum} from "../../enums/events.enum";

interface Subscription {
    event: EventsEnum
    fn: Function
    context?: any
}

export class EventBus {

    public static emitter: Phaser.Events.EventEmitter = new Phaser.Events.EventEmitter()

    private static subscriptions: Subscription[] = []

    private static debug: boolean = false

    public static clear() {
        EventBus.emitter.removeAllListeners()
        EventBus.subscriptions = []

        if (EventBus.debug) {
            for (let e in EventsEnum) {
                EventBus.on(e as EventsEnum, (event: any) => {
                    console.log("EVENT >>>", e)
                })
            }
        }
    }

    public static emitDelayed(scene: Phaser.Scene, delay: number = 1, event: EventsEnum, ...args: any) {
        scene.time.delayedCall(delay, () => {
            EventBus.emit(event, ...args)
        })
    }

    public static emit(event: EventsEnum, ...args: any): boolean {
        return EventBus.emitter.emit(event, args.length == 1 ? args[0] : args)
    }

    public static on(event: EventsEnum, fn: Function, context?: any) {
        EventBus.emitter.on(event, fn, context)
        EventBus.subscriptions.push({event, fn, context})
    }

    /**
     * Снимает все подписки, сделанные с данным контекстом
     */
    public static offAll(context: any) {
        EventBus.subscriptions = EventBus.subscriptions.filter((s) => {
            if (s.context === context) {
                EventBus.emitter.off(s.event, s.fn, s.context)
                return false
            }
            return true
        })
    }

    /**
     * Подписка сцены, автоматически снимается при остановке сцены
     */
    public static onScene(scene: Phaser.Scene, event: EventsEnum, fn: Function) {
        if (!EventBus.subscriptions.some((s) => s.context === scene)) {
            scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => EventBus.offAll(scene))
        }
        EventBus.on(event, fn, scene)
    }
}
