/**
 * catalog.js
 * A curated list of well-known coins, each mapped to its Binance USDT
 * trading pair (for free, keyless, high-rate-limit price/candle data)
 * and its CoinGecko id (for optional market-cap/logo enrichment only).
 *
 * Why curated instead of CoinGecko's full ~17,000-coin list: that list
 * is polluted with scam/impersonator tokens (e.g. a junk coin whose
 * *symbol* field is literally "bitcoin"), which previously outranked
 * real assets in search. A hand-picked list of coins that are actually
 * listed on a major exchange sidesteps that entirely, and searching it
 * is instant (no network call) since it's just an in-memory array.
 *
 * `binance: null` entries have no reliable USDT pair; those fall back to
 * CoinGecko entirely (see coinlist.js), same as any coin typed that isn't
 * in this list at all.
 */
export const CATALOG = [
  ["bitcoin", "Bitcoin", "BTC", "BTCUSDT"],
  ["ethereum", "Ethereum", "ETH", "ETHUSDT"],
  ["binancecoin", "BNB", "BNB", "BNBUSDT"],
  ["ripple", "XRP", "XRP", "XRPUSDT"],
  ["solana", "Solana", "SOL", "SOLUSDT"],
  ["cardano", "Cardano", "ADA", "ADAUSDT"],
  ["dogecoin", "Dogecoin", "DOGE", "DOGEUSDT"],
  ["tron", "TRON", "TRX", "TRXUSDT"],
  ["avalanche-2", "Avalanche", "AVAX", "AVAXUSDT"],
  ["polkadot", "Polkadot", "DOT", "DOTUSDT"],
  ["polygon-ecosystem-token", "Polygon", "POL", "POLUSDT"],
  ["chainlink", "Chainlink", "LINK", "LINKUSDT"],
  ["litecoin", "Litecoin", "LTC", "LTCUSDT"],
  ["bitcoin-cash", "Bitcoin Cash", "BCH", "BCHUSDT"],
  ["uniswap", "Uniswap", "UNI", "UNIUSDT"],
  ["cosmos", "Cosmos", "ATOM", "ATOMUSDT"],
  ["ethereum-classic", "Ethereum Classic", "ETC", "ETCUSDT"],
  ["stellar", "Stellar", "XLM", "XLMUSDT"],
  ["internet-computer", "Internet Computer", "ICP", "ICPUSDT"],
  ["filecoin", "Filecoin", "FIL", "FILUSDT"],
  ["aptos", "Aptos", "APT", "APTUSDT"],
  ["arbitrum", "Arbitrum", "ARB", "ARBUSDT"],
  ["optimism", "Optimism", "OP", "OPUSDT"],
  ["near", "NEAR Protocol", "NEAR", "NEARUSDT"],
  ["injective-protocol", "Injective", "INJ", "INJUSDT"],
  ["sui", "Sui", "SUI", "SUIUSDT"],
  ["sei-network", "Sei", "SEI", "SEIUSDT"],
  ["the-open-network", "Toncoin", "TON", "TONUSDT"],
  ["shiba-inu", "Shiba Inu", "SHIB", "SHIBUSDT"],
  ["pepe", "Pepe", "PEPE", "PEPEUSDT"],
  ["dogwifcoin", "dogwifhat", "WIF", "WIFUSDT"],
  ["bonk", "Bonk", "BONK", "BONKUSDT"],
  ["render-token", "Render", "RENDER", "RENDERUSDT"],
  ["celestia", "Celestia", "TIA", "TIAUSDT"],
  ["algorand", "Algorand", "ALGO", "ALGOUSDT"],
  ["vechain", "VeChain", "VET", "VETUSDT"],
  ["the-sandbox", "The Sandbox", "SAND", "SANDUSDT"],
  ["decentraland", "Decentraland", "MANA", "MANAUSDT"],
  ["axie-infinity", "Axie Infinity", "AXS", "AXSUSDT"],
  ["the-graph", "The Graph", "GRT", "GRTUSDT"],
  ["aave", "Aave", "AAVE", "AAVEUSDT"],
  ["maker", "Maker", "MKR", "MKRUSDT"],
  ["curve-dao-token", "Curve DAO", "CRV", "CRVUSDT"],
  ["compound-governance-token", "Compound", "COMP", "COMPUSDT"],
  ["ethereum-name-service", "Ethereum Name Service", "ENS", "ENSUSDT"],
  ["lido-dao", "Lido DAO", "LDO", "LDOUSDT"],
  ["thorchain", "THORChain", "RUNE", "RUNEUSDT"],
  ["kava", "Kava", "KAVA", "KAVAUSDT"],
  ["oasis-network", "Oasis Network", "ROSE", "ROSEUSDT"],
  ["zilliqa", "Zilliqa", "ZIL", "ZILUSDT"],
  ["iota", "IOTA", "IOTA", "IOTAUSDT"],
  ["neo", "NEO", "NEO", "NEOUSDT"],
  ["qtum", "Qtum", "QTUM", "QTUMUSDT"],
  ["zcash", "Zcash", "ZEC", "ZECUSDT"],
  ["dash", "Dash", "DASH", "DASHUSDT"],
  ["eos", "EOS", "EOS", "EOSUSDT"],
  ["tezos", "Tezos", "XTZ", "XTZUSDT"],
  ["theta-token", "Theta Network", "THETA", "THETAUSDT"],
  ["flow", "Flow", "FLOW", "FLOWUSDT"],
  ["kusama", "Kusama", "KSM", "KSMUSDT"],
  ["enjincoin", "Enjin Coin", "ENJ", "ENJUSDT"],
  ["chiliz", "Chiliz", "CHZ", "CHZUSDT"],
  ["gala", "Gala", "GALA", "GALAUSDT"],
  ["1inch", "1inch", "1INCH", "1INCHUSDT"],
  ["pancakeswap-token", "PancakeSwap", "CAKE", "CAKEUSDT"],
  ["basic-attention-token", "Basic Attention Token", "BAT", "BATUSDT"],
  ["loopring", "Loopring", "LRC", "LRCUSDT"],
  ["gmx", "GMX", "GMX", "GMXUSDT"],
  ["dydx-chain", "dYdX", "DYDX", "DYDXUSDT"],
  ["blur", "Blur", "BLUR", "BLURUSDT"],
  ["worldcoin-wld", "Worldcoin", "WLD", "WLDUSDT"],
  ["jupiter-exchange-solana", "Jupiter", "JUP", "JUPUSDT"],
  ["pyth-network", "Pyth Network", "PYTH", "PYTHUSDT"],
  ["starknet", "Starknet", "STRK", "STRKUSDT"],
  ["manta-network", "Manta Network", "MANTA", "MANTAUSDT"],
  ["akash-network", "Akash Network", "AKT", "AKTUSDT"],
  ["kaspa", "Kaspa", "KAS", "KASUSDT"],
  ["ondo-finance", "Ondo", "ONDO", "ONDOUSDT"],
  ["floki", "FLOKI", "FLOKI", "FLOKIUSDT"],
  ["mantle", "Mantle", "MNT", "MNTUSDT"],
  ["usd-coin", "USD Coin", "USDC", "USDCUSDT"],
  ["dai", "Dai", "DAI", "DAIUSDT"],
  ["wrapped-bitcoin", "Wrapped Bitcoin", "WBTC", "WBTCUSDT"],
];

/**
 * Local, instant (no network) search over the curated catalog.
 * Ranking: exact symbol > exact name > name-prefix > symbol-prefix >
 * substring anywhere.
 */
export function searchCatalog(query, limit = 8) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored = [];
  for (const [id, name, symbol, binance] of CATALOG) {
    const n = name.toLowerCase();
    const s = symbol.toLowerCase();
    let score = -1;
    if (s === q) score = 100;
    else if (n === q) score = 95;
    else if (n.startsWith(q)) score = 80;
    else if (s.startsWith(q)) score = 70;
    else if (n.includes(q)) score = 40;
    if (score > 0) scored.push({ id, name, symbol, binance, score });
  }
  scored.sort((a, b) => b.score - a.score || a.name.length - b.name.length);
  return scored.slice(0, limit);
}

export function findInCatalog(id) {
  const hit = CATALOG.find(([cid]) => cid === id);
  return hit ? { id: hit[0], name: hit[1], symbol: hit[2], binance: hit[3] } : null;
}
