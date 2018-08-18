const BlueBird = require('bluebird')
const Transaction = require('ethereumjs-tx')
const UportIdentity = require('uport-identity')
const Web3 = require('web3')
const ProviderEngine = require('web3-provider-engine')
const CacheSubprovider = require('web3-provider-engine/subproviders/cache.js')
const FixtureSubprovider = require('web3-provider-engine/subproviders/fixture.js')
const FilterSubprovider = require('web3-provider-engine/subproviders/filters.js')
const HookedWalletSubprovider = require('web3-provider-engine/subproviders/hooked-wallet.js')
const SubscriptionSubprovider = require('web3-provider-engine/subproviders/subscriptions')
const NonceTrackerSubprovider = require('./services/nonceTracker')
const WsSubprovider = require('./services/wsSubprovider')
const HttpSubprovider = require('./services/httpSubprovider.js')

const engine = new ProviderEngine()
const TxRelaySigner = require('./services/eth-signer/txRelaySigner')
const txRelayArtifact = UportIdentity.TxRelay.v2
const KeyPair = require('./services/eth-signer/generators/keyPair')

class Provider {
  constructor (
    { privateKey,
      web3Provider,
      rpcUrl = 'https://rinkeby.infura.io/',
      fuelUrl = 'http://localhost:5000/relay',
      network = 'rinkeby',
      txRelayAddress = '0xda8c6dce9e9a85e6f9df7b09b2354da44cb48331',
      txSenderAddress = '0x00B8FBD65D61b7DFe34b9A3Bb6C81908d7fFD541',
      whiteListAddress = '0x0000000000000000000000000000000000000000'
    }
  ) {
    this.rpcUrl = rpcUrl
    this.fuelUrl = fuelUrl
    this.network = network
    this.txRelayAddress = txRelayAddress
    this.txSenderAddress = txSenderAddress
    this.whiteListAddress = whiteListAddress
    this.isWeb3Provided = web3Provider !== undefined
    this.web3 = ((this.isWeb3Provided === true) ? new Web3(web3Provider.currentProvider) : new Web3(rpcUrl))
    this.asyncWeb3 = BlueBird.promisifyAll(this.web3.eth)
    this.TxRelay = BlueBird.promisifyAll(new this.web3.eth.Contract(txRelayArtifact.abi, txRelayAddress))
    this.senderKeyPair = {}
    if (this.isWeb3Provided === true) {
      this.senderKeyPair.address = window.web3.eth.defaultAccount
    } else if (privateKey !== undefined) {
      this.senderKeyPair = KeyPair.fromPrivateKey(privateKey)
    } else {
      throw new Error('A web instance, or a private key, should be passed')
    }
    this.txRelaySigner = new TxRelaySigner(
      this.senderKeyPair,
      this.txRelayAddress,
      this.txSenderAddress,
      this.whiteListAddress
    )
    this.signFunction = async (hash) => {
      const sig = await this.asyncWeb3.signAsync(hash, this.senderKeyPair.address)
      return sig
    }
    this.start = this.start
  }
  start () {
    engine.addProvider(
      new FixtureSubprovider({
        web3_clientVersion: 'ProviderEngine/v0.0.0/javascript',
        net_listening: true,
        eth_hashrate: '0x00',
        eth_mining: false,
        eth_syncing: true
      })
    )
    engine.addProvider(new CacheSubprovider())
    engine.addProvider(new FilterSubprovider())
    engine.addProvider(new NonceTrackerSubprovider())
    // engine.addProvider(new VmSubprovider())
    engine.addProvider(
      new HookedWalletSubprovider({
        getAccounts: (cb) => {
          console.log(this.senderKeyPair.address)
          cb(null, [this.senderKeyPair.address])
        },
        getPrivateKey: (cb) => {
          cb(null, this.senderKeyPair.privateKey)
        },
        signTransaction: async (txParams, callback) => {
          const txRelayNonce = await this.TxRelay.methods
            .getNonce(this.senderKeyPair.address).call()
          txParams.nonce = Web3.utils.toHex(txRelayNonce)
          const tx = new Transaction(txParams)
          const rawTx = '0x' + tx.serialize().toString('hex')
          let metaSignedTx
          if (this.isWeb3Provided === true) {
            metaSignedTx = await this.txRelaySigner.signRawTx(rawTx, this.signFunction)
          } else {
            metaSignedTx = await this.txRelaySigner.signRawTx(rawTx)
          }
          const params = {
            metaNonce: txParams.nonce,
            metaSignedTx,
            blockchain: this.network
          }
          console.log(params)
          callback(null, params)
        }
      })
    )

    const connectionType = getConnectionType(this.rpcUrl)

    if (connectionType === 'ws') {
      const filterSubprovider = new FilterSubprovider()
      engine.addProvider(filterSubprovider)
      engine.addProvider(
        new WsSubprovider({
          rpcUrl: this.rpcUrl,
          fuelUrl: this.fuelUrl
        })
      )
    } else {
      const filterAndSubsSubprovider = new SubscriptionSubprovider()
      filterAndSubsSubprovider.on('data', (err, notification) => {
        engine.emit('data', err, notification)
      })
      engine.addProvider(filterAndSubsSubprovider)

      engine.addProvider(new HttpSubprovider({
        rpcUrl: this.rpcUrl,
        fuelUrl: this.fuelUrl
      }))
    }
    engine.on('error', error => {
      console.error(error.stack)
    })
    engine.start()
    return engine
  }
}

function getConnectionType (rpcUrl) {
  if (!rpcUrl) return undefined

  const protocol = rpcUrl.split(':')[0]
  switch (protocol) {
    case 'http':
    case 'https':
      return 'http'
    case 'ws':
    case 'wss':
      return 'ws'
    default:
      throw new Error(`ProviderEngine - unrecognized protocol in "${rpcUrl}"`)
  }
}

module.exports = Provider
