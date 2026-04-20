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
  const capex
