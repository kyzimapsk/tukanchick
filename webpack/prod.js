const { merge } = require('webpack-merge');
const base = require("./base");
const TerserPlugin = require("terser-webpack-plugin");

module.exports = merge(base, {
  mode: "production",
  output: {
    filename: "bundle.[contenthash].min.js"
  },
  devtool: false,
  performance: {
    maxEntrypointSize: 2000000,
    maxAssetSize: 2000000
  },
  optimization: {
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          output: {
            comments: false
          }
        }
      })
    ]
  }
});
