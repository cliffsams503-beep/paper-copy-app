import Link from "next/link";
import { AGE_NOTICE, PAPER_DISCLAIMER } from "@/lib/legalCopy";

export function LegalFooter() {
  return (
    <footer className="legal-strip" aria-label="Legal">
      <p className="legal-disclaimer">{PAPER_DISCLAIMER}</p>
      <p className="age-notice">{AGE_NOTICE}</p>
      <nav className="legal-links" aria-label="Legal documents">
        <Link href="/terms">Terms of Service</Link>
        <Link href="/privacy">Privacy Policy</Link>
      </nav>
    </footer>
  );
}
