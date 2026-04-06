const history = window.__exerciseHistory || [];
if (history.length === 0) {
  // Nothing to render
} else {
  function formatChartDate(isoDate) {
    const d = new Date(isoDate + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function formatDetailDate(isoDate) {
    const d = new Date(isoDate + "T00:00:00");
    const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
    const month = d.toLocaleDateString("en-US", { month: "short" });
    const day = d.getDate();
    return `${weekday} ${month} ${day}`;
  }

  const ctx = document.getElementById("history-chart");
  const data = history.map((s) => s.best_1rm);

  const accentColor = getComputedStyle(document.documentElement)
    .getPropertyValue("--color-accent")
    .trim();

  const accent = accentColor || "#E8875B";
  const lineColor = "oklch(65% 0.02 35)";
  const defaultRadius = 5;
  let selectedIndex = -1;
  const pointRadii = data.map(() => defaultRadius);
  const pointBgColors = data.map(() => lineColor);

  // Plugin to draw tooltip box above selected point
  const selectedLabelPlugin = {
    id: "selectedLabel",
    afterDatasetsDraw(chart) {
      if (selectedIndex < 0) return;
      const meta = chart.getDatasetMeta(0);
      const point = meta.data[selectedIndex];
      if (!point) return;
      const ctx = chart.ctx;
      const value = history[selectedIndex].best_1rm + " kg";
      ctx.save();
      ctx.font = "600 12px system-ui, sans-serif";
      const textWidth = ctx.measureText(value).width;
      const padX = 8;
      const padY = 5;
      const boxW = textWidth + padX * 2;
      const boxH = 12 + padY * 2;
      const chartArea = chart.chartArea;
      let boxX = point.x - boxW / 2;
      if (boxX < chartArea.left) boxX = chartArea.left;
      if (boxX + boxW > chartArea.right) boxX = chartArea.right - boxW;
      let boxY = point.y - boxH - 10;
      if (boxY < chartArea.top) boxY = point.y + 10;
      if (boxY + boxH > chartArea.bottom) boxY = chartArea.bottom - boxH;
      ctx.fillStyle = "rgba(0,0,0,0.75)";
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 4);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(value, boxX + boxW / 2, boxY + boxH / 2);
      ctx.restore();
    },
  };

  const chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: history.map((s) => s.date),
      datasets: [
        {
          label: "Est. 1RM (kg)",
          data,
          borderColor: lineColor,
          backgroundColor: lineColor,
          pointRadius: pointRadii,
          pointBackgroundColor: pointBgColors,
          pointBorderColor: pointBgColors,
          pointBorderWidth: 0,
          pointHitRadius: 0,
          tension: 0.1,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      events: [], // Disable all chart interactions
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            maxTicksLimit: 6,
            callback: function (value) {
              return formatChartDate(this.getLabelForValue(value));
            },
          },
        },
        y: {
          beginAtZero: false,
          title: {
            display: true,
            text: "kg",
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
    },
    plugins: [selectedLabelPlugin],
  });

  // Session list (most recent first)
  const listEl = document.getElementById("session-list");
  const itemsByIndex = {};

  for (let i = history.length - 1; i >= 0; i--) {
    const session = history[i];
    const item = document.createElement("button");
    item.className = "history-session";

    const workingSets = session.sets.filter((s) => !s.is_drop);
    const setsText = workingSets
      .map((s) => formatWeight(s.weight_kg) + " × " + s.reps)
      .join("  ·  ");

    let html =
      '<span class="history-session__date">' +
      formatDetailDate(session.date) +
      "</span>";
    html +=
      '<span class="history-session__sets">' +
      escapeHtml(setsText) +
      "</span>";

    if (session.effort_tag === "increase") {
      html +=
        '<span class="history-session__tag history-session__tag--increase">↑</span>';
    } else if (session.effort_tag === "decrease") {
      html +=
        '<span class="history-session__tag history-session__tag--decrease">↓</span>';
    }

    item.innerHTML = html;
    item.addEventListener("click", () => selectSession(i));
    listEl.appendChild(item);
    itemsByIndex[i] = item;
  }

  // Detail panel
  function showDetail(session) {
    const detail = document.getElementById("session-detail");
    const dateEl = document.getElementById("detail-date");
    const effortEl = document.getElementById("detail-effort");
    const noteEl = document.getElementById("detail-note");
    const setsEl = document.getElementById("detail-sets");

    dateEl.textContent = formatDetailDate(session.date);

    if (session.effort_tag === "increase") {
      effortEl.innerHTML =
        '<span class="history-detail__effort--increase">↑ Increase weight</span>';
    } else if (session.effort_tag === "decrease") {
      effortEl.innerHTML =
        '<span class="history-detail__effort--decrease">↓ Decrease weight</span>';
    } else {
      effortEl.innerHTML = "";
    }

    if (session.next_time_note) {
      noteEl.innerHTML = `<p class="history-detail__note-text">${escapeHtml(session.next_time_note)}</p>`;
    } else {
      noteEl.innerHTML = "";
    }

    const workingSets = session.sets.filter((s) => !s.is_drop);
    const dropSets = session.sets.filter((s) => s.is_drop);

    let setsHtml = workingSets
      .map((s) => formatWeight(s.weight_kg) + " kg × " + s.reps + " reps")
      .join("<br>");

    if (dropSets.length > 0) {
      setsHtml +=
        '<br><span class="text-quiet">Drop: ' +
        dropSets
          .map(
            (s) => formatWeight(s.weight_kg) + " kg × " + s.reps + " reps",
          )
          .join(", ") +
        "</span>";
    }

    setsEl.innerHTML = setsHtml;
    detail.hidden = false;
  }

  function selectSession(index) {
    // Update list highlight
    if (selectedIndex >= 0 && itemsByIndex[selectedIndex]) {
      itemsByIndex[selectedIndex].classList.remove("history-session--active");
    }
    itemsByIndex[index].classList.add("history-session--active");

    // Update chart point — selected is orange, others are line color
    const ds = chart.data.datasets[0];
    for (let i = 0; i < history.length; i++) {
      const selected = i === index;
      ds.pointRadius[i] = selected ? 7 : defaultRadius;
      ds.pointBackgroundColor[i] = selected ? accent : lineColor;
      ds.pointBorderColor[i] = selected ? accent : lineColor;
    }

    selectedIndex = index;
    chart.update("none");

    // Scroll selected item into view
    itemsByIndex[index].scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });

    // Show detail
    showDetail(history[index]);
  }

  // Size list to show 5 items
  if (history.length > 3) {
    const firstItem = listEl.querySelector(".history-session");
    if (firstItem) {
      const itemHeight = firstItem.offsetHeight;
      listEl.style.maxHeight = itemHeight * 3 + "px";
    }
  }

  // Select last session by default
  selectSession(history.length - 1);

  function formatWeight(w) {
    return w === Math.floor(w) ? String(Math.floor(w)) : String(w);
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
}
