'use strict'
const Subprovider = require('./subprovider')
const WebSocket = global.WebSocket || require('ws')
const axios = require('axios')
const Backoff = require('backoff')
const EventEmitter = require('events')
const createPayload = require('web3-provider-engine/util/create-payload')

class FuelSubprovider extends Subprovider {
  constructor ({ rpcUrl, fuelUrl, debug }) {
    super()
    EventEmitter.call(this)
    this._backoff = Backoff.exponential({
      randomisationFactor: 0.2,
      maxDelay: 5000
    })
    this._connectTime = null
    this._log = debug ? (...args) => console.info(console, ['[WSProvider]', ...args]) : () => { }
    this._pendingRequests = new Map()
    this._socket = null
    this._unhandledRequests = []
    this._rpcUrl = rpcUrl
    this._fuelUrl = fuelUrl
    this._axios = axios.create({
      baseURL: fuelUrl,
      headers: { 'Content-Type': 'application/json' }
    })
    this._handleSocketClose = this._handleSocketClose.bind(this)
    this._handleSocketMessage = this._handleSocketMessage.bind(this)
    this._handleSocketOpen = this._handleSocketOpen.bind(this)
    // Called when a backoff timeout has finished. Time to try reconnecting.
    this._backoff.on('ready', () => {
      this._openSocket()
    })
    this._openSocket()
  }
  handleRequest (payload, next, end) {
    if (!this._socket || this._socket.readyState !== WebSocket.OPEN) {
      this._unhandledRequests.push(Array.from(arguments))
      this._log('Socket not open. Request queued.')
      return
    }
    if (payload.method === 'eth_sendRawTransaction') {
      this._pendingRequests.set(payload.id, [payload, end])
      const newPayload = payload.params[0]
      newPayload.jsonRpcReponse = true
      newPayload.id = payload.id
      this._axios.post('', newPayload)
    } else {
      this._pendingRequests.set(payload.id, [payload, end])
      const newPayload = createPayload(payload)
      delete newPayload.origin
      this._socket.send(JSON.stringify(newPayload))
      this._log(`Sent: ${newPayload.method} #${newPayload.id}`)
    }
  }
  _handleSocketClose ({ reason, code }) {
    this._log(`Socket closed, code ${code} (${reason || 'no reason'})`)
    // If the socket has been open for longer than 5 seconds, reset the backoff
    if (this._connectTime && Date.now() - this._connectTime > 5000) {
      this._backoff.reset()
    }
    this._socket.removeEventListener('close', this._handleSocketClose)
    this._socket.removeEventListener('message', this._handleSocketMessage)
    this._socket.removeEventListener('open', this._handleSocketOpen)
    this._socket = null
    this._backoff.backoff()
  }
  _handleSocketMessage (message) {
    let payload
    try {
      payload = JSON.parse(message.data)
    } catch (e) {
      this._log('Received a message that is not valid JSON:', payload)
      return
    }
    if (payload.id === undefined) {
      return this.emit('data', null, payload)
    }
    if (!this._pendingRequests.has(payload.id)) {
      return
    }
    const [originalReq, end] = this._pendingRequests.get(payload.id)
    this._pendingRequests.delete(payload.id)
    this._log(`Received: ${originalReq.method} #${payload.id}`)
    if (payload.error) {
      return end(new Error(payload.error.message))
    }
    end(null, payload.result)
  }
  _handleSocketOpen () {
    this._log('Socket open.')
    this._connectTime = Date.now()
    // Any pending requests need to be resent because our session was lost
    // and will not get responses for them in our new session.
    this._pendingRequests.forEach((value) => this._unhandledRequests.push(value))
    this._pendingRequests.clear()
    const unhandledRequests = this._unhandledRequests.splice(0, this._unhandledRequests.length)
    unhandledRequests.forEach((request) => {
      this.handleRequest.apply(this, request)
    })
  }
  _openSocket () {
    this._log('Opening socket...')
    this._socket = new WebSocket(this._rpcUrl)
    this._socket.addEventListener('close', this._handleSocketClose)
    this._socket.addEventListener('message', this._handleSocketMessage)
    this._socket.addEventListener('open', this._handleSocketOpen)
    this._axios.interceptors.response.use((response) => {
      this._handleSocketMessage({ data: JSON.stringify(response.data) })
    }, (error) => {
      return Promise.reject(error)
    })
  }
}
// multiple inheritance
Object.assign(FuelSubprovider.prototype, EventEmitter.prototype)

module.exports = FuelSubprovider
