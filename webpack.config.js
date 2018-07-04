'use strict'

const webpack = require('webpack')
const path = require('path')

// Plugin Setup
const globalsPlugin = new webpack.DefinePlugin({
  __DEV__: JSON.stringify(JSON.parse(process.env.BUILD_DEV || 'true')),
  'process.env': { NODE_ENV: JSON.stringify('development') }
})

const libraryName = 'fuelWeb3Provider'

const serverConfig = {
  entry: { [libraryName]: './src/index.js' },
  devtool: 'source-map',
  output: {
    filename: '[name].node.js',
    library: libraryName,
    libraryTarget: 'umd',
    umdNamedDefine: true
  },
  'target': 'node', // To work with node
  module: {
    rules: [
      { test: /\.(t|j)sx?$/, use: { loader: 'babel-loader' } },
      // addition - add source-map support
      { enforce: 'pre', test: /\.js$/, loader: 'source-map-loader' }
    ]
  },
  node: {
    process: false, // To work with node
    console: false,
    fs: 'empty',
    net: 'empty',
    tls: 'empty'
  },
  resolve: {
    modules: ['./src', 'node_modules'],
    extensions: ['.ts', '.js', '.json'],
    alias: {
      'fsevents': path.join(__dirname, './nil.js'),
      'original-fs': path.join(__dirname, './nil.js'),
      'scrypt': 'js-scrypt',
      'fs': path.join(__dirname, './src/nil.js'),
      'swarm-js': path.resolve(__dirname, './node_modules/swarm-js/lib/api-browser.js'),
      'fs-promise': path.join(__dirname, './src/nil.js')
    }
  },
  plugins: [globalsPlugin,
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV)
    }),
    new webpack.IgnorePlugin(/^electron$/)]
}

const clientConfig = {
  entry: { [libraryName]: './src/index.js' },
  devtool: 'source-map',
  output: {
    filename: '[name].js',
    library: libraryName,
    libraryTarget: 'umd',
    umdNamedDefine: true
  },
  target: 'web',
  module: {
    rules: [
      { test: /\.(t|j)sx?$/, use: { loader: 'babel-loader' } },
      // addition - add source-map support
      { enforce: 'pre', test: /\.js$/, loader: 'source-map-loader' }
    ]
  },
  node: {
    console: false,
    fs: 'empty',
    net: 'empty',
    tls: 'empty'
  },
  resolve: {
    modules: ['./src', 'node_modules'],
    extensions: ['.ts', '.js', '.json']
  },
  plugins: [globalsPlugin]
}

module.exports = [ clientConfig, serverConfig ]
