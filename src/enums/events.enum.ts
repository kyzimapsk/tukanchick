export enum EventsEnum {
    INITIALIZE_MAP_AFTER = "INITIALIZE_MAP_AFTER",


    START_GAME = "START_GAME",

    START_ROUND = "START_ROUND",
    START_ROUND_AFTER = "START_ROUND_AFTER",
    END_ROUND = "END_ROUND",
    END_ROUND_AFTER = "END_ROUND_AFTER",

    START_TURN = "START_TURN",
    START_TURN_AFTER = "START_TURN_AFTER",
    END_TURN = "END_TURN",
    SKIP_TURN = "SKIP_TURN",

    MAKE_ROAD = "MAKE_ROAD",
    DRAW_ROAD = "DRAW_ROAD",
    MAKE_ROAD_AFTER = "MAKE_ROAD_AFTER",

    CONNECT_ARTIFACT = "CONNECT_ARTIFACT",
    CONNECT_TOWN = "CONNECT_TOWN",
    BONUS_ROAD = "BONUS_ROAD",
    MARK_HEXAGON = "MARK_HEXAGON",


    MESSAGE = "MESSAGE",

    // строка состояния на панели управления (ожидание других игроков и т.п.)
    STATUS = "STATUS",

    // временное уведомление (игрок отключился и т.п.)
    NOTICE = "NOTICE",

    // игрок закрыл экран очков
    SCORE_CLOSED = "SCORE_CLOSED",

    CLOSE_GAME = "CLOSE_GAME",
}
