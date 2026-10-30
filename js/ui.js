/**
 * UI Renderer and Event Controller
 * PRD 5개 화면 및 PC 3단/모바일 바텀시트 반응형 레이아웃 구현
 */

(function () {
  class UIManager {
    constructor() {
      this.currentView = 'today'; // 'today' | 'all' | 'lists' | 'settings' | 'trash'
      this.activeFilter = 'all'; // 전체 뷰 내 하위 필터: 'all' | 'inbox' | 'upcoming' | 'completed' | 'list:<id>'
      this.searchQuery = '';
      this.sortBy = 'priority'; // 'priority' | 'due' | 'created'
      this.selectedTaskId = null; // 상세 패널에 표시 중인 Task ID

      const now = new Date();
      this.calYear = now.getFullYear();
      this.calMonth = now.getMonth();

      this.elements = {};
    }

    init() {
      this.cacheDOMElements();
      this.bindGlobalEvents();
      this.render();

      // 스토어 변경 구독
      window.TodoStore.subscribe(() => {
        this.render();
      });
    }

    cacheDOMElements() {
      this.elements = {
        app: document.getElementById('app'),
        viewTitle: document.getElementById('view-title'),
        viewSubtitle: document.getElementById('view-subtitle'),
        contentArea: document.getElementById('main-content-area'),
        detailPanel: document.getElementById('detail-panel-container'),
        quickAddInput: document.getElementById('quick-add-input'),
        quickAddBtn: document.getElementById('quick-add-submit-btn'),
        quickAddListSelect: document.getElementById('quick-add-list-select'),
        quickAddDueSelect: document.getElementById('quick-add-due-select'),
        progressBarFill: document.getElementById('progress-bar-fill'),
        progressText: document.getElementById('progress-text'),
        undoToast: document.getElementById('undo-toast'),
        undoBtn: document.getElementById('undo-btn'),
        undoText: document.getElementById('undo-text'),
        scanlineOverlay: document.getElementById('scanline-overlay'),
        navButtons: document.querySelectorAll('[data-nav-target]')
      };
    }

    bindGlobalEvents() {
      // 1. 네비게이션 버튼들
      document.querySelectorAll('[data-nav-target]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const target = btn.getAttribute('data-nav-target');
          const filter = btn.getAttribute('data-nav-filter') || 'all';
          this.navigateTo(target, filter);
        });
      });

      // 2. 빠른 추가 폼
      const quickAddForm = document.getElementById('quick-add-form');
      if (quickAddForm) {
        quickAddForm.addEventListener('submit', (e) => {
          e.preventDefault();
          this.handleQuickAdd();
        });
      }

      // 3. 실행 취소 (Undo) 버튼
      if (this.elements.undoBtn) {
        this.elements.undoBtn.addEventListener('click', () => {
          const res = window.TodoStore.undoLastDelete();
          if (res) {
            this.hideUndoToast();
            if (window.Sound) window.Sound.playAdd();
          }
        });
      }

      // 4. 모바일 상세 닫기 배경 클릭
      document.addEventListener('click', (e) => {
        if (e.target.matches('.modal-backdrop') || e.target.closest('.close-detail-btn')) {
          this.closeDetailPanel();
        }
      });
    }

    // 네비게이션 화면 전환
    navigateTo(view, filter = 'all') {
      this.currentView = view;
      this.activeFilter = filter;

      // 활성 네비 버튼 스타일 갱신
      document.querySelectorAll('[data-nav-target]').forEach((btn) => {
        const target = btn.getAttribute('data-nav-target');
        const f = btn.getAttribute('data-nav-filter') || 'all';
        if (target === view && (view !== 'all' || f === filter)) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });

      this.render();
    }

    // 빠른 추가 처리 (F-01 5초 내 추가)
    handleQuickAdd() {
      const input = this.elements.quickAddInput;
      if (!input) return;
      const title = input.value.trim();

      if (!title) {
        // 빈 입력 흔들림 피드백 (PRD 8.2)
        input.classList.remove('shake-input');
        void input.offsetWidth;
        input.classList.add('shake-input');
        return;
      }

      let listId = 'inbox';
      if (this.elements.quickAddListSelect) {
        listId = this.elements.quickAddListSelect.value || 'inbox';
      }

      // 빠른 마감일 선택 옵션 반영
      let dueDate = null;
      const dueOpt = this.elements.quickAddDueSelect ? this.elements.quickAddDueSelect.value : 'today';
      if (dueOpt === 'today') {
        dueDate = window.TodoStore.getTodayStr();
      } else if (dueOpt === 'tomorrow') {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        dueDate = tomorrow.toISOString().slice(0, 10);
      } else {
        dueDate = null;
      }

      const created = window.TodoStore.addTask({
        title,
        dueDate,
        listId
      });

      if (created) {
        input.value = '';
        input.focus(); // 연속 입력 유지
        if (window.Sound) window.Sound.playAdd();
      }
    }

    // 실행 취소 토스트 표시 (F-04)
    showUndoToast(taskTitle) {
      if (!this.elements.undoToast) return;
      this.elements.undoText.textContent = `"${taskTitle.slice(0, 15)}..." 삭제됨`;
      this.elements.undoToast.classList.add('visible');

      if (this.undoTimeout) clearTimeout(this.undoTimeout);
      this.undoTimeout = setTimeout(() => {
        this.hideUndoToast();
      }, 5000);
    }

    hideUndoToast() {
      if (this.elements.undoToast) {
        this.elements.undoToast.classList.remove('visible');
      }
    }

    // 메인 렌더 함수
    render() {
      this.applySettingsToDOM();
      this.renderCatAndProgress();
      this.renderQuickAddLists();

      switch (this.currentView) {
        case 'today':
          this.renderTodayView();
          break;
        case 'all':
          this.renderAllView();
          break;
        case 'lists':
          this.renderListsView();
          break;
        case 'settings':
          this.renderSettingsView();
          break;
        case 'trash':
          this.renderTrashView();
          break;
        default:
          this.renderTodayView();
      }

      this.renderDetailPanel();
    }

    // 설정 반영 (스캔라인, 폰트 등)
    applySettingsToDOM() {
      const settings = window.TodoStore.settings;
      if (this.elements.scanlineOverlay) {
        this.elements.scanlineOverlay.style.display = settings.scanlinesEnabled ? 'block' : 'none';
      }
      if (window.Sound) {
        window.Sound.setEnabled(settings.soundEnabled);
      }
    }

    // 상단 고양이 및 달성률 바 렌더링 (F-30, F-31)
    renderCatAndProgress() {
      const stats = window.TodoStore.getTodayStats();

      // 진행 바 업데이트
      if (this.elements.progressBarFill) {
        this.elements.progressBarFill.style.width = `${stats.percent}%`;
      }
      if (this.elements.progressText) {
        this.elements.progressText.innerHTML = `오늘 달성률: <span class="pixel-highlight">${stats.completed}/${stats.total}</span> (${stats.percent}%)`;
      }

      // 고양이 상태 갱신
      if (window.CatMascot) {
        window.CatMascot.updateState();
      }
    }

    // 빠른 추가 드롭다운 목록 갱신
    renderQuickAddLists() {
      const select = this.elements.quickAddListSelect;
      if (!select) return;

      const currentVal = select.value;
      const lists = window.TodoStore.lists;

      select.innerHTML = lists
        .map((l) => `<option value="${l.id}" ${l.id === currentVal ? 'selected' : ''}>📁 ${this.escape(l.name)}</option>`)
        .join('');
    }

    // 1. [홈 - 오늘 보기] 화면 (PRD 5.2)
    renderTodayView() {
      if (this.elements.viewTitle) this.elements.viewTitle.textContent = '오늘 할 일 (Today)';
      if (this.elements.viewSubtitle) {
        const todayStr = window.TodoStore.getTodayStr();
        this.elements.viewSubtitle.textContent = `${todayStr} 기준`;
      }

      const overdueTasks = window.TodoStore.getOverdueTasks();
      const todayTasks = window.TodoStore.getTodayTasks().filter((t) => t.dueDate === window.TodoStore.getTodayStr());

      let html = '';

      // 1-1. 기한 지난 항목 경고 배너 & 일괄 처리 (PRD F-22)
      if (overdueTasks.length > 0) {
        html += `
          <div class="overdue-banner-container pixel-box-coral">
            <div class="overdue-header">
              <span class="overdue-icon">⚠️</span>
              <div class="overdue-text-group">
                <span class="overdue-title">기한 지난 할 일이 ${overdueTasks.length}개 있어요!</span>
                <span class="overdue-sub">"괜찮아, 다시 잡아보자냥!"</span>
              </div>
              <div class="overdue-actions">
                <button type="button" class="pixel-btn pixel-btn-sm pixel-btn-mint" id="reschedule-overdue-btn">
                  오늘로 모두 옮기기
                </button>
                <button type="button" class="pixel-btn pixel-btn-sm pixel-btn-dark" id="delete-overdue-btn">
                  일괄 정리
                </button>
              </div>
            </div>
            <div class="overdue-list">
              ${overdueTasks.map((t) => this.renderTaskCard(t, true)).join('')}
            </div>
          </div>
        `;
      }

      // 1-2. 오늘 할 일 목록
      html += `
        <div class="task-section">
          <div class="section-header">
            <span class="section-title">✨ 오늘의 할 일 목록</span>
            <span class="section-count">${todayTasks.length}개</span>
          </div>
      `;

      if (todayTasks.length === 0 && overdueTasks.length === 0) {
        html += `
          <div class="empty-state-box">
            <div class="empty-cat-art">(=^･ω･^=)💤</div>
            <p class="empty-title">오늘 예정된 할 일이 없습니다냥!</p>
            <p class="empty-desc">아래 입력창에서 5초 만에 새로운 할 일을 적어보거나 편안한 휴식을 즐겨보세요.</p>
          </div>
        `;
      } else {
        html += `<div class="task-card-list">
          ${todayTasks.map((t) => this.renderTaskCard(t)).join('')}
        </div>`;
      }

      html += `</div>`;
      this.elements.contentArea.innerHTML = html;

      // 일괄 처리 이벤트 바인딩
      const rescheduleBtn = document.getElementById('reschedule-overdue-btn');
      if (rescheduleBtn) {
        rescheduleBtn.addEventListener('click', () => {
          const count = window.TodoStore.rescheduleOverdueToToday();
          if (window.Sound) window.Sound.playAdd();
          if (window.CatMascot) {
            window.CatMascot.setBubbleText(`${count}개의 할 일을 오늘로 옮겨왔다냥! 다시 시작이다냥!`);
          }
        });
      }

      const deleteOverdueBtn = document.getElementById('delete-overdue-btn');
      if (deleteOverdueBtn) {
        deleteOverdueBtn.addEventListener('click', () => {
          if (confirm('기한 지난 미완료 할 일들을 휴지통으로 보낼까요?')) {
            window.TodoStore.deleteOverdueTasks();
            if (window.Sound) window.Sound.playDelete();
          }
        });
      }

      this.bindTaskCardEvents();
    }

    // 2. [전체 목록] 화면 (PRD 5.2)
    renderAllView() {
      if (this.elements.viewTitle) this.elements.viewTitle.textContent = '전체 할 일 목록';
      if (this.elements.viewSubtitle) this.elements.viewSubtitle.textContent = '모든 할 일, 예정, 카테고리별 조회';

      const lists = window.TodoStore.lists;
      let tasks = window.TodoStore.getActiveTasks();

      // 필터 적용
      if (this.activeFilter === 'inbox') {
        tasks = window.TodoStore.getInboxTasks();
      } else if (this.activeFilter === 'upcoming') {
        tasks = window.TodoStore.getUpcomingTasks();
      } else if (this.activeFilter === 'completed') {
        tasks = window.TodoStore.getCompletedTasks();
      } else if (this.activeFilter.startsWith('list:')) {
        const listId = this.activeFilter.replace('list:', '');
        tasks = tasks.filter((t) => t.listId === listId);
      }

      // 검색어 적용 (F-23)
      if (this.searchQuery) {
        const q = this.searchQuery.toLowerCase();
        tasks = tasks.filter((t) => t.title.toLowerCase().includes(q) || (t.note && t.note.toLowerCase().includes(q)));
      }

      // 정렬 적용 (F-24)
      tasks.sort((a, b) => {
        // 미완료가 위로
        if (a.completed !== b.completed) return a.completed ? 1 : -1;

        if (this.sortBy === 'priority') {
          return b.priority - a.priority; // 높은 우선순위 우선
        } else if (this.sortBy === 'due') {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          const dueA = a.dueDate + ' ' + (a.dueTime || '23:59');
          const dueB = b.dueDate + ' ' + (b.dueTime || '23:59');
          return dueA.localeCompare(dueB);
        } else {
          return new Date(b.createdAt) - new Date(a.createdAt);
        }
      });

      let html = `
        <div class="all-view-toolbar">
          <!-- 상단 탭 / 필터 필터바 -->
          <div class="filter-chip-row">
            <button type="button" class="pixel-chip ${this.activeFilter === 'all' ? 'active' : ''}" data-filter="all">전체</button>
            <button type="button" class="pixel-chip ${this.activeFilter === 'inbox' ? 'active' : ''}" data-filter="inbox">📥 인박스</button>
            <button type="button" class="pixel-chip ${this.activeFilter === 'upcoming' ? 'active' : ''}" data-filter="upcoming">📅 예정</button>
            <button type="button" class="pixel-chip ${this.activeFilter === 'completed' ? 'active' : ''}" data-filter="completed">✅ 완료됨</button>
            ${lists
              .filter((l) => !l.isDefault)
              .map(
                (l) => `
                <button type="button" class="pixel-chip ${this.activeFilter === 'list:' + l.id ? 'active' : ''}" data-filter="list:${l.id}" style="--chip-color: ${l.color}">
                  📁 ${this.escape(l.name)}
                </button>
              `
              )
              .join('')}
          </div>

          <!-- 검색 및 정렬 바 -->
          <div class="search-sort-bar">
            <div class="search-input-wrapper">
              <span class="search-icon">${window.Icons.search}</span>
              <input type="text" id="all-search-input" class="pixel-input search-input" placeholder="검색어 입력 (제목, 메모)..." value="${this.escape(
                this.searchQuery
              )}">
              ${this.searchQuery ? `<button type="button" id="clear-search-btn" class="clear-search-btn">✕</button>` : ''}
            </div>
            <div class="sort-select-wrapper">
              <label for="all-sort-select">정렬:</label>
              <select id="all-sort-select" class="pixel-select sort-select">
                <option value="priority" ${this.sortBy === 'priority' ? 'selected' : ''}>우선순위 높은순</option>
                <option value="due" ${this.sortBy === 'due' ? 'selected' : ''}>마감일 임박순</option>
                <option value="created" ${this.sortBy === 'created' ? 'selected' : ''}>최근 등록순</option>
              </select>
            </div>
          </div>
        </div>

        <div class="task-section">
          <div class="section-header">
            <span class="section-title">조회 결과 (${tasks.length}개)</span>
          </div>
      `;

      if (tasks.length === 0) {
        html += `
          <div class="empty-state-box">
            <div class="empty-cat-art">(=･ω･=)?</div>
            <p class="empty-title">조건에 맞는 할 일이 없다냥!</p>
            <p class="empty-desc">검색어나 선택된 필터를 확인해보세요.</p>
          </div>
        `;
      } else {
        html += `<div class="task-card-list">
          ${tasks.map((t) => this.renderTaskCard(t)).join('')}
        </div>`;
      }

      html += `</div>`;
      this.elements.contentArea.innerHTML = html;

      // 필터 칩 클릭 이벤트
      document.querySelectorAll('[data-filter]').forEach((chip) => {
        chip.addEventListener('click', () => {
          this.activeFilter = chip.getAttribute('data-filter');
          this.renderAllView();
        });
      });

      // 검색창 이벤트
      const searchInput = document.getElementById('all-search-input');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          this.searchQuery = e.target.value;
          this.renderAllView();
        });
      }

      const clearSearchBtn = document.getElementById('clear-search-btn');
      if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
          this.searchQuery = '';
          this.renderAllView();
        });
      }

      // 정렬 셀렉트 이벤트
      const sortSelect = document.getElementById('all-sort-select');
      if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
          this.sortBy = e.target.value;
          this.renderAllView();
        });
      }

      this.bindTaskCardEvents();
    }

    // 3. [목록 관리] 화면 (PRD 화면 4)
    renderListsView() {
      if (this.elements.viewTitle) this.elements.viewTitle.textContent = '목록(분류) 관리';
      if (this.elements.viewSubtitle) this.elements.viewSubtitle.textContent = '과목, 업무, 취미 등 나만의 할 일 분류 만들기';

      const lists = window.TodoStore.lists;
      const tasks = window.TodoStore.getActiveTasks();

      let html = `
        <div class="lists-manager-container">
          <!-- 새 목록 만들기 카드 -->
          <div class="pixel-card new-list-card">
            <h3 class="card-heading">➕ 새 목록 만들기</h3>
            <form id="new-list-form" class="new-list-form">
              <input type="text" id="new-list-name" class="pixel-input" placeholder="목록 이름 (예: 독서, 코딩, 운동)..." required maxlength="30">
              <div class="color-picker-row">
                <label>테마 색상:</label>
                <div class="preset-colors">
                  ${['#B794F6', '#FF9EC7', '#8FE3C0', '#FFF3D6', '#FF7A8A', '#72DDF7']
                    .map(
                      (c, i) => `
                    <label class="color-option">
                      <input type="radio" name="list-color" value="${c}" ${i === 0 ? 'checked' : ''}>
                      <span class="color-swatch" style="background-color: ${c}"></span>
                    </label>
                  `
                    )
                    .join('')}
                </div>
              </div>
              <button type="submit" class="pixel-btn pixel-btn-lavender">목록 추가</button>
            </form>
          </div>

          <!-- 등록된 목록 리스트 -->
          <div class="lists-grid">
            ${lists
              .map((list) => {
                const count = tasks.filter((t) => t.listId === list.id && !t.completed).length;
                return `
                <div class="pixel-card list-item-card" style="border-left: 6px solid ${list.color};">
                  <div class="list-card-main">
                    <div class="list-card-color-dot" style="background-color: ${list.color}"></div>
                    <div class="list-card-info">
                      <span class="list-card-name">${this.escape(list.name)}</span>
                      <span class="list-card-badge">${count}개 진행 중</span>
                    </div>
                  </div>
                  <div class="list-card-actions">
                    ${
                      list.isDefault
                        ? `<span class="default-badge">기본</span>`
                        : `<button type="button" class="pixel-btn-icon delete-list-btn" data-list-id="${list.id}" title="목록 삭제">✕</button>`
                    }
                  </div>
                </div>
              `;
              })
              .join('')}
          </div>
        </div>
      `;

      this.elements.contentArea.innerHTML = html;

      // 새 목록 폼 이벤트
      const form = document.getElementById('new-list-form');
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const nameInput = document.getElementById('new-list-name');
          const colorInput = document.querySelector('input[name="list-color"]:checked');
          const name = nameInput.value.trim();
          const color = colorInput ? colorInput.value : '#B794F6';

          if (name) {
            window.TodoStore.addList(name, color);
            nameInput.value = '';
            if (window.Sound) window.Sound.playAdd();
            this.renderListsView();
          }
        });
      }

      // 목록 삭제 이벤트
      document.querySelectorAll('.delete-list-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-list-id');
          if (confirm('이 목록을 삭제할까요? 포함된 할 일은 [인박스]로 이동됩니다.')) {
            window.TodoStore.deleteList(id);
            if (window.Sound) window.Sound.playDelete();
            this.renderListsView();
          }
        });
      });
    }

    // 4. [휴지통] 화면 (PRD F-53)
    renderTrashView() {
      if (this.elements.viewTitle) this.elements.viewTitle.textContent = '휴지통';
      if (this.elements.viewSubtitle) this.elements.viewSubtitle.textContent = '삭제된 항목 복구 또는 영구 삭제 (30일 보관)';

      const trashTasks = window.TodoStore.getTrashTasks();

      let html = `
        <div class="trash-view-container">
          <div class="trash-top-bar">
            <span>삭제된 할 일 (${trashTasks.length}개)</span>
            ${
              trashTasks.length > 0
                ? `<button type="button" class="pixel-btn pixel-btn-sm pixel-btn-coral" id="empty-trash-btn">휴지통 비우기</button>`
                : ''
            }
          </div>
      `;

      if (trashTasks.length === 0) {
        html += `
          <div class="empty-state-box">
            <div class="empty-cat-art">(=^･ｪ･^=)✨</div>
            <p class="empty-title">휴지통이 깨끗하게 비어있다냥!</p>
          </div>
        `;
      } else {
        html += `
          <div class="task-card-list">
            ${trashTasks
              .map(
                (t) => `
              <div class="pixel-card task-card task-card-deleted">
                <div class="task-card-content">
                  <div class="task-title-text strikethrough">${this.escape(t.title)}</div>
                  <div class="task-meta-row">
                    <span class="task-meta-item">삭제일시: ${new Date(t.deletedAt).toLocaleString()}</span>
                  </div>
                </div>
                <div class="task-card-trash-actions">
                  <button type="button" class="pixel-btn pixel-btn-sm pixel-btn-mint restore-task-btn" data-task-id="${t.id}">
                    복구
                  </button>
                  <button type="button" class="pixel-btn pixel-btn-sm pixel-btn-coral permanent-delete-btn" data-task-id="${t.id}">
                    영구 삭제
                  </button>
                </div>
              </div>
            `
              )
              .join('')}
          </div>
        `;
      }

      html += `</div>`;
      this.elements.contentArea.innerHTML = html;

      // 휴지통 이벤트 바인딩
      const emptyBtn = document.getElementById('empty-trash-btn');
      if (emptyBtn) {
        emptyBtn.addEventListener('click', () => {
          if (confirm('휴지통을 완전히 비우시겠습니까? 삭제된 할 일은 되돌릴 수 없습니다.')) {
            window.TodoStore.emptyTrash();
            if (window.Sound) window.Sound.playDelete();
            this.renderTrashView();
          }
        });
      }

      document.querySelectorAll('.restore-task-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-task-id');
          window.TodoStore.restoreTask(id);
          if (window.Sound) window.Sound.playAdd();
          this.renderTrashView();
        });
      });

      document.querySelectorAll('.permanent-delete-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-task-id');
          if (confirm('정말로 이 항목을 영구 삭제하시겠습니까?')) {
            window.TodoStore.permanentDeleteTask(id);
            if (window.Sound) window.Sound.playDelete();
            this.renderTrashView();
          }
        });
      });
    }

    // 5. [설정] 화면 (PRD 화면 5, F-52, F-56)
    renderSettingsView() {
      if (this.elements.viewTitle) this.elements.viewTitle.textContent = '설정';
      if (this.elements.viewSubtitle) this.elements.viewSubtitle.textContent = '동기화, 백업/복원, 효과음, 로파이 감성 조절';

      const s = window.TodoStore.settings;
      const hasAutoBackup = window.TodoStore.hasAutoBackup();
      const taskCount = window.TodoStore.tasks.length;

      let html = `
        <div class="settings-view-container">
          <!-- 1. 데이터 안전 상태 및 백업/복원 (PRD F-52) -->
          <div class="pixel-card settings-section-card">
            <h3 class="card-heading">💾 데이터 백업 및 복원 (JSON)</h3>
            <p class="settings-desc">
              현재 저장소에 <strong class="pixel-highlight">${taskCount}개</strong>의 할 일이 안전하게 보관되어 있습니다.
              주 1회 백업 파일을 다운로드해 두면 브라우저 캐시 삭제 시에도 언제든 안전하게 복구할 수 있습니다.
            </p>
            <div class="backup-action-row">
              <button type="button" class="pixel-btn pixel-btn-lavender" id="export-json-btn">
                <span>${window.Icons.download}</span> JSON 파일로 백업 다운로드
              </button>
              <label class="pixel-btn pixel-btn-dark file-upload-label">
                <span>${window.Icons.upload}</span> 백업 파일 가져오기 (복원)
                <input type="file" id="import-json-input" accept=".json" style="display:none">
              </label>
            </div>
            ${
              hasAutoBackup
                ? `
              <div class="autobackup-restore-box">
                <span>💡 최근 가져오기 직전의 자동 백업 스냅샷이 존재합니다.</span>
                <button type="button" class="pixel-btn pixel-btn-sm pixel-btn-mint" id="restore-autobackup-btn">
                  직전 자동 백업으로 되돌리기
                </button>
              </div>
            `
                : ''
            }
          </div>

          <!-- 2. 감성 & 효과음 설정 (PRD 3.1, 3.2, F-56) -->
          <div class="pixel-card settings-section-card">
            <h3 class="card-heading">🎮 효과음 및 로파이 그래픽</h3>
            <div class="setting-toggle-row">
              <div class="setting-text">
                <span class="setting-label">8비트 레트로 효과음</span>
                <span class="setting-sub">도장 체크 소리, 고양이 울음, 완료 팡파레 사운드</span>
              </div>
              <label class="pixel-switch">
                <input type="checkbox" id="setting-sound-toggle" ${s.soundEnabled ? 'checked' : ''}>
                <span class="slider"></span>
              </label>
            </div>

            <div class="setting-toggle-row">
              <div class="setting-text">
                <span class="setting-label">완료 픽셀 파티클 이펙트</span>
                <span class="setting-sub">할 일 완료 시 별가루 및 하트 파티클 효과</span>
              </div>
              <label class="pixel-switch">
                <input type="checkbox" id="setting-particles-toggle" ${s.particlesEnabled ? 'checked' : ''}>
                <span class="slider"></span>
              </label>
            </div>

            <div class="setting-toggle-row">
              <div class="setting-text">
                <span class="setting-label">로파이 브라운관 스캔라인 효과</span>
                <span class="setting-sub">레트로 CRT 모니터 느낌의 미세한 스캔라인 오버레이</span>
              </div>
              <label class="pixel-switch">
                <input type="checkbox" id="setting-scanline-toggle" ${s.scanlinesEnabled ? 'checked' : ''}>
                <span class="slider"></span>
              </label>
            </div>
          </div>

          <!-- 3. 시간 기준 설정 (PRD 8.3) -->
          <div class="pixel-card settings-section-card">
            <h3 class="card-heading">⏰ 하루 시작 시각 기준</h3>
            <p class="settings-desc">
              새벽에 깨어있는 올빼미족을 위해 하루의 시작 기준을 설정할 수 있습니다.
            </p>
            <div class="setting-select-row">
              <label for="setting-day-start">하루 시작 기준:</label>
              <select id="setting-day-start" class="pixel-select">
                <option value="0" ${s.dayStartHour === 0 ? 'selected' : ''}>자정 (00:00 기준)</option>
                <option value="4" ${s.dayStartHour === 4 ? 'selected' : ''}>새벽 4시 (새벽 4시 이전은 어제로 처리)</option>
                <option value="6" ${s.dayStartHour === 6 ? 'selected' : ''}>아침 6시</option>
              </select>
            </div>
          </div>

          <!-- 4. 단축키 안내 (PRD F-55) -->
          <div class="pixel-card settings-section-card">
            <h3 class="card-heading">⌨️ PC 키보드 단축키 안내</h3>
            <div class="shortcut-grid">
              <div class="shortcut-item"><kbd>N</kbd> <span>새 할 일 빠른 입력창 포커스</span></div>
              <div class="shortcut-item"><kbd>/</kbd> <span>전체 화면 검색창 포커스</span></div>
              <div class="shortcut-item"><kbd>Esc</kbd> <span>상세 패널 및 모달 닫기</span></div>
              <div class="shortcut-item"><kbd>Ctrl + Z</kbd> <span>최근 삭제된 할 일 되돌리기</span></div>
            </div>
          </div>
        </div>
      `;

      this.elements.contentArea.innerHTML = html;

      // 설정 이벤트 바인딩
      document.getElementById('export-json-btn')?.addEventListener('click', () => {
        const json = window.TodoStore.exportJSON();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const now = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = `dotcat-todo-backup-${now}.json`;
        a.click();
        URL.revokeObjectURL(url);
      });

      document.getElementById('import-json-input')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
          const res = window.TodoStore.importJSON(event.target.result);
          if (res.success) {
            alert(`성공적으로 복원되었습니다! (불러온 할 일: ${res.count}개)`);
            this.render();
          } else {
            alert(`복원 실패: ${res.error}`);
          }
        };
        reader.readAsText(file);
      });

      document.getElementById('restore-autobackup-btn')?.addEventListener('click', () => {
        if (confirm('가져오기 직전 상태로 복구할까요?')) {
          const ok = window.TodoStore.restoreFromAutoBackup();
          if (ok) {
            alert('이전 상태로 복원되었습니다.');
            this.render();
          }
        }
      });

      document.getElementById('setting-sound-toggle')?.addEventListener('change', (e) => {
        window.TodoStore.updateSettings({ soundEnabled: e.target.checked });
        if (e.target.checked && window.Sound) window.Sound.playTone(440);
      });

      document.getElementById('setting-particles-toggle')?.addEventListener('change', (e) => {
        window.TodoStore.updateSettings({ particlesEnabled: e.target.checked });
      });

      document.getElementById('setting-scanline-toggle')?.addEventListener('change', (e) => {
        window.TodoStore.updateSettings({ scanlinesEnabled: e.target.checked });
      });

      document.getElementById('setting-day-start')?.addEventListener('change', (e) => {
        window.TodoStore.updateSettings({ dayStartHour: Number(e.target.value) });
      });
    }

    // 개별 할 일 카드 HTML 생성 (도장 체크박스, 배지, 우선순위)
    renderTaskCard(task, isOverdue = false) {
      const todayStr = window.TodoStore.getTodayStr();
      const list = window.TodoStore.getListById(task.listId);
      const subtasks = window.TodoStore.getSubtasksByTaskId(task.id);
      const subtaskCount = subtasks.length;
      const subtaskCompleted = subtasks.filter((s) => s.completed).length;

      // 우선순위 텍스트 & 색상 (0: 낮음, 1: 보통, 2: 높음)
      const priorityLabels = {
        0: { text: '낮음', class: 'priority-low' },
        1: { text: '보통', class: 'priority-med' },
        2: { text: '높음', class: 'priority-high' }
      };
      const prio = priorityLabels[task.priority] || priorityLabels[1];

      // 마감일 배지 (시간 표기 포함)
      let dueBadgeHtml = '';
      if (task.dueDate) {
        let badgeClass = 'badge-future';
        let badgeText = task.dueDate;
        const timeText = task.dueTime ? ` ${task.dueTime}` : '';

        if (task.dueDate === todayStr) {
          const curTime = window.TodoStore.getCurrentTimeStr();
          const isTimeOver = task.dueTime && task.dueTime < curTime;
          if (isTimeOver && !task.completed) {
            badgeClass = 'badge-overdue';
            badgeText = `오늘 마감 지남 (${task.dueTime})`;
          } else {
            badgeClass = 'badge-today';
            badgeText = `오늘${timeText}`;
          }
        } else if (task.dueDate < todayStr && !task.completed) {
          badgeClass = 'badge-overdue';
          badgeText = `기한 지남${timeText ? ' (' + task.dueTime + ')' : ''}`;
        } else {
          badgeText = `${task.dueDate}${timeText}`;
        }

        dueBadgeHtml = `<span class="pixel-badge ${badgeClass}">${badgeText}</span>`;
      }

      // 하위 할 일 진행률 배지 (F-09)
      const subtaskBadge =
        subtaskCount > 0
          ? `<span class="pixel-badge badge-subtasks">✓ ${subtaskCompleted}/${subtaskCount}</span>`
          : '';

      // 반복 표시 배지 (F-10)
      const recurringIcons = { daily: '매일 반복', weekly: '매주 반복', monthly: '매월 반복' };
      const recurringBadge =
        task.recurring && task.recurring !== 'none'
          ? `<span class="pixel-badge badge-repeat">🔁 ${recurringIcons[task.recurring]}</span>`
          : '';

      const isSelected = this.selectedTaskId === task.id;

      return `
        <div class="pixel-card task-card ${task.completed ? 'task-completed' : ''} ${isSelected ? 'task-selected' : ''}" data-task-id="${task.id}">
          <!-- 픽셀 도장 체크박스 (F-02, 3.3) -->
          <button type="button" class="pixel-checkbox-btn ${task.completed ? 'checked' : ''}" data-action="toggle" data-task-id="${task.id}" title="완료 체크">
            <span class="pixel-check-mark"></span>
          </button>

          <!-- 본문 영역 (클릭 시 상세 열기) -->
          <div class="task-card-body" data-action="detail" data-task-id="${task.id}">
            <div class="task-card-title-row">
              <span class="task-title-text ${task.completed ? 'strikethrough' : ''}">${this.escape(task.title)}</span>
              ${task.priority === 2 ? `<span class="priority-star">★</span>` : ''}
            </div>

            <div class="task-meta-row">
              <span class="pixel-badge badge-list" style="--list-color: ${list.color}">
                📁 ${this.escape(list.name)}
              </span>
              ${dueBadgeHtml}
              ${subtaskBadge}
              ${recurringBadge}
              <span class="pixel-badge ${prio.class}">${prio.text}</span>
            </div>
          </div>

          <!-- 카드 빠른 액션 (삭제 등) -->
          <div class="task-card-actions">
            <button type="button" class="pixel-btn-icon delete-card-btn" data-action="delete" data-task-id="${task.id}" title="삭제">
              ${window.Icons.trash}
            </button>
          </div>
        </div>
      `;
    }

    // 카드 이벤트 위임 바인딩
    bindTaskCardEvents() {
      const container = this.elements.contentArea;
      if (!container) return;

      container.querySelectorAll('.task-card').forEach((card) => {
        const taskId = card.getAttribute('data-task-id');

        // 체크 토글 버튼
        const checkBtn = card.querySelector('[data-action="toggle"]');
        if (checkBtn) {
          checkBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const wasCompleted = checkBtn.classList.contains('checked');
            const updated = window.TodoStore.toggleTask(taskId);

            if (updated && updated.completed) {
              // 완료 효과: 도장 사운드 + 파티클
              if (window.Sound) window.Sound.playCheck();
              if (window.CatMascot) window.CatMascot.spawnTaskCompleteParticles(checkBtn);

              // 오늘 할 일 모두 완료 시 팡파레 체크!
              const stats = window.TodoStore.getTodayStats();
              if (stats.total > 0 && stats.remaining === 0) {
                if (window.Sound) window.Sound.playFanfare();
              }
            } else {
              if (window.Sound) window.Sound.playUncheck();
            }
          });
        }

        // 본문 클릭 시 상세 패널 열기
        const bodyEl = card.querySelector('[data-action="detail"]');
        if (bodyEl) {
          bodyEl.addEventListener('click', () => {
            this.openDetailPanel(taskId);
          });
        }

        // 삭제 버튼
        const delBtn = card.querySelector('[data-action="delete"]');
        if (delBtn) {
          delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const deleted = window.TodoStore.deleteTask(taskId);
            if (deleted) {
              if (window.Sound) window.Sound.playDelete();
              this.showUndoToast(deleted.title);
              if (this.selectedTaskId === taskId) {
                this.closeDetailPanel();
              }
            }
          });
        }
      });
    }

    // 상세 패널 열기 (PC는 우측, 모바일은 모달 바텀시트)
    openDetailPanel(taskId) {
      this.selectedTaskId = taskId;
      const task = window.TodoStore.tasks.find((t) => t.id === taskId);
      if (task && task.dueDate) {
        const parts = task.dueDate.split('-');
        if (parts.length === 3) {
          this.calYear = parseInt(parts[0], 10);
          this.calMonth = parseInt(parts[1], 10) - 1;
        }
      } else {
        const now = new Date();
        this.calYear = now.getFullYear();
        this.calMonth = now.getMonth();
      }
      this.render();
    }

    closeDetailPanel() {
      this.selectedTaskId = null;
      this.render();
    }

    // 달력 HTML 생성기 (월별 달력 뷰 및 날짜 클릭 선택)
    renderCalendarHtml(selectedDateStr) {
      const year = this.calYear;
      const month = this.calMonth; // 0 ~ 11
      const todayStr = window.TodoStore.getTodayStr();

      const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

      // 해당 월 첫 날 요일(0:일 ~ 6:토) 및 총 일수
      const firstDay = new Date(year, month, 1).getDay();
      const lastDate = new Date(year, month + 1, 0).getDate();

      // 이전 달 마지막 날
      const prevLastDate = new Date(year, month, 0).getDate();

      let daysHtml = '';

      // 1. 이전 달 날짜들
      for (let i = firstDay - 1; i >= 0; i--) {
        const d = prevLastDate - i;
        const prevM = month === 0 ? 12 : month;
        const prevY = month === 0 ? year - 1 : year;
        const dateStr = `${prevY}-${String(prevM).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        daysHtml += `<button type="button" class="cal-day-cell cal-day-other" data-cal-date="${dateStr}">${d}</button>`;
      }

      // 2. 이번 달 날짜들
      for (let d = 1; d <= lastDate; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isSelected = selectedDateStr === dateStr;
        const isToday = todayStr === dateStr;
        const dayOfWeek = new Date(year, month, d).getDay();

        let cls = 'cal-day-cell';
        if (isSelected) cls += ' is-selected';
        if (isToday) cls += ' is-today';
        if (dayOfWeek === 0) cls += ' is-sunday';
        if (dayOfWeek === 6) cls += ' is-saturday';

        daysHtml += `
          <button type="button" class="${cls}" data-cal-date="${dateStr}" title="${dateStr}">
            <span class="day-number">${d}</span>
            ${isToday ? '<span class="today-marker" title="오늘">●</span>' : ''}
          </button>
        `;
      }

      // 3. 다음 달 날짜들 (총 칸 수 7의 배수로 마감)
      const totalCells = firstDay + lastDate;
      const nextDays = (7 - (totalCells % 7)) % 7;
      for (let d = 1; d <= nextDays; d++) {
        const nextM = month === 11 ? 1 : month + 2;
        const nextY = month === 11 ? year + 1 : year;
        const dateStr = `${nextY}-${String(nextM).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        daysHtml += `<button type="button" class="cal-day-cell cal-day-other" data-cal-date="${dateStr}">${d}</button>`;
      }

      return `
        <div class="pixel-calendar-box">
          <div class="cal-nav-row">
            <button type="button" class="pixel-btn-icon cal-arrow-btn" id="cal-prev-btn" title="이전 달">◀</button>
            <span class="cal-current-month">${year}년 ${month + 1}월</span>
            <button type="button" class="pixel-btn-icon cal-arrow-btn" id="cal-next-btn" title="다음 달">▶</button>
            <button type="button" class="pixel-btn pixel-btn-xs pixel-btn-lavender" id="cal-today-btn">오늘로</button>
          </div>
          <div class="cal-weekdays-row">
            ${weekDays.map((w, idx) => `<span class="cal-weekday-label ${idx === 0 ? 'sun' : idx === 6 ? 'sat' : ''}">${w}</span>`).join('')}
          </div>
          <div class="cal-grid">
            ${daysHtml}
          </div>
        </div>
      `;
    }

    // 상세 패널 렌더링 (PRD 4.1, 화면 3)
    renderDetailPanel() {
      const container = this.elements.detailPanel;
      if (!container) return;

      if (!this.selectedTaskId) {
        container.innerHTML = `
          <div class="detail-empty-placeholder">
            <span class="placeholder-cat">🐱</span>
            <p>할 일을 선택하면 상세 내용을 확인하고 수정할 수 있습니다냥!</p>
          </div>
        `;
        container.classList.remove('active');
        return;
      }

      const task = window.TodoStore.tasks.find((t) => t.id === this.selectedTaskId);
      if (!task || task.isDeleted) {
        this.selectedTaskId = null;
        this.renderDetailPanel();
        return;
      }

      container.classList.add('active');

      const lists = window.TodoStore.lists;
      const subtasks = window.TodoStore.getSubtasksByTaskId(task.id);
      const todayStr = window.TodoStore.getTodayStr();

      // 빠른 마감일 계산 (오늘, 내일, 이번 주말, 다음 주 월요일)
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().slice(0, 10);

      // 이번 주말(토요일)
      const thisSaturday = new Date(now);
      const dayDiffToSat = 6 - now.getDay();
      thisSaturday.setDate(thisSaturday.getDate() + (dayDiffToSat >= 0 ? dayDiffToSat : dayDiffToSat + 7));
      const satStr = thisSaturday.toISOString().slice(0, 10);

      // 다음 주 월요일
      const nextMon = new Date(now);
      const dayDiffToMon = (1 - now.getDay() + 7) % 7 || 7;
      nextMon.setDate(nextMon.getDate() + dayDiffToMon);
      const nextMonStr = nextMon.toISOString().slice(0, 10);

      container.innerHTML = `
        <div class="modal-backdrop"></div>
        <div class="detail-panel-content pixel-box">
          <div class="detail-header">
            <span class="detail-title-badge">할 일 상세 정보</span>
            <button type="button" class="pixel-btn-icon close-detail-btn" title="닫기">✕</button>
          </div>

          <div class="detail-body">
            <!-- 제목 편집 (F-03 자동저장) -->
            <div class="detail-form-group">
              <label>할 일 제목</label>
              <input type="text" id="detail-task-title" class="pixel-input" value="${this.escape(task.title)}" placeholder="제목을 입력하세요...">
            </div>

            <!-- 마감일 & 시간 설정 (F-05 & 커스텀 픽셀 달력 / 시간 피커) -->
            <div class="detail-form-group date-time-setting-group">
              <div class="date-header-row">
                <label>📅 마감일 & 시간</label>
                <span class="selected-datetime-summary">
                  ${
                    task.dueDate
                      ? `<span class="pixel-badge badge-today">선택됨: ${task.dueDate}${task.dueTime ? ` (${task.dueTime})` : ''}</span>`
                      : '<span class="pixel-badge badge-future">지정 안 됨</span>'
                  }
                </span>
              </div>

              <!-- 빠른 마감일 버튼 -->
              <div class="quick-due-row">
                <button type="button" class="pixel-btn pixel-btn-xs ${task.dueDate === todayStr ? 'active' : ''}" data-due="${todayStr}">오늘</button>
                <button type="button" class="pixel-btn pixel-btn-xs ${task.dueDate === tomorrowStr ? 'active' : ''}" data-due="${tomorrowStr}">내일</button>
                <button type="button" class="pixel-btn pixel-btn-xs ${task.dueDate === satStr ? 'active' : ''}" data-due="${satStr}">이번 주말</button>
                <button type="button" class="pixel-btn pixel-btn-xs ${task.dueDate === nextMonStr ? 'active' : ''}" data-due="${nextMonStr}">다음 주</button>
                <button type="button" class="pixel-btn pixel-btn-xs pixel-btn-dark" id="clear-due-btn">마감일 해제</button>
              </div>

              <!-- 도트 미니 캘린더 -->
              ${this.renderCalendarHtml(task.dueDate)}

              <!-- 시간 설정 블록 -->
              <div class="time-picker-block">
                <div class="time-picker-header">
                  <span class="time-label">⏰ 마감 시간:</span>
                  <input type="time" id="detail-task-time" class="pixel-input pixel-time-input" value="${task.dueTime || ''}">
                  <button type="button" class="pixel-btn pixel-btn-xs pixel-btn-dark" id="clear-time-btn">시간 해제</button>
                </div>
                <div class="quick-time-chips">
                  <span class="quick-time-label">빠른 시간:</span>
                  <button type="button" class="pixel-chip pixel-chip-xs ${task.dueTime === '09:00' ? 'active' : ''}" data-time="09:00">오전 09:00</button>
                  <button type="button" class="pixel-chip pixel-chip-xs ${task.dueTime === '13:00' ? 'active' : ''}" data-time="13:00">오후 13:00</button>
                  <button type="button" class="pixel-chip pixel-chip-xs ${task.dueTime === '18:00' ? 'active' : ''}" data-time="18:00">저녁 18:00</button>
                  <button type="button" class="pixel-chip pixel-chip-xs ${task.dueTime === '21:00' ? 'active' : ''}" data-time="21:00">밤 21:00</button>
                  <button type="button" class="pixel-chip pixel-chip-xs ${task.dueTime === '23:59' ? 'active' : ''}" data-time="23:59">마감 23:59</button>
                </div>
              </div>
            </div>

            <!-- 우선순위 & 분류 목록 (F-06, F-07) -->
            <div class="detail-row-2col">
              <div class="detail-form-group">
                <label>우선순위</label>
                <select id="detail-task-priority" class="pixel-select">
                  <option value="2" ${task.priority === 2 ? 'selected' : ''}>🔥 높음 (분홍)</option>
                  <option value="1" ${task.priority === 1 ? 'selected' : ''}>⭐ 보통 (라벤더)</option>
                  <option value="0" ${task.priority === 0 ? 'selected' : ''}>🌱 낮음 (연라일락)</option>
                </select>
              </div>
              <div class="detail-form-group">
                <label>분류 목록</label>
                <select id="detail-task-list" class="pixel-select">
                  ${lists.map((l) => `<option value="${l.id}" ${task.listId === l.id ? 'selected' : ''}>📁 ${this.escape(l.name)}</option>`).join('')}
                </select>
              </div>
            </div>

            <!-- 반복 설정 (F-10) -->
            <div class="detail-form-group">
              <label>반복 규칙</label>
              <select id="detail-task-recurring" class="pixel-select">
                <option value="none" ${task.recurring === 'none' ? 'selected' : ''}>반복 없음</option>
                <option value="daily" ${task.recurring === 'daily' ? 'selected' : ''}>매일 반복</option>
                <option value="weekly" ${task.recurring === 'weekly' ? 'selected' : ''}>매주 반복</option>
                <option value="monthly" ${task.recurring === 'monthly' ? 'selected' : ''}>매월 반복</option>
              </select>
            </div>

            <!-- 하위 할 일 체크리스트 (F-09) -->
            <div class="detail-form-group">
              <label>하위 할 일 (${subtasks.filter((s) => s.completed).length}/${subtasks.length})</label>
              <div class="subtask-list">
                ${subtasks
                  .map(
                    (st) => `
                  <div class="subtask-row">
                    <input type="checkbox" class="pixel-subtask-check" data-subtask-id="${st.id}" ${st.completed ? 'checked' : ''}>
                    <span class="subtask-title ${st.completed ? 'strikethrough' : ''}">${this.escape(st.title)}</span>
                    <button type="button" class="delete-subtask-btn" data-subtask-id="${st.id}">✕</button>
                  </div>
                `
                  )
                  .join('')}
              </div>
              <form id="new-subtask-form" class="new-subtask-form">
                <input type="text" id="new-subtask-title" class="pixel-input pixel-input-sm" placeholder="새 하위 할 일 추가 후 Enter...">
              </form>
            </div>

            <!-- 상세 메모 & URL 링크 클릭 (F-08) -->
            <div class="detail-form-group">
              <label>메모 (URL 자동 링크 지원)</label>
              <textarea id="detail-task-note" class="pixel-textarea" rows="4" placeholder="자세한 내용, 링크, 참고사항을 적어두세요...">${this.escape(
                task.note || ''
              )}</textarea>
              <div class="note-rendered-links">
                ${this.renderLinksFromText(task.note || '')}
              </div>
            </div>

            <!-- 하단 삭제 버튼 -->
            <div class="detail-footer-actions">
              <button type="button" class="pixel-btn pixel-btn-coral w-full" id="detail-delete-btn">
                <span>${window.Icons.trash}</span> 이 할 일 삭제하기
              </button>
            </div>
          </div>
        </div>
      `;

      // 상세 패널 이벤트 바인딩
      const titleInput = document.getElementById('detail-task-title');
      titleInput?.addEventListener('input', (e) => {
        window.TodoStore.updateTask(task.id, { title: e.target.value });
      });

      // 1. 빠른 마감일 버튼
      container.querySelectorAll('[data-due]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const val = btn.getAttribute('data-due');
          window.TodoStore.updateTask(task.id, { dueDate: val });
          const parts = val.split('-');
          this.calYear = parseInt(parts[0], 10);
          this.calMonth = parseInt(parts[1], 10) - 1;
          if (window.Sound) window.Sound.playTone(520, 'triangle', 0.05);
        });
      });

      // 2. 마감일 해제 버튼
      document.getElementById('clear-due-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        window.TodoStore.updateTask(task.id, { dueDate: null, dueTime: null });
        if (window.Sound) window.Sound.playTone(320, 'sine', 0.05);
      });

      // 3. 달력 월 이동 (이전/다음/오늘)
      document.getElementById('cal-prev-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.calMonth--;
        if (this.calMonth < 0) {
          this.calMonth = 11;
          this.calYear--;
        }
        this.renderDetailPanel();
      });

      document.getElementById('cal-next-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.calMonth++;
        if (this.calMonth > 11) {
          this.calMonth = 0;
          this.calYear++;
        }
        this.renderDetailPanel();
      });

      document.getElementById('cal-today-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const now = new Date();
        this.calYear = now.getFullYear();
        this.calMonth = now.getMonth();
        this.renderDetailPanel();
      });

      // 4. 달력 날짜 셀 직접 클릭 (원클릭 마감일 지정)
      container.querySelectorAll('[data-cal-date]').forEach((dayBtn) => {
        dayBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const chosenDate = dayBtn.getAttribute('data-cal-date');
          window.TodoStore.updateTask(task.id, { dueDate: chosenDate });
          const parts = chosenDate.split('-');
          this.calYear = parseInt(parts[0], 10);
          this.calMonth = parseInt(parts[1], 10) - 1;
          if (window.Sound) window.Sound.playTone(580, 'triangle', 0.06);
        });
      });

      // 5. 시간 인풋 설정
      const timeInput = document.getElementById('detail-task-time');
      timeInput?.addEventListener('change', (e) => {
        window.TodoStore.updateTask(task.id, { dueTime: e.target.value || null });
      });

      // 6. 시간 해제 버튼
      document.getElementById('clear-time-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        window.TodoStore.updateTask(task.id, { dueTime: null });
        if (timeInput) timeInput.value = '';
        if (window.Sound) window.Sound.playTone(320, 'sine', 0.05);
      });

      // 7. 자주 쓰는 빠른 시간 칩
      container.querySelectorAll('[data-time]').forEach((timeChip) => {
        timeChip.addEventListener('click', (e) => {
          e.stopPropagation();
          const chosenTime = timeChip.getAttribute('data-time');
          window.TodoStore.updateTask(task.id, { dueTime: chosenTime });
          if (timeInput) timeInput.value = chosenTime;
          if (window.Sound) window.Sound.playTone(620, 'square', 0.05);
        });
      });

      document.getElementById('detail-task-priority')?.addEventListener('change', (e) => {
        window.TodoStore.updateTask(task.id, { priority: Number(e.target.value) });
      });

      document.getElementById('detail-task-list')?.addEventListener('change', (e) => {
        window.TodoStore.updateTask(task.id, { listId: e.target.value });
      });

      document.getElementById('detail-task-recurring')?.addEventListener('change', (e) => {
        window.TodoStore.updateTask(task.id, { recurring: e.target.value });
      });

      const noteTextarea = document.getElementById('detail-task-note');
      noteTextarea?.addEventListener('input', (e) => {
        window.TodoStore.updateTask(task.id, { note: e.target.value });
      });

      // 하위 할 일 추가
      document.getElementById('new-subtask-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('new-subtask-title');
        const stTitle = input.value.trim();
        if (stTitle) {
          window.TodoStore.addSubtask(task.id, stTitle);
          input.value = '';
          if (window.Sound) window.Sound.playAdd();
        }
      });

      // 하위 할 일 체크 & 삭제
      container.querySelectorAll('.pixel-subtask-check').forEach((chk) => {
        chk.addEventListener('change', () => {
          const stId = chk.getAttribute('data-subtask-id');
          window.TodoStore.toggleSubtask(stId);
          if (window.Sound) window.Sound.playCheck();
        });
      });

      container.querySelectorAll('.delete-subtask-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const stId = btn.getAttribute('data-subtask-id');
          window.TodoStore.deleteSubtask(stId);
        });
      });

      // 삭제 버튼
      document.getElementById('detail-delete-btn')?.addEventListener('click', () => {
        const deleted = window.TodoStore.deleteTask(task.id);
        if (deleted) {
          if (window.Sound) window.Sound.playDelete();
          this.showUndoToast(deleted.title);
          this.closeDetailPanel();
        }
      });
    }

    // 텍스트 내 URL 파싱 및 하이퍼링크 렌더링 (F-08)
    renderLinksFromText(text) {
      if (!text) return '';
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const matches = text.match(urlRegex);
      if (!matches || matches.length === 0) return '';

      return `
        <div class="note-links-box">
          <span class="links-title">🔗 포함된 링크 바로가기:</span>
          ${matches
            .map((url) => `<a href="${this.escape(url)}" target="_blank" rel="noopener noreferrer" class="pixel-link">${this.escape(url)}</a>`)
            .join('')}
        </div>
      `;
    }

    // XSS 방지 escape
    escape(str) {
      if (typeof str !== 'string') return '';
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }
  }

  window.UIManager = new UIManager();
})();

