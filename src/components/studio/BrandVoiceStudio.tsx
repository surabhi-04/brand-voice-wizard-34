import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronDown,
  Copy,
  Feather,
  Menu,
  MessageCircle,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  campaignInputSchema,
  generateCampaign,
  getCampaignHistory,
  hasCampaignApi,
  IntegrationPendingError,
  regenerateCampaign,
  regenerateTweet,
  saveCampaignToNotion,
  type CampaignHistoryItem,
  type CampaignInput,
  type CampaignResult,
  type Tweet,
} from "@/lib/campaign-service";

const objectives = [
  "Brand awareness",
  "Product launch",
  "Engagement",
  "Community building",
  "Education",
  "Traffic",
] as const;

const tones = ["Witty", "Friendly", "Bold", "Professional", "Playful", "Informative", "Empathetic"] as const;

const initialForm: CampaignInput = {
  brandName: "",
  industry: "",
  objective: "Brand awareness",
  details: "",
  audience: "",
  tones: [],
  instructions: "",
};

const statusMessages = [
  "Listening for the details you shared…",
  "Shaping a voice profile…",
  "Finding ten distinct ways in…",
  "Giving every line a final read…",
];

function formatDate(value?: string) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="eyebrow">{children}</p>;
}

function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <a href="#top" aria-label="Brand Voice AI home" className="inline-flex items-center gap-2.5 text-foreground no-underline">
      <span className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground" aria-hidden="true">
        <Feather size={17} strokeWidth={1.8} />
      </span>
      <span className="text-[0.91rem] font-semibold tracking-normal">
        Brand Voice <span className="font-normal text-muted-foreground">AI</span>
      </span>
      {!compact && <span className="sr-only">— Find the voice. Make it matter.</span>}
    </a>
  );
}

function Navigation() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="section-wrap flex h-[72px] items-center justify-between">
        <Wordmark />
        <nav aria-label="Main navigation" className="hidden items-center gap-8 md:flex">
          <a className="text-sm text-muted-foreground transition-colors hover:text-foreground" href="#studio">Studio</a>
          <a className="text-sm text-muted-foreground transition-colors hover:text-foreground" href="#how-it-works">How it works</a>
          <a className="text-sm text-muted-foreground transition-colors hover:text-foreground" href="#library">Campaign library</a>
        </nav>
        <div className="hidden md:block">
          <Button asChild size="sm" className="h-10 rounded-sm px-4">
            <a href="#studio">Create campaign <ArrowRight aria-hidden="true" /></a>
          </Button>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
          className="md:hidden"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X /> : <Menu />}
        </Button>
      </div>
      {menuOpen && (
        <nav aria-label="Mobile navigation" className="section-wrap grid gap-1 border-t border-border py-3 md:hidden">
          {[["Studio", "#studio"], ["How it works", "#how-it-works"], ["Campaign library", "#library"]].map(([label, href]) => (
            <a key={href} href={href} onClick={closeMenu} className="rounded-sm px-2 py-3 text-sm text-foreground hover:bg-secondary">
              {label}
            </a>
          ))}
          <Button asChild className="mt-2 rounded-sm" onClick={closeMenu}>
            <a href="#studio">Create campaign <ArrowRight aria-hidden="true" /></a>
          </Button>
        </nav>
      )}
    </header>
  );
}

function Hero() {
  return (
    <section id="top" className="hero-grid border-b border-border">
      <div className="section-wrap grid items-center gap-8 py-14 md:min-h-[600px] md:grid-cols-[1.02fr_0.98fr] md:gap-12 md:py-20">
        <div className="animate-in max-w-[540px]">
          <div className="mb-7 flex items-center gap-3">
            <span className="h-px w-8 bg-accent" aria-hidden="true" />
            <SectionLabel>AI brand content studio</SectionLabel>
          </div>
          <h1 className="font-display text-[clamp(4rem,7vw,6.7rem)] leading-[0.87] text-foreground">
            Find the voice.<br /><span className="italic text-primary">Make it matter.</span>
          </h1>
          <p className="mt-7 max-w-[430px] text-[1.08rem] leading-8 text-muted-foreground">
            Turn what makes a brand distinctive into 10 ideas worth posting.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
            <Button asChild size="lg" className="h-12 rounded-sm px-6">
              <a href="#studio">Create your campaign <ArrowRight aria-hidden="true" /></a>
            </Button>
            <a className="inline-flex items-center gap-2 text-sm font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground" href="#how-it-works">
              See how it works <ArrowDown size={15} aria-hidden="true" />
            </a>
          </div>
          <p className="mt-7 text-xs text-muted-foreground">A considered starting point—not a scan of live social profiles.</p>
        </div>
        <div className="hero-art animate-in" aria-label="Illustrative campaign preview" role="img">
          <div className="hero-sheet hero-sheet-back" aria-hidden="true" />
          <div className="hero-sheet hero-sheet-front" aria-hidden="true">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <span className="eyebrow">A voice, in brief</span>
              <span className="grid size-8 place-items-center rounded-full bg-secondary text-primary"><MessageCircle size={15} /></span>
            </div>
            <div className="hero-quote" aria-hidden="true">“</div>
            <p className="mt-8 max-w-[250px] font-display text-[2rem] leading-[1.05]">Warm enough to invite.<br /><i>Clear enough to stay.</i></p>
            <div className="mt-7 flex flex-wrap gap-2">
              {["Conversational", "Thoughtful", "Bright"].map((tag) => <span key={tag} className="rounded-full border border-border px-2.5 py-1 text-[0.66rem] text-muted-foreground">{tag}</span>)}
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-border pt-3 text-[0.65rem] text-muted-foreground">
              <span>Illustrative preview</span><span>01 / 10</span>
            </div>
          </div>
          <span className="hero-ten" aria-hidden="true">10</span>
          <span className="note-mark text-center font-display text-[1.02rem] leading-tight" aria-hidden="true">ideas<br />with intent</span>
          <span className="absolute right-[6%] top-2 text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">A campaign, considered</span>
        </div>
      </div>
    </section>
  );
}

function ToneSelector({ value, onChange }: { value: CampaignInput["tones"]; onChange: (tones: CampaignInput["tones"]) => void }) {
  function toggle(tone: (typeof tones)[number]) {
    onChange(value.includes(tone) ? value.filter((item) => item !== tone) : [...value, tone]);
  }
  return (
    <fieldset>
      <legend className="field-label">Preferred tone <span className="font-normal text-muted-foreground">· choose any</span></legend>
      <div className="flex flex-wrap gap-2">
        {tones.map((tone) => {
          const selected = value.includes(tone);
          return (
            <Button
              key={tone}
              type="button"
              variant={selected ? "default" : "outline"}
              aria-pressed={selected}
              className={`tone-chip h-9 rounded-full px-3.5 text-xs ${selected ? "" : "bg-card"}`}
              onClick={() => toggle(tone)}
            >
              {selected && <Check size={13} aria-hidden="true" />}{tone}
            </Button>
          );
        })}
      </div>
    </fieldset>
  );
}

function CampaignForm({
  value,
  onChange,
  onSubmit,
  generating,
  error,
  status,
}: {
  value: CampaignInput;
  onChange: (value: CampaignInput) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  generating: boolean;
  error: string;
  status: string;
}) {
  const [showErrors, setShowErrors] = useState(false);
  const brandError = showErrors ? campaignInputSchema.shape.brandName.safeParse(value.brandName).error?.issues[0]?.message : undefined;
  return (
    <form className="grid gap-6" onSubmit={(event) => { setShowErrors(true); onSubmit(event); }} noValidate>
      <div>
        <label htmlFor="brand-name" className="field-label">Brand name <span className="text-accent">*</span></label>
        <Input id="brand-name" autoComplete="organization" maxLength={100} required aria-invalid={Boolean(brandError)} aria-describedby={brandError ? "brand-error" : undefined} className="field-control h-11 rounded-sm shadow-none" placeholder="e.g. Fieldwork Studio" value={value.brandName} onChange={(event) => onChange({ ...value, brandName: event.target.value })} />
        {brandError ? <p id="brand-error" role="alert" className="mt-1.5 text-xs text-destructive">{brandError}</p> : <p className="field-help">The name your audience already knows—or is about to.</p>}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="industry" className="field-label">Industry or category <span className="font-normal text-muted-foreground">· optional</span></label>
          <Input id="industry" maxLength={100} className="field-control h-11 rounded-sm shadow-none" placeholder="e.g. Independent food" value={value.industry} onChange={(event) => onChange({ ...value, industry: event.target.value })} />
        </div>
        <div>
          <label htmlFor="objective" className="field-label">Campaign objective</label>
          <div className="relative">
            <select id="objective" className="field-control h-11 appearance-none pr-9" value={value.objective} onChange={(event) => onChange({ ...value, objective: event.target.value as CampaignInput["objective"] })}>
              {objectives.map((objective) => <option key={objective}>{objective}</option>)}
            </select>
            <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="brand-details" className="field-label">What do you offer? <span className="font-normal text-muted-foreground">· optional</span></label>
        <Textarea id="brand-details" maxLength={1500} rows={3} className="field-control min-h-[94px] resize-y rounded-sm shadow-none" placeholder="A product, service, point of view, or detail worth knowing." value={value.details} onChange={(event) => onChange({ ...value, details: event.target.value })} />
      </div>

      <div>
        <label htmlFor="audience" className="field-label">Who are you speaking to? <span className="font-normal text-muted-foreground">· optional</span></label>
        <Input id="audience" maxLength={160} className="field-control h-11 rounded-sm shadow-none" placeholder="e.g. Design-minded founders building their first team" value={value.audience} onChange={(event) => onChange({ ...value, audience: event.target.value })} />
      </div>

      <ToneSelector value={value.tones} onChange={(next) => onChange({ ...value, tones: next })} />

      <div>
        <label htmlFor="instructions" className="field-label">Anything else we should know? <span className="font-normal text-muted-foreground">· optional</span></label>
        <Textarea id="instructions" maxLength={1000} rows={3} className="field-control min-h-[94px] resize-y rounded-sm shadow-none" placeholder="Campaign context, words to avoid, or a thought you want to carry through." value={value.instructions} onChange={(event) => onChange({ ...value, instructions: event.target.value })} />
      </div>

      {error && (
        <div role="alert" className="border-l-2 border-accent bg-secondary/60 px-4 py-3 text-sm leading-6 text-foreground">
          <p className="font-semibold">We couldn’t create that campaign.</p><p>{error}</p>
        </div>
      )}
      {generating && (
        <div className="flex items-center gap-3 rounded-sm bg-secondary px-4 py-3 text-sm text-primary" role="status" aria-live="polite">
          <span className="size-4 animate-spin rounded-full border-2 border-primary/20 border-t-primary" aria-hidden="true" />{status}
        </div>
      )}
      <Button type="submit" size="lg" disabled={generating} className="h-12 w-full rounded-sm text-sm">
        {generating ? "Finding the words…" : <><Sparkles size={16} aria-hidden="true" /> Generate 10 tweets <ArrowRight size={16} aria-hidden="true" /></>}
      </Button>
      <p className="-mt-3 text-center text-[0.72rem] leading-5 text-muted-foreground">Brand traits and audience insights are inferences, not verified profile data.</p>
    </form>
  );
}

function StudioGuidance({ value, connected }: { value: CampaignInput; connected: boolean }) {
  const currentTones = value.tones.length ? value.tones : ["Witty", "Thoughtful"];
  return (
    <aside className="h-fit border-t border-border pt-6 lg:sticky lg:top-28 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-1">
      <SectionLabel>At your side</SectionLabel>
      <h3 className="mt-3 font-display text-3xl leading-tight">A little context goes a long way.</h3>
      <p className="mt-3 max-w-[360px] text-sm leading-6 text-muted-foreground">A few details help the studio find a more considered direction. Nothing is generated until you ask.</p>
      <div className="mt-7 border-y border-border py-5">
        <div className="flex items-start justify-between gap-4">
          <span className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Your brief</span>
          <span className="rounded-full bg-secondary px-2.5 py-1 text-[0.68rem] font-medium text-primary">{value.objective}</span>
        </div>
        <p className="mt-5 font-display text-2xl">{value.brandName.trim() || "Your brand"}</p>
        <p className="mt-1 text-sm text-muted-foreground">{value.industry.trim() || "Industry not specified"}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {currentTones.map((tone) => <span key={tone} className="rounded-full border border-border bg-card px-2.5 py-1 text-xs text-foreground">{tone}</span>)}
          {value.tones.length === 0 && <span className="text-xs text-muted-foreground">Suggested tone</span>}
        </div>
      </div>
      <div className="mt-5 flex items-start gap-3 text-sm leading-6 text-muted-foreground">
        <span className="mt-0.5 text-accent" aria-hidden="true"><Feather size={17} /></span>
        <p>We work from the details you provide. This is not a live scan of social profiles.</p>
      </div>
      <div className="mt-7 flex items-start gap-3 border border-border bg-card p-4">
        <span className="mt-0.5 text-primary" aria-hidden="true"><Sparkles size={16} /></span>
        <div><p className="text-sm font-semibold">{connected ? "Campaign service ready" : "Generation connection pending"}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{connected ? "Your campaign will be sent to the configured studio service." : "Connect the campaign API to create real results. No sample content will be passed off as generated."}</p></div>
      </div>
    </aside>
  );
}

function ProfileField({ title, value, inferred }: { title: string; value: string | string[]; inferred: boolean }) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-xs font-bold uppercase tracking-[0.11em] text-muted-foreground">{title}</h4>
        <span className={`rounded-full px-2 py-0.5 text-[0.64rem] font-medium ${inferred ? "bg-secondary text-primary" : "bg-muted text-muted-foreground"}`}>{inferred ? "Inferred" : "Based on your brief"}</span>
      </div>
      {Array.isArray(value) ? <div className="mt-3 flex flex-wrap gap-2">{value.map((item) => <span key={item} className="rounded-full border border-border px-2.5 py-1 text-xs">{item}</span>)}</div> : <p className="mt-2 max-w-2xl text-sm leading-6">{value}</p>}
    </div>
  );
}

function TweetCard({
  tweet,
  index,
  onRegenerate,
  regenerating,
}: {
  tweet: Tweet;
  index: number;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  const [copied, setCopied] = useState(false);
  async function copyTweet() {
    try {
      await navigator.clipboard.writeText(tweet.text);
      setCopied(true);
      toast.success(`Tweet ${index + 1} copied`);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Clipboard access isn’t available in this browser. Select the tweet text to copy it.");
    }
  }
  return (
    <article className="tweet-card border border-border p-5 transition-shadow hover:shadow-[var(--surface-shadow)] sm:p-6" aria-label={`Tweet ${index + 1}: ${tweet.label}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="font-display text-2xl text-primary">{String(index + 1).padStart(2, "0")}</span>
          <span className="rounded-full bg-secondary px-2.5 py-1 text-[0.68rem] font-medium text-primary">{tweet.label}</span>
        </div>
        <span className="pt-1 text-xs tabular-nums text-muted-foreground">{tweet.text.length} characters</span>
      </div>
      <p className="mt-5 whitespace-pre-wrap text-[0.97rem] leading-7 text-foreground">{tweet.text}</p>
      <div className="mt-5 flex items-center justify-end gap-2 border-t border-border/70 pt-3">
        <Button type="button" variant="ghost" size="sm" className="h-9 rounded-sm px-2.5 text-xs" onClick={copyTweet} aria-label={`Copy tweet ${index + 1}`}>
          {copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copied" : "Copy"}
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-9 rounded-sm px-2.5 text-xs" onClick={onRegenerate} disabled={regenerating} aria-label={`Regenerate tweet ${index + 1}`}>
          <RefreshCw size={14} className={regenerating ? "animate-spin" : ""} />Regenerate
        </Button>
      </div>
    </article>
  );
}

function CampaignResults({
  result,
  input,
  onResult,
}: {
  result: CampaignResult;
  input: CampaignInput;
  onResult: (result: CampaignResult) => void;
}) {
  const [busy, setBusy] = useState<"all" | number | "save" | null>(null);
  const inferred = (field: CampaignResult["profile"]["inferredFields"][number]) => result.profile.inferredFields.includes(field);

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(result.tweets.map((tweet, index) => `${index + 1}. ${tweet.text}`).join("\n\n"));
      toast.success("All 10 tweets copied");
    } catch {
      toast.error("Clipboard access isn’t available in this browser. Copy tweets individually instead.");
    }
  }
  async function regenerateOne(index: number) {
    setBusy(index);
    try {
      const tweet = await regenerateTweet(result.campaignId, index + 1, input);
      onResult({ ...result, tweets: result.tweets.map((item, current) => current === index ? tweet : item) });
      toast.success(`Tweet ${index + 1} regenerated`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That tweet could not be regenerated.");
    } finally {
      setBusy(null);
    }
  }
  async function regenerateAll() {
    if (!window.confirm("Replace all 10 tweets with a new set? Your current set will be replaced only if the new set succeeds.")) return;
    setBusy("all");
    try {
      const tweets = await regenerateCampaign(result.campaignId, input);
      onResult({ ...result, tweets });
      toast.success("A fresh set of 10 tweets is ready");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The tweets could not be regenerated. Your current set is unchanged.");
    } finally {
      setBusy(null);
    }
  }
  async function saveToNotion() {
    setBusy("save");
    try {
      const saved = await saveCampaignToNotion(result.campaignId, result);
      toast.success("Campaign saved to Notion", saved.url ? { description: saved.url } : undefined);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The campaign could not be saved.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section id="results" className="section-rule mt-20 scroll-mt-24 pt-12" aria-labelledby="results-title">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div><SectionLabel>Campaign workspace</SectionLabel><h2 id="results-title" className="section-heading mt-3">{input.brandName}<span className="text-primary">.</span></h2><p className="mt-2 text-sm text-muted-foreground">{input.objective} · 10 campaign ideas</p></div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="h-10 rounded-sm bg-card" onClick={copyAll}><CheckCheck size={15} aria-hidden="true" />Copy all tweets</Button>
          <Button type="button" variant="outline" className="h-10 rounded-sm bg-card" onClick={regenerateAll} disabled={busy !== null}><RefreshCw size={15} className={busy === "all" ? "animate-spin" : ""} aria-hidden="true" />Regenerate all</Button>
          <Button type="button" className="h-10 rounded-sm" onClick={saveToNotion} disabled={busy !== null}><ArrowRight size={15} aria-hidden="true" />{busy === "save" ? "Saving…" : "Save to Notion"}</Button>
        </div>
      </div>
      <div className="mt-8 grid gap-5 border border-border bg-card p-5 shadow-[var(--surface-shadow)] sm:p-7 lg:grid-cols-2">
        <ProfileField title="Brand voice" value={result.profile.summary} inferred={inferred("summary")} />
        <ProfileField title="Audience" value={result.profile.audience} inferred={inferred("audience")} />
        <ProfileField title="Content themes" value={result.profile.themes} inferred={inferred("themes")} />
        <ProfileField title="Writing characteristics" value={result.profile.characteristics} inferred={inferred("characteristics")} />
      </div>
      <div className="mt-10 flex items-end justify-between gap-4 border-b border-border pb-4">
        <div><SectionLabel>The writing</SectionLabel><h3 className="mt-2 font-display text-3xl">Ten ways in.</h3></div>
        <p className="text-sm text-muted-foreground">One voice, ten different angles</p>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {result.tweets.map((tweet, index) => <TweetCard key={tweet.id} tweet={tweet} index={index} onRegenerate={() => void regenerateOne(index)} regenerating={busy === index} />)}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { number: "01", title: "Tell us about your brand.", text: "Share a name, a goal, and the details that make your brand yours.", icon: <Feather size={18} /> },
    { number: "02", title: "Discover your voice.", text: "See a concise voice profile, with inferences clearly marked as inferences.", icon: <MessageCircle size={18} /> },
    { number: "03", title: "Create 10 campaign-ready tweets.", text: "Review, copy, and refine ideas without losing the rest of your set.", icon: <Sparkles size={18} /> },
  ];
  return (
    <section id="how-it-works" className="section-rule scroll-mt-24 py-20 md:py-24">
      <div className="section-wrap">
        <div className="grid gap-5 md:grid-cols-[0.8fr_1.2fr] md:items-end"><div><SectionLabel>A simple practice</SectionLabel><h2 className="section-heading mt-4 max-w-[410px]">From a few details to a clearer voice.</h2></div><p className="max-w-[390px] text-sm leading-7 text-muted-foreground md:justify-self-end">A thoughtful workflow for turning what you know about your brand into ideas worth sharing.</p></div>
        <div className="mt-12 grid border-y border-border md:grid-cols-3">
          {steps.map((step, index) => <article key={step.number} className={`py-7 md:py-8 ${index < 2 ? "md:border-r md:border-border md:pr-7" : ""} ${index > 0 ? "md:pl-7" : ""} ${index < 2 ? "border-b border-border md:border-b-0" : ""}`}>
            <div className="flex items-center justify-between"><span className="font-display text-4xl text-primary">{step.number}</span><span className="grid size-9 place-items-center rounded-full bg-secondary text-primary" aria-hidden="true">{step.icon}</span></div>
            <h3 className="mt-7 max-w-[260px] font-display text-[1.75rem] leading-tight">{step.title}</h3><p className="mt-3 max-w-[280px] text-sm leading-6 text-muted-foreground">{step.text}</p>
          </article>)}
        </div>
      </div>
    </section>
  );
}

function CampaignLibrary({ connected }: { connected: boolean }) {
  const [items, setItems] = useState<CampaignHistoryItem[]>([]);
  const [loading, setLoading] = useState(connected);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!connected) return;
    let active = true;
    getCampaignHistory().then((history) => { if (active) setItems(history); }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "Saved campaigns could not be loaded.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [connected]);

  return (
    <section id="library" className="scroll-mt-24 bg-secondary/55 py-20 md:py-24">
      <div className="section-wrap">
        <div className="flex flex-wrap items-end justify-between gap-5"><div><SectionLabel>Campaign library</SectionLabel><h2 className="section-heading mt-4">Kept close.</h2></div><p className="max-w-[330px] text-sm leading-6 text-muted-foreground">A home for campaigns you have actually saved to your connected workspace.</p></div>
        {loading ? <div className="mt-10 flex items-center gap-3 border-t border-border py-7 text-sm text-muted-foreground" role="status"><span className="size-4 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />Loading saved campaigns…</div> : error ? <div className="mt-10 border-t border-border py-7 text-sm text-destructive" role="alert">{error}</div> : items.length ? <div className="mt-9 grid gap-3 md:grid-cols-2">{items.map((item) => <article key={item.id} className="flex flex-wrap items-center justify-between gap-4 border border-border bg-card p-5"><div><p className="font-display text-2xl">{item.brandName}</p><p className="mt-1 text-sm text-muted-foreground">{item.objective} · {formatDate(item.createdAt)}</p></div>{item.url ? <Button asChild variant="outline" size="sm" className="rounded-sm"><a href={item.url} target="_blank" rel="noreferrer">Open campaign <ArrowRight size={14} /></a></Button> : <span className="text-xs text-muted-foreground">Saved campaign</span>}</article>)}</div> : (
          <div className="mt-9 grid gap-6 border-t border-border py-8 md:grid-cols-[auto_1fr_auto] md:items-center">
            <div className="grid size-12 place-items-center rounded-full border border-border bg-background text-primary" aria-hidden="true"><Feather size={19} /></div>
            <div><h3 className="font-display text-2xl">{connected ? "Nothing saved here yet." : "A place for the campaigns worth keeping."}</h3><p className="mt-2 max-w-[520px] text-sm leading-6 text-muted-foreground">{connected ? "Campaigns will appear here after they are successfully saved to your connected workspace." : "Connect the real Notion workflow to save campaigns here. Until then, this library stays honest and empty."}</p></div>
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground"><span className={`size-2 rounded-full ${connected ? "bg-primary" : "bg-accent"}`} />{connected ? "Connected" : "Connection pending"}</span>
          </div>
        )}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border py-8">
      <div className="section-wrap flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div><Wordmark /><p className="mt-3 max-w-[310px] text-xs leading-5 text-muted-foreground">A considered space for finding a brand’s voice—and putting it to work.</p></div>
        <nav aria-label="Footer navigation" className="flex gap-6 text-xs"><a className="text-muted-foreground hover:text-foreground" href="#studio">Studio</a><a className="text-muted-foreground hover:text-foreground" href="#how-it-works">How it works</a></nav>
      </div>
    </footer>
  );
}

export default function App() {
  const [form, setForm] = useState(initialForm);
  const [result, setResult] = useState<CampaignResult | null>(null);
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusIndex, setStatusIndex] = useState(0);
  const apiConnected = useMemo(() => hasCampaignApi(), []);

  useEffect(() => {
    if (!isGenerating) return;
    const timer = window.setInterval(() => setStatusIndex((index) => (index + 1) % statusMessages.length), 2200);
    return () => window.clearInterval(timer);
  }, [isGenerating]);

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validated = campaignInputSchema.safeParse(form);
    if (!validated.success) {
      setError("");
      document.getElementById("brand-name")?.focus();
      return;
    }
    setError("");
    setIsGenerating(true);
    setStatusIndex(0);
    try {
      const campaign = await generateCampaign(validated.data);
      setResult(campaign);
      window.requestAnimationFrame(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (reason) {
      const message = reason instanceof IntegrationPendingError
        ? "The Gemini campaign service is not connected yet. Configure the backend API to generate real brand analysis and tweets. No sample results are being shown."
        : reason instanceof Error ? reason.message : "Please try again, or check that the campaign service is available.";
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="site-shell">
      <Navigation />
      <main>
        <Hero />
        <section id="studio" className="section-wrap scroll-mt-24 py-20 md:py-24">
          <div className="grid gap-7 lg:grid-cols-[1.2fr_0.8fr] lg:gap-16">
            <div>
              <SectionLabel>The studio</SectionLabel>
              <h2 className="section-heading mt-4 max-w-[650px]">Start with what makes you, <i>you.</i></h2>
              <p className="mt-4 max-w-[570px] text-sm leading-7 text-muted-foreground">A little context is all we need to shape a first draft. Share only what feels useful.</p>
              <div className="mt-8 border-t border-border pt-7">
                <CampaignForm value={form} onChange={setForm} onSubmit={(event) => void handleGenerate(event)} generating={isGenerating} error={error} status={statusMessages[statusIndex] ?? statusMessages[0] ?? "Finding your voice…"} />
              </div>
              {result && <CampaignResults result={result} input={form} onResult={setResult} />}
            </div>
            <StudioGuidance value={form} connected={apiConnected} />
          </div>
        </section>
        <HowItWorks />
        <CampaignLibrary connected={apiConnected} />
      </main>
      <Footer />
    </div>
  );
}