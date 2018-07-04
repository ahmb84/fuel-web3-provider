const createPayload = require('web3-provider-engine/util/create-payload.js')

class Subprovider {
  setEngine (engine) {
    const self = this
    self.engine = engine
    engine.on('block', function (block) {
      self.currentBlock = block
    })
  }
  handleRequest (payload, next, end) {
    throw new Error('Subproviders should override `handleRequest`.')
  }
  emitPayload (payload, cb) {
    const self = this
    self.engine.sendAsync(createPayload(payload), cb)
  }
}

module.exports = Subprovider
