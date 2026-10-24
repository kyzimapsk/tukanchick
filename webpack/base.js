const webpack = require("webpack");
const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin");

// адрес websocket-сервера; пустая строка = тот же хост, что и страница (/exchange)
const MULTIPLAYER_URL = process.env.MULTIPLAYER_URL || "";
const SERVER_PORT = process.env.PORT || 5000;

module.exports = {
    mode: "development",
    devtool: "eval-source-map",
    entry: "./src/index.ts",
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ]
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
    output: {
        path: path.resolve(process.cwd(), 'dist'),
        clean: true,
    },
    devServer: {
        proxy: [
            {
                context: ['/exchange'],
                target: `http://localhost:${SERVER_PORT}`,
                ws: true,
            },
        ],
    },
    plugins: [
        new webpack.ProgressPlugin(),
        new webpack.DefinePlugin({
            CANVAS_RENDERER: JSON.stringify(true),
            WEBGL_RENDERER: JSON.stringify(true),
            MULTIPLAYER_URL: JSON.stringify(MULTIPLAYER_URL),
            APP_VERSION: JSON.stringify(require("../package.json").version),
        }),
        new HtmlWebpackPlugin({
            template: "./index.html"
        }),
        new CopyPlugin({
            patterns: [
                {
                    from: 'assets/**/*',
                },
            ],
        }),
    ]
};
