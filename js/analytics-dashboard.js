// ============================================================================
// js/analytics-dashboard.js - Writers Performance Analytics Dashboard & Visualizer
// Restricted strictly to Narrative Administrator (Daniel Poludyonny)
// ============================================================================

(function () {
  let currentTimeframe = 'daily';
  let currentDate = new Date().toISOString().split('T')[0];
  let cachedReportData = null;

  function formatDurationShort(sec) {
    if (!sec || sec <= 0) return '0s';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const parts = [];
    if (h > 0) parts.append ? parts.push(`${h}h`) : parts.push(`${h}h`);
    if (m > 0 || h > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(' ');
  }

  function adjustDateBy(offset) {
    const d = new Date(currentDate + 'T00:00:00');
    if (currentTimeframe === 'daily') {
      d.setDate(d.getDate() + offset);
    } else if (currentTimeframe === 'weekly') {
      d.setDate(d.getDate() + (offset * 7));
    } else if (currentTimeframe === 'monthly') {
      d.setMonth(d.getMonth() + offset);
    }
    currentDate = d.toISOString().split('T')[0];
    const dateInput = document.getElementById('analytics-date-picker');
    if (dateInput) dateInput.value = currentDate;
    loadAnalyticsReport();
  }

  function resetToToday() {
    currentDate = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('analytics-date-picker');
    if (dateInput) dateInput.value = currentDate;
    loadAnalyticsReport();
  }

  async function loadAnalyticsReport() {
    const loadingEl = document.getElementById('analytics-loading-state');
    const contentEl = document.getElementById('analytics-dashboard-content');
    const emptyEl = document.getElementById('analytics-empty-state');
    const periodLabelEl = document.getElementById('analytics-period-title');

    if (loadingEl) loadingEl.classList.remove('hidden');
    if (contentEl) contentEl.classList.add('hidden');
    if (emptyEl) emptyEl.classList.add('hidden');

    try {
      const headers = (typeof getAuthHeaders === 'function') 
        ? getAuthHeaders(false) 
        : {};

      const url = `/api/analytics/report?timeframe=${encodeURIComponent(currentTimeframe)}&date=${encodeURIComponent(currentDate)}`;
      const res = await fetch(url, { headers });

      if (res.status === 403) {
        alert('Access Denied: Analytics are restricted to narrative administrator.');
        closeAnalyticsModal();
        return;
      }

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const data = await res.json();
      cachedReportData = data;

      if (periodLabelEl) {
        periodLabelEl.innerText = data.periodLabel || currentDate;
      }

      renderAnalyticsDashboard(data);

      if (loadingEl) loadingEl.classList.add('hidden');
      if (data.totalSeconds > 0) {
        if (contentEl) contentEl.classList.remove('hidden');
      } else {
        if (emptyEl) emptyEl.classList.remove('hidden');
      }
    } catch (err) {
      console.error('[Analytics] Failed to fetch report:', err);
      if (loadingEl) loadingEl.classList.add('hidden');
      if (emptyEl) {
        emptyEl.classList.remove('hidden');
        const emptyMsg = document.getElementById('analytics-empty-message');
        if (emptyMsg) emptyMsg.innerText = `Could not load telemetry data: ${err.message}`;
      }
    }
  }

  function renderAnalyticsDashboard(data) {
    // 1. KPI Cards
    const kpiTotalTime = document.getElementById('analytics-kpi-total-time');
    const kpiTotalHours = document.getElementById('analytics-kpi-total-hours');
    const kpiTopWriter = document.getElementById('analytics-kpi-top-writer');
    const kpiTopShare = document.getElementById('analytics-kpi-top-share');
    const kpiActiveCount = document.getElementById('analytics-kpi-active-writers');
    const kpiTopBoard = document.getElementById('analytics-kpi-top-board');
    const kpiTopBoardTime = document.getElementById('analytics-kpi-top-board-time');

    if (kpiTotalTime) kpiTotalTime.innerText = data.totalFormatted || '0s';
    if (kpiTotalHours) kpiTotalHours.innerText = `${data.totalHours || 0} active hours`;
    if (kpiTopWriter) kpiTopWriter.innerText = data.topContributor?.name || 'None';
    if (kpiTopShare) kpiTopShare.innerText = `${data.topContributor?.percent || 0}% of all editing`;
    if (kpiActiveCount) kpiActiveCount.innerText = `${data.activeWritersCount || 0} writers active`;
    if (kpiTopBoard) kpiTopBoard.innerText = data.mostEditedBoard?.boardId || 'None';
    if (kpiTopBoardTime) kpiTopBoardTime.innerText = data.mostEditedBoard?.formatted || '0s';

    // 2. Graph 1: Stacked Contribution Share Bar & Legend Pills
    renderContributionShareBar(data);

    // 3. Graph 2: Interactive SVG Activity Timeline Chart
    renderTimelineChart(data);

    // 4. Graph 3: Board Breakdown Progress Bars
    renderBoardBreakdown(data);

    // 5. Performance Table
    renderPerformanceTable(data);
  }

  function renderContributionShareBar(data) {
    const barContainer = document.getElementById('analytics-share-bar');
    const legendContainer = document.getElementById('analytics-share-legend');
    if (!barContainer || !legendContainer) return;

    barContainer.innerHTML = '';
    legendContainer.innerHTML = '';

    if (!data.users || data.users.length === 0 || data.totalSeconds === 0) {
      barContainer.innerHTML = '<div class="w-full h-full bg-gray-800 rounded flex items-center justify-center text-xs text-gray-400">No editing activity recorded for this period</div>';
      return;
    }

    // Stacked segments
    data.users.forEach(user => {
      if (user.percentShare <= 0) return;
      const seg = document.createElement('div');
      seg.className = 'h-full transition-all duration-300 relative group cursor-pointer';
      seg.style.width = `${user.percentShare}%`;
      seg.style.backgroundColor = user.color || '#f59e0b';
      seg.title = `${user.name}: ${user.formatted} (${user.percentShare}%)`;
      barContainer.appendChild(seg);
    });

    // Legend pills
    data.users.forEach(user => {
      const pill = document.createElement('div');
      pill.className = 'flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-gray-800/80 border border-gray-700/60 text-xs hover:border-gray-600 transition';
      pill.innerHTML = `
        <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: ${user.color || '#f59e0b'}"></span>
        <span class="font-medium text-gray-200 truncate max-w-[130px]" title="${user.name}">${user.name}</span>
        <span class="font-mono text-amber-400 font-bold ml-auto">${user.formatted}</span>
        <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-700/80 text-gray-300">${user.percentShare}%</span>
      `;
      legendContainer.appendChild(pill);
    });
  }

  function renderTimelineChart(data) {
    const container = document.getElementById('analytics-chart-svg-container');
    const tooltip = document.getElementById('analytics-chart-tooltip');
    if (!container) return;

    const chart = data.chart;
    if (!chart || !chart.labels || chart.labels.length === 0) {
      container.innerHTML = '<div class="text-xs text-gray-400 p-8 text-center">No timeline data available</div>';
      return;
    }

    const labels = chart.labels;
    const series = chart.series || [];
    const numBuckets = labels.length;

    // Calculate maximum total minutes in any single bucket for Y scaling
    let maxBucketMinutes = 0;
    const bucketTotals = new Array(numBuckets).fill(0);
    series.forEach(s => {
      (s.data || []).forEach((val, idx) => {
        if (idx < numBuckets) {
          bucketTotals[idx] += (val || 0);
          if (bucketTotals[idx] > maxBucketMinutes) {
            maxBucketMinutes = bucketTotals[idx];
          }
        }
      });
    });

    // Ensure nice round Y scale (at least 10 minutes)
    if (maxBucketMinutes < 10) maxBucketMinutes = 10;
    const yMax = Math.ceil(maxBucketMinutes * 1.15);

    const width = 800;
    const height = 220;
    const padLeft = 45;
    const padRight = 15;
    const padTop = 20;
    const padBottom = 30;
    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    const slotW = chartW / numBuckets;
    const barW = Math.max(2, Math.min(slotW * 0.7, 30));

    let svg = `<svg viewBox="0 0 ${width} ${height}" class="w-full h-full select-none" xmlns="http://www.w3.org/2000/svg">`;

    // Horizontal grid lines (4 levels)
    for (let i = 0; i <= 4; i++) {
      const val = Math.round((yMax / 4) * i);
      const yPos = padTop + chartH - (i / 4) * chartH;
      svg += `
        <line x1="${padLeft}" y1="${yPos}" x2="${width - padRight}" y2="${yPos}" stroke="#374151" stroke-dasharray="3,3" stroke-width="1" />
        <text x="${padLeft - 6}" y="${yPos + 3}" fill="#9ca3af" font-size="10" text-anchor="end" font-family="monospace">${val}m</text>
      `;
    }

    // Render stacked bars per bucket
    for (let b = 0; b < numBuckets; b++) {
      const xCenter = padLeft + (b * slotW) + (slotW / 2);
      const xBar = xCenter - (barW / 2);
      let currentBaseY = padTop + chartH;

      series.forEach(s => {
        const val = (s.data && s.data[b]) || 0;
        if (val <= 0) return;

        const barH = (val / yMax) * chartH;
        const yBar = currentBaseY - barH;
        currentBaseY = yBar;

        const writerName = (s.name || '').replace(/"/g, '&quot;');
        const color = s.color || '#f59e0b';

        svg += `
          <rect 
            x="${xBar}" 
            y="${yBar}" 
            width="${barW}" 
            height="${barH}" 
            fill="${color}" 
            rx="2"
            class="chart-bar-hover transition-opacity hover:opacity-80 cursor-pointer"
            data-writer="${writerName}"
            data-slot="${labels[b]}"
            data-val="${val} mins"
          />
        `;
      });

      // Bottom label (skip some if monthly to avoid crowding)
      let showLabel = true;
      if (numBuckets > 15 && b % 2 !== 0 && b !== numBuckets - 1) showLabel = false;
      if (showLabel) {
        svg += `
          <text x="${xCenter}" y="${height - 10}" fill="#9ca3af" font-size="10" text-anchor="middle" font-family="monospace">${labels[b]}</text>
        `;
      }
    }

    svg += '</svg>';
    container.innerHTML = svg;

    // Setup interactive tooltips on chart rects
    const rects = container.querySelectorAll('.chart-bar-hover');
    rects.forEach(r => {
      r.addEventListener('mouseenter', (e) => {
        if (!tooltip) return;
        const w = r.getAttribute('data-writer');
        const s = r.getAttribute('data-slot');
        const v = r.getAttribute('data-val');
        tooltip.innerHTML = `
          <div class="font-bold text-amber-300 text-xs">${w}</div>
          <div class="text-[11px] text-gray-300">${s}</div>
          <div class="font-mono text-xs font-semibold text-white mt-0.5">${v}</div>
        `;
        tooltip.classList.remove('hidden');
        positionTooltip(e, tooltip, container);
      });

      r.addEventListener('mousemove', (e) => {
        if (tooltip && !tooltip.classList.contains('hidden')) {
          positionTooltip(e, tooltip, container);
        }
      });

      r.addEventListener('mouseleave', () => {
        if (tooltip) tooltip.classList.add('hidden');
      });
    });
  }

  function positionTooltip(event, tooltip, container) {
    const rect = container.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    tooltip.style.left = `${Math.min(x + 12, rect.width - 150)}px`;
    tooltip.style.top = `${Math.max(10, y - 45)}px`;
  }

  function renderBoardBreakdown(data) {
    const listContainer = document.getElementById('analytics-boards-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    if (!data.boards || data.boards.length === 0) {
      listContainer.innerHTML = '<div class="text-xs text-gray-400 py-3 text-center">No board activity recorded</div>';
      return;
    }

    data.boards.forEach(b => {
      const row = document.createElement('div');
      row.className = 'p-2 rounded bg-gray-800/60 border border-gray-700/50 flex flex-col gap-1.5';
      row.innerHTML = `
        <div class="flex items-center justify-between text-xs">
          <span class="font-semibold text-gray-200 truncate max-w-[200px]" title="${b.boardId}">
            📁 ${b.boardId}
          </span>
          <div class="flex items-center gap-2">
            <span class="text-gray-400 text-[11px]">${b.userCount} writer${b.userCount > 1 ? 's' : ''}</span>
            <span class="font-mono font-bold text-amber-400">${b.formatted}</span>
            <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-700 text-gray-300">${b.percent}%</span>
          </div>
        </div>
        <div class="w-full h-1.5 bg-gray-900 rounded-full overflow-hidden">
          <div class="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full" style="width: ${b.percent}%"></div>
        </div>
      `;
      listContainer.appendChild(row);
    });
  }

  function renderPerformanceTable(data) {
    const tbody = document.getElementById('analytics-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!data.users || data.users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="px-3 py-4 text-center text-xs text-gray-400">No active editing activity recorded</td></tr>';
      return;
    }

    data.users.forEach((u, index) => {
      const tr = document.createElement('tr');
      tr.className = 'border-b border-gray-800 hover:bg-gray-800/40 text-xs transition';
      
      const lastActiveFormatted = u.lastActive 
        ? new Date(u.lastActive).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '–';

      tr.innerHTML = `
        <td class="px-3 py-2.5 flex items-center gap-2">
          <span class="w-2 h-2 rounded-full shrink-0" style="background-color: ${u.color}"></span>
          <span class="font-bold text-gray-400 font-mono w-4">#${index + 1}</span>
          <div>
            <div class="font-semibold text-gray-100">${u.name}</div>
            <div class="text-[11px] text-gray-400 font-mono">${u.email}</div>
          </div>
        </td>
        <td class="px-3 py-2.5 font-mono font-bold text-amber-400">${u.formatted}</td>
        <td class="px-3 py-2.5 font-mono text-gray-300">${u.hours}h</td>
        <td class="px-3 py-2.5">
          <div class="flex items-center gap-2">
            <span class="font-semibold text-gray-200">${u.percentShare}%</span>
            <div class="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div class="h-full" style="width: ${u.percentShare}%; background-color: ${u.color}"></div>
            </div>
          </div>
        </td>
        <td class="px-3 py-2.5 text-gray-300 truncate max-w-[150px]" title="${u.topBoard}">
          ${u.topBoard}
        </td>
        <td class="px-3 py-2.5 text-gray-400 font-mono text-[11px]">${lastActiveFormatted}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function downloadCsvExport() {
    const url = `/api/analytics/export?timeframe=${encodeURIComponent(currentTimeframe)}&date=${encodeURIComponent(currentDate)}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `rcne-analytics-${currentTimeframe}-${currentDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function openAnalyticsModal() {
    const menu = document.getElementById('dropdown-master-menu');
    if (menu) menu.classList.add('hidden');

    const modal = document.getElementById('modal-analytics-dashboard');
    if (!modal) return;
    modal.classList.remove('hidden');

    const dateInput = document.getElementById('analytics-date-picker');
    if (dateInput) dateInput.value = currentDate;

    loadAnalyticsReport();
    if (window.lucide && window.lucide.createIcons) {
      window.lucide.createIcons();
    }
  }

  function closeAnalyticsModal() {
    const modal = document.getElementById('modal-analytics-dashboard');
    if (modal) modal.classList.add('hidden');
  }

  // Bind controls on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', () => {
    // 1. Header Button
    const btnOpen = document.getElementById('btn-admin-analytics');
    if (btnOpen) {
      btnOpen.addEventListener('click', (e) => {
        e.preventDefault();
        openAnalyticsModal();
      });
    }

    // 2. Modal Close Buttons
    const btnClose = document.getElementById('btn-close-analytics-modal');
    if (btnClose) btnClose.addEventListener('click', closeAnalyticsModal);

    const btnCloseFooter = document.getElementById('btn-analytics-close-footer');
    if (btnCloseFooter) btnCloseFooter.addEventListener('click', closeAnalyticsModal);

    const modal = document.getElementById('modal-analytics-dashboard');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeAnalyticsModal();
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
        closeAnalyticsModal();
      }
    });

    // 3. Timeframe Tabs
    ['daily', 'weekly', 'monthly'].forEach(tf => {
      const tab = document.getElementById(`analytics-tab-${tf}`);
      if (tab) {
        tab.addEventListener('click', () => {
          ['daily', 'weekly', 'monthly'].forEach(t => {
            const el = document.getElementById(`analytics-tab-${t}`);
            if (el) {
              el.classList.remove('bg-amber-600', 'text-white', 'shadow');
              el.classList.add('text-gray-400', 'hover:text-gray-200');
            }
          });
          tab.classList.add('bg-amber-600', 'text-white', 'shadow');
          tab.classList.remove('text-gray-400', 'hover:text-gray-200');
          currentTimeframe = tf;
          loadAnalyticsReport();
        });
      }
    });

    // 4. Date navigation buttons
    const btnPrev = document.getElementById('btn-analytics-prev-date');
    if (btnPrev) btnPrev.addEventListener('click', () => adjustDateBy(-1));

    const btnNext = document.getElementById('btn-analytics-next-date');
    if (btnNext) btnNext.addEventListener('click', () => adjustDateBy(1));

    const btnToday = document.getElementById('btn-analytics-today');
    if (btnToday) btnToday.addEventListener('click', resetToToday);

    const datePicker = document.getElementById('analytics-date-picker');
    if (datePicker) {
      datePicker.addEventListener('change', (e) => {
        if (e.target.value) {
          currentDate = e.target.value;
          loadAnalyticsReport();
        }
      });
    }

    // 5. CSV Export Button
    const btnExport = document.getElementById('btn-analytics-export-csv');
    if (btnExport) btnExport.addEventListener('click', downloadCsvExport);

    const btnRefresh = document.getElementById('btn-analytics-refresh');
    if (btnRefresh) btnRefresh.addEventListener('click', loadAnalyticsReport);
  });

  // Global exports
  window.openAnalyticsDashboard = openAnalyticsModal;
  window.closeAnalyticsDashboard = closeAnalyticsModal;
})();
