[![Build Status](https://travis-ci.com/Frontier-project/FrontierJS.svg?token=DJeMzxJJncp3nRaEUuxH&branch=master)](https://travis-ci.com/Frontier-project/FrontierJS)

# FuelWeb3Provider

## Integrate Fuel in your Dapp

FuelWeb3Provider provides a simple way for you to integrate Fuel service into your javascript application.

## What is Fuel?

Fuel is strongly inspired by [Sensui](https://github.com/ConsenSys/lambda-sensui), the [uPort](https://uport.me) tx funding service, and his meta-transaction system conceived by Dr. Christian Lundkvist. Sensui works just for uPort users, Fuel enable developers to add a funding system to his Dapp and so make transactions feesless for the end user.

## Install

You can install the library via `npm`:

```javascript
npm i @ahmb84/fuel-web3-provider
```

## Smart Contract Compatibality

As it very well explained [here](https://github.com/uport-project/uport-identity/blob/develop/docs/reference/txRelay.md) your smart contract need some change in order to support meta-tx.

1.  Add sender param sender to all functions and modifiers that include a reference to msg.sender a. This param should be the first param of the function call
2.  All references to msg.sender should be changed to sender
3.  Add a modifier onlyAuthorized to all functions changed in this manner a. Allows the relay contract to call these functions. Otherwise, anyone could claim to be whomever they wanted to be b. Also allows users to call these functions themselves without meta-tx with the use of checkMessageData function

## Config

In your application you must first configure your FrontierJS object. The constructor uses the following parameters in order to work:

| Param              | Description                                                          |
| ------------------ | -------------------------------------------------------------------- |
| `privateKey`       | Your private Ethreum key                                             |
| `rpcUrl`           | An Ethreum node RPC uri, providing access to the Ethereum Blockchain |
| `fuelUrl`          | The uri of a fuel server                                             |
| `network`          | Mainnet, Rinkeby, Kovan, or Ropsten                                  |
| `txRelayAddress`   | The address of the contract relayer                                  |
| `txSenderAddress`  | The address of the sender of the transaction, the gas provider       |
| `whiteListAddress` | The white listed address                                             |

## Usage

In order to use it, just import the library and pass the previous params in the constructor.

```javascript
import Web3 from 'web3';
import FuelProvider from '@ahmb84/web3-fuel-provider';
import targetContractAbi from './targetContractAbi.json';
const privateKey = '0x0000000';

const fuelProvider = new FuelProvider(privateKey);
```

And then pass the provider to web3 use it in the normal way.

```javascript
const web3 = new Web3(fuelProvider.start());
const targetContract = new web3.eth.Contract(
  targetContractAbi,
  '0xaaf1bbc703a6f9ebe8f8c171f4dc0d60c8b4b1b8'
);

targetContract.methods
  .register('0x' + config.address, 1)
  .send({
    from: '0x' + config.address
  })
  .on('error', error => {
    console.log(error);
  })
  .on('transactionHash', transactionHash => {
    console.log('This the transactionHash', transactionHash);
  });
```

[Here](https://github.com/ahmb84/fuel-node-example) you will can find a reference implementation.
