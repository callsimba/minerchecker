import Link from "next/link";
import Image from "next/image";

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
      className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/5 bg-[#151a2a] text-slate-400 transition-all duration-200 hover:-translate-y-0.5 hover:border-orange-500/30 hover:bg-orange-500/10 hover:text-orange-400 hover:shadow-lg hover:shadow-orange-900/20"
    >
      {children}
    </a>
  );
}

function FooterCol({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
        {title}
      </h3>
      <ul className="flex flex-col gap-3">{children}</ul>
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
        className="group inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white"
      >
        <span className="h-px w-0 bg-orange-500 transition-all duration-300 group-hover:w-2" />
        <span>{children}</span>
      </Link>
    </li>
  );
}

export function SiteFooter() {
  return (
    <footer className="relative border-t border-white/5 bg-[#0b0e14] pt-16 pb-8">
      {/* Background Grid Pattern */}
      <div className="pointer-events-none absolute inset-0 bg-[url('/grid.svg')] bg-top opacity-[0.15] [mask-image:linear-gradient(180deg,white,transparent)]" />

      <div className="relative mx-auto max-w-[1400px] px-4 md:px-6">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
          
          {/* Brand Column */}
          <div className="lg:col-span-4">
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-orange-600 to-orange-400 text-white font-black text-sm tracking-tighter shadow-lg shadow-orange-900/20">
                MC
                <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/20" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-white leading-none tracking-tight">MinerChecker</span>
                  <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                    Live
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 font-medium tracking-wide mt-0.5">PRO ANALYTICS SUITE</span>
              </div>
            </div>

            <p className="mt-6 max-w-sm text-sm leading-relaxed text-slate-400">
              The industry standard for ASIC hardware intelligence. We provide verified vendor data, real-time profitability snapshots, and institutional-grade analytics for miners.
            </p>

            <div className="mt-8 flex gap-3">
              <SocialIcon label="X (Twitter)" href="https://x.com/">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M18.9 2H22l-6.8 7.8L23.6 22h-6.6l-5.2-6.7L5.7 22H2.6l7.4-8.5L.9 2h6.8l4.7 6.1L18.9 2Zm-1.1 18h1.7L7 3.9H5.2l12.6 16.1Z" />
                </svg>
              </SocialIcon>
              <SocialIcon label="GitHub" href="https://github.com/">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-3 .7-3.6-1.3-3.6-1.3-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.4 1.1 3 .8.1-.7.4-1.1.6-1.4-2.4-.3-4.9-1.2-4.9-5.3 0-1.2.4-2.1 1-2.9-.1-.2-.4-1.3.1-2.7 0 0 .9-.3 2.9 1.1.9-.2 1.8-.3 2.7-.3.9 0 1.8.1 2.7.3 2-1.4 2.9-1.1 2.9-1.1.5 1.4.2 2.5.1 2.7.6.8 1 1.7 1 2.9 0 4.1-2.5 5-4.9 5.3.4.3.7.9.7 1.9V21c0 .3.2.6.7.5A10 10 0 0 0 12 2Z" />
                </svg>
              </SocialIcon>
              <SocialIcon label="Discord" href="https://discord.com/">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                   <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037 13.67 13.67 0 0 0-.61 1.253 18.232 18.232 0 0 0-5.486 0 13.7 13.7 0 0 0-.617-1.253.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.419 0 1.334-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.419 0 1.334-.946 2.419-2.157 2.419z"/>
                </svg>
              </SocialIcon>
            </div>
          </div>

          {/* Links Section */}
          <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4 lg:col-span-8">
            <FooterCol title="Mining Data">
              <FooterLink href="/miners/asic-miners">ASIC Miners</FooterLink>
              <FooterLink href="/miners/profitability">Profitability</FooterLink>
              <FooterLink href="/miners/efficiency">Efficiency Rankings</FooterLink>
              <FooterLink href="/miners/manufacturers">Manufacturers</FooterLink>
              <FooterLink href="/miners/mineable-coins">Mineable Coins</FooterLink>
              <FooterLink href="/miners/mining-pools">Mining Pools</FooterLink>
            </FooterCol>

            <FooterCol title="Marketplace">
              <FooterLink href="/marketplace/trusted-vendors">Trusted Vendors</FooterLink>
              <FooterLink href="/marketplace/cloud-mining">Cloud Mining</FooterLink>
              <FooterLink href="/marketplace/hardware-wallets">Hardware Wallets</FooterLink>
            </FooterCol>

            <FooterCol title="Industry & Resources">
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

        {/* Bottom Bar */}
        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 md:flex-row">
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} MinerChecker Inc. All rights reserved. Data provided for informational purposes only.
          </p>
          
          <div className="flex items-center gap-6">
             <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-medium text-slate-400">All Systems Operational</span>
             </div>
          </div>
        </div>
      </div>
    </footer>
  );
}