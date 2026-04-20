// Renewables - 공통 데이터 로드 스크립트
(async function() {
  try {
    const res = await fetch('/data/latest.json?t=' + Date.now());
    if (!res.ok) throw new Error('데이터를 불러올 수 없습니다');
    const data = await res.json();
    window.__renewablesData = data;

    // 갱신 시각
    const upd = document.getElementById('updated-time');
    if (upd) {
      const d = data.latest.date;
      upd.textContent = `마지막 업데이트: ${d} (데이터 기준일)`;
    }

    // SMP 값
    const smpVal = document.getElementById('smp-value');
    if (smpVal) {
      smpVal.textContent = data.latest.smp.avg.toFixed(2);
      const ch = document.getElementById('smp-change');
      if (ch) {
        const pct = data.latest.smp.change_pct;
        ch.textContent = (pct >= 0 ? '▲ ' : '▼ ') + Math.abs(pct).toFixed(2) + '%';
        ch.className = 'change ' + (pct >= 0 ? 'up' : 'down');
      }
    }

    // SMP 최대·최소 (대시보드용)
    const smpMax = document.getElementById('smp-max');
    if (smpMax) smpMax.textContent = data.latest.smp.max.toFixed(2);
    const smpMin = document.getElementById('smp-min');
    if (smpMin) smpMin.textContent = data.latest.smp.min.toFixed(2);

    // REC 값
    const recVal = document.getElementById('rec-value');
    if (recVal) {
      recVal.textContent = data.latest.rec.price.toLocaleString();
      const ch = document.getElementById('rec-change');
      if (ch) {
        const pct = data.latest.rec.change_pct;
        ch.textContent = (pct >= 0 ? '▲ ' : '▼ ') + Math.abs(pct).toFixed(2) + '%';
        ch.className = 'change ' + (pct >= 0 ? 'up' : 'down');
      }
    }

    // 30일 통계
    const sAvg = document.getElementById('stat-avg');
    if (sAvg) sAvg.textContent = data.stats_30d.smp_avg.toFixed(1);
    const sMax = document.getElementById('stat-max');
    if (sMax) sMax.textContent = data.stats_30d.smp_max.toFixed(1);
    const sMin = document.getElementById('stat-min');
    if (sMin) sMin.textContent = data.stats_30d.smp_min.toFixed(1);

    // 대시보드 차트 이벤트
    document.dispatchEvent(new CustomEvent('renewablesDataLoaded', { detail: data }));

  } catch (err) {
    console.error('데이터 로드 실패:', err);
    const upd = document.getElementById('updated-time');
    if (upd) upd.textContent = '⚠️ 데이터 로드 실패';
  }
})();

