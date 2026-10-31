/**
 * script.js — Student Performance Dashboard
 * ============================================
 * Modul utama: load data, filter, hitung KPI, render semua chart & tabel.
 * Semua data diambil dari student_data.json (tidak ada data dummy).
 */

/* ── Palet warna konsisten ── */
const COLORS = {
  primary:  ['#0d9488','#14b8a6','#2dd4bf','#5eead4','#99f6e4','#ccfbf1'],
  amber:    ['#f59e0b','#fbbf24','#fde68a'],
  mixed:    ['#0d9488','#f59e0b','#6366f1','#ec4899','#10b981','#8b5cf6','#f97316','#06b6d4'],
  gender:   ['#0d9488','#f59e0b'],
  stress:   ['#10b981','#f59e0b','#ef4444'],
  extra:    ['#0d9488','#94a3b8'],
};

/* ── State global ── */
let allData = [];         // semua data mentah dari JSON
let filteredData = [];    // data setelah filter diterapkan
let charts = {};          // referensi chart agar bisa di-destroy/update

/* ═══════════════════════════════════════════════════
   1. LOAD DATA
   ═══════════════════════════════════════════════════ */
async function loadData() {
  try {
    const res = await fetch('student_data.json');
    if (!res.ok) throw new Error('Gagal memuat student_data.json');
    allData = await res.json();
    filteredData = [...allData];

    // Tampilkan waktu update
    document.getElementById('lastUpdated').textContent =
      'Data: ' + allData.length + ' mahasiswa · ' +
      new Date().toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' });

    populateFilters();
    applyFilters();
  } catch (err) {
    console.error(err);
    document.getElementById('insightText').textContent =
      '⚠️ Gagal memuat data. Pastikan file student_data.json ada di direktori yang sama.';
  }
}

/* ═══════════════════════════════════════════════════
   2. POPULATE FILTER DROPDOWN
   ═══════════════════════════════════════════════════ */
function populateFilters() {
  // Ambil nilai unik dari allData untuk setiap filter
  const majors   = [...new Set(allData.map(d => d.Major))].sort();
  const semesters= [...new Set(allData.map(d => d.Semester))].sort((a,b) => a-b);
  const methods  = [...new Set(allData.map(d => d.Study_Method))].sort();
  const stresses = ['Rendah','Sedang','Tinggi']; // urutan bermakna

  fillSelect('filterMajor',       majors,    v => v);
  fillSelect('filterSemester',    semesters, v => 'Semester ' + v, v => v);
  fillSelect('filterStudyMethod', methods,   v => v);
  fillSelect('filterStress',      stresses,  v => v);
}

/** Isi elemen <select> dengan opsi dari array */
function fillSelect(id, values, labelFn, valueFn) {
  const sel = document.getElementById(id);
  values.forEach(v => {
    const opt = document.createElement('option');
    opt.value = valueFn ? valueFn(v) : v;
    opt.textContent = labelFn(v);
    sel.appendChild(opt);
  });
}

/* ═══════════════════════════════════════════════════
   3. APPLY FILTERS
   ═══════════════════════════════════════════════════ */
function applyFilters() {
  const major  = document.getElementById('filterMajor').value;
  const sem    = document.getElementById('filterSemester').value;
  const method = document.getElementById('filterStudyMethod').value;
  const stress = document.getElementById('filterStress').value;

  filteredData = allData.filter(d => {
    if (major  && d.Major        !== major)           return false;
    if (sem    && String(d.Semester) !== String(sem)) return false;
    if (method && d.Study_Method !== method)          return false;
    if (stress && d.Stress_Level !== stress)          return false;
    return true;
  });

  renderAll();
}

/* ═══════════════════════════════════════════════════
   4. RENDER ALL — panggil semua fungsi render
   ═══════════════════════════════════════════════════ */
function renderAll() {
  if (filteredData.length === 0) {
    showEmptyState();
    return;
  }
  updateKPI();
  updateInsight();
  renderChartSemester();
  renderChartMajor();
  renderChartStudyMethod();
  renderChartGender();
  renderChartStress();
  renderChartStudyScatter();
  renderChartSleepScatter();
  renderChartMethodScore();
  renderChartExtracurricular();
  renderTop10Table();
}

/** Tampilkan state kosong jika tidak ada data yang cocok */
function showEmptyState() {
  // KPI
  ['kpiTotal','kpiFinalScore','kpiStudyHours','kpiAttendance'].forEach(id => {
    document.getElementById(id).textContent = '–';
  });
  document.getElementById('insightText').textContent = 'Tidak ada data yang cocok dengan filter yang dipilih.';
  // Hapus semua chart
  Object.keys(charts).forEach(key => { charts[key].destroy(); delete charts[key]; });
  // Table body
  document.getElementById('tableTop10Body').innerHTML =
    '<tr><td colspan="7" class="empty-state">Tidak ada data</td></tr>';
}

/* ═══════════════════════════════════════════════════
   5. KPI
   ═══════════════════════════════════════════════════ */
function updateKPI() {
  const n = filteredData.length;
  document.getElementById('kpiTotal').textContent = n.toLocaleString('id-ID');
  document.getElementById('kpiFinalScore').textContent =
    avg(filteredData, 'Final_Score').toFixed(1);
  document.getElementById('kpiStudyHours').textContent =
    avg(filteredData, 'Study_Hours_Per_Week').toFixed(1) + ' jam';
  document.getElementById('kpiAttendance').textContent =
    avg(filteredData, 'Attendance_Pct').toFixed(1) + '%';
}

/* ═══════════════════════════════════════════════════
   6. INSIGHT OTOMATIS
   ═══════════════════════════════════════════════════ */
function updateInsight() {
  const el = document.getElementById('insightText');
  el.classList.add('fading');

  setTimeout(() => {
    const sentences = buildInsights();
    el.textContent = sentences.join(' ');
    el.classList.remove('fading');
  }, 200);
}

function buildInsights() {
  const insights = [];
  const n = filteredData.length;

  // Insight 1 — Jurusan dengan nilai tertinggi (jika semua jurusan ada)
  const majorAvg = groupAvg(filteredData, 'Major', 'Final_Score');
  const topMajor = maxKey(majorAvg);
  const botMajor = minKey(majorAvg);
  if (topMajor && botMajor && topMajor !== botMajor) {
    insights.push(
      `Dari ${n} mahasiswa yang difilter, jurusan ${topMajor} memiliki rata-rata nilai akhir tertinggi (${majorAvg[topMajor].toFixed(1)}), sedangkan ${botMajor} terendah (${majorAvg[botMajor].toFixed(1)}).`
    );
  } else if (topMajor) {
    insights.push(
      `Dari ${n} mahasiswa, rata-rata nilai akhir adalah ${avg(filteredData,'Final_Score').toFixed(1)}.`
    );
  }

  // Insight 2 — Metode belajar dengan nilai terbaik
  const methodAvg = groupAvg(filteredData, 'Study_Method', 'Final_Score');
  const topMethod = maxKey(methodAvg);
  if (topMethod) {
    insights.push(
      `Metode belajar "${topMethod}" menghasilkan rata-rata nilai akhir tertinggi (${methodAvg[topMethod].toFixed(1)}).`
    );
  }

  // Insight 3 — Tingkat stres dan dampaknya
  const stressAvg = groupAvg(filteredData, 'Stress_Level', 'Final_Score');
  if (stressAvg['Rendah'] && stressAvg['Tinggi']) {
    const diff = (stressAvg['Rendah'] - stressAvg['Tinggi']).toFixed(1);
    if (diff > 0) {
      insights.push(
        `Mahasiswa dengan stres Rendah rata-rata ${diff} poin lebih tinggi nilainya dibanding yang berstres Tinggi.`
      );
    }
  }

  return insights.length ? insights : [`Total ${n} mahasiswa tersaring dengan rata-rata nilai akhir ${avg(filteredData,'Final_Score').toFixed(1)}.`];
}

/* ═══════════════════════════════════════════════════
   7. HELPER CHART: upsert chart agar tidak duplikat
   ═══════════════════════════════════════════════════ */
function upsertChart(id, config) {
  if (charts[id]) { charts[id].destroy(); }
  const ctx = document.getElementById(id).getContext('2d');
  charts[id] = new Chart(ctx, config);
}

/** Opsi umum untuk sumbu agar terlihat rapi */
function axisDefaults() {
  return {
    ticks: { font: { size: 11 }, color: '#64748b' },
    grid:  { color: '#f1f5f9' },
  };
}

/* ═══════════════════════════════════════════════════
   8. CHART 1 — Tren Nilai per Semester (line)
   ═══════════════════════════════════════════════════ */
function renderChartSemester() {
  const semMap = groupAvg(filteredData, 'Semester', 'Final_Score');
  const labels = Object.keys(semMap).sort((a,b)=>a-b).map(s=>'Sem '+s);
  const values = Object.keys(semMap).sort((a,b)=>a-b).map(s=>+semMap[s].toFixed(1));

  upsertChart('chartSemester', {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Rata-rata Nilai Akhir',
        data: values,
        borderColor: '#0d9488',
        backgroundColor: 'rgba(13,148,136,0.08)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#0d9488',
        pointRadius: 5,
        pointHoverRadius: 7,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: tooltipStyle() },
      scales: {
        x: { ...axisDefaults(), title: { display: true, text: 'Semester', color:'#64748b', font:{size:11} } },
        y: { ...axisDefaults(), min: 40, title: { display: true, text: 'Nilai', color:'#64748b', font:{size:11} } },
      }
    }
  });
}

/* ═══════════════════════════════════════════════════
   9. CHART 2 — Nilai per Jurusan (bar)
   ═══════════════════════════════════════════════════ */
function renderChartMajor() {
  const majorMap = groupAvg(filteredData, 'Major', 'Final_Score');
  const sorted   = Object.entries(majorMap).sort((a,b)=>b[1]-a[1]);
  const labels   = sorted.map(([k])=>k);
  const values   = sorted.map(([,v])=>+v.toFixed(1));

  upsertChart('chartMajor', {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Rata-rata Nilai Akhir',
        data: values,
        backgroundColor: COLORS.primary.slice(0, labels.length),
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: tooltipStyle() },
      scales: {
        x: { ...axisDefaults(), min: 40 },
        y: { ...axisDefaults() },
      }
    }
  });
}

/* ═══════════════════════════════════════════════════
   10. CHART 3 — Distribusi Metode Belajar (doughnut)
   ═══════════════════════════════════════════════════ */
function renderChartStudyMethod() {
  const counts = groupCount(filteredData, 'Study_Method');
  upsertChart('chartStudyMethod', doughnutConfig(counts, COLORS.mixed));
}

/* ═══════════════════════════════════════════════════
   11. CHART 4 — Distribusi Gender (pie)
   ═══════════════════════════════════════════════════ */
function renderChartGender() {
  const counts = groupCount(filteredData, 'Gender');
  upsertChart('chartGender', pieConfig(counts, COLORS.gender));
}

/* ═══════════════════════════════════════════════════
   12. CHART 5 — Distribusi Tingkat Stres (pie)
   ═══════════════════════════════════════════════════ */
function renderChartStress() {
  const order  = ['Rendah','Sedang','Tinggi'];
  const counts = groupCount(filteredData, 'Stress_Level');
  const ordered = {};
  order.forEach(k => { if (counts[k] !== undefined) ordered[k] = counts[k]; });
  upsertChart('chartStress', pieConfig(ordered, COLORS.stress));
}

/* ═══════════════════════════════════════════════════
   13. CHART 6 — Jam Belajar vs Nilai (scatter)
   ═══════════════════════════════════════════════════ */
function renderChartStudyScatter() {
  const points = filteredData.map(d => ({ x: d.Study_Hours_Per_Week, y: d.Final_Score }));
  upsertChart('chartStudyScatter', scatterConfig(
    points, 'Jam Belajar/Minggu', 'Nilai Akhir', '#0d9488'
  ));
}

/* ═══════════════════════════════════════════════════
   14. CHART 7 — Jam Tidur vs Nilai (scatter)
   ═══════════════════════════════════════════════════ */
function renderChartSleepScatter() {
  const points = filteredData.map(d => ({ x: d.Sleep_Hours, y: d.Final_Score }));
  upsertChart('chartSleepScatter', scatterConfig(
    points, 'Jam Tidur', 'Nilai Akhir', '#f59e0b'
  ));
}

/* ═══════════════════════════════════════════════════
   15. CHART 8 — Nilai per Metode Belajar (bar)
   ═══════════════════════════════════════════════════ */
function renderChartMethodScore() {
  const methodMap = groupAvg(filteredData, 'Study_Method', 'Final_Score');
  const sorted    = Object.entries(methodMap).sort((a,b)=>b[1]-a[1]);
  const labels    = sorted.map(([k])=>k);
  const values    = sorted.map(([,v])=>+v.toFixed(1));

  upsertChart('chartMethodScore', {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Rata-rata Nilai Akhir',
        data: values,
        backgroundColor: COLORS.mixed.slice(0, labels.length),
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: tooltipStyle() },
      scales: {
        x: { ...axisDefaults() },
        y: { ...axisDefaults(), min: 40 },
      }
    }
  });
}

/* ═══════════════════════════════════════════════════
   16. CHART 9 — Top 10 Table
   ═══════════════════════════════════════════════════ */
function renderTop10Table() {
  const top10 = [...filteredData]
    .sort((a,b) => b.Final_Score - a.Final_Score)
    .slice(0, 10);

  const tbody = document.getElementById('tableTop10Body');

  if (top10.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Tidak ada data</td></tr>';
    return;
  }

  tbody.innerHTML = top10.map((d, i) => {
    const rankClass = i===0?'rank-1':i===1?'rank-2':i===2?'rank-3':'rank-other';
    const scoreClass = d.Final_Score >= 70 ? 'score-high' : d.Final_Score >= 55 ? 'score-mid' : 'score-low';
    return `
      <tr>
        <td><span class="rank-badge ${rankClass}">${i+1}</span></td>
        <td class="text-slate-400">${d.Student_ID}</td>
        <td class="font-medium text-slate-700">${d.Student_Name}</td>
        <td>${d.Major}</td>
        <td class="text-center">${d.Semester}</td>
        <td>${d.Study_Method}</td>
        <td><span class="score-badge ${scoreClass}">${d.Final_Score}</span></td>
      </tr>`;
  }).join('');
}

/* ═══════════════════════════════════════════════════
   17. CHART 10 — Ekstrakurikuler (doughnut)
   ═══════════════════════════════════════════════════ */
function renderChartExtracurricular() {
  const counts = groupCount(filteredData, 'Extracurricular');
  // Pastikan label lebih deskriptif
  const labeled = {};
  if (counts['Ya'])    labeled['Aktif Ekskul']  = counts['Ya'];
  if (counts['Tidak']) labeled['Tidak Ekskul'] = counts['Tidak'];
  upsertChart('chartExtracurricular', doughnutConfig(labeled, COLORS.extra));
}

/* ═══════════════════════════════════════════════════
   18. FACTORY FUNCTIONS — konfigurasi chart reusable
   ═══════════════════════════════════════════════════ */

/** Konfigurasi doughnut chart generik */
function doughnutConfig(countObj, palette) {
  const labels = Object.keys(countObj);
  const data   = Object.values(countObj);
  return {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: palette.slice(0, labels.length),
        borderWidth: 2,
        borderColor: '#fff',
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font:{size:11}, padding:12, color:'#475569' } },
        tooltip: tooltipStyle(),
      },
      cutout: '60%',
    }
  };
}

/** Konfigurasi pie chart generik */
function pieConfig(countObj, palette) {
  const labels = Object.keys(countObj);
  const data   = Object.values(countObj);
  return {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: palette.slice(0, labels.length),
        borderWidth: 2,
        borderColor: '#fff',
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font:{size:11}, padding:12, color:'#475569' } },
        tooltip: tooltipStyle(),
      }
    }
  };
}

/** Konfigurasi scatter plot generik */
function scatterConfig(points, xLabel, yLabel, color) {
  return {
    type: 'scatter',
    data: {
      datasets: [{
        label: `${xLabel} vs ${yLabel}`,
        data: points,
        backgroundColor: color + 'aa',
        borderColor: color,
        borderWidth: 1,
        pointRadius: 4,
        pointHoverRadius: 6,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: tooltipStyle() },
      scales: {
        x: { ...axisDefaults(), title: { display: true, text: xLabel, color:'#64748b', font:{size:11} } },
        y: { ...axisDefaults(), title: { display: true, text: yLabel, color:'#64748b', font:{size:11} } },
      }
    }
  };
}

/** Konfigurasi tooltip agar konsisten */
function tooltipStyle() {
  return {
    backgroundColor: '#1e293b',
    titleColor: '#f8fafc',
    bodyColor: '#cbd5e1',
    padding: 10,
    cornerRadius: 8,
    displayColors: true,
  };
}

/* ═══════════════════════════════════════════════════
   19. UTILITY FUNCTIONS
   ═══════════════════════════════════════════════════ */

/** Hitung rata-rata field numerik dari array */
function avg(arr, field) {
  if (!arr.length) return 0;
  return arr.reduce((s, d) => s + d[field], 0) / arr.length;
}

/** Hitung rata-rata per grup berdasarkan groupField → valueField */
function groupAvg(arr, groupField, valueField) {
  const map = {};
  arr.forEach(d => {
    const key = d[groupField];
    if (!map[key]) map[key] = { sum: 0, count: 0 };
    map[key].sum   += d[valueField];
    map[key].count += 1;
  });
  const result = {};
  Object.keys(map).forEach(k => { result[k] = map[k].sum / map[k].count; });
  return result;
}

/** Hitung jumlah per grup */
function groupCount(arr, field) {
  return arr.reduce((acc, d) => {
    const key = d[field];
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

/** Kunci dengan nilai maksimum */
function maxKey(obj) {
  const keys = Object.keys(obj);
  if (!keys.length) return null;
  return keys.reduce((a,b) => obj[a] >= obj[b] ? a : b);
}

/** Kunci dengan nilai minimum */
function minKey(obj) {
  const keys = Object.keys(obj);
  if (!keys.length) return null;
  return keys.reduce((a,b) => obj[a] <= obj[b] ? a : b);
}

/* ═══════════════════════════════════════════════════
   20. EVENT LISTENERS
   ═══════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // Muat data saat halaman siap
  loadData();

  // Pasang event listener pada setiap filter
  ['filterMajor','filterSemester','filterStudyMethod','filterStress'].forEach(id => {
    document.getElementById(id).addEventListener('change', applyFilters);
  });

  // Tombol reset filter
  document.getElementById('btnReset').addEventListener('click', () => {
    ['filterMajor','filterSemester','filterStudyMethod','filterStress'].forEach(id => {
      document.getElementById(id).value = '';
    });
    applyFilters();
  });
});
