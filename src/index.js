const BlueBird = require('bluebird')
const Transaction = require('ethereumjs-tx')
const EthSigner = require('eth-signer')
const UportIdentity = require('uport-identity')
const Web3 = require('web3')
const ProviderEngine = require('web3-provider-engine')
const CacheSubprovider = require('web3-provider-engine/subproviders/cache.js')
const FixtureSubprovider = require('web3-provider-engine/subproviders/fixture.js')
const FilterSubprovider = require('web3-provider-engine/subproviders/filters.js')
const VmSubprovider = require('web3-provider-engine/subproviders/vm.js')
const HookedWalletSubprovider = require('web3-provider-engine/subproviders/hooked-wallet.js')
const NonceTrackerSubprovider = require('./services/nonceTracker')
const FuelSubprovider = require('./services/fuelSubprovider')
const engine = new ProviderEngine()
const TxRelaySigner = EthSigner.signers.TxRelaySigner
const txRelayArtifact = UportIdentity.TxRelay.v2
const KeyPair = BlueBird.promisifyAll(EthSigner.generators.KeyPair)

class Provider {
  constructor (
    { privateKey,
      rpcUrl = 'wss://rinkeby.infura.io/ws',
      fuelUrl = 'https://bagas.app/api/relay',
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
    this.web3 = new Web3(rpcUrl)
    this.TxRelay = BlueBird.promisifyAll(
      new this.web3.eth.Contract(txRelayArtifact.abi, txRelayAddress)
    )
    this.senderKeyPair = KeyPair.fromPrivateKey(privateKey)
    this.txRelaySigner = BlueBird.promisifyAll(
      new TxRelaySigner(
        this.senderKeyPair,
        this.txRelayAddress,
        this.txSenderAddress,
        this.whiteListAddress
      )
    )
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
          cb(null, [this.senderKeyPair.address])
        },
        getPrivateKey: (cb) => {
          cb(null, this.senderKeyPair.privateKey)
        },
        signTransaction: async (txParams) => {
          const txRelayNonce = await this.TxRelay.methods
            .getNonce(this.senderKeyPair.address)
            .call({ from: this.senderKeyPair.address })
          txParams.nonce = Web3.utils.toHex(txRelayNonce)
          const tx = new Transaction(txParams)
          const rawTx = '0x' + tx.serialize().toString('hex')
          const metaSignedTx = await this.txRelaySigner.signRawTxAsync(rawTx)
          const params = {
            metaNonce: txParams.nonce,
            metaSignedTx,
            blockchain: this.network
          }
          return (null, params)
        }
      })
    )
    engine.addProvider(
      new FuelSubprovider({
        rpcUrl: this.rpcUrl,
        fuelUrl: this.fuelUrl
      })
    )
    engine.on('error', error => {
      console.error(error.stack)
    })
    engine.start()
    return engine
  }
}

module.exports = Provider
