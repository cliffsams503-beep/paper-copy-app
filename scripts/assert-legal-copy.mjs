/**
 * Asserts required legal copy is present in source (no Jest).
 * Fails if a required sentence is missing or weakened.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

function mustInclude(rel, needle, label) {
  const text = read(rel);
  if (!text.includes(needle)) {
    throw new Error(`${label} missing from ${rel}:\n${needle}`);
  }
}

const DISCLAIMER =
  "Paper Copy is a simulation with virtual money only. No real trades, wallets, or deposits. Not financial advice. Paper results do not predict future profits. Market data and quotes are estimates. Independent of Pump.fun. Credits and scoreboard fees are not money and cannot be spent, transferred, or withdrawn.";

const BUY =
  "This creates a paper position only. Prices and fills are guesstimates (including assumed slippage). This is not a recommendation to buy this token with real money. Simulated results do not mean you would profit (or lose the same amount) in a live market.";

const FIXTURE =
  "Not a recommendation. Paste any public Solana address as a technical watch fixture only. We do not rank, endorse, or suggest wallets. Following a wallet does not mean that wallet is skilled. Viewing a signal never opens a position until you tap Yes. Never paste a seed or private key.";

const AGE =
  "Paper Copy is not directed at children under 13. If you are under 13, you should not use this app.";

mustInclude("src/lib/legalCopy.ts", DISCLAIMER, "footer disclaimer");
mustInclude("src/lib/legalCopy.ts", BUY, "buy disclaimer");
mustInclude("src/lib/legalCopy.ts", FIXTURE, "fixture notice");
mustInclude("src/lib/legalCopy.ts", AGE, "age notice");
mustInclude("src/lib/legalCopy.ts", "November 5, 2026", "updated date");

mustInclude("src/components/LegalFooter.tsx", "PAPER_DISCLAIMER", "footer uses disclaimer");
mustInclude("src/components/LegalFooter.tsx", 'href="/terms"', "terms link");
mustInclude("src/components/LegalFooter.tsx", 'href="/privacy"', "privacy link");
mustInclude("src/components/LegalFooter.tsx", "AGE_NOTICE", "age near footer");

mustInclude("src/components/PaperCopyApp.tsx", "LegalFooter", "footer on app shell");
mustInclude("src/components/TokenScreen.tsx", "PAPER_BUY_DISCLAIMER", "meme buy prompt");
mustInclude("src/components/CopyScreen.tsx", "PAPER_BUY_DISCLAIMER", "copy buy prompt");
mustInclude("src/components/CopyScreen.tsx", "COPY_FIXTURE_NOTICE", "copy fixture");
mustInclude("src/components/CopyScreen.tsx", "Powered by Jupiter", "jupiter credit");

mustInclude("src/components/LegalDocument.tsx", "LegalFooter", "legal pages footer");
mustInclude("src/app/terms/page.tsx", "LegalDocument", "terms page shell");
mustInclude("src/app/terms/page.tsx", "November 5, 2026", "terms date");
mustInclude("src/app/terms/page.tsx", "Cliff Sams", "terms operator");
mustInclude("src/app/terms/page.tsx", "AGE_NOTICE", "terms age notice");
mustInclude("src/app/privacy/page.tsx", "LegalDocument", "privacy page shell");
mustInclude("src/app/privacy/page.tsx", "paper-copy-v1", "privacy storage key");
mustInclude("src/app/privacy/page.tsx", "November 5, 2026", "privacy date");
mustInclude("src/app/privacy/page.tsx", "AGE_NOTICE", "privacy age notice");

const score = read("src/components/ScoreboardScreen.tsx");
if (!/not a payout/i.test(score) || !/scoreboard credit/i.test(score)) {
  throw new Error("scoreboard dollar figures missing scoreboard-credit / not-a-payout label");
}

const banned = [DISCLAIMER, BUY, FIXTURE];
for (const rel of [
  "src/components/LegalFooter.tsx",
  "src/components/CopyScreen.tsx",
  "src/components/TokenScreen.tsx",
  "src/app/terms/page.tsx",
  "src/app/privacy/page.tsx",
]) {
  const text = read(rel);
  if (/wallet adapter|@solana\/wallet|signTransaction|real money deposit/i.test(text)) {
    throw new Error(`${rel} looks like it adds wallet or real-money behavior`);
  }
  for (const phrase of banned) {
    if (text.includes(phrase.slice(0, 40)) && text.includes("[TODO]")) {
      throw new Error(`${rel} still has a placeholder`);
    }
  }
}

const terms = read("src/app/terms/page.tsx");
const privacy = read("src/app/privacy/page.tsx");
if (/\b[A-Z][a-z]+,\s+[A-Z]{2}\b/.test(terms) && /governing law/i.test(terms)) {
  throw new Error("terms appear to name a governing-law venue");
}
const email = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
if (email.test(terms) || email.test(privacy)) {
  throw new Error("legal pages must not invent an email address");
}
if (/phone/i.test(terms) && /\d{3}[-.\s]\d{3}/.test(terms)) {
  throw new Error("terms publish a phone number");
}
if (/GDPR compliant|CCPA compliant|certified under/i.test(privacy)) {
  throw new Error("privacy page makes a compliance certification claim");
}

console.log("legal copy assertions passed");
