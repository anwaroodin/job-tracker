import { Link } from "react-router";
import { StatusBadge } from "~/components/molecules/status-badge";
import type { Application } from "~/server/db/schema";

export function ApplicationTable({ rows }: { rows: Application[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-12 border border-dashed border-stroke-primary bg-bg-grouped-primary p-10 text-center">
        <p className="text-sm text-text-secondary">
          No applications yet. Add one to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-16 bg-bg-grouped-primary [box-shadow:inset_0_0_0_1px_var(--stroke-secondary)]">
      <table className="w-full text-sm">
        <thead className="text-left text-[11px] uppercase tracking-wider text-text-tertiary">
          <tr>
            <th className="px-5 py-3 font-medium">Company</th>
            <th className="px-5 py-3 font-medium">Role</th>
            <th className="px-5 py-3 font-medium">Status</th>
            <th className="px-5 py-3 font-medium">Applied</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stroke-secondary">
          {rows.map((row) => (
            <tr
              key={row.id}
              className="transition-colors hover:bg-fill-tertiary"
            >
              <td className="px-5 py-3.5">
                <Link
                  to={`/applications/${row.id}`}
                  className="font-medium text-text-primary transition-colors hover:text-accent-primary"
                >
                  {row.company}
                </Link>
                {row.location && (
                  <p className="mt-0.5 text-xs text-text-secondary">
                    {row.location}
                  </p>
                )}
              </td>
              <td className="px-5 py-3.5 text-text-primary">{row.role}</td>
              <td className="px-5 py-3.5">
                <StatusBadge status={row.status} />
              </td>
              <td className="px-5 py-3.5 text-text-secondary tabular-nums">
                {new Date(row.appliedAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
