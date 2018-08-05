const xhr = process.browser ? require('xhr') : require('request')
const inherits = require('util').inherits
const createPayload = require('web3-provider-engine/util/create-payload.js')
const Subprovider = require('./subprovider.js')
const JsonRpcError = require('json-rpc-error')


module.exports = RpcSource

inherits(RpcSource, Subprovider)

function RpcSource(opts) {
  this.rpcUrl = opts.rpcUrl
  this.fuelUrl = opts.fuelUrl
}

RpcSource.prototype.handleRequest = function(payload, next, end){
  // overwrite id to conflict with other concurrent users
  let newPayload = createPayload(payload)


  if (payload.method === 'eth_sendRawTransaction') {
    newPayload = payload.params[0]
    newPayload.jsonRpcReponse = true
    newPayload.id = payload.id
  }

  xhr({
    uri: payload.method === ('eth_sendRawTransaction') ? (this.fuelUrl) : (this.rpcUrl),
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(newPayload),
    rejectUnauthorized: false,
  }, (err, res, body) => {
    if (err) return end(new JsonRpcError.InternalError(err))
    // check for error code
    switch (res.statusCode) {
      case 405:
        return end(new JsonRpcError.MethodNotFound())
      case 504: // Gateway timeout
        let msg = `Gateway timeout. The request took too long to process. `
        msg += `This can happen when querying logs over too wide a block range.`
        const err = new Error(msg)
        return end(new JsonRpcError.InternalError(err))
      default:
        if (res.statusCode != 200) {
          return end(new JsonRpcError.InternalError(res.body))
        }
    }

    // parse response
    let data
    try {
      data = JSON.parse(body) || body
    } catch (error) {
      console.error(error.stack)
      return end(new JsonRpcError.InternalError(err))
    }
    if (data.error) return end(data.error)

    end(null, data.result)
  })

}
