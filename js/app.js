/**
 * Main Application Orchestrator
 * 단축키(F-55), 시간 감지, 앱 초기화 담당
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. 컴포넌트 초기화
  window.TodoStore.init();
  window.CatMascot.init();
  window.UIManager.init();

  // 2. 키보드 단축키 등록 (PRD F-55)
  window.addEventListener('keydown', (e) => {
    const activeEl = document.activeElement;
    const isInputFocused =
      activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT');

    // Esc 키: 입력창 포커스 해제 및 상세 패널 닫기
    if (e.key === 'Escape') {
      if (isInputFocused) {
        activeEl.blur();
      }
      window.UIManager.closeDetailPanel();
      return;
    }

    // Ctrl+Z: 최근 삭제 실행 취소 (Undo)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
      if (!isInputFocused) {
        e.preventDefault();
        const res = window.TodoStore.undoLastDelete();
        if (res) {
          window.UIManager.hideUndoToast();
          if (window.Sound) window.Sound.playAdd();
        }
      }
      return;
    }

    // 텍스트 필드에 포커스되어 있는 동안은 단일 문자 단축키 비활성화
    if (isInputFocused) return;

    // N 키: 새 할 일 빠른 입력창 포커스 (F-01)
    if (e.key === 'n' || e.key === 'N') {
      e.preventDefault();
      const input = document.getElementById('quick-add-input');
      if (input) {
        input.focus();
        input.select();
      }
      return;
    }

    // / 키: 검색창 포커스
    if (e.key === '/') {
      e.preventDefault();
      window.UIManager.navigateTo('all', 'all');
      setTimeout(() => {
        const searchInput = document.getElementById('all-search-input');
        if (searchInput) {
          searchInput.focus();
        }
      }, 50);
      return;
    }
  });

  // 3. 주기적 시간 감지 (1분마다 밤 11시 / 날짜 변경 체크하여 고양이 상태 갱신)
  setInterval(() => {
    if (window.CatMascot) {
      window.CatMascot.updateState();
    }
  }, 60000);
});

