'use strict'
const Subprovider = require('./subprovider')
const Transaction = require('ethereumjs-tx')
const ethUtil = require('ethereumjs-util')
const blockTagForPayload = require('web3-provider-engine/util/rpc-cache-utils').blockTagForPayload

class NonceTrackerSubprovider extends Subprovider {
  constructor (opts) {
    super()
    this.nonceCache = {}
    this.handleRequest = this.handleRequest.bind(this)
  }
  handleRequest (payload, next, end) {
    const self = this
    switch (payload.method) {
      case 'eth_getTransactionCount':
        const blockTag = blockTagForPayload(payload)
        const address = payload.params[0].toLowerCase()
        const cachedResult = self.nonceCache[address]
        if (blockTag === 'pending') {
          if (cachedResult) {
            end(null, cachedResult)
          } else {
            next((error, result, cb) => {
              if (error) { return cb() }
              if (self.nonceCache[address] === undefined) {
                self.nonceCache[address] = result
              }
              cb()
            })
          }
        } else {
          next()
        }
        return
      case 'eth_sendRawTransaction':
        next((error, result, cb) => {
          if (error) {
            return cb()
          }
          const rawTx = payload.params[0].metaSignedTx
          const tx = new Transaction(Buffer.from(ethUtil.stripHexPrefix(rawTx), 'hex'))
          const address = '0x' + tx.to.toString('hex')
          let nonce = ethUtil.bufferToInt(tx.nonce)
          nonce++
          let hexNonce = nonce.toString(16)
          if (hexNonce.length % 2) {
            hexNonce = '0' + hexNonce
          }
          hexNonce = '0x' + hexNonce
          self.nonceCache[address] = hexNonce
          cb()
        })
        return
      default:
        next()
    }
  }
}

module.exports = NonceTrackerSubprovider
