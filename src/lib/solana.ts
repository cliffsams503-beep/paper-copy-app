/** Lightweight Solana pubkey helpers — no wallet adapter. */

const ALPH =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const ALPH_MAP = new Map([...ALPH].map((c, i) => [c, i]));

export const WSOL = "So11111111111111111111111111111111111111112";
export const PUMP_PROGRAM = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";

export type AddressCheck =
  | { ok: true; address: string }
  | { ok: false; reason: string; looksLikeSecret: boolean };

export function looksLikeSecretMaterial(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  // Seed / recovery phrase (multiple words)
  if (/\s/.test(t) && t.split(/\s+/).filter(Boolean).length >= 8) return true;
  // Long hex private-key style
  if (/^(0x)?[0-9a-fA-F]{64,}$/.test(t.replace(/\s+/g, ""))) return true;
  // Comma/array of numbers (byte array secret)
  if (/^\s*\[?\s*\d+(\s*,\s*\d+){31,}\s*\]?\s*$/.test(t)) return true;
  return false;
}

export function decodeBase58(str: string): Uint8Array | null {
  if (!str || /[^123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]/.test(str)) {
    return null;
  }
  let num = 0n;
  for (const ch of str) {
    const v = ALPH_MAP.get(ch);
    if (v === undefined) return null;
    num = num * 58n + BigInt(v);
  }
  const hex = num.toString(16);
  const padded = hex.length % 2 ? "0" + hex : hex;
  const bytes = new Uint8Array(padded.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(padded.slice(i * 2, i * 2 + 2), 16);
  }
  // Restore leading zeros (base58 '1')
  let leading = 0;
  for (const ch of str) {
    if (ch === "1") leading++;
    else break;
  }
  if (leading === 0) return bytes;
  const out = new Uint8Array(leading + bytes.length);
  out.set(bytes, leading);
  return out;
}

export function encodeBase58(bytes: Uint8Array): string {
  let num = 0n;
  for (const b of bytes) num = (num << 8n) + BigInt(b);
  let s = "";
  while (num > 0n) {
    const r = Number(num % 58n);
    num = num / 58n;
    s = ALPH[r] + s;
  }
  for (const b of bytes) {
    if (b === 0) s = "1" + s;
    else break;
  }
  return s || "1";
}

/** Validate a Solana public key (base58, 32-byte). Reject secrets. */
export function validatePublicSolanaAddress(raw: string): AddressCheck {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      ok: false,
      reason: "Paste a public Solana wallet address.",
      looksLikeSecret: false,
    };
  }
  if (looksLikeSecretMaterial(trimmed)) {
    return {
      ok: false,
      reason:
        "Only paste a public address, never a seed phrase or private key.",
      looksLikeSecret: true,
    };
  }
  if (/\s/.test(trimmed)) {
    return {
      ok: false,
      reason:
        "Only paste a public address, never a seed phrase or private key.",
      looksLikeSecret: true,
    };
  }
  const decoded = decodeBase58(trimmed);
  if (!decoded || decoded.length !== 32) {
    return {
      ok: false,
      reason:
        "That does not look like a Solana public key (base58, 32 bytes).",
      looksLikeSecret: false,
    };
  }
  return { ok: true, address: trimmed };
}

export function shortenAddress(addr: string, left = 4, right = 4): string {
  if (addr.length <= left + right + 1) return addr;
  return `${addr.slice(0, left)}…${addr.slice(-right)}`;
}

/** SHA-256 first 8 bytes of `event:TradeEvent` discriminator (Pump.fun). */
const TRADE_EVT = new Uint8Array([
  0xbd, 0xdb, 0x7f, 0xd3, 0x4e, 0xe6, 0x61, 0xee,
]);

function b64ToBytes(b64: string): Uint8Array | null {
  try {
    if (typeof Buffer !== "undefined") {
      return new Uint8Array(Buffer.from(b64, "base64"));
    }
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function readU64LE(buf: Uint8Array, o: number): bigint {
  const view = new DataView(buf.buffer, buf.byteOffset + o, 8);
  return view.getBigUint64(0, true);
}


export type PumpTradeEvent = {
  mint: string;
  solAmount: string;
  tokenAmount: string;
  isBuy: boolean;
  user: string;
  creator: string | null;
  creatorFee: string | null;
};

export function decodePumpTradeEvents(
  logs: string[] | null | undefined
): PumpTradeEvent[] {
  const out: PumpTradeEvent[] = [];
  for (const l of logs || []) {
    if (!l.startsWith("Program data: ")) continue;
    const b = b64ToBytes(l.slice("Program data: ".length));
    if (!b || b.length < 8 + 32 + 8 + 8 + 1 + 32 + 8) continue;
    let match = true;
    for (let i = 0; i < 8; i++) {
      if (b[i] !== TRADE_EVT[i]) {
        match = false;
        break;
      }
    }
    if (!match) continue;
    let o = 8;
    const mint = encodeBase58(b.slice(o, o + 32));
    o += 32;
    const solAmount = readU64LE(b, o).toString();
    o += 8;
    const tokenAmount = readU64LE(b, o).toString();
    o += 8;
    const isBuy = b[o] === 1;
    o += 1;
    const user = encodeBase58(b.slice(o, o + 32));
    o += 32;
    o += 8; // timestamp
    o += 32; // reserves
    let creator: string | null = null;
    let creatorFee: string | null = null;
    if (b.length >= o + 32 + 16 + 32 + 16) {
      o += 32; // fee recipient
      o += 16; // fee bps + fee
      creator = encodeBase58(b.slice(o, o + 32));
      o += 32;
      o += 8; // creator fee bps
      creatorFee = readU64LE(b, o).toString();
    }
    out.push({
      mint,
      solAmount,
      tokenAmount,
      isBuy,
      user,
      creator,
      creatorFee,
    });
  }
  return out;
}

type JsonTx = {
  slot?: number;
  blockTime?: number | null;
  meta?: {
    err?: unknown;
    fee?: number;
    preBalances?: number[];
    postBalances?: number[];
    preTokenBalances?: Array<{
      owner?: string;
      mint: string;
      uiTokenAmount: { amount: string; decimals: number };
    }>;
    postTokenBalances?: Array<{
      owner?: string;
      mint: string;
      uiTokenAmount: { amount: string; decimals: number };
    }>;
    logMessages?: string[];
    innerInstructions?: Array<{
      instructions: Array<{ programId?: string }>;
    }>;
  };
  transaction?: {
    message?: {
      accountKeys?: Array<string | { pubkey: string }>;
      instructions?: Array<{ programId?: string }>;
    };
  };
};

export type ParsedSwapResult = {
  parseOk: boolean;
  signature: string;
  err: unknown;
  direction: "BUY" | "SELL" | "TOKEN_SWAP" | null;
  inMint: string | null;
  inAmount: string | null;
  outMint: string | null;
  outAmount: string | null;
  inDecimals: number | null;
  outDecimals: number | null;
  programs: string[];
  pumpEvents: PumpTradeEvent[];
  creatorLabel: string;
  blockTime: number | null;
  slot: number | null;
  reason?: string;
};

export function parseSwapTransaction(
  signature: string,
  tx: JsonTx,
  wallet: string
): ParsedSwapResult {
  const meta = tx.meta;
  const message = tx.transaction?.message;
  if (!meta || !message) {
    return {
      parseOk: false,
      signature,
      err: meta?.err ?? null,
      direction: null,
      inMint: null,
      inAmount: null,
      outMint: null,
      outAmount: null,
      inDecimals: null,
      outDecimals: null,
      programs: [],
      pumpEvents: [],
      creatorLabel: "Unknown creator",
      blockTime: tx.blockTime ?? null,
      slot: tx.slot ?? null,
      reason: "Missing transaction message/meta",
    };
  }

  const keys = (message.accountKeys || []).map((k) =>
    typeof k === "string" ? k : k.pubkey
  );
  const programs = new Set<string>();
  for (const ix of message.instructions || []) {
    if (ix.programId) programs.add(ix.programId);
  }
  for (const inner of meta.innerInstructions || []) {
    for (const ix of inner.instructions) {
      if (ix.programId) programs.add(ix.programId);
    }
  }

  let solLamportsDelta = 0;
  if (wallet && keys.includes(wallet)) {
    const i = keys.indexOf(wallet);
    const pre = meta.preBalances?.[i] ?? 0;
    const post = meta.postBalances?.[i] ?? 0;
    solLamportsDelta = post - pre;
    if (keys[0] === wallet && typeof meta.fee === "number") {
      solLamportsDelta += meta.fee;
    }
  }

  const deltas: Record<
    string,
    { pre: bigint; post: bigint; decimals: number }
  > = {};
  for (const side of ["pre", "post"] as const) {
    const arr =
      side === "pre" ? meta.preTokenBalances || [] : meta.postTokenBalances || [];
    for (const b of arr) {
      if (b.owner !== wallet) continue;
      const d = (deltas[b.mint] ??= {
        pre: 0n,
        post: 0n,
        decimals: b.uiTokenAmount.decimals,
      });
      d[side] += BigInt(b.uiTokenAmount.amount);
      d.decimals = b.uiTokenAmount.decimals;
    }
  }
  const tok: Record<string, { delta: bigint; decimals: number }> = {};
  for (const [mint, d] of Object.entries(deltas)) {
    if (d.post !== d.pre) {
      tok[mint] = { delta: d.post - d.pre, decimals: d.decimals };
    }
  }

  const wsolDelta = tok[WSOL]?.delta ?? 0n;
  const netSol = BigInt(solLamportsDelta) + wsolDelta;
  const others = Object.fromEntries(
    Object.entries(tok).filter(([m]) => m !== WSOL)
  );

  const pumpEvents = decodePumpTradeEvents(meta.logMessages);
  let creatorLabel = "Unknown creator";
  for (const ev of pumpEvents) {
    if (ev.user === wallet && ev.creator) {
      creatorLabel = `Creator ${shortenAddress(ev.creator)}`;
      break;
    }
  }

  let direction: ParsedSwapResult["direction"] = null;
  let inMint: string | null = null;
  let inAmount: string | null = null;
  let outMint: string | null = null;
  let outAmount: string | null = null;
  let inDecimals: number | null = null;
  let outDecimals: number | null = null;

  const otherEntries = Object.entries(others);
  if (otherEntries.length === 1) {
    const [mint, v] = otherEntries[0];
    if (v.delta > 0n && netSol < 0n) {
      direction = "BUY";
      inMint = WSOL;
      inAmount = (-netSol).toString();
      inDecimals = 9;
      outMint = mint;
      outAmount = v.delta.toString();
      outDecimals = v.decimals;
    } else if (v.delta < 0n && netSol > 0n) {
      direction = "SELL";
      inMint = mint;
      inAmount = (-v.delta).toString();
      inDecimals = v.decimals;
      outMint = WSOL;
      outAmount = netSol.toString();
      outDecimals = 9;
    }
  } else if (otherEntries.length === 2) {
    const [[m1, v1], [m2, v2]] = otherEntries;
    if (v1.delta < 0n && v2.delta > 0n) {
      direction = "TOKEN_SWAP";
      inMint = m1;
      inAmount = (-v1.delta).toString();
      inDecimals = v1.decimals;
      outMint = m2;
      outAmount = v2.delta.toString();
      outDecimals = v2.decimals;
    } else if (v2.delta < 0n && v1.delta > 0n) {
      direction = "TOKEN_SWAP";
      inMint = m2;
      inAmount = (-v2.delta).toString();
      inDecimals = v2.decimals;
      outMint = m1;
      outAmount = v1.delta.toString();
      outDecimals = v1.decimals;
    }
  }

  const parseOk = Boolean(direction) && meta.err == null;
  return {
    parseOk,
    signature,
    err: meta.err ?? null,
    direction,
    inMint,
    inAmount,
    outMint,
    outAmount,
    inDecimals,
    outDecimals,
    programs: [...programs].filter(Boolean).sort(),
    pumpEvents,
    creatorLabel,
    blockTime: tx.blockTime ?? null,
    slot: tx.slot ?? null,
    reason: parseOk
      ? undefined
      : meta.err
        ? "Transaction failed on-chain"
        : "Could not parse direction/size/mints",
  };
}

/** Verify TRADE_EVT discriminator at runtime matches sha256 prefix when crypto available. */
export async function assertTradeEvtDiscriminator(): Promise<boolean> {
  try {
    const data = new TextEncoder().encode("event:TradeEvent");
    const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
    for (let i = 0; i < 8; i++) {
      if (hash[i] !== TRADE_EVT[i]) return false;
    }
    return true;
  } catch {
    return true;
  }
}
