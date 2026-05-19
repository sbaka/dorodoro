"use client";

import { useMemo } from "react";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
  Tooltip,
  type ChartOptions,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

type Props = {
  labels: string[];
  minutes: number[];
};

export function WeeklyFocusChart({ labels, minutes }: Props) {
  const data = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: "Minutes",
          data: minutes,
          backgroundColor: minutes.map((value) =>
            value > 0 ? "rgba(45, 143, 84, 0.82)" : "rgba(26, 26, 46, 0.15)",
          ),
          borderRadius: 8,
          maxBarThickness: 38,
        },
      ],
    }),
    [labels, minutes],
  );

  const options = useMemo<ChartOptions<"bar">>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.parsed.y ?? 0} min`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "#5a5a72" },
        },
        y: {
          beginAtZero: true,
          ticks: { color: "#5a5a72", precision: 0 },
          grid: { color: "rgba(26, 26, 46, 0.1)" },
        },
      },
    }),
    [],
  );

  return <Bar data={data} options={options} />;
}
