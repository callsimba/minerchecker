import { PageShell } from "@/components/page-shell";

export const metadata = { title: "Manufacturers • MinerChecker" };

export default function Page() {
  return (
    <PageShell
      title="Manufacturers"
      subtitle="A structured directory of ASIC manufacturers with product families, release cycles, and reliability considerations."
    />
  );
}
