const slsw = require('serverless-webpack')
const webpack = require('webpack')
const fs = require('fs')
const path = require('path')
const nodeExternals = require('webpack-node-externals')

module.exports = {
  entry: slsw.lib.entries,
  target: 'node',
  devtool: false,
  mode: slsw.lib.webpack.isLocal ? 'development' : 'production',
  optimization: {
    minimize: false,
  },
  performance: {
    hints: false,
  },
  resolve: {
    mainFields: ['main', 'module'],
    extensions: ['.ts', '.js'],
    alias: {
      '~': path.resolve(__dirname, 'src'),
    },
  },
  externals: slsw.lib.webpack.isLocal ? [nodeExternals()] : ['aws-sdk'],
  module: {
    rules: [
      {
        include: path.resolve(__dirname, 'node_modules/canvas'),
        use: 'null-loader',
      },
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'babel-loader',
          },
          {
            loader: 'ts-loader',
          },
        ],
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'babel-loader',
          },
        ],
      },
      {
        test: /\.(graphql|gql)$/,
        exclude: /node_modules/,
        loader: 'graphql-tag/loader',
      },
    ],
  },
  plugins: [
    new webpack.DefinePlugin(
      fs.existsSync('.env')
        ? Object.fromEntries(
            fs
              .readFileSync('.env', 'utf-8')
              .split('\n')
              .map(v => v.trim())
              .filter(Boolean)
              .filter(v => !/^#/.test(v))
              .map(v => v.split('='))
              .map(([k, v]) => [`process.env.${k}`, JSON.stringify(v)])
          )
        : {}
    ),
  ],
}
