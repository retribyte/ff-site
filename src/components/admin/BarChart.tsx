import styles from "./barChart.module.scss";

export interface ChartSeries {
  name: string;
  /** A CSS color, normally a token: var(--chart-1) */
  color: string;
}

export interface ChartBar {
  /** Shown in the tooltip and the table */
  label: string;
  /** One value per series, stacked bottom to top in series order */
  values: number[];
}

/** A round axis maximum at or above `max` (240 → 250, 350 → 400), so the tallest bar nearly fills the plot. */
function niceMax(max: number): number {
  if (max <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(max));
  return [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]
    .map((m) => m * p)
    .find((v) => v >= max)!;
}

const n = (x: number) => x.toLocaleString("en-US");

// Stacked columns over time, drawn with CSS so it needs no client JS. Hovering a column
// shows its values; a table carries the same numbers for screen readers.
export default function BarChart({
  title,
  series,
  bars,
  ticks,
}: {
  title: string;
  series: ChartSeries[];
  bars: ChartBar[];
  /** Indexes of the bars whose label is printed under the axis */
  ticks: number[];
}) {
  const top = niceMax(
    Math.max(0, ...bars.map((b) => b.values.reduce((s, v) => s + v, 0))),
  );

  return (
    <figure className={styles.figure}>
      {series.length > 1 && (
        <ul className={styles.legend}>
          {series.map((s) => (
            <li key={s.name}>
              <span
                className={styles.swatch}
                style={{ background: s.color }}
                aria-hidden="true"
              />
              {s.name}
            </li>
          ))}
        </ul>
      )}
      <div className={styles.plot} aria-hidden="true">
        <span className={styles.yMax}>{n(top)}</span>
        <span className={styles.yMid}>{n(top / 2)}</span>
        <div className={styles.bars}>
          {bars.map((b, i) => {
            const total = b.values.reduce((s, v) => s + v, 0);
            return (
              <div key={i} className={styles.col}>
                <div
                  className={styles.stack}
                  style={{ height: `${(total / top) * 100}%` }}
                >
                  {b.values.map((v, j) =>
                    v > 0 ? (
                      <span
                        key={j}
                        style={{ flexGrow: v, background: series[j].color }}
                      />
                    ) : null,
                  )}
                </div>
                <div
                  className={styles.tip}
                  data-side={i > bars.length / 2 ? "left" : "right"}
                >
                  <strong>{b.label}</strong>
                  {series.map((s, j) => (
                    <span key={s.name}>
                      <span
                        className={styles.swatch}
                        style={{ background: s.color }}
                      />
                      {s.name}: {n(b.values[j])}
                    </span>
                  ))}
                  {series.length > 1 && <span>total: {n(total)}</span>}
                </div>
                {ticks.includes(i) && (
                  <span
                    className={styles.tick}
                    data-align={
                      i === 0
                        ? "start"
                        : i === bars.length - 1
                          ? "end"
                          : undefined
                    }
                  >
                    {b.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {/* Hidden by its wrapper: a table ignores a height smaller than its rows, so
                srOnly on the table itself would leave it full size and lengthen the page */}
      <div className={styles.srOnly}>
        <table>
          <thead>
            <tr>
              <th scope="col">when</th>
              {series.map((s) => (
                <th key={s.name} scope="col">
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bars.map((b, i) => (
              <tr key={i}>
                <th scope="row">{b.label}</th>
                {b.values.map((v, j) => (
                  <td key={j}>{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
