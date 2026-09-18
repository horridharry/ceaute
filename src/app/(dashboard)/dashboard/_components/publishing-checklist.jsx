import Link from "next/link";
import { ListTemplate } from "@/components/templates/list-template";
import { CommitBar } from "@/components/ui/commit-bar";
import { PublishAction } from "./publish-action";

// A5. Before publishing, Today is replaced by this. It mirrors
// publication-readiness.js item for item, and says plainly that the database
// does the checking — so a provider is never told she is ready by a screen
// that turns out to be wrong.
export function PublishingChecklist({ checklist, publishAction }) {
  const { items, doneCount, total } = checklist;
  const ready = doneCount === total;

  return (
    <ListTemplate
      title="Ready to publish?"
      meta={`${doneCount} / ${total}`}
      filters={
        <div
          className="h-1 w-full overflow-hidden rounded-full bg-black/8"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={doneCount}
          aria-label="Publishing checklist progress"
        >
          <div
            className="h-full rounded-full bg-plum transition-[width] duration-150 ease-out"
            style={{ width: `${(doneCount / total) * 100}%` }}
          />
        </div>
      }
    >
      {items.map((item) =>
        item.done ? (
          <div
            key={item.label}
            className="flex items-center gap-2.5 rounded-row bg-surface px-3.5 py-[13px]"
          >
            <span
              aria-hidden="true"
              className="mt-px block h-[9px] w-[5px] shrink-0 rotate-45 border-b-2 border-r-2 border-ok"
            />
            <span className="text-[14px] text-black/60">{item.title}</span>
          </div>
        ) : (
          <Link
            key={item.label}
            href={item.href}
            className="flex items-center justify-between gap-3 rounded-row border border-black/12 px-3.5 py-[13px] transition duration-150 ease-out hover:border-black/25"
          >
            <span className="text-[14px] font-medium text-ink">
              {item.title}
            </span>
            <span aria-hidden="true" className="shrink-0 text-[15px] text-black/45">
              →
            </span>
          </Link>
        ),
      )}

      <p className="mt-2 text-[12.5px]/[1.55] text-black/60">
        Publishing is checked by the database, not this list — if something is
        missing it will tell you exactly what.
      </p>

      <CommitBar className="-mx-5">
        <PublishAction publishAction={publishAction} ready={ready} />
      </CommitBar>
    </ListTemplate>
  );
}
