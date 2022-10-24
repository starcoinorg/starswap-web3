import { toChecksumAddress } from '@starcoin/stc-util'
import invariant from 'tiny-invariant'

export function normalizeChainId(chainId: string | number): number {
  if (typeof chainId === 'string') {
    // Temporary fix until the next version of Metamask Mobile gets released.
    // In the current version (0.2.13), the chainId starts with “Ox” rather
    // than “0x”. Fix: https://github.com/MetaMask/metamask-mobile/pull/1275
    chainId = chainId.replace(/^Ox/, '0x')

    const parsedChainId = Number.parseInt(chainId, chainId.trim().substring(0, 2) === '0x' ? 16 : 10)
    invariant(!Number.isNaN(parsedChainId), `chainId ${ chainId } is not an integer`)
    return parsedChainId
  } else {
    invariant(Number.isInteger(chainId), `chainId ${ chainId } is not an integer`)
    return chainId
  }
}

// https://github.com/ethers-io/ethers.js/blob/d9d438a119bb11f8516fc9cf02c534ab3816fcb3/packages/address/src.ts/index.ts
export const normalizeAccount = toChecksumAddress
