import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import NotchLogo from "@/components/NotchLogo";
import { useNimiq } from "@/nimiq/NimiqContext";
import {
  getActiveMarkets,
  getBetsByMarket,
  getBetsByAddress,
  getMarketsByStatus,
  getMarketsByCreator,
  getProfile,
  createMarket,
  placeBet,
  updateMarketOdds,
  upsertProfile,
  resolveMarket,
} from "@/lib/db";
import { supabase } from "@/lib/supabase";
import {
  getProbability,
  getTimeRemaining,
  formatPoolNumber,
  timeAgo,
  potentialPayout,
  shortenAddress,
} from "@/utils/markets";

type Tab = "home" | "create" | "profile";
type MarketType = "OPINION" | "PREDICTION";
type Side = "a" | "b";
type MarketStatus = "open" | "resolved";
type PortfolioSort = "recent" | "amount";

type Market = {
  id: string;
  category: string;
  categoryClass: string;
  type: MarketType;
  title: string;
  sideA: string;
  sideB: string;
  aPct: number;
  pool: string;
  poolRaw: number;
  bettors: number;
  time: string;
  urgent?: boolean;
  creator: string;
  creatorWallet?: string;
  rule: string;
  status?: MarketStatus;
  winner?: Side;
  resolvedPot?: string;
  payout?: string;
};

type BetRow = {
  id: string;
  market_id: string;
  bettor_address: string;
  side: string;
  amount_nim: any;
  created_at: string;
  markets?: any;
};

const CATEGORY_CLASS: Record<string, string> = {
  crypto: "ink",
  sports: "red",
  culture: "amber",
  politics: "red",
  other: "ink",
};

const UI_CATEGORY_TO_DB: Record<string, string> = {
  Culture: "culture",
  Nimiq: "crypto",
  Tech: "other",
  Sport: "sports",
};

const DURATIONS: Record<string, number> = {
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "3d": 3 * 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

const AMOUNTS = [5, 25, 100];
const CREATION_FEE_NIM = 0.1;
const MIN_BET_NIM = 0.1;

function generateMarketId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch (_) {
    /* fall through */
  }
  try {
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      const b = new Uint8Array(16);
      crypto.getRandomValues(b);
      b[6] = (b[6] & 0x0f) | 0x40;
      b[8] = (b[8] & 0x3f) | 0x80;
      const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
      return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    }
  } catch (_) {
    /* fall through */
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function buildBetMemo(marketId: string, side: Side, address: string): string {
  const full = `notch:bet:${marketId}:${side}:${address}`;
  try {
    if (new TextEncoder().encode(full).length <= 64) return full;
  } catch (_) {
    /* fall through to short memo */
  }
  return `nb:${String(marketId).slice(0, 8)}:${side}:${String(address).slice(-8)}`;
}

function toViewModel(row: any): Market {
  const prob = getProbability(row.total_nim_a, row.total_nim_b);
  const poolRaw = (Number(row.total_nim_a) || 0) + (Number(row.total_nim_b) || 0);
  const time = getTimeRemaining(row.duration_ends_at);
  const status: MarketStatus = row.status === "resolved" ? "resolved" : "open";
  return {
    id: row.id,
    category: String(row.category || "other").toUpperCase(),
    categoryClass: CATEGORY_CLASS[row.category] || "ink",
    type: String(row.type || "opinion").toUpperCase() as MarketType,
    title: row.question,
    sideA: row.side_a_label,
    sideB: row.side_b_label,
    aPct: prob.a,
    pool: formatPoolNumber(poolRaw),
    poolRaw,
    bettors: Number(row.total_bettors) || 0,
    time: status === "resolved" ? "Resolved" : time.display,
    urgent: status !== "resolved" && (time.isUrgent || time.isClosed),
    creator: shortenAddress(row.creator_address),
    creatorWallet: row.creator_address,
    rule:
      row.type === "prediction"
        ? "The creator resolves this market using their stated outcome."
        : "The crowd decides by total NIM committed.",
    status,
    winner: row.winning_side === "a" || row.winning_side === "b" ? row.winning_side : undefined,
  };
}

function NotchGlyph({ kind, spin = false }: { kind: "backed" | "won" | "created" | "proof" | "copy" | "home" | "create" | "profile" | "back" | "share" | "close" | "download" | "arrow" | "check" | "next" | "filter"; spin?: boolean }) {
  const symbols = { backed: "/", won: "✓", created: "+", proof: "•", copy: "□", home: "⌂", create: "+", profile: "○", back: "←", share: "↗", close: "×", download: "↓", arrow: "↗", check: "✓", next: "›", filter: "≡" };
  return <span className={`notch-glyph glyph-${kind} ${spin ? "spin" : ""}`} aria-hidden="true">{symbols[kind]}</span>;
}

function Logo() {
  return (
    <div className="brand-lockup" aria-label="Notch home">
      <NotchLogo />
    </div>
  );
}

function StatusPill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "red" | "ink" | "amber" }) {
  return <span className={`status-pill status-${tone}`}>{children}</span>;
}

function BottomNav({ tab, onTab }: { tab: Tab; onTab: (tab: Tab) => void }) {
  return (
    <nav className="bottom-nav" aria-label="Primary navigation">
      <button className={`nav-item ${tab === "home" ? "active" : ""}`} onClick={() => onTab("home")} aria-label="Home" aria-current={tab === "home" ? "page" : undefined}>
        <NotchGlyph kind="home" />
        <span>Home</span>
      </button>
      <button className={`create-nav ${tab === "create" ? "active" : ""}`} onClick={() => onTab("create")} aria-label="Create market" aria-current={tab === "create" ? "page" : undefined}>
        <span className="create-orb"><NotchGlyph kind="create" /></span>
        <span>Create</span>
      </button>
      <button className={`nav-item ${tab === "profile" ? "active" : ""}`} onClick={() => onTab("profile")} aria-label="Profile" aria-current={tab === "profile" ? "page" : undefined}>
        <NotchGlyph kind="profile" />
        <span>Profile</span>
      </button>
    </nav>
  );
}

function Header({ wallet, onWallet }: { wallet: string; onWallet: () => void }) {
  return (
    <header className="topbar">
      <Logo />
      <button className="wallet-chip" onClick={onWallet} aria-label="Open connected wallet">
        <span className="wallet-dot" />
        <span>{shortenAddress(wallet)}</span>
        <NotchGlyph kind="next" />
      </button>
    </header>
  );
}

function Onboarding({ onStart }: { onStart: () => void }) {
  return (
    <div className="onboarding-layer">
      <section className="onboarding-card" aria-labelledby="onboarding-title">
        <NotchLogo />
        <div className="onboarding-art" aria-hidden="true">
          <span className="onboarding-notch-mark"><NotchLogo compact /></span>
          <span className="onboarding-orbit orbit-one" />
          <span className="onboarding-orbit orbit-two" />
          <span className="onboarding-spark spark-one">+</span>
          <span className="onboarding-spark spark-two">×</span>
        </div>
        <h1 id="onboarding-title">Put your conviction<br /><em>on the line.</em></h1>
        <p>Find a question. Pick a side. Back it with NIM.</p>
        <button className="onboarding-button" onClick={onStart}>See the markets <NotchGlyph kind="arrow" /></button>
      </section>
    </div>
  );
}

function ShareResultCard({ market, side, amount, onClose }: { market: Market; side: Side; amount: number; onClose: () => void }) {
  const sideLabel = side === "a" ? market.sideA : market.sideB;
  const copyResult = async () => {
    try {
      await navigator.clipboard?.writeText(`I backed ${sideLabel} on Notch: ${market.title} · ${amount} NIM`);
    } catch (_) {
      /* ignore */
    }
  };
  const shareResult = async () => {
    const text = `I backed ${sideLabel} on Notch: ${market.title}`;
    try {
      if (navigator.share) await navigator.share({ title: "My Notch call", text });
      else await copyResult();
    } catch (_) {
      /* user dismissed */
    }
  };
  const downloadResult = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 1500;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#FFF4E6";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#FF3B3B";
    context.fillRect(72, 72, 1056, 1056);
    context.fillStyle = "#FFF4E6";
    context.beginPath();
    (context as any).roundRect(120, 112, 72, 72, 18);
    context.fill();
    context.fillStyle = "#FF3B3B";
    context.font = "700 46px Arial";
    context.fillText("N", 138, 164);
    context.fillStyle = "#FFF4E6";
    context.font = "700 38px Arial";
    context.fillText("notch", 215, 164);
    context.font = "700 72px Arial";
    const lines = market.title.match(/.{1,30}(?:\s|$)/g) ?? [market.title];
    lines.slice(0, 4).forEach((line, index) => context.fillText(line.trim(), 130, 430 + index * 88));
    context.font = "700 190px Arial";
    context.fillText(sideLabel, 130, 930);
    context.font = "700 56px Arial";
    context.fillText(`${amount} NIM`, 130, 1015);
    context.fillStyle = "#171717";
    context.font = "700 34px Arial";
    context.fillText("Put your conviction on the line.", 72, 1240);
    context.font = "400 26px Arial";
    context.fillText("notch · Nimiq Pay", 72, 1300);
    const link = document.createElement("a");
    link.download = `notch-${market.id}-${side}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };
  return (
    <div className="share-layer" role="dialog" aria-modal="true" aria-labelledby="share-title">
      <button className="sheet-scrim" onClick={onClose} aria-label="Close share card" />
      <section className="share-sheet">
        <div className="sheet-handle" />
        <div className="share-header"><h2 id="share-title">Make it public.</h2><button className="icon-button" onClick={onClose} aria-label="Close"><NotchGlyph kind="close" /></button></div>
        <div className="result-card">
          <div className="result-card-top"><NotchLogo /><span>MY CALL</span></div>
          <p>{market.title}</p>
          <div className="result-call"><strong>{sideLabel}</strong><span>{amount} NIM</span></div>
          <div className="result-bar"><span style={{ width: `${side === "a" ? market.aPct : 100 - market.aPct}%` }} /></div>
          <div className="result-footer"><span>Notch</span><span>Put your conviction on the line.</span></div>
        </div>
        <div className="share-actions"><button className="share-primary" onClick={shareResult}><NotchGlyph kind="share" />Share card</button><button className="share-secondary" onClick={downloadResult}><NotchGlyph kind="download" />Download</button></div>
      </section>
    </div>
  );
}

function MarketCard({ market, onOpen, position }: { market: Market; onOpen: () => void; position?: Side }) {
  const aLeading = market.aPct >= 50;
  const resolved = market.status === "resolved";
  const resolutionLabel = market.type === "OPINION" ? "Crowd resolves" : `Creator resolves · ${market.creator}`;
  const positionLabel = position === "a" ? market.sideA : position === "b" ? market.sideB : null;
  return (
    <article className={`market-card ${market.urgent ? "urgent-card" : ""} ${resolved ? "resolved-card" : ""} ${position ? "positioned" : ""}`} onClick={onOpen} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onOpen(); }}>
      <div className="market-card-topline">
        <div className="market-tags">
          <StatusPill tone={market.categoryClass === "red" ? "red" : market.categoryClass === "amber" ? "amber" : "ink"}>{market.category}</StatusPill>
          <span className="market-type">{resolved ? "RESOLVED" : market.type}</span>
        </div>
        {resolved ? <span className="resolved-label">{market.winner === "a" ? market.sideA : market.sideB} won</span> : <span className={`market-time ${market.urgent ? "urgent" : ""}`}>{market.time}</span>}
      </div>
      <h2>{market.title}</h2>
      <div className="probability-wrap" aria-label={`${market.sideA} ${market.aPct} percent, ${market.sideB} ${100 - market.aPct} percent`}>
        <div className="probability-labels">
          <span className={aLeading ? "leading" : ""}>{market.sideA} <strong>{market.aPct}%</strong></span>
          <span className={!aLeading ? "leading" : ""}>{market.sideB} <strong>{100 - market.aPct}%</strong></span>
        </div>
      <div className="probability-track"><span style={{ width: `${market.aPct}%` }} /><span style={{ width: `${100 - market.aPct}%` }} /></div>
      </div>
      <div className="market-card-context">{positionLabel ? `You backed ${positionLabel}` : resolutionLabel}</div>
      <div className="market-card-footer">
        <span><strong>{market.pool}</strong> NIM</span><span>{market.bettors} convictions</span><span className="market-card-cta">{resolved ? "View result" : position ? "View position" : "Take a side"} <NotchGlyph kind="arrow" /></span>
      </div>
    </article>
  );
}

function CreatorResolve({ market, onResolve, resolving }: { market: Market; onResolve: (winner: Side) => void; resolving: boolean }) {
  const [winner, setWinner] = useState<Side | null>(null);
  return (
    <section className="creator-resolve">
      <div className="creator-resolve-head"><div><span>Creator control</span><h2>Set the winning side</h2></div><NotchGlyph kind="proof" /></div>
      <p>Choose the outcome once the real-world event is clear. This cannot be undone.</p>
      <div className="resolve-options">
        <button className={winner === "a" ? "selected" : ""} onClick={() => setWinner("a")}>{market.sideA}</button>
        <button className={winner === "b" ? "selected" : ""} onClick={() => setWinner("b")}>{market.sideB}</button>
      </div>
      {winner && <button className="resolve-confirm" disabled={resolving} onClick={() => onResolve(winner)}>{resolving ? <><NotchGlyph kind="proof" spin />Confirming on Nimiq…</> : <>Resolve as {winner === "a" ? market.sideA : market.sideB} <NotchGlyph kind="check" /></>}</button>}
    </section>
  );
}

function HomeScreen({ markets, positions, onOpen, onWallet, wallet, feedLoading, feedError, onRetry, filter, onFilter }: {
  markets: Market[];
  positions: Record<string, Side>;
  onOpen: (market: Market) => void;
  onWallet: () => void;
  wallet: string;
  feedLoading: boolean;
  feedError: string | null;
  onRetry: () => void;
  filter: string;
  onFilter: (f: string) => void;
}) {
  return (
    <main className="screen home-screen">
      <Header wallet={wallet} onWallet={onWallet} />
      <section className="intro-block">
        <h1>What do you<br /><em>actually</em> think?</h1>
        <p>See where the crowd is putting its NIM. Then make your call.</p>
      </section>
      <div className="feed-toolbar">
        <div className="filter-tabs" role="tablist" aria-label="Market sorting">
          {["Trending", "Newest", "Closing soon"].map((option) => <button key={option} role="tab" aria-selected={filter === option} className={filter === option ? "selected" : ""} onClick={() => onFilter(option)}>{option}</button>)}
        </div>
        <button className="icon-button small" aria-label="Filter markets"><NotchGlyph kind="filter" /></button>
      </div>
      <div className="feed-heading"><span>{filter === "Trending" ? "The pulse right now" : filter}</span></div>
      {feedLoading ? (
        <section className="market-list" aria-label="Loading markets">
          {[0, 1, 2].map((i) => (
            <article className="market-card" key={i} aria-hidden="true">
              <h2>Loading markets…</h2>
              <div className="market-card-footer"><span>···</span></div>
            </article>
          ))}
        </section>
      ) : feedError ? (
        <section className="market-list" aria-label="Feed error">
          <article className="market-card">
            <h2>Couldn't load markets</h2>
            <p style={{ fontSize: "14px", opacity: 0.7 }}>{feedError}</p>
            <div className="market-card-footer"><button className="market-card-cta" onClick={onRetry}>Retry <NotchGlyph kind="arrow" /></button></div>
          </article>
        </section>
      ) : markets.length === 0 ? (
        <section className="market-list" aria-label="Empty feed">
          <article className="market-card">
            <h2>No markets yet</h2>
            <div className="market-card-context">Be the first to put a question on the line.</div>
          </article>
        </section>
      ) : (
        <section className="market-list" aria-label="Markets">
          {markets.map((market) => <MarketCard key={market.id} market={market} position={positions[market.id]} onOpen={() => onOpen(market)} />)}
        </section>
      )}
      <button className="see-all-button">Browse all markets <NotchGlyph kind="arrow" /></button>
    </main>
  );
}

function DetailScreen({ market, position, positionAmount, bets, onBack, onBet, onShare, onResolve, resolving, isOwner }: {
  market: Market;
  position?: Side;
  positionAmount: number;
  bets: BetRow[];
  onBack: () => void;
  onBet: (side: Side) => void;
  onShare: () => void;
  onResolve: (winner: Side) => void;
  resolving: boolean;
  isOwner: boolean;
}) {
  const aLeading = market.aPct >= 50;
  const resolved = market.status === "resolved";
  const winnerKey: Side = market.winner ?? (aLeading ? "a" : "b");
  const winnerLabel = winnerKey === "a" ? market.sideA : market.sideB;
  return (
    <main className="screen detail-screen">
      <div className="detail-nav">
        <button className="icon-button" onClick={onBack} aria-label="Go back"><NotchGlyph kind="back" /></button>
        <span />
        <button className="icon-button" onClick={onShare} aria-label="Share market"><NotchGlyph kind="share" /></button>
      </div>
      <div className="detail-kicker"><StatusPill tone={market.categoryClass === "red" ? "red" : market.categoryClass === "amber" ? "amber" : "ink"}>{market.category}</StatusPill><span className="kicker-divider" />{resolved ? "RESOLVED" : market.type === "OPINION" ? "CROWD DECIDES" : "CREATOR RESOLVES"}</div>
      <h1 className="detail-title">{market.title}</h1>
      <section className="hero-stat" aria-label="Current market split">
        <div className={`hero-number ${resolved ? "resolved-number" : ""}`}><span>{resolved ? winnerLabel : aLeading ? market.aPct : 100 - market.aPct}{resolved ? " won" : "%"}</span><span className="hero-arrow">{resolved ? "✓" : "↗"}</span></div>
        <div className="hero-caption"><strong>{resolved ? `${winnerLabel} wins the pot` : `${aLeading ? market.sideA : market.sideB} is currently leading`}</strong><span>{resolved ? `${market.resolvedPot ?? market.pool} NIM split` : "based on NIM committed"}</span></div>
      </section>
      <div className="detail-split">
        <div className="detail-split-labels"><span className={aLeading ? "selected-side" : ""}>{market.sideA}<strong>{market.aPct}%</strong></span><span className={!aLeading ? "selected-side" : ""}>{market.sideB}<strong>{100 - market.aPct}%</strong></span></div>
        <div className="probability-track detail-track"><span style={{ width: `${market.aPct}%` }} /><span style={{ width: `${100 - market.aPct}%` }} /></div>
      </div>
      {resolved ? <section className="result-panel"><div><span>Winning side</span><strong>{winnerLabel}</strong></div><div><span>Pot split</span><strong>{market.resolvedPot ?? market.pool} <small>NIM</small></strong></div>{position && <div><span>Your payout</span><strong className="hot-value">+{market.payout ?? "0"} <small>NIM</small></strong></div>}</section> : <div className="bet-actions">
        <button className={`bet-button ${aLeading ? "primary" : "secondary"}`} onClick={() => onBet("a")}>Bet {market.sideA} <NotchGlyph kind="arrow" /></button>
        <button className={`bet-button ${!aLeading ? "primary" : "secondary"}`} onClick={() => onBet("b")}>Bet {market.sideB} <NotchGlyph kind="arrow" /></button>
      </div>}
      {market.type === "PREDICTION" && isOwner && !resolved && <CreatorResolve market={market} onResolve={onResolve} resolving={resolving} />}
      {position && <div className="position-banner"><span className="position-check"><NotchGlyph kind="check" /></span><span><strong>Your position: {position === "a" ? market.sideA : market.sideB} · {positionAmount} NIM</strong><small>You are in this market</small></span><NotchGlyph kind="next" /></div>}
      <section className="stats-grid detail-stats">
        <div><span>Total pool</span><strong>{market.pool} <small>NIM</small></strong></div>
        <div><span>Bettors</span><strong>{market.bettors}</strong></div>
        <div><span>{resolved ? "Status" : "Time left"}</span><strong className={market.urgent ? "hot-value" : ""}>{resolved ? "Settled" : market.time}</strong></div>
      </section>
      <section className="resolution-note"><NotchGlyph kind="proof" /><div><strong>{market.type === "OPINION" ? "The crowd decides" : `Resolved by ${market.creator}`}</strong><p>{market.rule}</p></div></section>
      <section className="recent-section">
        <div className="section-heading"><span>Recent convictions</span></div>
        <div className="recent-list">
          {bets.length === 0 ? (
            <div className="recent-row"><span className="recent-who"><strong>No convictions yet — be the first.</strong></span></div>
          ) : bets.map((b, index) => (
            <div className="recent-row" key={b.id}>
              <span className="avatar-dot">{(b.bettor_address || "N")[1] || "N"}</span>
              <span className="recent-who"><strong>{shortenAddress(b.bettor_address)}</strong><small>{timeAgo(b.created_at)}</small></span>
              <span className={`recent-side ${b.side === "a" ? "yes" : "no"}`}>{b.side === "a" ? market.sideA : market.sideB}</span>
              <strong className="recent-amount">{Number(b.amount_nim) || 0} NIM</strong>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function BetSheet({ market, initialSide, busy, onClose, onConfirm }: { market: Market; initialSide: Side; busy: boolean; onClose: () => void; onConfirm: (side: Side, amount: number) => void }) {
  const [side, setSide] = useState<Side>(initialSide);
  const [amount, setAmount] = useState(25);
  return (
    <div className="sheet-layer" role="dialog" aria-modal="true" aria-labelledby="bet-sheet-title">
      <button className="sheet-scrim" onClick={onClose} aria-label="Close bet sheet" />
      <section className="bet-sheet">
        <div className="sheet-handle" />
        <div className="sheet-header"><div><h2 id="bet-sheet-title">Put your conviction<br />on the line.</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><NotchGlyph kind="close" /></button></div>
        <p className="sheet-question">{market.title}</p>
        <div className="side-picker" role="radiogroup" aria-label="Choose side">
          {(["a", "b"] as Side[]).map((option) => (
            <button key={option} role="radio" aria-checked={side === option} className={side === option ? "chosen" : ""} onClick={() => setSide(option)}>
              <span className="side-letter">{option === "a" ? market.sideA.slice(0, 1).toUpperCase() : market.sideB.slice(0, 1).toUpperCase()}</span>
              <span><strong>{option === "a" ? market.sideA : market.sideB}</strong><small>{option === "a" ? market.aPct : 100 - market.aPct}%</small></span>
              {side === option && <NotchGlyph kind="check" />}
            </button>
          ))}
        </div>
        <div className="amount-heading"><span>How much NIM?</span></div>
        <div className="amount-options">{AMOUNTS.map((value) => <button key={value} className={amount === value ? "chosen" : ""} onClick={() => setAmount(value)}>{value} NIM</button>)}<button className={amount !== 5 && amount !== 25 && amount !== 100 ? "chosen" : ""} onClick={() => setAmount(250)}>Custom</button></div>
        <div className="sheet-review"><span>Backing {side === "a" ? market.sideA : market.sideB}</span><strong>{amount} NIM</strong></div>
        <button className="confirm-button" disabled={busy} onClick={() => onConfirm(side, amount)}>{busy ? "Confirm in Nimiq Pay…" : <>Back {side === "a" ? market.sideA : market.sideB} with {amount} NIM <NotchGlyph kind="arrow" /></>}</button>
        <p className="sheet-disclaimer">Nimiq Pay will ask you to confirm this transaction.</p>
      </section>
    </div>
  );
}

function CreateScreen({ busy, onCreated }: { busy: boolean; onCreated: (data: { question: string; category: string; type: MarketType; duration: string }) => void }) {
  const [question, setQuestion] = useState("");
  const [category, setCategory] = useState("Culture");
  const [type, setType] = useState<MarketType>("OPINION");
  const [duration, setDuration] = useState("24h");
  const canCreate = question.trim().length > 8 && !busy;
  return (
    <main className="screen create-screen">
      <div className="create-header"><div><h1>What’s your call?</h1></div></div>
      <p className="screen-lede">Ask a question people can’t resist taking a side on.</p>
      <label className="field-label" htmlFor="question">Your question</label>
      <textarea id="question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Will…?" maxLength={200} />
      <div className="field-meta"><span>{question.length}/200</span></div>
      <div className="form-section"><div className="field-label">Market type</div><div className="segmented-control" role="radiogroup" aria-label="Market type"><button className={type === "OPINION" ? "selected" : ""} onClick={() => setType("OPINION")}><span>Opinion</span><small>crowd settles</small></button><button className={type === "PREDICTION" ? "selected" : ""} onClick={() => setType("PREDICTION")}><span>Prediction</span><small>you resolve</small></button></div></div>
      <div className="form-section"><div className="field-label">Category</div><div className="choice-row">{["Culture", "Nimiq", "Tech", "Sport"].map((option) => <button key={option} className={category === option ? "selected" : ""} onClick={() => setCategory(option)}>{option}</button>)}</div></div>
      <div className="form-section"><div className="field-label">Closes in</div><div className="choice-row duration-row">{["1h", "6h", "24h", "3d", "7d"].map((option) => <button key={option} className={duration === option ? "selected" : ""} onClick={() => setDuration(option)}>{option}</button>)}</div></div>
      <div className="cost-note"><NotchGlyph kind="proof" /><span>Creating costs <strong>0.1 NIM</strong> to leave an on-chain proof.</span></div>
      <button className="create-submit" disabled={!canCreate} onClick={() => onCreated({ question: question.trim(), category, type, duration })}>{busy ? "Creating — confirm in Nimiq Pay…" : <>Create market <NotchGlyph kind="create" /></>}</button>
      <p className="create-footnote">You can’t edit a market once it is live.</p>
    </main>
  );
}

function MyMarketsScreen({ markets, wallet, onBack, onOpen }: { markets: Market[]; wallet: string; onBack: () => void; onOpen: (market: Market) => void }) {
  const creatorMarkets = markets.filter((market) => market.creatorWallet === wallet);
  return (
    <main className="screen creator-screen">
      <div className="detail-nav"><button className="icon-button" onClick={onBack} aria-label="Back to portfolio"><NotchGlyph kind="back" /></button><span /><span className="creator-wallet">{shortenAddress(wallet)}</span></div>
      <div className="creator-page-heading"><span>Creator workspace</span><h1>My markets</h1><p>Manage the questions you put on the line.</p></div>
      <div className="creator-summary"><strong>{creatorMarkets.length}</strong><span>markets created</span><strong>{creatorMarkets.filter((market) => market.status === "resolved").length}</strong><span>resolved</span></div>
      <section className="creator-market-list">{creatorMarkets.length ? creatorMarkets.map((market) => <button className="creator-market-row" key={market.id} onClick={() => onOpen(market)}><span className={`creator-status ${market.status === "resolved" ? "settled" : "open"}`}>{market.status === "resolved" ? "Settled" : "Open"}</span><span className="creator-market-copy"><strong>{market.title}</strong><small>{market.type === "PREDICTION" ? "Prediction" : "Opinion"} · {market.pool} NIM</small></span><NotchGlyph kind="next" /></button>) : <div className="portfolio-empty">Create a prediction market to manage it here.</div>}</section>
    </main>
  );
}

function ProfileScreen({ wallet, profile, activeMarkets, resolvedMarkets, myBets, createdMarkets, positions, onManage }: {
  wallet: string;
  profile: any;
  activeMarkets: Market[];
  resolvedMarkets: Market[];
  myBets: BetRow[];
  createdMarkets: any[];
  positions: Record<string, Side>;
  onManage: () => void;
}) {
  const [sort, setSort] = useState<PortfolioSort>("recent");
  const created = profile?.total_markets_created ?? createdMarkets.length;
  const placed = profile?.total_bets_placed ?? myBets.length;

  const byId = useMemo(() => {
    const map: Record<string, Market> = {};
    for (const m of [...activeMarkets, ...resolvedMarkets]) map[m.id] = m;
    return map;
  }, [activeMarkets, resolvedMarkets]);

  const participated = resolvedMarkets.filter((m) => positions[m.id]);
  const wins = participated.filter((m) => m.winner === positions[m.id]);
  const winRate = participated.length > 0 ? Math.round((wins.length / participated.length) * 100) : null;
  const wonTotal = wins.reduce((sum, m) => {
    const mine = myBets.filter((b) => b.market_id === m.id && b.side === m.winner);
    const staked = mine.reduce((s, b) => s + (Number(b.amount_nim) || 0), 0);
    const sideTotal = m.winner === "a" ? (m.poolRaw * m.aPct) / 100 : (m.poolRaw * (100 - m.aPct)) / 100;
    return sum + potentialPayout(staked, sideTotal, m.poolRaw);
  }, 0);

  const activeMine = activeMarkets.filter((m) => positions[m.id]);
  const sortedActive = [...activeMine].sort((a, b) =>
    sort === "amount" ? b.poolRaw - a.poolRaw : b.id.localeCompare(a.id)
  );
  const sortedResolved = [...participated].sort((a, b) => (sort === "amount" ? b.poolRaw - a.poolRaw : b.id.localeCompare(a.id)));

  const activity: { icon: "backed" | "won" | "created"; title: string; sub: string }[] = [
    ...myBets.slice(0, 2).map((b) => {
      const m = byId[b.market_id];
      const label = b.side === "a" ? m?.sideA ?? "A" : m?.sideB ?? "B";
      return { icon: "backed" as const, title: `Backed ${label}`, sub: `${m?.title?.slice(0, 34) ?? "a market"} · ${b.amount_nim} NIM` };
    }),
    ...createdMarkets.slice(0, 1).map((m: any) => ({
      icon: "created" as const,
      title: "Created a market",
      sub: String(m.question || "").slice(0, 36),
    })),
  ];

  return (
    <main className="screen profile-screen">
      <div className="profile-topbar"><div><h1>Portfolio</h1></div><button className="manage-markets-button" onClick={onManage}>My markets <NotchGlyph kind="next" /></button></div>
      <section className="identity-card"><div className="identity-avatar">{(wallet[1] || "N").toUpperCase()}</div><div className="identity-copy"><strong>notch player</strong><span>{wallet}</span></div><button className="copy-button" aria-label="Copy wallet address" onClick={() => { try { navigator.clipboard?.writeText(wallet); } catch (_) { /* ignore */ } }}><NotchGlyph kind="copy" /></button></section>
      <section className="profile-stats"><div><span>Markets created</span><strong>{created}</strong></div><div><span>Bets placed</span><strong>{placed}</strong></div><div><span>Win rate</span><strong>{winRate === null ? "—" : <>{winRate}<span className="stat-unit">%</span></>}</strong></div><div><span>NIM won</span><strong>{wonTotal > 0 ? <>+{wonTotal.toFixed(0)} <small>NIM</small></> : "—"}</strong></div></section>
      <section className="accuracy-card"><div className="score-ring" aria-label={`${winRate ?? 0} percent win rate`}><div className="score-ring-center"><strong>{winRate ?? "—"}</strong><small>%</small></div></div><div className="accuracy-copy"><h2>{participated.length === 0 ? <>No settled<br />calls yet.</> : <>More signal<br />than noise.</>}</h2><p>{participated.length === 0 ? "Your settled markets will score your conviction here." : `${participated.length} calls settled · ${wins.length} hit.`}</p></div></section>
      <div className="portfolio-filter" role="tablist" aria-label="Sort portfolio"><span>Sort by</span><button className={sort === "recent" ? "selected" : ""} onClick={() => setSort("recent")}>Recent</button><button className={sort === "amount" ? "selected" : ""} onClick={() => setSort("amount")}>Amount</button></div>
      <section className="portfolio-section"><div className="section-heading"><span>Active positions</span><span className="section-count">{sortedActive.length}</span></div>{sortedActive.length ? <div className="portfolio-list">{sortedActive.map((market) => <div className="portfolio-row" key={market.id}><div><strong>{market.title}</strong><span>{positions[market.id] === "a" ? market.sideA : market.sideB} · {market.pool} NIM pool</span></div><b>{positions[market.id] === "a" ? market.sideA : market.sideB}</b></div>)}</div> : <div className="portfolio-empty">Your next call will appear here.</div>}</section>
      <section className="portfolio-section"><div className="section-heading"><span>Past results</span><span className="section-count">{sortedResolved.length}</span></div><div className="portfolio-list">{sortedResolved.map((market) => <div className="portfolio-row" key={market.id}><div><strong>{market.title}</strong><span>{market.winner === "a" ? market.sideA : market.sideB} won · {market.pool} NIM split</span></div><b className="hot-value">+{market.payout ?? "0"} NIM</b></div>)}</div></section>
      <div className="section-heading profile-heading"><span>Recent activity</span></div>
      <div className="activity-list">{activity.length === 0 ? <div className="activity-row"><NotchGlyph kind="backed" /><div><strong>Nothing yet</strong><span>Your bets and markets show up here</span></div></div> : activity.map((a, i) => <div className="activity-row" key={i}><NotchGlyph kind={a.icon} /><div><strong>{a.title}</strong><span>{a.sub}</span></div></div>)}</div>
    </main>
  );
}

export default function Home() {
  const { address, sendTransaction } = useNimiq();
  const wallet = address || "";
  const [tab, setTab] = useState<Tab>("home");
  const [filter, setFilter] = useState("Trending");
  const [markets, setMarkets] = useState<Market[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [detailBets, setDetailBets] = useState<BetRow[]>([]);
  const [betTarget, setBetTarget] = useState<{ market: Market; side: Side } | null>(null);
  const [betBusy, setBetBusy] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [myBets, setMyBets] = useState<BetRow[]>([]);
  const [resolvedMarkets, setResolvedMarkets] = useState<Market[]>([]);
  const [createdMarkets, setCreatedMarkets] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try {
      return !localStorage.getItem("notch-onboarded");
    } catch (_) {
      return true;
    }
  });
  const [shareTarget, setShareTarget] = useState<{ market: Market; side: Side; amount: number } | null>(null);
  const [commitPulse, setCommitPulse] = useState(false);
  const [creatorView, setCreatorView] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedMarket?.id ?? null;

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  }, []);

  const sortForFilter = filter === "Newest" ? "newest" : filter === "Closing soon" ? "closing" : "trending";

  const fetchFeed = useCallback(
    async (sort: string) => {
      setFeedLoading(true);
      setFeedError(null);
      try {
        const rows = await getActiveMarkets(sort);
        setMarkets((Array.isArray(rows) ? rows : []).map(toViewModel));
      } catch (e: any) {
        setFeedError(e?.message || String(e));
      } finally {
        setFeedLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchFeed(sortForFilter);
  }, [filter, fetchFeed]);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const refreshUserData = useCallback(async () => {
    if (!wallet) return;
    try {
      const bets = await getBetsByAddress(wallet);
      setMyBets(Array.isArray(bets) ? bets : []);
    } catch (_) {
      /* keep previous */
    }
    try {
      setProfile(await getProfile(wallet));
    } catch (_) {
      /* ignore */
    }
    try {
      setCreatedMarkets(await getMarketsByCreator(wallet));
    } catch (_) {
      /* ignore */
    }
  }, [wallet]);

  useEffect(() => {
    refreshUserData();
    getMarketsByStatus("resolved")
      .then((rows) => setResolvedMarkets((Array.isArray(rows) ? rows : []).map(toViewModel)))
      .catch(() => {});
  }, [refreshUserData]);

  useEffect(() => {
    let channel: any = null;
    try {
      channel = supabase
        .channel("notch-feed-v2")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "markets" }, (payload: any) => {
          const row = payload.new;
          if (!row || row.status !== "active") return;
          const vm = toViewModel(row);
          setMarkets((prev) => (prev.some((m) => m.id === vm.id) ? prev : [vm, ...prev]));
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "markets" }, (payload: any) => {
          const row = payload.new;
          if (!row) return;
          if (row.status !== "active") {
            setMarkets((prev) => prev.filter((m) => m.id !== row.id));
            if (selectedIdRef.current === row.id) setSelectedMarket(toViewModel(row));
            return;
          }
          const vm = toViewModel(row);
          setMarkets((prev) => prev.map((m) => (m.id === vm.id ? vm : m)));
          if (selectedIdRef.current === vm.id) setSelectedMarket(vm);
        })
        .on("postgres_changes", { event: "DELETE", schema: "public", table: "markets" }, (payload: any) => {
          const old = payload.old;
          if (old?.id) setMarkets((prev) => prev.filter((m) => m.id !== old.id));
        })
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "bets" }, (payload: any) => {
          const row = payload.new;
          if (!row) return;
          if (row.market_id === selectedIdRef.current) {
            setDetailBets((prev) => (prev.some((b) => b.id === row.id) ? prev : [row, ...prev].slice(0, 20)));
          }
          if (row.bettor_address === wallet) refreshUserData();
        })
        .subscribe();
    } catch (_) {
      channel = null;
    }
    return () => {
      try {
        if (channel) supabase.removeChannel(channel);
      } catch (_) {
        /* ignore */
      }
    };
  }, [wallet, refreshUserData]);

  const positions = useMemo(() => {
    const map: Record<string, Side> = {};
    const sorted = [...myBets].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    for (const b of sorted) {
      if ((b.side === "a" || b.side === "b") && !map[b.market_id]) map[b.market_id] = b.side;
    }
    return map;
  }, [myBets]);

  const userTotals = useCallback(
    (marketId: string) => {
      const totals = { a: 0, b: 0 };
      for (const b of myBets) {
        if (b.market_id !== marketId) continue;
        if (b.side === "a" || b.side === "b") totals[b.side] += Number(b.amount_nim) || 0;
      }
      return totals;
    },
    [myBets]
  );

  const openMarket = useCallback(async (market: Market) => {
    setSelectedMarket(market);
    setDetailBets([]);
    try {
      const rows = await getBetsByMarket(market.id);
      setDetailBets((Array.isArray(rows) ? rows : []).slice(0, 20));
    } catch (_) {
      /* ignore */
    }
  }, []);

  const handleCreated = useCallback(
    async (data: { question: string; category: string; type: MarketType; duration: string }) => {
      if (createBusy || !wallet) return;
      setCreateBusy(true);
      try {
        const marketId = generateMarketId();
        const memo = `notch:create:${marketId}`;
        const endsAt = new Date(Date.now() + (DURATIONS[data.duration] || DURATIONS["24h"]));
        const { hash } = await sendTransaction(CREATION_FEE_NIM, memo);
        const row = await createMarket({
          id: marketId,
          creator_address: wallet,
          creation_tx_hash: hash,
          question: data.question,
          side_a_label: "YES",
          side_b_label: "NO",
          category: UI_CATEGORY_TO_DB[data.category] || "other",
          type: data.type.toLowerCase(),
          duration_ends_at: endsAt.toISOString(),
          status: "active",
          total_nim_a: 0,
          total_nim_b: 0,
          total_bettors: 0,
          share_url: `https://notchlabs.vercel.app/market/${marketId}`,
        });
        try {
          const existing = await getProfile(wallet);
          await upsertProfile(wallet, {
            total_markets_created: (existing?.total_markets_created || 0) + 1,
          });
        } catch (e) {
          console.error("[Notch] Profile increment failed (non-blocking)", e);
        }
        const vm = toViewModel(row);
        setMarkets((prev) => [vm, ...prev]);
        try {
          setCreatedMarkets(await getMarketsByCreator(wallet));
        } catch (_) {
          /* ignore */
        }
        setSelectedMarket(vm);
        setTab("home");
        showToast("Market published · 0.1 NIM proof on-chain");
      } catch (e: any) {
        console.error("[Notch] Create market failed", e);
        showToast(`Create failed · ${e?.message || String(e)}`);
      } finally {
        setCreateBusy(false);
      }
    },
    [createBusy, wallet, sendTransaction, showToast]
  );

  const handleConfirm = useCallback(
    async (side: Side, amount: number) => {
      if (!betTarget || betBusy || !wallet) return;
      if (!Number.isFinite(amount) || amount < MIN_BET_NIM) {
        showToast("Minimum bet is 0.1 NIM");
        return;
      }
      const market = betTarget.market;
      setBetBusy(true);
      try {
        const memo = buildBetMemo(market.id, side, wallet);
        const { hash } = await sendTransaction(amount, memo);
        await placeBet({
          market_id: market.id,
          bettor_address: wallet,
          side,
          amount_nim: amount,
          tx_hash: hash,
          tx_memo: memo,
          status: "confirmed",
        });
        await updateMarketOdds(market.id, side, amount);
        try {
          const existing = await getProfile(wallet);
          await upsertProfile(wallet, {
            total_bets_placed: (existing?.total_bets_placed || 0) + 1,
          });
        } catch (e) {
          console.error("[Notch] Profile bet-count increment failed (non-blocking)", e);
        }
        await refreshUserData();
        await fetchFeed(sortForFilter);
        const placedMarket = market;
        const placedSide = side;
        const placedAmount = amount;
        setBetTarget(null);
        setBetBusy(false);
        setShareTarget({ market: placedMarket, side: placedSide, amount: placedAmount });
        setCommitPulse(true);
        window.setTimeout(() => setCommitPulse(false), 720);
        showToast(`Position placed · ${side === "a" ? market.sideA : market.sideB} with ${amount} NIM`);
      } catch (e: any) {
        console.error("[Notch] Bet failed", e);
        setBetBusy(false);
        showToast(`Bet failed · ${e?.message || String(e)}`);
      }
    },
    [betTarget, betBusy, wallet, sendTransaction, showToast, refreshUserData, fetchFeed, sortForFilter]
  );

  const handleResolve = useCallback(
    async (winner: Side) => {
      if (!selectedMarket) return;
      setResolvingId(selectedMarket.id);
      showToast("Submitting resolution to Nimiq…");
      try {
        const row = await resolveMarket(selectedMarket.id, winner);
        const updated = toViewModel(row);
        const mine = userTotals(selectedMarket.id);
        const staked = winner === "a" ? mine.a : mine.b;
        const sideTotal = winner === "a" ? (updated.poolRaw * updated.aPct) / 100 : (updated.poolRaw * (100 - updated.aPct)) / 100;
        updated.payout = staked > 0 ? potentialPayout(staked, sideTotal, updated.poolRaw).toFixed(0) : "0";
        updated.resolvedPot = updated.pool;
        setMarkets((current) => current.map((m) => (m.id === updated.id ? updated : m)));
        setResolvedMarkets((current) => {
          const rest = current.filter((m) => m.id !== updated.id);
          return [updated, ...rest];
        });
        setSelectedMarket(updated);
        showToast(`Market resolved · ${winner === "a" ? updated.sideA : updated.sideB} wins the pot`);
      } catch (e: any) {
        showToast(`Resolve failed · ${e?.message || String(e)}`);
      } finally {
        setResolvingId(null);
      }
    },
    [selectedMarket, showToast, userTotals]
  );

  const handleShare = useCallback(() => {
    if (!selectedMarket) return;
    const totals = userTotals(selectedMarket.id);
    const side: Side = totals.a >= totals.b ? "a" : "b";
    const amount = Math.round((side === "a" ? totals.a : totals.b) * 10) / 10;
    if (amount <= 0) {
      showToast("Place a bet first to share your call");
      return;
    }
    setShareTarget({ market: selectedMarket, side, amount });
  }, [selectedMarket, userTotals, showToast]);

  const handleWallet = useCallback(() => {
    try {
      if (navigator.clipboard?.writeText && wallet) {
        navigator.clipboard.writeText(wallet);
        showToast("Wallet address copied");
      } else {
        showToast("Nimiq Pay wallet connected");
      }
    } catch (_) {
      showToast("Nimiq Pay wallet connected");
    }
  }, [wallet, showToast]);

  const dismissOnboarding = useCallback(() => {
    try {
      localStorage.setItem("notch-onboarded", "1");
    } catch (_) {
      /* ignore */
    }
    setShowOnboarding(false);
  }, []);

  const detailTotals = selectedMarket ? userTotals(selectedMarket.id) : { a: 0, b: 0 };
  const detailPosition = selectedMarket ? positions[selectedMarket.id] : undefined;
  const detailIsOwner = !!selectedMarket && selectedMarket.creatorWallet === wallet;

  const activeContent = selectedMarket ? (
    <DetailScreen
      market={selectedMarket}
      position={detailPosition}
      positionAmount={detailPosition === "a" ? detailTotals.a : detailTotals.b}
      bets={detailBets}
      onBack={() => setSelectedMarket(null)}
      onBet={(side) => setBetTarget({ market: selectedMarket, side })}
      onShare={handleShare}
      onResolve={handleResolve}
      resolving={resolvingId === selectedMarket.id}
      isOwner={detailIsOwner}
    />
  ) : creatorView ? (
    <MyMarketsScreen markets={[...markets, ...resolvedMarkets]} wallet={wallet} onBack={() => setCreatorView(false)} onOpen={openMarket} />
  ) : tab === "home" ? (
    <HomeScreen
      markets={markets}
      positions={positions}
      onOpen={openMarket}
      onWallet={handleWallet}
      wallet={wallet}
      feedLoading={feedLoading}
      feedError={feedError}
      onRetry={() => fetchFeed(sortForFilter)}
      filter={filter}
      onFilter={setFilter}
    />
  ) : tab === "create" ? (
    <CreateScreen busy={createBusy} onCreated={handleCreated} />
  ) : (
    <ProfileScreen
      wallet={wallet}
      profile={profile}
      activeMarkets={markets}
      resolvedMarkets={resolvedMarkets}
      myBets={myBets}
      createdMarkets={createdMarkets}
      positions={positions}
      onManage={() => setCreatorView(true)}
    />
  );

  return (
    <div className="app-frame">
      <div className="app-scroll">{activeContent}</div>
      <BottomNav tab={selectedMarket || creatorView ? "home" : tab} onTab={(nextTab) => { setSelectedMarket(null); setCreatorView(false); setTab(nextTab); }} />
      {betTarget && <BetSheet market={betTarget.market} initialSide={betTarget.side} busy={betBusy} onClose={() => { if (!betBusy) setBetTarget(null); }} onConfirm={handleConfirm} />}
      {commitPulse && <div className="conviction-pulse" aria-hidden="true"><span className="pulse-ring" /><span className="pulse-notch"><NotchGlyph kind="check" /></span></div>}
      {shareTarget && <ShareResultCard market={shareTarget.market} side={shareTarget.side} amount={shareTarget.amount} onClose={() => setShareTarget(null)} />}
      {showOnboarding && <Onboarding onStart={dismissOnboarding} />}
      {toast && <div className="toast" role="status"><span className="toast-mark"><NotchGlyph kind="check" /></span>{toast}</div>}
    </div>
  );
}
