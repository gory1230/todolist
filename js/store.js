/**
 * Store - State & LocalStorage Management
 * PRD 6장 데이터 및 동기화, 백업 규격 준수
 */

(function () {
  const STORAGE_KEY = 'dotcat_todo_data_v1';
  const BACKUP_STORAGE_KEY = 'dotcat_todo_autobackup_v1';

  // UUID v4 생성기
  function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // 오늘 날짜 문자열 (YYYY-MM-DD) 계산 (dayStartHour 반영)
  function getTodayString(dayStartHour = 0) {
    const now = new Date();
    // 설정된 시작 시간(예: 새벽 4시)보다 전이면 전날로 계산
    if (now.getHours() < dayStartHour) {
      now.setDate(now.getDate() - 1);
    }
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // 현재 시간 문자열 (HH:mm)
  function getCurrentTimeString() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  // 기본 목록 세트
  const DEFAULT_LISTS = [
    { id: 'inbox', name: '인박스', color: '#B794F6', isDefault: true, order: 0 },
    { id: 'study', name: '공부 / 과제', color: '#FF9EC7', isDefault: false, order: 1 },
    { id: 'personal', name: '개인 생활', color: '#8FE3C0', isDefault: false, order: 2 }
  ];

  // 기본 설정
  const DEFAULT_SETTINGS = {
    soundEnabled: true,
    particlesEnabled: true,
    scanlinesEnabled: true,
    dayStartHour: 0, // 0시(자정) or 4시
    weekStartDay: 1, // 1: 월요일
    reducedMotion: false,
    schemaVersion: 1
  };

  class TodoStore {
    constructor() {
      this.tasks = [];
      this.subtasks = [];
      this.lists = [];
      this.settings = { ...DEFAULT_SETTINGS };
      this.lastDeletedTask = null;
      this.undoTimer = null;
      this.listeners = new Set();

      this.init();
    }

    init() {
      const loaded = this.loadFromStorage();
      if (!loaded) {
        // 첫 사용자: 샘플 데이터 생성
        this.createSampleData();
      }
    }

    // 변경 통보
    subscribe(listener) {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }

    notify() {
      this.saveToStorage();
      for (const listener of this.listeners) {
        try {
          listener(this);
        } catch (e) {
          console.error('Listener notification error:', e);
        }
      }
    }

    // 로컬 스토리지 불러오기
    loadFromStorage() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return false;
        const data = JSON.parse(raw);

        this.tasks = Array.isArray(data.tasks) ? data.tasks : [];
        this.subtasks = Array.isArray(data.subtasks) ? data.subtasks : [];
        this.lists = Array.isArray(data.lists) && data.lists.length > 0 ? data.lists : DEFAULT_LISTS;
        this.settings = Object.assign({}, DEFAULT_SETTINGS, data.settings || {});
        return true;
      } catch (err) {
        console.error('Failed to load from storage:', err);
        return false;
      }
    }

    // 로컬 스토리지 저장
    saveToStorage() {
      try {
        const payload = {
          schemaVersion: this.settings.schemaVersion || 1,
          updatedAt: new Date().toISOString(),
          tasks: this.tasks,
          subtasks: this.subtasks,
          lists: this.lists,
          settings: this.settings
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch (err) {
        console.error('Failed to save to storage:', err);
      }
    }

    // 첫 방문 샘플 데이터 (PRD 8.7)
    createSampleData() {
      const today = getTodayString(this.settings.dayStartHour);
      this.lists = JSON.parse(JSON.stringify(DEFAULT_LISTS));
      this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));

      const sampleTask1 = {
        id: generateUUID(),
        title: '🐱 방 안에 있는 도트 고양이 클릭해서 말 걸어보기',
        note: '고양이를 클릭하면 귀여운 냥 소리와 함께 반응한다냥! 상태에 따라 다양한 모습으로 바뀐답니다.',
        dueDate: today,
        dueTime: null,
        priority: 1, // 보통
        completed: false,
        completedAt: null,
        listId: 'inbox',
        recurring: 'none',
        order: 1,
        isDeleted: false,
        deletedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const sampleTask2 = {
        id: generateUUID(),
        title: '✨ 체크박스를 눌러 도장 찍고 완료 피드백 확인하기',
        note: '체크하면 픽셀 도장이 찍히고 민트색 완료와 별가루 파티클이 터집니다!',
        dueDate: today,
        dueTime: null,
        priority: 2, // 높음
        completed: false,
        completedAt: null,
        listId: 'inbox',
        recurring: 'none',
        order: 2,
        isDeleted: false,
        deletedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const sampleTask3 = {
        id: generateUUID(),
        title: '⌨️ 하단 입력창이나 단축키 [N]으로 오늘 할 일 추가해보기',
        note: '5초 안에 빠르게 적고 엔터 치면 포커스가 유지되어 연속 입력할 수 있어요.',
        dueDate: today,
        dueTime: null,
        priority: 0, // 낮음
        completed: false,
        completedAt: null,
        listId: 'inbox',
        recurring: 'none',
        order: 3,
        isDeleted: false,
        deletedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      this.tasks = [sampleTask1, sampleTask2, sampleTask3];

      // 하위 할 일 샘플
      this.subtasks = [
        { id: generateUUID(), taskId: sampleTask1.id, title: '고양이 귀 톡 치기', completed: false, order: 0 },
        { id: generateUUID(), taskId: sampleTask1.id, title: '고양이 응원 받기', completed: false, order: 1 }
      ];

      this.saveToStorage();
    }

    // 날짜 및 시간 도우미
    getTodayStr() {
      return getTodayString(this.settings.dayStartHour);
    }

    getCurrentTimeStr() {
      return getCurrentTimeString();
    }

    // 할 일 조회 (소프트 삭제 제외)
    getActiveTasks() {
      return this.tasks.filter((t) => !t.isDeleted);
    }

    // 휴지통 항목 조회
    getTrashTasks() {
      return this.tasks.filter((t) => t.isDeleted);
    }

    // 하위 할 일 목록
    getSubtasksByTaskId(taskId) {
      return this.subtasks.filter((st) => st.taskId === taskId).sort((a, b) => a.order - b.order);
    }

    // 오늘 할 일 목록 (오늘 마감 + 미완료 기한 지난 항목 포함, PRD 4.2 F-20)
    getTodayTasks() {
      const today = this.getTodayStr();
      const curTime = this.getCurrentTimeStr();
      return this.getActiveTasks().filter((t) => {
        if (!t.dueDate) return false;
        // 오늘 마감 항목
        if (t.dueDate === today) return true;
        // 기한 지남이면서 아직 미완료인 항목 (이전 날짜이거나 오늘 특정 시간 지난 것)
        if (t.dueDate < today && !t.completed) return true;
        return false;
      });
    }

    // 기한 지난 미완료 항목 (PRD F-22: 날짜 또는 오늘 지정 시간 경과)
    getOverdueTasks() {
      const today = this.getTodayStr();
      const curTime = this.getCurrentTimeStr();
      return this.getActiveTasks().filter((t) => {
        if (!t.dueDate || t.completed) return false;
        if (t.dueDate < today) return true;
        if (t.dueDate === today && t.dueTime && t.dueTime < curTime) return true;
        return false;
      });
    }

    // 예정 항목 (내일, 이번 주, 이후)
    getUpcomingTasks() {
      const today = this.getTodayStr();
      return this.getActiveTasks().filter((t) => {
        return t.dueDate && t.dueDate > today && !t.completed;
      });
    }

    // 인박스 항목 (목록이 inbox이거나 마감일 미지정 등)
    getInboxTasks() {
      return this.getActiveTasks().filter((t) => {
        return t.listId === 'inbox' || !t.listId;
      });
    }

    // 완료된 항목 목록 (PRD F-25)
    getCompletedTasks() {
      return this.getActiveTasks().filter((t) => t.completed);
    }

    // 오늘 달성률 및 카운트
    getTodayStats() {
      const todayTasks = this.getTodayTasks();
      const total = todayTasks.length;
      const completed = todayTasks.filter((t) => t.completed).length;
      const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
      const overdueCount = this.getOverdueTasks().length;

      return { total, completed, remaining: total - completed, percent, overdueCount };
    }

    // 할 일 추가 (F-01 빠른 추가)
    addTask({ title, note = '', dueDate = null, dueTime = null, priority = 1, listId = 'inbox', recurring = 'none' }) {
      const trimmed = (title || '').trim();
      if (!trimmed) return null;

      // 만약 오늘 뷰에서 추가하고 마감일이 명시되지 않았다면 오늘 날짜 기본 부여
      const finalDueDate = dueDate !== undefined ? dueDate : this.getTodayStr();

      const newTask = {
        id: generateUUID(),
        title: trimmed.slice(0, 200),
        note: note || '',
        dueDate: finalDueDate,
        dueTime: dueTime || null,
        priority: priority !== undefined ? Number(priority) : 1,
        completed: false,
        completedAt: null,
        listId: listId || 'inbox',
        recurring: recurring || 'none',
        order: this.tasks.length + 1,
        isDeleted: false,
        deletedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      this.tasks.unshift(newTask);
      this.notify();
      return newTask;
    }

    // 할 일 수정 (F-03 자동 저장)
    updateTask(id, updates) {
      const task = this.tasks.find((t) => t.id === id);
      if (!task) return null;

      Object.assign(task, updates, {
        updatedAt: new Date().toISOString()
      });

      this.notify();
      return task;
    }

    // 완료 체크 토글 (F-02, F-10 반복 처리)
    toggleTask(id) {
      const task = this.tasks.find((t) => t.id === id);
      if (!task) return null;

      task.completed = !task.completed;
      task.completedAt = task.completed ? new Date().toISOString() : null;
      task.updatedAt = new Date().toISOString();

      // 반복 할 일 처리 (F-10)
      if (task.completed && task.recurring && task.recurring !== 'none') {
        this._handleRecurringTask(task);
      }

      this.notify();
      return task;
    }

    // 반복 규칙에 따른 다음 회차 생성
    _handleRecurringTask(task) {
      if (!task.dueDate) return;

      const baseDate = new Date(task.dueDate + 'T00:00:00');
      if (isNaN(baseDate.getTime())) return;

      let nextDate = new Date(baseDate);

      if (task.recurring === 'daily') {
        nextDate.setDate(nextDate.getDate() + 1);
      } else if (task.recurring === 'weekly') {
        nextDate.setDate(nextDate.getDate() + 7);
      } else if (task.recurring === 'monthly') {
        const curDay = nextDate.getDate();
        nextDate.setMonth(nextDate.getMonth() + 1);
        // 만약 31일이 없는 달인 경우 말일로 자동 보정 (PRD 8.3)
        if (nextDate.getDate() !== curDay) {
          nextDate.setDate(0);
        }
      }

      const nextYear = nextDate.getFullYear();
      const nextMonth = String(nextDate.getMonth() + 1).padStart(2, '0');
      const nextDayStr = String(nextDate.getDate()).padStart(2, '0');
      const nextDueDate = `${nextYear}-${nextMonth}-${nextDayStr}`;

      // 이미 동일한 반복 할 일의 다음 회차가 있는지 확인하여 중복 방지
      const alreadyExists = this.getActiveTasks().some(
        (t) => t.title === task.title && t.dueDate === nextDueDate && !t.completed
      );

      if (!alreadyExists) {
        const nextTask = {
          ...task,
          id: generateUUID(),
          completed: false,
          completedAt: null,
          dueDate: nextDueDate,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        this.tasks.push(nextTask);
      }
    }

    // 할 일 소프트 삭제 & 실행 취소 준비 (F-04)
    deleteTask(id) {
      const task = this.tasks.find((t) => t.id === id);
      if (!task) return null;

      task.isDeleted = true;
      task.deletedAt = new Date().toISOString();
      task.updatedAt = new Date().toISOString();

      this.lastDeletedTask = { id: task.id, title: task.title };

      if (this.undoTimer) clearTimeout(this.undoTimer);
      this.undoTimer = setTimeout(() => {
        this.lastDeletedTask = null;
      }, 5000); // 5초 후 만료

      this.notify();
      return task;
    }

    // 마지막 삭제 되돌리기 (Undo)
    undoLastDelete() {
      if (!this.lastDeletedTask) return false;
      const id = this.lastDeletedTask.id;
      const res = this.restoreTask(id);
      this.lastDeletedTask = null;
      if (this.undoTimer) clearTimeout(this.undoTimer);
      return res;
    }

    // 복구
    restoreTask(id) {
      const task = this.tasks.find((t) => t.id === id);
      if (!task) return false;
      task.isDeleted = false;
      task.deletedAt = null;
      task.updatedAt = new Date().toISOString();
      this.notify();
      return true;
    }

    // 영구 삭제
    permanentDeleteTask(id) {
      this.tasks = this.tasks.filter((t) => t.id !== id);
      this.subtasks = this.subtasks.filter((st) => st.taskId !== id);
      this.notify();
    }

    // 휴지통 비우기
    emptyTrash() {
      const deletedIds = new Set(this.tasks.filter((t) => t.isDeleted).map((t) => t.id));
      this.tasks = this.tasks.filter((t) => !t.isDeleted);
      this.subtasks = this.subtasks.filter((st) => !deletedIds.has(st.taskId));
      this.notify();
    }

    // 기한 지난 항목 일괄 오늘로 옮기기 (PRD F-22)
    rescheduleOverdueToToday() {
      const today = this.getTodayStr();
      const overdue = this.getOverdueTasks();
      overdue.forEach((t) => {
        t.dueDate = today;
        t.updatedAt = new Date().toISOString();
      });
      this.notify();
      return overdue.length;
    }

    // 기한 지난 항목 일괄 삭제
    deleteOverdueTasks() {
      const overdue = this.getOverdueTasks();
      overdue.forEach((t) => {
        t.isDeleted = true;
        t.deletedAt = new Date().toISOString();
        t.updatedAt = new Date().toISOString();
      });
      this.notify();
      return overdue.length;
    }

    // 하위 할 일 추가 (F-09)
    addSubtask(taskId, title) {
      const trimmed = (title || '').trim();
      if (!trimmed) return null;

      const subtask = {
        id: generateUUID(),
        taskId,
        title: trimmed,
        completed: false,
        order: this.getSubtasksByTaskId(taskId).length
      };

      this.subtasks.push(subtask);
      this.notify();
      return subtask;
    }

    // 하위 할 일 토글
    toggleSubtask(subtaskId) {
      const st = this.subtasks.find((s) => s.id === subtaskId);
      if (!st) return null;
      st.completed = !st.completed;
      this.notify();
      return st;
    }

    // 하위 할 일 삭제
    deleteSubtask(subtaskId) {
      this.subtasks = this.subtasks.filter((s) => s.id !== subtaskId);
      this.notify();
    }

    // 목록 관리 (F-07, 화면 4)
    addList(name, color = '#B794F6') {
      const trimmed = (name || '').trim();
      if (!trimmed) return null;

      const newList = {
        id: generateUUID(),
        name: trimmed,
        color: color || '#B794F6',
        isDefault: false,
        order: this.lists.length
      };

      this.lists.push(newList);
      this.notify();
      return newList;
    }

    updateList(id, updates) {
      const list = this.lists.find((l) => l.id === id);
      if (!list || list.isDefault) return null;
      Object.assign(list, updates);
      this.notify();
      return list;
    }

    deleteList(id) {
      const list = this.lists.find((l) => l.id === id);
      if (!list || list.isDefault) return false;

      // 해당 목록에 속한 할 일들은 인박스로 이동
      this.tasks.forEach((t) => {
        if (t.listId === id) {
          t.listId = 'inbox';
        }
      });

      this.lists = this.lists.filter((l) => l.id !== id);
      this.notify();
      return true;
    }

    getListById(id) {
      return this.lists.find((l) => l.id === id) || this.lists.find((l) => l.id === 'inbox');
    }

    // 설정 업데이트 (F-56)
    updateSettings(newSettings) {
      Object.assign(this.settings, newSettings);
      this.notify();
    }

    // JSON 내보내기 (PRD F-52)
    exportJSON() {
      const exportData = {
        app: 'DotCatTodo',
        schemaVersion: this.settings.schemaVersion || 1,
        exportedAt: new Date().toISOString(),
        tasks: this.tasks,
        subtasks: this.subtasks,
        lists: this.lists,
        settings: this.settings
      };
      return JSON.stringify(exportData, null, 2);
    }

    // 자동 백업 스냅샷 저장
    saveAutoBackup() {
      try {
        const payload = this.exportJSON();
        localStorage.setItem(BACKUP_STORAGE_KEY, payload);
      } catch (e) {
        console.error('Auto backup save failed:', e);
      }
    }

    // 자동 백업이 존재하는지 확인
    hasAutoBackup() {
      return !!localStorage.getItem(BACKUP_STORAGE_KEY);
    }

    // JSON 가져오기 (가져오기 전 자동 백업 필수 저장 - PRD 6.4)
    importJSON(jsonString) {
      try {
        const data = JSON.parse(jsonString);
        if (!data || (!data.tasks && !data.lists)) {
          throw new Error('유효하지 않은 백업 데이터 형식입니다.');
        }

        // 1. 현재 데이터 자동 백업
        this.saveAutoBackup();

        // 2. 데이터 복원 적용
        if (Array.isArray(data.tasks)) this.tasks = data.tasks;
        if (Array.isArray(data.subtasks)) this.subtasks = data.subtasks;
        if (Array.isArray(data.lists) && data.lists.length > 0) this.lists = data.lists;
        if (data.settings) this.settings = Object.assign({}, DEFAULT_SETTINGS, data.settings);

        this.notify();
        return { success: true, count: this.tasks.length };
      } catch (err) {
        console.error('Import failed:', err);
        return { success: false, error: err.message };
      }
    }

    // 자동 백업에서 직전 상태로 복원
    restoreFromAutoBackup() {
      const backupRaw = localStorage.getItem(BACKUP_STORAGE_KEY);
      if (!backupRaw) return false;
      return this.importJSON(backupRaw).success;
    }
  }

  window.TodoStore = new TodoStore();
})();

