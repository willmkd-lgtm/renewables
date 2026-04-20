// ================================================
// Renewables 사업성 분석 계산기 v3
// - REC 가중치 별도 UI
// - 법인/개인 자동 분기 (단순경비율)
// - 누진세율표 자동 적용
// - 이용률 ↔ 시간/일 토글 (둘 다 표시)
// ================================================

let ASSUMPTIONS = null;
let currentResult = null;
let primaryUtilField = 'pct';  // 'pct' or 'hr'

async function loadAssumptions() {
  const res = await fetch('data/assumptions.json?t=' + Date.now());
  ASSUMPTIONS = await res.json();
  populateRECDropdown();
  applyAllDefaults();
  setupFieldToggles();
  recalculate();
}

function populateRECDropdown() {
  const select = document.getElementById('rec_type');
  const weights = ASSUMPTIONS.rec.weights;
  select.innerHTML = '';
  Object.entries(weights).forEach(([key, obj]) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = `${obj.name} (${obj.weight})`;
    if (key === 'ground_100kw_3mw') opt.selected = true;
    select.appendChild(opt);
  });
}

function applyAllDefaults() {
  const A = ASSUMPTIONS;
  
  document.getElementById('capacity_kw').value = 100;
  document.getElementById('capex_total').value = 230;
  document.getElementById('loan_amount').value = 161;
  document.getElementById('interest_rate').value = (A.loan.default_interest_rate * 100).toFixed(1);
  document.getElementById('grace_years').value = A.loan.default_grace_years;
  document.getElementById('repay_years').value = A.loan.default_repay_years;
  
  document.getElementById('smp_price').value = A.smp.annual_avg_krw_per_kwh.toFixed(2);
  document.getElementById('rec_price').value = A.rec.spot_avg_krw;
  updateREC();
  
  document.getElementById('utilization_pct').value = (A.operation.default_utilization * 100).toFixed(2);
  document.getElementById('utilization_hr').value = A.operation.default_hours_per_day.toFixed(2);
  document.getElementById('module_decay').value = (A.operation.module_decay_per_year * 100).toFixed(2);
  
  document.getElementById('opex_annual').value = A.operation.opex_default_m_krw_per_100kw;
  document.getElementById('rent').value = 0;
  document.getElementById('fee_ratio').value = (A.fees.default_ratio * 100).toFixed(1);
  document.getElementById('inflation').value = (A.financial.inflation * 100).toFixed(1);
  document.getElementById('wacc').value = (A.financial.wacc * 100).toFixed(1);
  
  updateCapacityUI();
  updateTaxUI();
}

// REC 가중치 자동 계산
function updateREC() {
  const type = document.getElementById('rec_type').value;
  const weight = ASSUMPTIONS.rec.weights[type].weight;
  const smp = parseFloat(document.getElementById('smp_price').value) || 0;
  const rec = parseFloat(document.getElementById('rec_price').value) || 0;
  
  const salesPrice = smp + (rec * weight / 1000);
  document.getElementById('rec_weight_display').textContent = weight.toFixed(1);
  document.getElementById('sales_price_display').textContent = salesPrice.toFixed(2) + '원/kWh';
  document.getElementById('computed_sales_price').value = salesPrice.toFixed(4);
}

function setupFieldToggles() {
  // 평균값 체크박스
  document.querySelectorAll('[data-avg-checkbox]').forEach(cb => {
    cb.addEventListener('change', () => {
      const targetId = cb.getAttribute('data-target');
      const field = document.getElementById(targetId);
      if (cb.checked) {
        field.disabled = true;
        field.style.opacity = '0.5';
        resetFieldToAverage(targetId);
      } else {
        field.disabled = false;
        field.style.opacity = '1';
        field.focus();
      }
      recalculate();
    });
  });
  
  // 이용률 주 입력 선택 (라디오)
  document.querySelectorAll('[name="util_primary"]').forEach(r => {
    r.addEventListener('change', () => {
      primaryUtilField = document.querySelector('[name="util_primary"]:checked').value;
      const pctField = document.getElementById('utilization_pct');
      const hrField = document.getElementById('utilization_hr');
      pctField.disabled = (primaryUtilField !== 'pct');
      hrField.disabled = (primaryUtilField !== 'hr');
      pctField.style.opacity = (primaryUtilField === 'pct') ? '1' : '0.5';
      hrField.style.opacity = (primaryUtilField === 'hr') ? '1' : '0.5';
      recalculate();
    });
  });
  
  // 이용률 % ↔ 시간/일 상호변환
  document.getElementById('utilization_pct').addEventListener('input', () => {
    if (primaryUtilField !== 'pct') return;
    const pct = parseFloat(document.getElementById('utilization_pct').value) || 0;
    document.getElementById('utilization_hr').value = (pct / 100 * 24).toFixed(2);
  });
  document.getElementById('utilization_hr').addEventListener('input', () => {
    if (primaryUtilField !== 'hr') return;
    const hr = parseFloat(document.getElementById('utilization_hr').value) || 0;
    document.getElementById('utilization_pct').value = (hr / 24 * 100).toFixed(2);
  });
  
  // 사업자 유형
  document.querySelectorAll('[name="biz_type"]').forEach(r => {
    r.addEventListener('change', () => {
      updateTaxUI();
      recalculate();
    });
  });
}

function updateTaxUI() {
  const type = document.querySelector('[name="biz_type"]:checked').value;
  const corpBox = document.getElementById('tax_corp_box');
  const personalBox = document.getElementById('tax_personal_box');
  
  if (type === 'corporate') {
    corpBox.style.display = 'block';
    personalBox.style.display = 'none';
  } else {
    corpBox.style.display = 'none';
    personalBox.style.display = 'block';
  }
}

function resetFieldToAverage(fieldId) {
  const A = ASSUMPTIONS;
  const cap = parseFloat(document.getElementById('capacity_kw').value) || 100;
  
  switch(fieldId) {
    case 'capex_total':
      if (cap <= 200) document.getElementById('capex_total').value = (cap / 100 * 230).toFixed(1);
      break;
    case 'utilization_pct':
      document.getElementById('utilization_pct').value = (A.operation.default_utilization * 100).toFixed(2);
      document.getElementById('utilization_hr').value = (A.operation.default_utilization * 24).toFixed(2);
      break;
    case 'utilization_hr':
      document.getElementById('utilization_hr').value = A.operation.default_hours_per_day.toFixed(2);
      document.getElementById('utilization_pct').value = (A.operation.default_hours_per_day / 24 * 100).toFixed(2);
      break;
    case 'module_decay':
      document.getElementById('module_decay').value = (A.operation.module_decay_per_year * 100).toFixed(2);
      break;
    case 'opex_annual':
      document.getElementById('opex_annual').value = (cap / 100 * A.operation.opex_default_m_krw_per_100kw).toFixed(2);
      break;
    case 'interest_rate':
      document.getElementById('interest_rate').value = (A.loan.default_interest_rate * 100).toFixed(1);
      break;
    case 'fee_ratio':
      document.getElementById('fee_ratio').value = (A.fees.default_ratio * 100).toFixed(1);
      break;
    case 'inflation':
      document.getElementById('inflation').value = (A.financial.inflation * 100).toFixed(1);
      break;
    case 'wacc':
      document.getElementById('wacc').value = (A.financial.wacc * 100).toFixed(1);
      break;
    case 'smp_price':
      document.getElementById('smp_price').value = A.smp.annual_avg_krw_per_kwh.toFixed(2);
      updateREC();
      break;
    case 'rec_price':
      document.getElementById('rec_price').value = A.rec.spot_avg_krw;
      updateREC();
      break;
  }
}

function updateCapacityUI() {
  const cap = parseFloat(document.getElementById('capacity_kw').value);
  const capexCb = document.querySelector('[data-target="capex_total"]');
  
  if (cap > 200) {
    capexCb.checked = false;
    capexCb.disabled = true;
    document.getElementById('capex_total').disabled = false;
    document.getElementById('capex_total').style.opacity = '1';
    document.getElementById('capex_warn').style.display = 'block';
  } else {
    capexCb.disabled = false;
    document.getElementById('capex_warn').style.display = 'none';
  }
  
  document.getElementById('large_project_warning').style.display = cap >= 1000 ? 'block' : 'none';
  
  // REC 가중치 용량별 자동 추천
  const recSelect = document.getElementById('rec_type');
  if (!recSelect.dataset.userChanged) {
    if (cap < 100) recSelect.value = 'ground_under_100kw';
    else if (cap <= 3000) recSelect.value = 'ground_100kw_3mw';
    else recSelect.value = 'ground_over_3mw';
    updateREC();
  }
  
  document.querySelectorAll('[data-avg-checkbox]:checked').forEach(cb => {
    resetFieldToAverage(cb.getAttribute('data-target'));
  });
}

function getInputs() {
  const cap = parseFloat(document.getElementById('capacity_kw').value) || 0;
  const utilization = primaryUtilField === 'pct'
    ? (parseFloat(document.getElementById('utilization_pct').value) || 0) / 100
    : (parseFloat(document.getElementById('utilization_hr').value) || 0) / 24;
  
  return {
    capacity_kw: cap,
    capex_total: parseFloat(document.getElementById('capex_total').value) || 0,
    smp_price: parseFloat(document.getElementById('smp_price').value) || 0,
    rec_price: parseFloat(document.getElementById('rec_price').value) || 0,
    rec_weight: ASSUMPTIONS.rec.weights[document.getElementById('rec_type').value].weight,
    sales_price: parseFloat(document.getElementById('computed_sales_price').value) || 0,
    utilization: utilization,
    module_decay: (parseFloat(document.getElementById('module_decay').value) || 0) / 100,
    opex_annual: parseFloat(document.getElementById('opex_annual').value) || 0,
    rent: parseFloat(document.getElementById('rent').value) || 0,
    loan_amount: parseFloat(document.getElementById('loan_amount').value) || 0,
    interest_rate: (parseFloat(document.getElementById('interest_rate').value) || 0) / 100,
    grace_years: parseInt(document.getElementById('grace_years').value) || 0,
    repay_years: parseInt(document.getElementById('repay_years').value) || 0,
    fee_ratio: (parseFloat(document.getElementById('fee_ratio').value) || 0) / 100,
    inflation: (parseFloat(document.getElementById('inflation').value) || 0) / 100,
    inflation_to_sales: document.getElementById('inflation_to_sales').checked,
    wacc: (parseFloat(document.getElementById('wacc').value) || 0) / 100,
    biz_type: document.querySelector('[name="biz_type"]:checked').value
  };
}

// 개인사업자 단순경비율 자동 선택
function getSimpleExpenseRate(revenue_won) {
  const bands = ASSUMPTIONS.financial.personal_simple_rate_bands;
  for (const b of bands) {
    if (revenue_won < b.max_revenue) return { rate: b.rate, desc: b.desc };
  }
  // 3.85억 이상 → 복식부기 (기준경비율)
  return { 
    rate: 1 - ASSUMPTIONS.financial.personal_standard_expense_rate, 
    desc: '3.85억 초과 (복식부기 의무)',
    is_bookkeeping: true
  };
}

// 종합소득세 누진 계산
function calcIncomeTax(taxable_income_won) {
  if (taxable_income_won <= 0) return 0;
  const brackets = ASSUMPTIONS.financial.income_tax_brackets;
  for (const b of brackets) {
    if (b.max === null || taxable_income_won <= b.max) {
      const base_tax = taxable_income_won * b.rate - b.deduction;
      return Math.max(0, base_tax) * (1 + ASSUMPTIONS.financial.local_income_tax_addon);
    }
  }
  return 0;
}

function calculate(inp) {
  const years = 20;
  const capex = inp.capex_total;
  const debt = Math.min(inp.loan_amount, capex);
  const equity = capex - debt;
  const loan_ratio = capex > 0 ? debt / capex : 0;
  const annual_principal = inp.repay_years > 0 ? debt / inp.repay_years : 0;
  const fee_amount = capex * inp.fee_ratio;
  const equity_with_fee = equity + fee_amount;
  const total_cash_need = capex + fee_amount;
  
  const results = [];
  let loan_balance = debt;
  let cumulative_fcff = -capex;
  let payback_year = null;
  let total_tax_20y = 0;
  
  for (let y = 1; y <= years; y++) {
    const module_eff = Math.pow(1 - inp.module_decay, y - 1);
    const generation_mwh = inp.capacity_kw / 1000 * inp.utilization * 8760 * module_eff;
    const generation_kwh = generation_mwh * 1000;
    
    const price_y = inp.inflation_to_sales 
      ? inp.sales_price * Math.pow(1 + inp.inflation, y - 1)
      : inp.sales_price;
    
    const revenue_mil = generation_kwh * price_y / 1_000_000;  // 백만원
    const revenue_won = revenue_mil * 1_000_000;               // 원
    
    const opex = inp.opex_annual * Math.pow(1 + inp.inflation, y - 1);
    const depreciation = capex / 20;
    const rent = inp.rent * Math.pow(1 + inp.inflation, y - 1);
    const cogs = depreciation + opex + rent;
    
    const ebit = revenue_mil - cogs;
    const interest = loan_balance * inp.interest_rate;
    const principal = y > inp.grace_years ? Math.min(annual_principal, loan_balance) : 0;
    const ebt = ebit - interest;
    
    // 세금 계산 (사업자 유형 분기)
    let tax_won = 0;
    let tax_desc = '';
    
    if (inp.biz_type === 'corporate') {
      // 법인: 단일세율 11%
      tax_won = Math.max(0, ebt * 1_000_000 * ASSUMPTIONS.financial.corporate_tax_rate);
      tax_desc = '법인세 11%';
    } else {
      // 개인: 단순경비율 → 누진세율
      const expenseInfo = getSimpleExpenseRate(revenue_won);
      
      if (expenseInfo.is_bookkeeping) {
        // 복식부기: 실제 소득 기준
        const taxable = ebt * 1_000_000;
        tax_won = calcIncomeTax(taxable);
        tax_desc = `복식부기: ${(1-ASSUMPTIONS.financial.personal_standard_expense_rate)*100}% 소득율`;
      } else {
        // 단순경비율
        const deemed_income = revenue_won * (1 - expenseInfo.rate);
        tax_won = calcIncomeTax(deemed_income);
        tax_desc = `단순경비율 ${(expenseInfo.rate * 100).toFixed(1)}%`;
      }
    }
    
    const tax_mil = tax_won / 1_000_000;
    const net_income = ebt - tax_mil;
    total_tax_20y += tax_mil;
    
    const effective_tax_rate = ebt > 0 ? tax_mil / ebt : 0;
    const noplat = ebit * (1 - effective_tax_rate);
    const fcff = noplat + depreciation;
    const fcfe = fcff - interest * (1 - effective_tax_rate) - principal;
    
    results.push({
      year: y, generation_mwh, revenue: revenue_mil, opex, depreciation, cogs, ebit,
      interest, principal, loan_balance, ebt, tax: tax_mil, net_income, fcff, fcfe,
      tax_desc, effective_tax_rate, price_y
    });
    
    loan_balance = Math.max(0, loan_balance - principal);
    const prev_cum = cumulative_fcff;
    cumulative_fcff += fcff;
    if (payback_year === null && cumulative_fcff >= 0 && fcff > 0) {
      payback_year = y - 1 + Math.abs(prev_cum) / fcff;
    }
  }
  
  const fcff_flow = [-capex, ...results.map(r => r.fcff)];
  const fcfe_flow = [-equity, ...results.map(r => r.fcfe)];
  
  return {
    total_capex: capex, fee_amount, total_cash_need,
    debt, equity, equity_with_fee, loan_ratio, annual_principal,
    project_irr: calculateIRR(fcff_flow),
    equity_irr: calculateIRR(fcfe_flow),
    npv: calculateNPV(fcff_flow, inp.wacc),
    payback: payback_year,
    total_tax_20y,
    avg_annual_tax: total_tax_20y / 20,
    year1_tax: results[0].tax,
    year2_tax: results[1].tax,
    yearly: results, inputs: inp
  };
}

function calculateIRR(cf, guess = 0.1) {
  let rate = guess;
  for (let i = 0; i < 200; i++) {
    let npv = 0, dnpv = 0;
    for (let t = 0; t < cf.length; t++) {
      const d = Math.pow(1 + rate, t);
      npv += cf[t] / d;
      dnpv -= t * cf[t] / (d * (1 + rate));
    }
    if (Math.abs(dnpv) < 1e-10) return null;
    const newRate = rate - npv / dnpv;
    if (!isFinite(newRate)) return null;
    if (Math.abs(newRate - rate) < 1e-8) return newRate;
    rate = Math.max(-0.99, newRate);
  }
  return rate;
}

function calculateNPV(cf, r) {
  return cf.reduce((s, c, t) => s + c / Math.pow(1 + r, t), 0);
}

function recalculate() {
  if (!ASSUMPTIONS) return;
  updateREC();
  const inp = getInputs();
  const r = calculate(inp);
  currentResult = r;
  
  document.getElementById('r_project_irr').textContent = r.project_irr !== null ? (r.project_irr * 100).toFixed(2) + '%' : 'N/A';
  document.getElementById('r_equity_irr').textContent = r.equity_irr !== null ? (r.equity_irr * 100).toFixed(2) + '%' : 'N/A';
  document.getElementById('r_npv').textContent = r.npv.toFixed(1) + ' 백만원';
  document.getElementById('r_payback').textContent = r.payback !== null ? r.payback.toFixed(1) + '년' : '회수 불가';
  document.getElementById('r_equity').textContent = r.equity.toFixed(1) + ' 백만원';
  document.getElementById('r_equity_with_fee').textContent = r.equity_with_fee.toFixed(1) + ' 백만원';
  document.getElementById('r_total_capex').textContent = r.total_capex.toFixed(1) + ' 백만원';
  document.getElementById('r_fee').textContent = r.fee_amount.toFixed(1) + ' 백만원';
  document.getElementById('r_total_need').textContent = r.total_cash_need.toFixed(1) + ' 백만원';
  
  // 세금 카드
  document.getElementById('r_year1_tax').textContent = (r.year1_tax * 1_000_000 / 10000).toFixed(0) + '만원';
  document.getElementById('r_year2_tax').textContent = (r.year2_tax * 1_000_000 / 10000).toFixed(0) + '만원';
  document.getElementById('r_avg_tax').textContent = (r.avg_annual_tax * 1_000_000 / 10000).toFixed(0) + '만원';
  document.getElementById('r_total_tax').textContent = r.total_tax_20y.toFixed(1) + ' 백만원';
  document.getElementById('r_tax_desc').textContent = r.yearly[0].tax_desc;
  
  updateChart(r);
  updateTable(r);
}

let chartInstance = null;
function updateChart(r) {
  const ctx = document.getElementById('cashflowChart');
  if (!ctx) return;
  const labels = r.yearly.map(y => y.year + '년');
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: '매출', data: r.yearly.map(y => y.revenue), backgroundColor: 'rgba(59,130,246,0.6)', borderColor: '#3b82f6', borderWidth: 1 },
        { label: '순이익', data: r.yearly.map(y => y.net_income), backgroundColor: 'rgba(16,185,129,0.6)', borderColor: '#10b981', borderWidth: 1 },
        { label: 'FCFE', data: r.yearly.map(y => y.fcfe), type: 'line', borderColor: '#f59e0b', backgroundColor: 'transparent', borderWidth: 3, tension: 0.3, pointRadius: 3 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#f1f5f9' } },
        tooltip: { backgroundColor: 'rgba(15,23,42,0.95)', callbacks: { label: c => c.dataset.label + ': ' + c.parsed.y.toFixed(1) + ' 백만원' } }
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8', callback: v => v + '백만' } }
      }
    }
  });
}

function updateTable(r) {
  const tbody = document.getElementById('yearlyTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  r.yearly.forEach(y => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${y.year}</td>
      <td style="text-align:right">${y.generation_mwh.toFixed(1)}</td>
      <td style="text-align:right">${y.revenue.toFixed(2)}</td>
      <td style="text-align:right">${y.cogs.toFixed(2)}</td>
      <td style="text-align:right">${y.ebit.toFixed(2)}</td>
      <td style="text-align:right">${y.interest.toFixed(2)}</td>
      <td style="text-align:right; color:#f59e0b">${y.tax.toFixed(2)}</td>
      <td style="text-align:right">${y.net_income.toFixed(2)}</td>
      <td style="text-align:right; color:#10b981; font-weight:600">${y.fcfe.toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function downloadPDF() {
  alert('PDF 저장은 회원가입 기능 구축 후 제공됩니다. 지금은 브라우저 인쇄(Ctrl+P)로 저장하세요.');
  window.print();
}

document.addEventListener('DOMContentLoaded', () => {
  loadAssumptions();
  
  document.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('input', () => {
      if (el.id === 'capacity_kw') updateCapacityUI();
      if (el.id === 'rec_type') el.dataset.userChanged = 'true';
      if (el.id === 'smp_price' || el.id === 'rec_price' || el.id === 'rec_type') updateREC();
      recalculate();
    });
  });
  
  document.getElementById('btn_default_loan').addEventListener('click', () => {
    const capex = parseFloat(document.getElementById('capex_total').value) || 0;
    document.getElementById('loan_amount').value = (capex * 0.7).toFixed(2);
    document.getElementById('grace_years').value = 2;
    document.getElementById('repay_years').value = 18;
    document.getElementById('interest_rate').value = 5.0;
    const cb = document.querySelector('[data-target="interest_rate"]');
    if (cb) { cb.checked = true; document.getElementById('interest_rate').disabled = true; document.getElementById('interest_rate').style.opacity = '0.5'; }
    recalculate();
  });
  
  document.getElementById('btn_pdf').addEventListener('click', downloadPDF);
});
