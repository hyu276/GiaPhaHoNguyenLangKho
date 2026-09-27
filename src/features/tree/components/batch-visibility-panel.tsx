"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  executeBatchVisibility,
  loadBatchVisibilityCandidates,
  type BatchVisibilityCandidate,
} from "@/app/admin/tree/batch-visibility-actions";
import { Button } from "@/components/ui/button";

type TargetVisibility = "public" | "private";

function changingPeople(
  people: BatchVisibilityCandidate[],
  selectedIds: ReadonlySet<string>,
  target: TargetVisibility,
) {
  return people.filter(
    (person) => selectedIds.has(person.id) && person.visibility !== target,
  );
}

function livingPublicImpact(
  people: BatchVisibilityCandidate[],
  target: TargetVisibility,
) {
  if (target !== "public") return 0;
  return people.filter((person) => person.deathYear === null).length;
}

function ImpactSummary({
  people,
  target,
}: {
  people: BatchVisibilityCandidate[];
  target: TargetVisibility;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="rounded-xl border border-border bg-background p-3">
        <strong className="text-xl">{people.length}</strong>
        <p className="mt-1 text-xs text-muted-foreground">Hồ sơ sẽ đổi</p>
      </div>
      <div className="rounded-xl border border-border bg-background p-3">
        <strong className="text-xl">
          {target === "public" ? "Public" : "Private"}
        </strong>
        <p className="mt-1 text-xs text-muted-foreground">Visibility đích</p>
      </div>
      <div className="rounded-xl border border-border bg-background p-3">
        <strong className="text-xl">
          {livingPublicImpact(people, target)}
        </strong>
        <p className="mt-1 text-xs text-muted-foreground">
          Living → public cần review
        </p>
      </div>
    </div>
  );
}

function CandidateRow({
  checked,
  onToggle,
  person,
}: {
  checked: boolean;
  onToggle: (personId: string) => void;
  person: BatchVisibilityCandidate;
}) {
  const years =
    (person.birthYear?.toString() ?? "?") +
    " – " +
    (person.deathYear?.toString() ?? "nay");

  return (
    <label className="flex items-start gap-3 rounded-xl border border-border bg-background p-3">
      <input
        checked={checked}
        className="mt-1"
        onChange={() => onToggle(person.id)}
        type="checkbox"
      />
      <span className="min-w-0 flex-1">
        <strong className="block text-sm text-card-foreground">
          {person.displayName}
        </strong>
        <span className="mt-1 block text-xs text-muted-foreground">
          {years} · {person.visibility} · rev {person.revision}
        </span>
      </span>
    </label>
  );
}

function CandidateList({
  people,
  selectedIds,
  toggle,
}: {
  people: BatchVisibilityCandidate[];
  selectedIds: ReadonlySet<string>;
  toggle: (personId: string) => void;
}) {
  if (people.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        Không có hồ sơ active chưa merge.
      </p>
    );
  }

  return (
    <div className="grid max-h-72 gap-2 overflow-y-auto pr-1">
      {people.map((person) => (
        <CandidateRow
          checked={selectedIds.has(person.id)}
          key={person.id}
          onToggle={toggle}
          person={person}
        />
      ))}
    </div>
  );
}

export function BatchVisibilityPanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<BatchVisibilityCandidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState<TargetVisibility>("private");
  const [confirmation, setConfirmation] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const changed = useMemo(
    () => changingPeople(people, selectedIds, target),
    [people, selectedIds, target],
  );

  async function refresh() {
    setLoading(true);
    setStatus(null);
    const result = await loadBatchVisibilityCandidates();
    setLoading(false);

    if (!result.ok) {
      setPeople([]);
      setStatus(result.message);
      return;
    }

    setPeople(result.people);
    setSelectedIds(new Set());
    setConfirmation("");
  }

  function toggle(personId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(personId)) next.delete(personId);
      else next.add(personId);
      return next;
    });
    setConfirmation("");
  }

  function openPanel() {
    setOpen(true);
    void refresh();
  }

  async function applyBatch() {
    if (confirmation !== "APPLY" || changed.length === 0) return;

    setLoading(true);
    setStatus(null);
    const result = await executeBatchVisibility({
      visibility: target,
      people: changed.map((person) => ({
        personId: person.id,
        expectedRevision: person.revision,
      })),
    });
    setLoading(false);

    if (!result.ok) {
      setStatus(result.message);
      return;
    }

    setStatus("Đã áp dụng batch visibility và ghi audit cho từng hồ sơ.");
    setConfirmation("");
    router.refresh();
    await refresh();
  }

  return (
    <>
      <Button onClick={openPanel} type="button" variant="outline">
        Batch visibility
      </Button>

      {open ? (
        <div
          aria-label="Batch visibility"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm sm:p-8"
          role="dialog"
        >
          <section className="w-full max-w-3xl rounded-3xl border border-border bg-card p-5 shadow-xl">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  Step 10 · Impact review
                </p>
                <h2 className="font-display mt-1 text-3xl text-card-foreground">
                  Batch visibility
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Atomic + revision-aware. Một conflict sẽ rollback toàn bộ
                  batch.
                </p>
              </div>
              <Button
                onClick={() => setOpen(false)}
                type="button"
                variant="ghost"
              >
                Đóng
              </Button>
            </div>

            <div className="mt-5 grid gap-4">
              <label className="text-xs font-medium text-muted-foreground">
                Visibility đích
                <select
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                  onChange={(event) => {
                    setTarget(event.target.value as TargetVisibility);
                    setConfirmation("");
                  }}
                  value={target}
                >
                  <option value="private">Private</option>
                  <option value="public">Public</option>
                </select>
              </label>

              <CandidateList
                people={people}
                selectedIds={selectedIds}
                toggle={toggle}
              />

              <ImpactSummary people={changed} target={target} />

              <p className="text-xs leading-5 text-muted-foreground">
                Hồ sơ vốn đã ở visibility đích sẽ không được gửi vào mutation.
                Nếu chuyển người chưa có năm mất sang public, hãy review privacy
                signal ở Data-quality dashboard.
              </p>

              <label className="text-xs font-medium text-muted-foreground">
                Nhập chính xác APPLY để xác nhận {changed.length} thay đổi
                <input
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                  onChange={(event) => setConfirmation(event.target.value)}
                  value={confirmation}
                />
              </label>

              {status ? (
                <p className="text-sm text-muted-foreground" role="status">
                  {status}
                </p>
              ) : null}

              <div className="flex justify-end gap-2">
                <Button
                  disabled={loading}
                  onClick={() => void refresh()}
                  type="button"
                  variant="outline"
                >
                  Tải lại
                </Button>
                <Button
                  disabled={
                    loading || changed.length === 0 || confirmation !== "APPLY"
                  }
                  onClick={() => void applyBatch()}
                  type="button"
                >
                  Áp dụng batch
                </Button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
