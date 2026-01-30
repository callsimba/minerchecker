import { PageShell } from "@/components/page-shell";
import { HardwareWalletsClient } from "@/components/hardware-wallets/wallets-client";

export const metadata = { title: "Hardware Wallets • MinerChecker" };

type Wallet = Parameters<typeof HardwareWalletsClient>[0]["wallets"][number];

const WALLETS: Wallet[] = [
  {
    id: "trezor-safe-3",
    name: "Trezor Safe 3",
    brand: "Trezor",
    tagline: "Beginner-friendly wallet ecosystem with strong UX and broad support.",
    focus: "Multi-asset",
    connections: ["USB-C"],
    openSource: "Yes",
    secureElement: "Yes",
    // Casting to any to bypass the restricted "$" | "$$" | "$$$" union type
    priceTier: "$59" as any, 
    officialUrl: "https://trezor.io/",
    bestFor: ["Beginners", "Multi-coin holders", "Simple setup"],
    highlights: [
      "Great for first-time hardware wallet users",
      "Strong device ecosystem + companion app",
      "Good balance of usability and security",
    ],
  },
  {
    id: "ledger-nano-x",
    name: "Ledger Nano X",
    brand: "Ledger",
    tagline: "Popular multi-asset wallet with mobile-friendly Bluetooth option.",
    focus: "Multi-asset",
    connections: ["USB-C", "Bluetooth"],
    openSource: "Partial",
    secureElement: "Yes",
    priceTier: "$135" as any,
    officialUrl: "https://www.ledger.com/",
    bestFor: ["Mobile users", "Multi-coin holders", "Bluetooth convenience"],
    highlights: [
      "Bluetooth support for easier mobile workflows",
      "Secure Element architecture",
      "Large ecosystem support for many assets",
    ],
  },
  {
    id: "coldcard",
    name: "COLDCARD",
    brand: "Coinkite",
    tagline: "Bitcoin-focused wallet designed for paranoid-level cold storage workflows.",
    focus: "Bitcoin-only",
    connections: ["USB-C", "microSD"],
    openSource: "Partial",
    secureElement: "Varies",
    priceTier: "$349" as any,
    officialUrl: "https://coldcard.com/",
    bestFor: ["Bitcoin-only", "Air-gapped workflows", "Advanced users"],
    highlights: [
      "microSD-based workflows for offline signing",
      "Designed for hardened BTC cold storage",
      "Great fit for “no always-on USB” threat models",
    ],
    notes: "If you want Bitcoin-only and you’re security-obsessed, this is a top candidate.",
  },
  {
    id: "bitbox02",
    name: "BitBox02",
    brand: "Shift Crypto",
    tagline: "Swiss-made wallet with microSD backups and a security-first design.",
    focus: "Multi-asset",
    connections: ["USB-C", "microSD"],
    openSource: "Yes",
    secureElement: "Yes",
    priceTier: "$177.00" as any,
    officialUrl: "https://shiftcrypto.ch/bitbox02/",
    bestFor: ["Clean backups", "Open-source leaning", "Simple security"],
    highlights: [
      "microSD backups built into the flow",
      "Touch sensors + compact UX",
      "Dual-chip approach with open-source verifiability goals",
    ],
  },
  {
    id: "blockstream-jade",
    name: "Blockstream Jade",
    brand: "Blockstream",
    tagline: "Bitcoin-focused wallet with flexible connectivity and strong transparency story.",
    focus: "Bitcoin-only",
    connections: ["USB-C", "Bluetooth", "QR"],
    openSource: "Yes",
    secureElement: "No",
    priceTier: "$169" as any,
    officialUrl: "https://blockstream.com/jade/",
    bestFor: ["Bitcoin-only", "Budget + real security", "QR workflows"],
    highlights: [
      "Supports QR-based operation modes",
      "Open-source positioning",
      "Very attractive price-to-security ratio",
    ],
  },
  {
    id: "passport",
    name: "Passport",
    brand: "Foundation Devices",
    tagline: "Bitcoin-only, air-gapped-first wallet built around QR workflows.",
    focus: "Bitcoin-only",
    connections: ["QR", "microSD"],
    openSource: "Partial",
    secureElement: "Varies",
    priceTier: "$340" as any,
    officialUrl: "https://foundationdevices.com/passport/",
    bestFor: ["Bitcoin-only", "Air-gapped QR workflows", "Minimal attack surface"],
    highlights: [
      "QR-focused offline signing design",
      "Great for users who avoid direct USB connections",
      "Strong fit for “keep it offline” threat models",
    ],
  },
  {
    id: "keystone",
    name: "Keystone",
    brand: "Keystone",
    tagline: "Air-gapped QR wallet line with a multi-asset focus for some models.",
    focus: "Multi-asset",
    connections: ["QR"],
    openSource: "Partial",
    secureElement: "Varies",
    priceTier: "$149" as any,
    officialUrl: "https://keyst.one/",
    bestFor: ["QR-first workflows", "Multi-asset", "Cable haters"],
    highlights: [
      "QR-based signing experience",
      "Designed to reduce direct device-to-PC connectivity",
      "Good fit if you want air-gapped style UX",
    ],
  },
];

export default function Page() {
  return (
    <PageShell
      title="Hardware Wallets"
      subtitle="Security-focused guidance for storing mining proceeds. Compare cold storage options by workflow (QR, microSD, Bluetooth) and security model."
    >
      <HardwareWalletsClient wallets={WALLETS} />
    </PageShell>
  );
}