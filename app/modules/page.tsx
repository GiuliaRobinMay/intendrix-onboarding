import Link from "next/link";
import { Clock, Zap } from "lucide-react";
import { PageHeader, Chip, GradientButton } from "@/components/ui";
import { getSeriesTemplates } from "@/lib/store";

export default function ModulesPage() {
  const templates = getSeriesTemplates();

  return (
    <>
      <PageHeader
        title="Modules"
        subtitle="Your reusable series library. Load a module into a client's program, then adapt the copy where needed."
        action={<GradientButton>+ New series</GradientButton>}
      />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((series) => {
          const meetings = series.steps.filter(
            (s) => s.leader.teamMeeting
          ).length;
          const cadence =
            series.steps[0].offsetDays < 7
              ? `+${series.steps[0].offsetDays}d, then weekly`
              : "weekly";
          return (
            <Link
              key={series.id}
              href={`/modules/${series.id}`}
              className="card card-hover block p-6"
            >
              <div className="flex items-start justify-between">
                <div
                  className="flex size-12 items-center justify-center rounded-xl text-sm font-bold text-paper"
                  style={{ backgroundColor: series.color }}
                >
                  {series.code}
                </div>
                <Chip color={series.color}>{series.steps.length} lessons</Chip>
              </div>
              <h2 className="mt-4 text-base font-bold">{series.name}</h2>
              <p className="mt-0.5 text-sm text-mist">{series.focus}</p>
              <div className="mt-4 flex flex-col gap-1.5 border-t border-white/5 pt-4 text-xs text-mist">
                <p className="flex items-center gap-1.5">
                  <Zap size={12} style={{ color: series.color }} />
                  Triggered by {series.triggerLabel}
                </p>
                <p className="flex items-center gap-1.5">
                  <Clock size={12} />
                  Cadence: {cadence} · 08:00
                </p>
                {meetings > 0 && (
                  <p className="flex items-center gap-1.5">
                    <span
                      className="inline-block size-2 rounded-full"
                      style={{ backgroundColor: series.color }}
                    />
                    {meetings} team meeting{meetings > 1 ? "s" : ""} embedded
                  </p>
                )}
              </div>
            </Link>
          );
        })}

        <div className="flex min-h-52 flex-col items-center justify-center gap-2 rounded-[1.25rem] border border-dashed border-white/10 p-6 text-center">
          <p className="text-sm font-semibold text-mist/70">+ Create a new series</p>
          <p className="max-w-52 text-xs text-mist/50">
            Fully flexible: add series, add lessons, reorder — nothing is locked to two variants.
          </p>
        </div>
      </div>
    </>
  );
}
