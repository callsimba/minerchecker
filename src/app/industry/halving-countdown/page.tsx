import HalvingCountdownClient, { type HalvingInitial } from "./HalvingCountdownClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Halving Countdown • MinerChecker" };

type ApiResp = {
  tipHeight: number | null;
  nextHalvingHeight: number;
  avgBlockSeconds: number;
  secondsRemainingEstimate: number | null;
};

async function fetchInitial(): Promise<ApiResp> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/api/btc/halving`, {
      cache: "no-store",
    });

    if (!res.ok) throw new Error("bad status");
    return (await res.json()) as ApiResp;
  } catch {
    try {
      const res2 = await fetch(`/api/btc/halving`, { cache: "no-store" });
      if (!res2.ok) throw new Error("bad status");
      return (await res2.json()) as ApiResp;
    } catch {
      return {
        tipHeight: null,
        nextHalvingHeight: 1_050_000,
        avgBlockSeconds: 600,
        secondsRemainingEstimate: null,
      };
    }
  }
}

export default async function Page() {
  const data = await fetchInitial();

  const initial: HalvingInitial = {
    btc: {
      tipHeight: data.tipHeight,
      nextHalvingHeight: data.nextHalvingHeight ?? 1_050_000,
      avgBlockSeconds: data.avgBlockSeconds ?? 600,
      secondsRemainingEstimate: data.secondsRemainingEstimate,
    },
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-200">
      <div className="mx-auto max-w-[1200px] px-4 md:px-6 pt-8">
        <HalvingCountdownClient initial={initial} />
      </div>
    </main>
  );
}