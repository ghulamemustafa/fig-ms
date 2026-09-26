import { useFormatter, useTranslations } from "next-intl";

import type { AuditLogView } from "@/lib/audit-queries";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";

type Diff = { from: unknown; to: unknown };

function isDiff(v: unknown): v is Diff {
  return typeof v === "object" && v !== null && "from" in v && "to" in v;
}

function show(v: unknown) {
  if (v === null || v === undefined || v === "") return "—";
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

export function AuditEntryList({
  entries,
  showMember = true,
}: {
  entries: AuditLogView[];
  showMember?: boolean;
}) {
  const t = useTranslations("auditLog");
  const format = useFormatter();

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("empty")}</p>;
  }

  return (
    <div className="space-y-2">
      {entries.map((e) => {
        const changes = (e.changes ?? {}) as Record<string, unknown>;
        const diffs = Object.entries(changes).filter(([k, v]) => k !== "_context" && isDiff(v)) as [string, Diff][];
        const context = changes._context as Record<string, unknown> | undefined;

        return (
          <div key={e.id} className="space-y-1.5 rounded-md border p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={e.action === "delete" ? "destructive" : e.action === "create" ? "default" : "secondary"}>
                {t(`actions.${e.action as "create" | "update" | "delete"}`)}
              </Badge>
              <span className="font-medium">{e.entityType}</span>
              {showMember && e.memberId && (
                <Link href={`/members/${e.memberId}`} className="underline">
                  {e.memberName} ({e.memberSerialNo})
                </Link>
              )}
              <span className="ms-auto text-xs text-muted-foreground tabular-nums">
                {format.dateTime(e.timestamp, { dateStyle: "medium", timeStyle: "short" })}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{t("by", { name: e.changedByName })}</p>

            {context && (
              <p className="text-xs">
                {Object.entries(context)
                  .filter(([, v]) => v !== null && v !== undefined)
                  .map(([k, v]) => `${k}: ${show(v)}`)
                  .join(" · ")}
              </p>
            )}

            {diffs.length > 0 && (
              <ul className="space-y-0.5 text-xs">
                {diffs.map(([field, d]) => (
                  <li key={field} className="break-words">
                    <span className="font-medium">{field}</span>: {show(d.from)} <span aria-hidden>→</span> {show(d.to)}
                  </li>
                ))}
              </ul>
            )}

            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">{t("rawChanges")}</summary>
              <pre className="mt-1 max-h-60 overflow-auto rounded bg-muted p-2" dir="ltr">
                {JSON.stringify(e.changes, null, 2)}
              </pre>
            </details>
          </div>
        );
      })}
    </div>
  );
}
