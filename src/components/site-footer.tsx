import Link from "next/link";

function SocialIcon({
  label,
  href,
  children,
}: {
  label: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      aria-label={label}
      target="_blank"
      rel="noreferrer"
      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-fg shadow-[var(--shadow)]
      transition hover:translate-y-[-1px] hover:bg-bg hover:border-[var(--accent-yellow)]/40
      focus:outline-none focus:ring-2 focus:ring-[var(--accent-yellow)]/25"
    >
      {children}
    </a>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-14 border-t border-border bg-bg">
      <div className="mx-auto max-w-6xl px-4 py-12">
        {/* Top grid */}
        <div className="grid gap-10 md:grid-cols-12">
          {/* Brand */}
          <div className="md:col-span-5">
            <div className="flex items-start gap-3">
              <div
                className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-card shadow-[var(--shadow)]
                ring-1 ring-[var(--accent-yellow)]/30"
              >
                <span className="text-sm font-semibold tracking-tight">MC</span>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-[15px] font-semibold text-fg">MinerChecker</div>
                  <span
                    className="inline-flex items-center gap-2 rounded-full px-2 py-0.5 text-[11px] font-semibold
                    ring-1 ring-[var(--accent-red)]/30 bg-[var(--accent-red)]/10 text-fg"
                  >
                    Verified
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent-yellow)]" />
                  </span>
                </div>

                <div className="mt-1 text-xs text-muted">
                  Accurate, vendor-aware profitability intelligence for ASIC hardware.
                </div>
              </div>
            </div>

            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
              MinerChecker helps miners and buyers evaluate ASIC hardware with clear economics, verified vendor listings,
              and snapshot-based profitability insights. Built for decision-making — not guesswork.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <SocialIcon label="X (Twitter)" href="https://x.com/">
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M18.9 2H22l-6.8 7.8L23.6 22h-6.6l-5.2-6.7L5.7 22H2.6l7.4-8.5L.9 2h6.8l4.7 6.1L18.9 2Zm-1.1 18h1.7L7 3.9H5.2l12.6 16.1Z"
                  />
                </svg>
              </SocialIcon>

              <SocialIcon label="GitHub" href="https://github.com/">
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-3 .7-3.6-1.3-3.6-1.3-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.4 1.1 3 .8.1-.7.4-1.1.6-1.4-2.4-.3-4.9-1.2-4.9-5.3 0-1.2.4-2.1 1-2.9-.1-.2-.4-1.3.1-2.7 0 0 .9-.3 2.9 1.1.9-.2 1.8-.3 2.7-.3.9 0 1.8.1 2.7.3 2-1.4 2.9-1.1 2.9-1.1.5 1.4.2 2.5.1 2.7.6.8 1 1.7 1 2.9 0 4.1-2.5 5-4.9 5.3.4.3.7.9.7 1.9V21c0 .3.2.6.7.5A10 10 0 0 0 12 2Z"
                  />
                </svg>
              </SocialIcon>

              <SocialIcon label="YouTube" href="https://youtube.com/">
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M21.6 7.2a3 3 0 0 0-2.1-2.1C17.7 4.5 12 4.5 12 4.5s-5.7 0-7.5.6A3 3 0 0 0 2.4 7.2 31.5 31.5 0 0 0 2 12s0 2.9.4 4.8a3 3 0 0 0 2.1 2.1c1.8.6 7.5.6 7.5.6s5.7 0 7.5-.6a3 3 0 0 0 2.1-2.1c.4-1.9.4-4.8.4-4.8s0-2.9-.4-4.8ZM10 15V9l6 3-6 3Z"
                  />
                </svg>
              </SocialIcon>
            </div>

            {/* Subtle accent line */}
            <div className="mt-8 h-px w-full bg-gradient-to-r from-transparent via-[var(--accent-red)]/25 to-transparent" />
          </div>

          {/* Nav columns */}
          <div className="grid gap-8 sm:grid-cols-2 md:col-span-7 md:grid-cols-4 md:gap-6">
            <FooterCol title="Miners">
              <FooterLink href="/miners/asic-miners">ASIC Miners</FooterLink>
              <FooterLink href="/miners/profitability">Profitability</FooterLink>
              <FooterLink href="/miners/efficiency">Efficiency</FooterLink>
              <FooterLink href="/miners/mineable-coins">Mineable Coins</FooterLink>
              <FooterLink href="/miners/manufacturers">Manufacturers</FooterLink>
              <FooterLink href="/miners/mining-pools">Mining Pools</FooterLink>
            </FooterCol>

            <FooterCol title="Marketplace">
              <FooterLink href="/marketplace/trusted-vendors">Trusted Vendors</FooterLink>
              <FooterLink href="/marketplace/cloud-mining">Cloud Mining</FooterLink>
              <FooterLink href="/marketplace/hardware-wallets">Hardware Wallets</FooterLink>
              <FooterLink href="/support/newsletter">Newsletter</FooterLink>
            </FooterCol>

            <FooterCol title="Industry">
              <FooterLink href="/industry/halving-countdown">Halving Countdown</FooterLink>
              <FooterLink href="/industry/mining-events">Mining Events</FooterLink>
              <FooterLink href="/resources/learning-hub">Learning Hub</FooterLink>
              <FooterLink href="/resources/crypto-glossary">Crypto Glossary</FooterLink>
            </FooterCol>

            <FooterCol title="Support">
              <FooterLink href="/support/faq">FAQ</FooterLink>
              <FooterLink href="/support/contact">Contact Us</FooterLink>
              <FooterLink href="/support/newsletter">Newsletter</FooterLink>
            </FooterCol>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 border-t border-border pt-6">
          <div className="flex flex-col gap-3 text-xs text-muted md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent-yellow)]" />
              <span>© {new Date().getFullYear()} MinerChecker. All rights reserved.</span>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <Link
                className="transition hover:text-fg focus:outline-none focus:ring-2 focus:ring-[var(--accent-yellow)]/20 rounded-md"
                href="/support/faq"
              >
                Help
              </Link>
              <Link
                className="transition hover:text-fg focus:outline-none focus:ring-2 focus:ring-[var(--accent-yellow)]/20 rounded-md"
                href="/support/contact"
              >
                Contact
              </Link>
              <Link
                className="transition hover:text-fg focus:outline-none focus:ring-2 focus:ring-[var(--accent-yellow)]/20 rounded-md"
                href="/resources/crypto-glossary"
              >
                Glossary
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

/** UI-only helpers (links unchanged) */
function FooterCol({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-sm font-semibold text-fg">{title}</div>
      <div className="mt-4 h-px w-10 bg-[var(--accent-yellow)]/40" />
      <ul className="mt-4 space-y-3 text-sm text-muted">{children}</ul>
    </div>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="group inline-flex items-center gap-2 transition hover:text-fg
        focus:outline-none focus:ring-2 focus:ring-[var(--accent-yellow)]/20 rounded-md"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-red)]/35 transition group-hover:bg-[var(--accent-yellow)]" />
        <span>{children}</span>
      </Link>
    </li>
  );
}
