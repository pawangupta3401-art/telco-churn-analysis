import Chart from 'chart.js/auto';

// Global State
let rawRecords = [];
let filteredRecords = [];
let initialSummary = null;
let charts = {};
let currentPage = 1;
const PAGE_SIZE = 12;

// Chart Styling Presets
Chart.defaults.color = '#94a3b8';
Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";
Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.07)';

// Initialize Application
async function initApp() {
  setupTabs();
  setupSimulator();

  // Load summary first for instant paint
  try {
    const resSummary = await fetch('/churn-summary.json');
    if (resSummary.ok) {
      initialSummary = await resSummary.json();
      renderInitialOverview(initialSummary);
      renderChurnDeepDive(initialSummary);
    }
  } catch (err) {
    console.warn('Could not load summary.json directly:', err);
  }

  // Load full records for interactivity
  try {
    const resData = await fetch('/churn-data.json');
    if (resData.ok) {
      rawRecords = await resData.json();
      filteredRecords = [...rawRecords];
      setupFilterListeners();
      setupTableSearchAndPagination();
      setupExportCsv();
      renderTablePage();
      updateMetricsAndCharts();
    }
  } catch (err) {
    console.error('Error loading churn records:', err);
  }
}

// Tab Switching
function setupTabs() {
  const tabs = document.querySelectorAll('.nav-btn');
  const views = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      views.forEach(v => v.classList.remove('active'));

      tab.classList.add('active');
      const targetId = `view-${tab.dataset.tab}`;
      const targetView = document.getElementById(targetId);
      if (targetView) targetView.classList.add('active');

      // Trigger chart resize if needed
      window.dispatchEvent(new Event('resize'));
    });
  });
}

// Initial Overview Render
function renderInitialOverview(summary) {
  updateKpiBanner(
    summary.totalCustomers,
    summary.churnedCustomers,
    summary.retainedCustomers,
    summary.churnRate,
    summary.avgMonthlyCharges,
    summary.totalRevenue
  );
  renderOverviewCharts(summary);
  renderServicesTable(summary.serviceAdoption);
}

// Update Top KPI Banner
function updateKpiBanner(total, churned, retained, churnRate, avgMonthly, revenue) {
  document.getElementById('val-total').textContent = total.toLocaleString();
  document.getElementById('val-churn-rate').textContent = `${churnRate.toFixed(1)}%`;
  document.getElementById('val-churned-count').textContent = `${churned.toLocaleString()} Churned Customers`;
  document.getElementById('val-retained-rate').textContent = `${(100 - churnRate).toFixed(1)}%`;
  document.getElementById('val-retained-count').textContent = `${retained.toLocaleString()} Active Accounts`;
  document.getElementById('val-avg-monthly').textContent = `$${avgMonthly.toFixed(1)}`;
  
  const revInM = (revenue / 1000000).toFixed(1);
  document.getElementById('val-total-rev').textContent = `$${revInM}M`;
}

// Render Overview Charts
function renderOverviewCharts(summary) {
  // 1. Internet Service
  const internetLabels = Object.keys(summary.internetStats);
  const internetTotals = internetLabels.map(k => summary.internetStats[k].total);
  const internetChurns = internetLabels.map(k => summary.internetStats[k].churned);

  createOrUpdateChart('chart-internet', {
    type: 'bar',
    data: {
      labels: internetLabels,
      datasets: [
        {
          label: 'Total Customers',
          data: internetTotals,
          backgroundColor: 'rgba(6, 182, 212, 0.45)',
          borderColor: '#06b6d4',
          borderWidth: 1.5,
          borderRadius: 6
        },
        {
          label: 'Churned',
          data: internetChurns,
          backgroundColor: 'rgba(244, 63, 94, 0.7)',
          borderColor: '#f43f5e',
          borderWidth: 1.5,
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top', labels: { boxWidth: 12 } } },
      scales: { y: { grid: { color: 'rgba(255,255,255,0.05)' } } }
    }
  });

  // 2. Contract
  const contractLabels = Object.keys(summary.contractStats);
  const contractTotals = contractLabels.map(k => summary.contractStats[k].total);
  const contractChurns = contractLabels.map(k => summary.contractStats[k].churned);

  createOrUpdateChart('chart-contract', {
    type: 'bar',
    data: {
      labels: contractLabels,
      datasets: [
        {
          label: 'Total Base',
          data: contractTotals,
          backgroundColor: 'rgba(99, 102, 241, 0.45)',
          borderColor: '#6366f1',
          borderWidth: 1.5,
          borderRadius: 6
        },
        {
          label: 'Churned',
          data: contractChurns,
          backgroundColor: 'rgba(244, 63, 94, 0.7)',
          borderColor: '#f43f5e',
          borderWidth: 1.5,
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top', labels: { boxWidth: 12 } } },
      scales: { y: { grid: { color: 'rgba(255,255,255,0.05)' } } }
    }
  });

  // 3. Payment Method
  const paymentLabels = Object.keys(summary.paymentStats);
  const paymentTotals = paymentLabels.map(k => summary.paymentStats[k].total);
  const paymentChurns = paymentLabels.map(k => summary.paymentStats[k].churned);

  createOrUpdateChart('chart-payment', {
    type: 'bar',
    data: {
      labels: paymentLabels.map(l => l.replace(' (automatic)', ' (Auto)')),
      datasets: [
        {
          label: 'Total Customers',
          data: paymentTotals,
          backgroundColor: 'rgba(16, 185, 129, 0.45)',
          borderColor: '#10b981',
          borderWidth: 1.5,
          borderRadius: 6
        },
        {
          label: 'Churned',
          data: paymentChurns,
          backgroundColor: 'rgba(244, 63, 94, 0.7)',
          borderColor: '#f43f5e',
          borderWidth: 1.5,
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top', labels: { boxWidth: 12 } } },
      scales: { y: { grid: { color: 'rgba(255,255,255,0.05)' } } }
    }
  });

  // 4. Monthly Charges Distribution
  const chargeLabels = Object.keys(summary.chargeBuckets);
  const chargeTotals = chargeLabels.map(k => summary.chargeBuckets[k].total);
  const chargeRates = chargeLabels.map(k => summary.chargeBuckets[k].churnRate);

  createOrUpdateChart('chart-charges', {
    type: 'line',
    data: {
      labels: chargeLabels,
      datasets: [
        {
          label: 'Customer Volume',
          data: chargeTotals,
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.2)',
          fill: true,
          tension: 0.35,
          yAxisID: 'y'
        },
        {
          label: 'Churn Rate (%)',
          data: chargeRates,
          borderColor: '#f43f5e',
          backgroundColor: 'rgba(244, 63, 94, 0.2)',
          borderDash: [5, 5],
          tension: 0.35,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top', labels: { boxWidth: 12 } } },
      scales: {
        y: { type: 'linear', position: 'left', grid: { color: 'rgba(255,255,255,0.05)' } },
        y1: { type: 'linear', position: 'right', grid: { drawOnChartArea: false }, ticks: { callback: v => `${v}%` } }
      }
    }
  });

  // 5. Tenure Distribution
  const tenureLabels = Object.keys(summary.tenureBuckets);
  const tenureTotals = tenureLabels.map(k => summary.tenureBuckets[k].total);
  const tenureChurns = tenureLabels.map(k => summary.tenureBuckets[k].churn);

  createOrUpdateChart('chart-tenure', {
    type: 'bar',
    data: {
      labels: tenureLabels,
      datasets: [
        {
          label: 'Total Accounts',
          data: tenureTotals,
          backgroundColor: 'rgba(6, 182, 212, 0.4)',
          borderColor: '#06b6d4',
          borderWidth: 1.5,
          borderRadius: 6
        },
        {
          label: 'Churned',
          data: tenureChurns,
          backgroundColor: 'rgba(244, 63, 94, 0.75)',
          borderColor: '#f43f5e',
          borderWidth: 1.5,
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top', labels: { boxWidth: 12 } } },
      scales: { y: { grid: { color: 'rgba(255,255,255,0.05)' } } }
    }
  });
}

// Services Penetration Table
function renderServicesTable(serviceAdoption) {
  const tbody = document.getElementById('services-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const serviceLabels = {
    'OnlineSecurity': { name: 'Online Security', impact: 'High Shield', pillClass: 'pill-high' },
    'TechSupport': { name: 'Tech Support', impact: 'High Shield', pillClass: 'pill-high' },
    'DeviceProtection': { name: 'Device Protection', impact: 'Moderate Shield', pillClass: 'pill-med' },
    'OnlineBackup': { name: 'Online Backup', impact: 'Moderate Shield', pillClass: 'pill-med' },
    'PaperlessBilling': { name: 'Paperless Billing', impact: 'Risk Correlator', pillClass: 'pill-high' },
    'StreamingTV': { name: 'Streaming TV', impact: 'Neutral / Price', pillClass: 'pill-low' },
    'StreamingMovies': { name: 'Streaming Movies', impact: 'Neutral / Price', pillClass: 'pill-low' },
    'PhoneService': { name: 'Phone Service', impact: 'Standard Base', pillClass: 'pill-low' },
    'MultipleLines': { name: 'Multiple Lines', impact: 'Neutral', pillClass: 'pill-low' }
  };

  Object.entries(serviceAdoption).forEach(([key, val]) => {
    const meta = serviceLabels[key] || { name: key, impact: 'Standard', pillClass: 'pill-low' };
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${meta.name}</strong></td>
      <td>${val.total_yes_pct}%</td>
      <td style="color: ${val.churn_yes_pct < val.total_yes_pct ? '#f43f5e' : '#06b6d4'}">${val.churn_yes_pct}%</td>
      <td><span class="pill-shield ${meta.pillClass}">${meta.impact}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// TAB 2: Churn Deep Dive Charts
function renderChurnDeepDive(summary) {
  // Badges update
  if (summary.serviceAdoption) {
    if (document.getElementById('badge-online-sec')) document.getElementById('badge-online-sec').textContent = `${summary.serviceAdoption.OnlineSecurity.churn_yes_pct}%`;
    if (document.getElementById('badge-tech-sup')) document.getElementById('badge-tech-sup').textContent = `${summary.serviceAdoption.TechSupport.churn_yes_pct}%`;
    if (document.getElementById('badge-online-bak')) document.getElementById('badge-online-bak').textContent = `${summary.serviceAdoption.OnlineBackup.churn_yes_pct}%`;
    if (document.getElementById('badge-dev-prot')) document.getElementById('badge-dev-prot').textContent = `${summary.serviceAdoption.DeviceProtection.churn_yes_pct}%`;
    if (document.getElementById('badge-paperless')) document.getElementById('badge-paperless').textContent = `${summary.serviceAdoption.PaperlessBilling.churn_yes_pct}%`;
  }

  // Churn by Contract Donut
  const contractLabels = Object.keys(summary.contractStats);
  const churnContractCounts = contractLabels.map(k => summary.contractStats[k].churned);

  createOrUpdateChart('chart-churn-contract', {
    type: 'doughnut',
    data: {
      labels: contractLabels,
      datasets: [{
        data: churnContractCounts,
        backgroundColor: ['#f59e0b', '#06b6d4', '#6366f1'],
        borderWidth: 2,
        borderColor: '#101624'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right' }
      },
      cutout: '68%'
    }
  });

  // Churn by Internet Donut
  const internetLabels = Object.keys(summary.internetStats);
  const churnInternetCounts = internetLabels.map(k => summary.internetStats[k].churned);

  createOrUpdateChart('chart-churn-internet', {
    type: 'doughnut',
    data: {
      labels: internetLabels,
      datasets: [{
        data: churnInternetCounts,
        backgroundColor: ['#06b6d4', '#f59e0b', '#64748b'],
        borderWidth: 2,
        borderColor: '#101624'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right' }
      },
      cutout: '68%'
    }
  });

  // Churn by Payment Method Bar
  const paymentLabels = Object.keys(summary.paymentStats);
  const churnPaymentCounts = paymentLabels.map(k => summary.paymentStats[k].churned);

  createOrUpdateChart('chart-churn-payment', {
    type: 'bar',
    data: {
      labels: paymentLabels.map(l => l.replace(' (automatic)', ' (Auto)')),
      datasets: [{
        label: 'Lost Customers',
        data: churnPaymentCounts,
        backgroundColor: '#06b6d4',
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { grid: { color: 'rgba(255,255,255,0.05)' } } }
    }
  });

  // Churn Rate by Monthly Billing Tier Area Chart
  const chargeLabels = Object.keys(summary.chargeBuckets);
  const churnRateBuckets = chargeLabels.map(k => summary.chargeBuckets[k].churnRate);

  createOrUpdateChart('chart-churn-charges', {
    type: 'line',
    data: {
      labels: chargeLabels,
      datasets: [{
        label: 'Churn Rate (%)',
        data: churnRateBuckets,
        borderColor: '#f43f5e',
        backgroundColor: 'rgba(244, 63, 94, 0.25)',
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          ticks: { callback: v => `${v}%` },
          grid: { color: 'rgba(255,255,255,0.05)' }
        }
      }
    }
  });
}

// Chart creation and reuse helper
function createOrUpdateChart(id, config) {
  const canvas = document.getElementById(id);
  if (!canvas) return;

  if (charts[id]) {
    charts[id].destroy();
  }
  charts[id] = new Chart(canvas, config);
}

// Interactive Filter Listeners
function setupFilterListeners() {
  const filters = ['gender', 'senior', 'partner', 'dependents', 'contract', 'internet', 'payment'];
  filters.forEach(f => {
    const el = document.getElementById(`filter-${f}`);
    if (el) el.addEventListener('change', onFilterChange);
  });

  const btnReset = document.getElementById('btn-reset-filters');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      filters.forEach(f => {
        const el = document.getElementById(`filter-${f}`);
        if (el) el.value = 'All';
      });
      onFilterChange();
    });
  }
}

// Filter Engine
function onFilterChange() {
  const gender = document.getElementById('filter-gender').value;
  const senior = document.getElementById('filter-senior').value;
  const partner = document.getElementById('filter-partner').value;
  const dependents = document.getElementById('filter-dependents').value;
  const contract = document.getElementById('filter-contract').value;
  const internet = document.getElementById('filter-internet').value;
  const payment = document.getElementById('filter-payment').value;

  filteredRecords = rawRecords.filter(r => {
    if (gender !== 'All' && r.gender !== gender) return false;
    if (senior !== 'All' && String(r.SeniorCitizen) !== senior) return false;
    if (partner !== 'All' && r.Partner !== partner) return false;
    if (dependents !== 'All' && r.Dependents !== dependents) return false;
    if (contract !== 'All' && r.Contract !== contract) return false;
    if (internet !== 'All' && r.InternetService !== internet) return false;
    if (payment !== 'All' && r.PaymentMethod !== payment) return false;
    return true;
  });

  currentPage = 1;
  renderTablePage();
  updateMetricsAndCharts();
}

// Recompute Analytics on Filter Change
function updateMetricsAndCharts() {
  const total = filteredRecords.length;
  if (total === 0) {
    updateKpiBanner(0, 0, 0, 0, 0, 0);
    return;
  }

  const churned = filteredRecords.filter(r => r.Churn === 'Yes').length;
  const retained = total - churned;
  const churnRate = (churned / total) * 100;
  const totalRev = filteredRecords.reduce((sum, r) => sum + (r.TotalCharges || 0), 0);
  const avgMonthly = filteredRecords.reduce((sum, r) => sum + (r.MonthlyCharges || 0), 0) / total;

  updateKpiBanner(total, churned, retained, churnRate, avgMonthly, totalRev);

  // Recompute summaries for charts
  const calcBreakdown = (key) => {
    const res = {};
    filteredRecords.forEach(r => {
      const v = r[key] || 'Unknown';
      if (!res[v]) res[v] = { total: 0, churned: 0 };
      res[v].total++;
      if (r.Churn === 'Yes') res[v].churned++;
    });
    return res;
  };

  const internetStats = calcBreakdown('InternetService');
  const contractStats = calcBreakdown('Contract');
  const paymentStats = calcBreakdown('PaymentMethod');

  // Buckets
  const chargeBuckets = {
    '$18 - $38': { total: 0, churn: 0, churnRate: 0 },
    '$38 - $58': { total: 0, churn: 0, churnRate: 0 },
    '$58 - $78': { total: 0, churn: 0, churnRate: 0 },
    '$78 - $98': { total: 0, churn: 0, churnRate: 0 },
    '$98 - $120': { total: 0, churn: 0, churnRate: 0 }
  };
  filteredRecords.forEach(r => {
    const mc = r.MonthlyCharges || 0;
    const isChurn = r.Churn === 'Yes';
    let b = '$18 - $38';
    if (mc >= 98) b = '$98 - $120';
    else if (mc >= 78) b = '$78 - $98';
    else if (mc >= 58) b = '$58 - $78';
    else if (mc >= 38) b = '$38 - $58';
    chargeBuckets[b].total++;
    if (isChurn) chargeBuckets[b].churn++;
  });
  Object.keys(chargeBuckets).forEach(k => {
    const tot = chargeBuckets[k].total;
    chargeBuckets[k].churnRate = tot > 0 ? (chargeBuckets[k].churn / tot) * 100 : 0;
  });

  const tenureBuckets = {
    '<1 yr (0-12m)': { total: 0, churn: 0 },
    '1-2 yrs (13-24m)': { total: 0, churn: 0 },
    '2-3 yrs (25-36m)': { total: 0, churn: 0 },
    '3-4 yrs (37-48m)': { total: 0, churn: 0 },
    '4-5 yrs (49-60m)': { total: 0, churn: 0 },
    '5-6 yrs (61-72m)': { total: 0, churn: 0 }
  };
  filteredRecords.forEach(r => {
    const t = r.tenure || 0;
    const isChurn = r.Churn === 'Yes';
    let b = '<1 yr (0-12m)';
    if (t > 60) b = '5-6 yrs (61-72m)';
    else if (t > 48) b = '4-5 yrs (49-60m)';
    else if (t > 36) b = '3-4 yrs (37-48m)';
    else if (t > 24) b = '2-3 yrs (25-36m)';
    else if (t > 12) b = '1-2 yrs (13-24m)';
    tenureBuckets[b].total++;
    if (isChurn) tenureBuckets[b].churn++;
  });

  // Services
  const services = ['OnlineSecurity', 'OnlineBackup', 'DeviceProtection', 'TechSupport', 'PaperlessBilling', 'StreamingTV', 'StreamingMovies', 'PhoneService', 'MultipleLines'];
  const serviceAdoption = {};
  const churnedRecords = filteredRecords.filter(r => r.Churn === 'Yes');
  services.forEach(s => {
    const yesTotal = filteredRecords.filter(r => r[s] === 'Yes').length;
    const yesChurn = churnedRecords.filter(r => r[s] === 'Yes').length;
    serviceAdoption[s] = {
      total_yes_pct: total > 0 ? ((yesTotal / total) * 100).toFixed(1) : 0,
      churn_yes_pct: churned > 0 ? ((yesChurn / churned) * 100).toFixed(1) : 0
    };
  });

  renderOverviewCharts({
    internetStats,
    contractStats,
    paymentStats,
    chargeBuckets,
    tenureBuckets
  });

  renderServicesTable(serviceAdoption);

  renderChurnDeepDive({
    internetStats,
    contractStats,
    paymentStats,
    chargeBuckets,
    serviceAdoption
  });
}

// TAB 3: Churn Simulator & Predictor
function setupSimulator() {
  const tenureInput = document.getElementById('sim-tenure');
  const chargesInput = document.getElementById('sim-charges');
  const tenureVal = document.getElementById('sim-tenure-val');
  const chargesVal = document.getElementById('sim-charges-val');

  tenureInput.addEventListener('input', () => {
    tenureVal.textContent = tenureInput.value;
    calculateRisk();
  });

  chargesInput.addEventListener('input', () => {
    chargesVal.textContent = parseFloat(chargesInput.value).toFixed(2);
    calculateRisk();
  });

  ['sim-contract', 'sim-internet', 'sim-payment', 'sim-tech-support', 'sim-online-security', 'sim-online-backup', 'sim-paperless', 'sim-partner', 'sim-senior']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', calculateRisk);
    });

  calculateRisk();
}

function calculateRisk() {
  const contract = document.getElementById('sim-contract').value;
  const internet = document.getElementById('sim-internet').value;
  const payment = document.getElementById('sim-payment').value;
  const tenure = parseInt(document.getElementById('sim-tenure').value, 10);
  const charges = parseFloat(document.getElementById('sim-charges').value);
  const techSupport = document.getElementById('sim-tech-support').checked;
  const onlineSecurity = document.getElementById('sim-online-security').checked;
  const onlineBackup = document.getElementById('sim-online-backup').checked;
  const paperless = document.getElementById('sim-paperless').checked;
  const partner = document.getElementById('sim-partner').checked;
  const senior = document.getElementById('sim-senior').checked;

  let riskScore = 26; // Base cohort churn rate
  const factors = [];

  // Contract weighting
  if (contract === 'Month-to-month') {
    riskScore += 24;
    factors.push('Month-to-month contract (+24% risk exposure)');
  } else if (contract === 'One year') {
    riskScore -= 12;
  } else if (contract === 'Two year') {
    riskScore -= 24;
  }

  // Internet weighting
  if (internet === 'Fiber optic') {
    riskScore += 18;
    factors.push('Fiber optic plan with high price sensitivity (+18% risk)');
  } else if (internet === 'No') {
    riskScore -= 16;
  }

  // Payment Method
  if (payment === 'Electronic check') {
    riskScore += 16;
    factors.push('Paying via Electronic Check without auto-pay (+16% risk)');
  } else if (payment.includes('automatic')) {
    riskScore -= 10;
  }

  // Tenure
  if (tenure <= 6) {
    riskScore += 22;
    factors.push('New customer in first 6 months (+22% risk)');
  } else if (tenure <= 12) {
    riskScore += 12;
    factors.push('Customer within first year (+12% risk)');
  } else if (tenure >= 36) {
    riskScore -= 16;
  }

  // Monthly charges
  if (charges >= 80) {
    riskScore += 10;
    factors.push('High monthly charges tier ($80+)');
  }

  // Service protections
  if (!techSupport && internet !== 'No') {
    riskScore += 10;
    factors.push('No Tech Support attached (+10% vulnerability)');
  } else if (techSupport) {
    riskScore -= 12;
  }

  if (!onlineSecurity && internet !== 'No') {
    riskScore += 10;
    factors.push('No Online Security attached (+10% vulnerability)');
  } else if (onlineSecurity) {
    riskScore -= 12;
  }

  if (onlineBackup) riskScore -= 6;
  if (paperless) riskScore += 6;
  if (partner) riskScore -= 8;
  if (senior) riskScore += 8;

  // Clamp 5% - 96%
  riskScore = Math.max(5, Math.min(96, Math.round(riskScore)));

  // Update UI
  const badgePct = document.getElementById('sim-risk-pct');
  const badgeLabel = document.getElementById('sim-risk-label');
  const barFill = document.getElementById('sim-risk-bar');
  const factorsList = document.getElementById('sim-factors-list');
  const actionText = document.getElementById('sim-action-text');

  badgePct.textContent = `${riskScore}%`;
  barFill.style.width = `${riskScore}%`;

  if (riskScore >= 65) {
    badgeLabel.textContent = 'CRITICAL RISK';
    badgeLabel.style.backgroundColor = 'rgba(244, 63, 94, 0.2)';
    badgeLabel.style.color = '#f43f5e';
    badgePct.style.color = '#f43f5e';
    barFill.style.backgroundColor = '#f43f5e';
    actionText.textContent = 'URGENT: Dispatch retention outreach immediately. Offer 1-year contract migration with $15 auto-pay bill credit, free Tech Support & Online Security bundle for 90 days.';
  } else if (riskScore >= 40) {
    badgeLabel.textContent = 'ELEVATED RISK';
    badgeLabel.style.backgroundColor = 'rgba(245, 158, 11, 0.2)';
    badgeLabel.style.color = '#f59e0b';
    badgePct.style.color = '#f59e0b';
    barFill.style.backgroundColor = '#f59e0b';
    actionText.textContent = 'MONITOR & ENGAGE: Introduce recurring Auto-Pay discount ($5/mo savings) and invite customer to activate complimentary Device Protection trial.';
  } else {
    badgeLabel.textContent = 'LOW RISK';
    badgeLabel.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
    badgeLabel.style.color = '#10b981';
    badgePct.style.color = '#10b981';
    barFill.style.backgroundColor = '#10b981';
    actionText.textContent = 'HEALTHY ACCOUNT: High retention likelihood. Eligible for value-add upsells (Streaming bundles or multi-device upgrades) at standard contract renewal.';
  }

  factorsList.innerHTML = factors.length > 0 
    ? factors.map(f => `<li>${f}</li>`).join('') 
    : '<li>Strong loyalty indicators (Long-term contract, automatic payments, active support bundle).</li>';
}

// TAB 4: Customer Table Search & Pagination
function setupTableSearchAndPagination() {
  const searchInput = document.getElementById('table-search');
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.toLowerCase().trim();
    if (!query) {
      filteredRecords = [...rawRecords];
    } else {
      filteredRecords = rawRecords.filter(r => 
        (r.customerID && r.customerID.toLowerCase().includes(query)) ||
        (r.Contract && r.Contract.toLowerCase().includes(query)) ||
        (r.PaymentMethod && r.PaymentMethod.toLowerCase().includes(query)) ||
        (r.InternetService && r.InternetService.toLowerCase().includes(query)) ||
        (r.gender && r.gender.toLowerCase().includes(query)) ||
        (r.Churn && r.Churn.toLowerCase().includes(query))
      );
    }
    currentPage = 1;
    renderTablePage();
  });

  document.getElementById('btn-prev-page').addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderTablePage();
    }
  });

  document.getElementById('btn-next-page').addEventListener('click', () => {
    const totalPages = Math.ceil(filteredRecords.length / PAGE_SIZE) || 1;
    if (currentPage < totalPages) {
      currentPage++;
      renderTablePage();
    }
  });
}

function renderTablePage() {
  const tbody = document.getElementById('table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const total = filteredRecords.length;
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const endIdx = Math.min(startIdx + PAGE_SIZE, total);
  const pageRecords = filteredRecords.slice(startIdx, endIdx);

  document.getElementById('table-showing-count').textContent = (endIdx - startIdx).toString();
  document.getElementById('table-total-count').textContent = total.toLocaleString();
  document.getElementById('page-indicator').textContent = `Page ${currentPage} of ${totalPages}`;

  document.getElementById('btn-prev-page').disabled = currentPage <= 1;
  document.getElementById('btn-next-page').disabled = currentPage >= totalPages;

  pageRecords.forEach(r => {
    const tr = document.createElement('tr');
    const isChurned = r.Churn === 'Yes';
    tr.innerHTML = `
      <td><strong>${r.customerID}</strong></td>
      <td>${r.gender}</td>
      <td>${r.tenure} mo</td>
      <td>${r.InternetService}</td>
      <td>${r.Contract}</td>
      <td>${(r.PaymentMethod || '').replace(' (automatic)', ' (Auto)')}</td>
      <td>$${parseFloat(r.MonthlyCharges || 0).toFixed(2)}</td>
      <td>$${parseFloat(r.TotalCharges || 0).toFixed(2)}</td>
      <td>
        <span class="badge-status ${isChurned ? 'churned' : 'retained'}">
          ${isChurned ? 'Churned' : 'Retained'}
        </span>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Export CSV Feature
function setupExportCsv() {
  const btn = document.getElementById('btn-export-csv');
  if (!btn) return;

  btn.addEventListener('click', () => {
    if (!filteredRecords || filteredRecords.length === 0) {
      alert('No records available to export.');
      return;
    }

    const headers = Object.keys(filteredRecords[0]);
    const csvRows = [headers.join(',')];

    filteredRecords.forEach(r => {
      const values = headers.map(h => {
        const val = r[h] !== undefined ? String(r[h]).replace(/"/g, '""') : '';
        return `"${val}"`;
      });
      csvRows.push(values.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `telco_churn_filtered_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
}

// Kick off when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);
