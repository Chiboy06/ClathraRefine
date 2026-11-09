"use client";
import { useEffect, useMemo, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { Badge, Button, Card, Empty, Notice, Page, Segmented, Table, Td, postJson, useFetch } from "@/components/ui";
import { LevelBadge } from "@/components/plant";
import { DECISIONS, trainingFrames } from "@/lib/training";
import { formatDateTime, num } from "@/lib/format";

type Score = { id: string; created_at: number; trainee: string; score: number; total: number };

export default function Training() {
  const frames = useMemo(() => trainingFrames(), []);
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<"1" | "2" | "4">("2");
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [saved, setSaved] = useState(false);
  const scores = useFetch<Score[]>("/api/training", [saved]);
  const f = frames[i];
  const pending = DECISIONS.find((d) => d.at <= f.s && answers[d.at] === undefined);
  const done = i === frames.length - 1;
  const score = DECISIONS.filter((d) => answers[d.at] === d.correct).length;

  useEffect(() => {
    if (!playing || pending || done) return;
    const t = setInterval(() => setI((x) => Math.min(frames.length - 1, x + 1)), 2000 / Number(speed));
    return () => clearInterval(t);
  }, [playing, pending, done, speed, frames.length]);

  const restart = () => {
    setI(0);
    setAnswers({});
    setSaved(false);
    setPlaying(false);
  };

  return (
    <Page title="Training mode" subtitle="Replay an incident, answer at each decision point, and get a score.">
      <Card
        actions={
          <>
            <Segmented label="Speed" value={speed} onChange={setSpeed} options={[{ value: "1", label: "1×" }, { value: "2", label: "2×" }, { value: "4", label: "4×" }]} />
            <Button onClick={() => setPlaying((x) => !x)} disabled={done || !!pending}>
              {playing ? <Pause aria-hidden className="h-4 w-4" /> : <Play aria-hidden className="h-4 w-4" />} {playing ? "Pause" : "Play"}
            </Button>
            <Button onClick={restart}>
              <RotateCcw aria-hidden className="h-4 w-4" /> Restart
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4" data-theme="night">
          <div className="rounded-xl border border-line bg-canvas p-4 text-fg">
            <div className="text-xs text-muted">Time</div>
            <div className="font-mono text-2xl">{f.s} s</div>
          </div>
          <div className="rounded-xl border border-line bg-canvas p-4 text-fg">
            <div className="text-xs text-muted">Ambient AT-101</div>
            <div className="font-mono text-2xl">{num(f.ambient)} mV</div>
          </div>
          <div className="rounded-xl border border-line bg-canvas p-4 text-fg">
            <div className="text-xs text-muted">Level</div>
            <div className="mt-1">
              <LevelBadge level={f.level} />
            </div>
          </div>
          <div className="rounded-xl border border-line bg-canvas p-4 text-fg">
            <div className="text-xs text-muted">Board</div>
            <div className="mt-1 flex flex-wrap gap-1">
              <Badge tone={f.trip ? "crit" : "ok"}>{f.trip ? "Trip latched" : "Trip clear"}</Badge>
              {f.trip && <Badge tone={f.silenced ? "warn" : "crit"}>{f.silenced ? "Siren silenced" : "Siren on"}</Badge>}
            </div>
          </div>
        </div>
        <div className="mt-2 h-1.5 rounded bg-elev" aria-hidden>
          <div className="h-1.5 rounded bg-primary transition-[width] duration-200" style={{ width: `${(i / (frames.length - 1)) * 100}%` }} />
        </div>

        {pending && (
          <div className="mt-6 rounded-xl border border-primary/50 bg-primary-bg p-4" data-testid="decision">
            <p className="font-semibold">{pending.question}</p>
            <div className="mt-3 flex flex-col gap-2">
              {pending.options.map((o, k) => (
                <Button key={o} className="justify-start" onClick={() => setAnswers({ ...answers, [pending.at]: k })}>
                  {o}
                </Button>
              ))}
            </div>
          </div>
        )}
        {DECISIONS.filter((d) => answers[d.at] !== undefined).map((d) => (
          <div key={d.at} className="mt-4">
            <Notice tone={answers[d.at] === d.correct ? "ok" : "warn"}>
              <strong>{answers[d.at] === d.correct ? "Right." : `The right answer: ${d.options[d.correct]}.`}</strong>
              <span className="mt-1 block whitespace-pre-line">{d.explain.split(/ (?=\d\. )/).join("\n")}</span>
            </Notice>
          </div>
        ))}
        {done && (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Badge tone={score === DECISIONS.length ? "ok" : "warn"} size="lg">
              Score {score} / {DECISIONS.length}
            </Badge>
            <Button
              variant="primary"
              disabled={saved}
              onClick={async () => {
                await postJson("/api/training", { scenario: "ambient-leak-v1", score, total: DECISIONS.length });
                setSaved(true);
              }}
            >
              {saved ? "Score saved" : "Save my score"}
            </Button>
          </div>
        )}
      </Card>
      <Card title="Scores">
        {scores.data?.length ? (
          <Table head={["Trainee", "Score", "When"]} caption="Training scores">
            {scores.data.map((x) => (
              <tr key={x.id}>
                <Td>{x.trainee}</Td>
                <Td mono>
                  {x.score} / {x.total}
                </Td>
                <Td mono>{formatDateTime(x.created_at)}</Td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty title="No scores yet">Finish the scenario and save your score to see it here.</Empty>
        )}
      </Card>
    </Page>
  );
}
