"use client";

import { useMemo, useState } from "react";

import {
  loadDataQualityReport,
  type DataQualityLoadResult,
} from "@/app/admin/tree/data-quality-actions";
import { Button } from "@/components/ui/button";
import type {
  DataQualityIssue,
  DataQualityIssueKind,
  DataQualitySeverity,
} from "@/features/tree/data-quality";

type QualityData = Extract<DataQualityLoadResult, { ok: true }>;

const SEVERITY_LABELS: Record<DataQualitySeverity, string> = {
  error: "Lỗi",
  warning: "Cảnh báo",
  info: "Thông tin",
};

const KIND_LABELS: Record<DataQualityIssueKind, string> = {
  missing_parents: "Thiếu cha/mẹ",
  missing_birth_year: "Thiếu năm sinh",
  chronology: "Chronology",
  duplicate_candidate: "Duplicate candidate",
  isolated_person: "Hồ sơ cô lập",
  living_public_exposure: "Living-public exposure",
  relationship_missing_provenance: "Quan hệ thiếu provenance",
};

function personName(data: QualityData, personId: string | null) {
  if (!personId) return null;
  return (
    data.people.find((person) => person.id === personId)?.displayName ?? personId
  );
}

function relationshipContext(
  data: QualityData,
  relationshipId: string | null,
) {
  if (!relationshipId) return null;
  const relationship = data.relationships.find(
    (item) => item.id === relationshipId,
  );
  if (!relationship) return relationshipId;

  const source = personName(data, relationship.sourcePersonId);
  const target = personName(data, relationship.targetPersonId);
  const label =
    relationship.relationshipKind === "partnership"
      ? "Hôn phối"
      : "Cha/mẹ → con";
  return \`\${label}: \${source ?? relationship.sourcePersonId} → \${
    target ?? relationship.targetPersonId
  }\`;
}

function IssueContext({
  data,
  issue,
}: {
  data: QualityData;
  issue: DataQualityIssue;
}) {
  const primary = personName(data, issue.personId);
  const related = personName(data, issue.relatedPersonId);
  const relationship = relationshipContext(data, issue.relationshipId);

  return (
    <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
      {primary ? <p>Hồ sơ: {primary}</p> : null}
      {related ? <p>Liên quan: {related}</p> : null}
      {relationship ? <p>Quan hệ: {relationship}</p> : null}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: DataQualitySeverity }) {
  const className =
    severity === "error"
      ? "bg-destructive/10 text-destructive"
      : severity === "warning"
        ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : "bg-muted text-muted-foreground";

  return (
    <span
      className={\`rounded-full px-2 py-1 text-[11px] font-semibold \${className}\`}
    >
      {SEVERITY_LABELS[severity]}
    </span>
  );
}

function QualityIssueCard({
  data,
  issue,
}: {
  data: QualityData;
  issue: DataQualityIssue;
}) {
  return (
    <article className="rounded-2xl border border-border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {KIND_LABELS[issue.kind]}
          </p>
          <h4 className="mt-1 text-sm font-semibold text-card-foreground">
            {issue.title}
          </h4>
        </div>
        <SeverityBadge severity={issue.severity} />
      </div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        {issue.detail}
      </p>
      <IssueContext data={data} issue={issue} />
    </article>
  );
}

function CountCard({
  count,
  label,
}: {
  count: number;
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-3">
      <p className="text-2xl font-semibold text-card-foreground">{count}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function DashboardSummary({ data }: { data: QualityData }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <CountCard count={data.report.counts.error} label="Lỗi" />
      <CountCard count={data.report.counts.warning} label="Cảnh báo" />
      <CountCard count={data.report.counts.info} label="Thông tin" />
    </div>
  );
}

function FilterControls({
  kind,
  onKindChange,
  onSeverityChange,
  severity,
}: {
  kind: "all" | DataQualityIssueKind;
  onKindChange: (value: "all" | DataQualityIssueKind) => void;
  onSeverityChange: (value: "all" | DataQualitySeverity) => void;
  severity: "all" | DataQualitySeverity;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="text-xs font-medium text-muted-foreground">
        Severity
        <select
          className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
          onChange={(event) =>
            onSeverityChange(
              event.target.value as "all" | DataQualitySeverity,
            )
          }
          value={severity}
        >
          <option value="all">Tất cả severity</option>
          {Object.entries(SEVERITY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className="text-xs font-medium text-muted-foreground">
        Loại kiểm tra
        <select
          className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
          onChange={(event) =>
            onKindChange(event.target.value as "all" | DataQualityIssueKind)
          }
          value={kind}
        >
          <option value="all">Tất cả loại</option>
          {Object.entries(KIND_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function EmptyIssues() {
  return (
    <p className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
      Không có tín hiệu nào phù hợp với filter hiện tại.
    </p>
  );
}

function QualityIssueList({
  data,
  issues,
}: {
  data: QualityData;
  issues: DataQualityIssue[];
}) {
  if (issues.length === 0) return <EmptyIssues />;

  return (
    <div className="grid gap-3">
      {issues.map((issue) => (
        <QualityIssueCard data={data} issue={issue} key={issue.id} />
      ))}
    </div>
  );
}

function DashboardBody({
  data,
  error,
  kind,
  loading,
  onKindChange,
  onSeverityChange,
  severity,
}: {
  data: QualityData | null;
  error: string | null;
  kind: "all" | DataQualityIssueKind;
  loading: boolean;
  onKindChange: (value: "all" | DataQualityIssueKind) => void;
  onSeverityChange: (value: "all" | DataQualitySeverity) => void;
  severity: "all" | DataQualitySeverity;
}) {
  const issues = useMemo(() => {
    if (!data) return [];
    return data.report.issues.filter(
      (issue) =>
        (severity === "all" || issue.severity === severity) &&
        (kind === "all" || issue.kind === kind),
    );
  }, [data, kind, severity]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Đang kiểm tra dữ liệu…</p>;
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (!data) return null;

  return (
    <>
      <DashboardSummary data={data} />
      <FilterControls
        kind={kind}
        onKindChange={onKindChange}
        onSeverityChange={onSeverityChange}
        severity={severity}
      />
      <p className="text-xs leading-5 text-muted-foreground">
        Đây là tín hiệu review, không phải kết luận dữ liệu sai. Dashboard không
        có thao tác tự sửa.
      </p>
      <QualityIssueList data={data} issues={issues} />
    </>
  );
}

export function DataQualityPanel() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<QualityData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [severity, setSeverity] = useState<"all" | DataQualitySeverity>("all");
  const [kind, setKind] = useState<"all" | DataQualityIssueKind>("all");

  async function refresh() {
    setLoading(true);
    setError(null);
    const result = await loadDataQualityReport();
    setLoading(false);

    if (!result.ok) {
      setData(null);
      setError(result.message);
      return;
    }

    setData(result);
  }

  function openDashboard() {
    setOpen(true);
    void refresh();
  }

  return (
    <>
      <Button onClick={openDashboard} type="button" variant="outline">
        Data quality
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label="Data-quality dashboard"
        >
          <section className="w-full max-w-4xl rounded-3xl border border-border bg-card p-5 shadow-xl sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  Step 9 · Review-only
                </p>
                <h2 className="font-display mt-1 text-3xl text-card-foreground">
                  Data-quality dashboard
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Tập trung các tín hiệu cần kiểm tra trước khi xuất bản, không
                  tự sửa hoặc suy diễn dữ liệu gia phả.
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  disabled={loading}
                  onClick={() => void refresh()}
                  type="button"
                  variant="outline"
                >
                  Refresh
                </Button>
                <Button
                  onClick={() => setOpen(false)}
                  type="button"
                  variant="ghost"
                >
                  Đóng
                </Button>
              </div>
            </div>

            <div className="mt-5 grid gap-4">
              <DashboardBody
                data={data}
                error={error}
                kind={kind}
                loading={loading}
                onKindChange={setKind}
                onSeverityChange={setSeverity}
                severity={severity}
              />
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
