import { AbstractConnectorArguments, ConnectorUpdate } from '@web3-react/types'
import { AbstractConnector } from '@web3-react/abstract-connector'
import warning from 'tiny-warning'

import { SendReturnResult, SendReturn, Send, SendOld } from './types'

function parseSendReturn(sendReturn: SendReturnResult | SendReturn): any {
  return sendReturn.hasOwnProperty('result') ? sendReturn.result : sendReturn
}

export class NoStarcoinProviderError extends Error {
  public constructor() {
    super()
    this.name = this.constructor.name
    this.message = 'No Starcoin provider was found on window.starcoin.'
  }
}

export class UserRejectedRequestError extends Error {
  public constructor() {
    super()
    this.name = this.constructor.name
    this.message = 'The user rejected the request.'
  }
}

export class StarMaskConnector extends AbstractConnector {
  constructor(kwargs: AbstractConnectorArguments) {
    super(kwargs)

    this.handleNetworkChanged = this.handleNetworkChanged.bind(this)
    this.handleChainChanged = this.handleChainChanged.bind(this)
    this.handleAccountsChanged = this.handleAccountsChanged.bind(this)
    this.handleClose = this.handleClose.bind(this)
  }

  private handleChainChanged(chainId: string | number): void {
    if (__DEV__) {
      console.log("Handling 'chainChanged' event with payload", chainId)
    }
    this.emitUpdate({ chainId, provider: window.starcoin })
  }

  private handleAccountsChanged(accounts: string[]): void {
    if (__DEV__) {
      console.log("Handling 'accountsChanged' event with payload", accounts)
    }
    if (accounts.length === 0) {
      this.emitDeactivate()
    } else {
      this.emitUpdate({ account: accounts[0] })
    }
  }

  private handleClose(code: number, reason: string): void {
    if (__DEV__) {
      console.log("Handling 'close' event with payload", code, reason)
    }
    this.emitDeactivate()
  }

  private handleNetworkChanged(networkId: string | number): void {
    if (__DEV__) {
      console.log("Handling 'networkChanged' event with payload", networkId)
    }
    this.emitUpdate({ chainId: networkId, provider: window.starcoin })
  }

  public async activate(): Promise<ConnectorUpdate> {
    if (!window.starcoin) {
      throw new NoStarcoinProviderError()
    }

    if (window.starcoin.on) {
      window.starcoin.on('chainChanged', this.handleChainChanged)
      window.starcoin.on('accountsChanged', this.handleAccountsChanged)
      window.starcoin.on('close', this.handleClose)
      window.starcoin.on('networkChanged', this.handleNetworkChanged)
    }

    if ((window.starcoin as any).isStarMask) {
      ; (window.starcoin as any).autoRefreshOnNetworkChange = false
    }

    // try to activate + get account via stc_requestAccounts
    let account
    try {
      account = await (window.starcoin.send as Send)('stc_requestAccounts').then(
        sendReturn => parseSendReturn(sendReturn)[0]
      )
    } catch (error) {
      if ((error as any).code === 4001) {
        throw new UserRejectedRequestError()
      }
      warning(false, 'stc_requestAccounts was unsuccessful, falling back to enable')
    }

    // if unsuccessful, try enable
    if (!account) {
      // if enable is successful but doesn't return accounts, fall back to getAccount (not happy i have to do this...)
      account = await window.starcoin.enable().then(sendReturn => sendReturn && parseSendReturn(sendReturn)[0])
    }

    return { provider: window.starcoin, ...(account ? { account } : {}) }
  }

  public async getProvider(): Promise<any> {
    return window.starcoin
  }

  public async getChainId(): Promise<number | string> {
    if (!window.starcoin) {
      throw new NoStarcoinProviderError()
    }

    const chainId =
      (window.starcoin as any).chainId ||
      (window.starcoin as any).networkVersion

    return chainId
  }

  public async getAccount(): Promise<null | string> {
    if (!window.starcoin) {
      throw new NoStarcoinProviderError()
    }

    let account
    try {
      account = await (window.starcoin.send as Send)('stc_accounts').then(sendReturn => parseSendReturn(sendReturn)[0])
    } catch {
      warning(false, 'stc_accounts was unsuccessful, falling back to enable')
    }

    if (!account) {
      try {
        account = await window.starcoin.enable().then(sendReturn => parseSendReturn(sendReturn)[0])
      } catch {
        warning(false, 'enable was unsuccessful, falling back to stc_accounts v2')
      }
    }

    if (!account) {
      account = parseSendReturn((window.starcoin.send as SendOld)({ method: 'stc_accounts' }))[0]
    }

    return account
  }

  public deactivate() {
    if (window.starcoin && window.starcoin.removeListener) {
      window.starcoin.removeListener('chainChanged', this.handleChainChanged)
      window.starcoin.removeListener('accountsChanged', this.handleAccountsChanged)
      window.starcoin.removeListener('close', this.handleClose)
      window.starcoin.removeListener('networkChanged', this.handleNetworkChanged)
    }
  }

  public async isAuthorized(): Promise<boolean> {
    if (!window.starcoin) {
      return false
    }

    try {
      return await (window.starcoin.send as Send)('stc_accounts').then(sendReturn => {
        if (parseSendReturn(sendReturn).length > 0) {
          return true
        } else {
          return false
        }
      })
    } catch {
      return false
    }
  }
}
