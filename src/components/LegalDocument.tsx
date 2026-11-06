import Link from "next/link";
import type { ReactNode } from "react";
import { LegalFooter } from "./LegalFooter";

export function LegalDocument({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="legal-shell">
      <header className="legal-top">
        <Link href="/" className="back">
          ← Paper Copy
        </Link>
        <p className="tag">Independent — not Pump.fun. Simulated. No real money.</p>
        <h1>{title}</h1>
      </header>
      <article className="legal-body">{children}</article>
      <LegalFooter />
    </div>
  );
}
