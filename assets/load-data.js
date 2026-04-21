// Renewables - 데이터 로더
// data/chart.json을 읽어와서 renewablesDataLoaded 이벤트 발생

(async function loadRenewablesData() {
  try {
    // 캐시 방지를 위해 쿼리스트링 추가
    const response = await fetch('/data/chart.json?t=' + Date.now());
    if (!response.ok) throw new Error('HTTP ' + response.status);
    
    const data = await response.json();
    
    // dashboard.js가 기다리는 이벤트 발생
    document.dispatchEvent(new CustomEvent('renewablesDataLoaded', { 
      detail: data 
    }));
    
    console.log('[Renewables] 데이터 로드 완료:', data.chart?.length + '일치');
  } catch (err) {
    console.error('[Renewables] 데이터 로드 실패:', err);
    
    // 로드 실패 시 사용자에게 안내 표시
    const tbody = document.getElementById('tableBody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:40px; color:#94a3b8;">
        ⏳ 데이터 로딩에 실패했습니다. 잠시 후 다시 시도해주세요.
      </td></tr>`;
    }
  }
})();
