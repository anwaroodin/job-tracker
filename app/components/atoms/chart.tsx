import {
  createContext,
  forwardRef,
  useContext,
  useId,
  useMemo,
  type ComponentProps,
  type ReactNode,
} from "react";
import * as Recharts from "recharts";
import { cn } from "~/lib/cn";

export type ChartConfig = Record<
  string,
  | {
      label?: ReactNode;
      icon?: React.ComponentType;
      color?: string;
      theme?: never;
    }
  | {
      label?: ReactNode;
      icon?: React.ComponentType;
      color?: never;
      theme: { light: string; dark: string };
    }
>;

type ChartContextValue = { config: ChartConfig };
const ChartContext = createContext<ChartContextValue | null>(null);

function useChart() {
  const ctx = useContext(ChartContext);
  if (!ctx) throw new Error("useChart must be used inside <ChartContainer>");
  return ctx;
}

export const ChartContainer = forwardRef<
  HTMLDivElement,
  ComponentProps<"div"> & { config: ChartConfig; children: ReactNode }
>(function ChartContainer({ id, className, children, config, ...props }, ref) {
  const uid = useId();
  const chartId = `chart-${(id ?? uid).replace(/:/g, "")}`;
  return (
    <ChartContext.Provider value={{ config }}>
      <div
        ref={ref}
        data-chart={chartId}
        className={cn(
          "flex aspect-auto h-full w-full justify-center text-xs",
          "[&_.recharts-cartesian-axis-tick_text]:fill-[var(--text-tertiary)]",
          "[&_.recharts-cartesian-grid_line]:stroke-[var(--stroke-secondary)]",
          "[&_.recharts-tooltip-cursor]:fill-[var(--fill-tertiary)]",
          "[&_.recharts-polar-grid_[stroke]]:stroke-[var(--stroke-secondary)]",
          "[&_.recharts-sector]:outline-none",
          "[&_.recharts-surface]:outline-none",
          className,
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <Recharts.ResponsiveContainer>
          {children as React.ReactElement}
        </Recharts.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
});

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const entries = Object.entries(config).filter(([, c]) =>
    "color" in c ? c.color : c.theme,
  );
  if (!entries.length) return null;
  const css = entries
    .map(([key, c]) => {
      const color = "color" in c ? c.color : c.theme?.light;
      return color ? `--color-${key}: ${color};` : "";
    })
    .join(" ");
  return (
    <style
      dangerouslySetInnerHTML={{ __html: `[data-chart="${id}"] { ${css} }` }}
    />
  );
}

export const ChartTooltip = Recharts.Tooltip;

export const ChartTooltipContent = forwardRef<
  HTMLDivElement,
  ComponentProps<"div"> & {
    active?: boolean;
    payload?: Array<{
      name?: string;
      value?: number | string;
      dataKey?: string;
      color?: string;
      payload?: any;
    }>;
    label?: string | number;
    hideLabel?: boolean;
    labelKey?: string;
    formatter?: (value: number | string, name: string) => ReactNode;
  }
>(function ChartTooltipContent(
  { active, payload, label, hideLabel, labelKey, formatter, className },
  ref,
) {
  const { config } = useChart();
  if (!active || !payload?.length) return null;
  return (
    <div
      ref={ref}
      className={cn(
        "grid min-w-32 gap-1 rounded-8 border border-stroke-secondary bg-bg-primary/95 px-2.5 py-2 text-[12px] shadow-md backdrop-blur",
        className,
      )}
    >
      {!hideLabel && label !== undefined && (
        <div className="text-[11px] font-medium text-text-secondary">
          {labelKey && payload[0]?.payload?.[labelKey]
            ? payload[0].payload[labelKey]
            : label}
        </div>
      )}
      <div className="grid gap-1">
        {payload.map((item, i) => {
          const key = item.dataKey ?? item.name ?? "";
          const meta = config[key];
          const swatch =
            item.color ??
            (meta && "color" in meta ? meta.color : undefined) ??
            "var(--text-primary)";
          const displayName = meta?.label ?? item.name ?? key;
          return (
            <div key={i} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <span
                  className="size-2 rounded-full"
                  style={{ background: swatch }}
                />
                <span className="text-text-secondary">{displayName}</span>
              </div>
              <span className="font-medium tabular-nums text-text-primary">
                {formatter
                  ? formatter(item.value ?? 0, String(displayName))
                  : item.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export const ChartLegend = Recharts.Legend;
export const ChartLegendContent = forwardRef<
  HTMLDivElement,
  {
    payload?: Array<{ value?: string; color?: string; dataKey?: string }>;
    className?: string;
  }
>(function ChartLegendContent({ payload, className }, ref) {
  const { config } = useChart();
  if (!payload?.length) return null;
  return (
    <div
      ref={ref}
      className={cn(
        "flex flex-wrap items-center justify-center gap-4 text-[12px]",
        className,
      )}
    >
      {payload.map((item, i) => {
        const key = item.dataKey ?? item.value ?? "";
        const meta = config[key];
        const swatch =
          item.color ?? (meta && "color" in meta ? meta.color : undefined);
        return (
          <div
            key={i}
            className="flex items-center gap-1.5 text-text-secondary"
          >
            <span
              className="size-2 rounded-full"
              style={{ background: swatch }}
            />
            {meta?.label ?? item.value}
          </div>
        );
      })}
    </div>
  );
});
