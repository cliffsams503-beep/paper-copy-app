import type { Metadata } from "next";
import { LegalDocument } from "@/components/LegalDocument";
import { AGE_NOTICE } from "@/lib/legalCopy";

export const metadata: Metadata = {
  title: "Terms of Service — Paper Copy",
  description:
    "Terms for Paper Copy, a simulated Solana paper-trading prototype. No brokerage, custody, wallet, or real-money service.",
};

export default function TermsPage() {
  return (
    <LegalDocument title="Terms of Service">
      <p className="legal-updated">Last updated November 5, 2026</p>
      <p>
        These terms cover the Paper Copy prototype (planned brand PaperSaver).
        The operator is Cliff Sams. This prototype does not publish a phone
        number or an email address.
      </p>

      <h2>Nature of the service</h2>
      <p>
        Paper Copy is simulated paper trading only. You practice with virtual
        money inside the app. Paper Copy is not a brokerage, not a custody
        service, not an exchange, and not a wallet service. It does not connect
        a wallet, hold assets for you, route real orders, or move tokens.
      </p>
      <p>
        Paper Copy is independent — not Pump.fun. It does not use Pump.fun’s
        logo and it is not the Pump.fun product.
      </p>

      <h2>No real money</h2>
      <p>
        There is no real money in this app. Virtual cash, credits, and
        scoreboard fees are not money. They cannot be spent, transferred, or
        withdrawn. There is no deposit and no payout. A paper result is not a
        cash balance.
      </p>

      <h2>Not advice, no warranties, data as-is</h2>
      <p>
        Paper Copy is not financial, investment, tax, or legal advice. Nothing
        in the app is a recommendation to buy or sell a token with real money.
        Market data, prices, and quotes are estimates provided as-is. We do not
        warrant that they are accurate, complete, timely, or that a paper fill
        matches a live market. Paper results do not predict future profits.
        Simulated results do not mean you would profit, or lose the same
        amount, in a live market.
      </p>

      <h2>Your responsibilities</h2>
      <ul>
        <li>Paste public addresses only. Never paste a seed phrase or a private key.</li>
        <li>Do not abuse the app or its API proxies.</li>
        <li>Do not scrape beyond normal use of the app in a browser.</li>
        <li>Do not use Paper Copy for anything unlawful.</li>
        <li>
          You are responsible for what you paste and for following the law that
          applies to you.
        </li>
      </ul>

      <h2>Third-party data</h2>
      <p>
        When you use the app, it may request data from DexScreener, a public
        Solana RPC, and Jupiter. Those services are not run by Paper Copy.
        Their terms may apply to the underlying data and to the request you
        triggered. Quotes are unsigned estimates. Paper Copy does not sign
        transactions.
      </p>

      <h2>Names and branding</h2>
      <p>
        Paper Copy (planned brand PaperSaver) is not affiliated with, endorsed
        by, or sponsored by Pump.fun, DexScreener, or Jupiter, beyond permitted
        use of their public APIs. Their names belong to their owners. “Powered
        by Jupiter” on a quote is an attribution for an unsigned quote, not a
        partnership and not a product endorsement.
      </p>

      <h2>Age</h2>
      <p>{AGE_NOTICE}</p>
      <p>
        This is a notice, not a date-of-birth check. The app does not ask you
        to confirm an age with a checkbox.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the fullest extent the law allows, Cliff Sams and Paper Copy are not
        liable for loss or damage from using this simulation. That includes
        relying on an estimate, a quote, a paper profit or loss, a scoreboard
        credit, or third-party data. The prototype is offered as-is. Because it
        does not move real money, do not treat a paper result as a real gain or
        a real loss. Some places do not allow certain limits on liability; in
        those places, the limit applies only as far as the law allows. These
        terms do not name a court or a venue.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        We may update these terms. When we do, we will change the “Last
        updated” date above. If you keep using Paper Copy after that date, you
        are accepting the updated terms. If you do not agree, stop using the
        app.
      </p>
    </LegalDocument>
  );
}
