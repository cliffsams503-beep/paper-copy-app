import type { Metadata } from "next";
import { LegalDocument } from "@/components/LegalDocument";
import { AGE_NOTICE } from "@/lib/legalCopy";

export const metadata: Metadata = {
  title: "Privacy Policy — Paper Copy",
  description:
    "How the Paper Copy prototype handles browser paper state, IP address, User-Agent, and public wallet addresses you paste. No accounts in this build.",
};

export default function PrivacyPage() {
  return (
    <LegalDocument title="Privacy Policy">
      <p className="legal-updated">Last updated November 5, 2026</p>
      <p>
        This policy describes the Paper Copy prototype operated by Cliff Sams.
        It says what this build actually does. It is not a certification under
        the GDPR, the CCPA, or any other privacy law. This prototype does not
        publish a phone number or an email address.
      </p>

      <h2>Age</h2>
      <p>{AGE_NOTICE}</p>
      <p>
        We do not knowingly want children under 13 to use the app, and we do
        not ask them to create an account. This notice is not a date-of-birth
        gate.
      </p>

      <h2>Paper state in the browser</h2>
      <p>
        Your paper account lives in this browser. The app stores it in
        localStorage under the key <code>paper-copy-v1</code>. That can include
        virtual cash, paper positions, scoreboard credits, and settings such as
        the slippage preference. It stays in the browser until you clear site
        data or use Reset paper account. Reset keeps the slippage preference
        and clears the paper positions.
      </p>

      <h2>What the server may process</h2>
      <p>
        There is no account in this build. When the app calls its own API
        routes, the server that hosts Paper Copy may process:
      </p>
      <ul>
        <li>your IP address</li>
        <li>your User-Agent</li>
        <li>
          public wallet addresses you paste, while Copy mode polls public chain
          data for that address
        </li>
      </ul>
      <p>
        Copy mode sends the public address you chose to the app’s API so it can
        read public signatures and transactions and, after your selected delay,
        request an unsigned quote. The app is built to reject seed phrases and
        private keys and not to forward a signed transaction.
      </p>

      <h2>What this build does not collect</h2>
      <ul>
        <li>No accounts and no passwords.</li>
        <li>No seed phrases and no private keys.</li>
        <li>No payment cards.</li>
        <li>
          No analytics cookie SDK in the current source. This build does not
          add a third-party analytics script.
        </li>
      </ul>

      <h2>Why this data is processed</h2>
      <p>
        The purpose is running the simulation and the API proxies, plus
        security and abuse prevention. Example: loading the meme list, reading
        a public token, pricing SOL, or polling a public address you asked to
        watch.
      </p>

      <h2>We do not sell data</h2>
      <p>
        Paper Copy does not sell personal information. Scoreboard credits are
        not sold, transferred, or paid out, because they are not money.
      </p>

      <h2>Hosting and third-party APIs</h2>
      <p>
        The host that runs the app (for example Render) may process requests
        under that host’s own systems, including default server logs. Log
        retention follows the host’s defaults. This policy does not promise a
        separate retention period.
      </p>
      <p>
        Third-party APIs you trigger may also process the request. Those can
        include DexScreener, a public Solana RPC, and Jupiter when a quote is
        requested. Their terms and privacy practices apply to their services.
        Paper Copy is not affiliated with Pump.fun, DexScreener, or Jupiter
        beyond permitted API use. Paper Copy is independent — not Pump.fun.
      </p>

      <h2>How long it stays</h2>
      <ul>
        <li>
          Browser storage under <code>paper-copy-v1</code> remains until you
          clear it or reset the paper account in the app.
        </li>
        <li>Server logs follow the host’s defaults.</li>
      </ul>

      <h2>Changes</h2>
      <p>
        We may update this policy. The “Last updated” date will change when we
        do. The date of this version is November 5, 2026.
      </p>
    </LegalDocument>
  );
}
