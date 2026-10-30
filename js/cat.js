/**
 * Dot Cat Mascot System (가칭: 도트냥)
 * PRD 3.3 7가지 상태 반응형 고양이 마스코트 및 픽셀 파티클 시스템
 */

(function () {
  // 고양이 상태별 말풍선 대사 목록
  const CAT_DIALOGUES = {
    sleep: [
      '오늘은 할 일이 없다냥! 푹 쉬어도 좋다냥 zzz',
      '쿨쿨... 햇살이 따뜻하다냥 zzz',
      '할 일이 생기면 언제든 적어달라냥~',
      '나랑 같이 낮잠 한숨 잘래냥? zzz'
    ],
    waiting: [
      '오늘 할 일이 기다리고 있다냥! 같이 힘내자냥!',
      '첫 번째 할 일을 체크해보자냥! 시작이 반이다냥!',
      '느긋하지만 꾸준하게 가보는 거다냥~ 꼬리 살랑살랑~',
      '오늘도 파이팅이다냥!'
    ],
    cheer: [
      '벌써 하나 끝냈다냥! 앞발 번쩍! 파이팅!',
      '좋은 출발이다냥! 리듬을 타보자냥!',
      '한 걸음씩 나아가면 금방 다 끝난다냥!',
      '멋지다냥! 다음 할 일도 척척!'
    ],
    excited: [
      '벌써 절반 넘게 해냈다냥! 몸이 절로 들썩들썩!',
      '신난다냥! 끝이 슬슬 보인다냥~',
      '대단하다냥! 집중력 최고다냥!',
      '조금만 더 힘내면 오늘 정복 완료다냥!'
    ],
    celebrate: [
      '와아아! 오늘 할 일 모두 완료다냥! 춤춘다냥! 💖',
      '오늘 하루도 완벽하게 해냈다냥! 칭찬의 츄르를 달라냥~',
      '대성공이다냥! 푹 쉴 자격이 충분하다냥! ✨',
      '정말 최고다냥! 내일도 같이 힘내자냥!'
    ],
    shocked: [
      '앗 깜짝이야! 기한이 지난 할 일이 있다냥!! 🙀',
      '괜찮아, 기한 지난 건 [오늘로 옮기기] 눌러서 다시 해보자냥!',
      '털이 곤두선다냥! 어서 확인해보자냥!',
      '밀린 일이 있어도 하나씩 풀면 된다냥!'
    ],
    night: [
      '하아암... 밤 11시가 넘었다냥... 졸리다냥...',
      '늦은 밤까지 수고 많았다냥. 이제 푹 쉴 시간이다냥 🌙',
      '눈이 감긴다냥... 오늘 하루도 고생했다냥 zzz',
      '내일도 건강하게 만나요냥... 쿨...'
    ],
    petted: [
      '골골골... 머리 쓰다듬어줘서 기분 좋다냥~ 🐾',
      '야옹~ 기분 최고다냥!',
      '골골골골... (행복한 고양이 소리)',
      '집사 최고다냥! 헤헤'
    ]
  };

  class CatMascot {
    constructor() {
      this.state = 'waiting'; // sleep, waiting, cheer, excited, celebrate, shocked, night
      this.dialogue = '';
      this.container = null;
      this.speechEl = null;
      this.spriteEl = null;
      this.isPetting = false;
    }

    init() {
      this.container = document.getElementById('cat-room-container');
      this.speechEl = document.getElementById('cat-speech-bubble');
      this.spriteEl = document.getElementById('cat-sprite-wrapper');

      if (this.spriteEl) {
        this.spriteEl.addEventListener('click', () => this.handleCatClick());
      }

      this.updateState();
    }

    // 현재 할 일 상태 및 시간에 따라 고양이 상태 판정 (PRD 3.3 명세)
    determineState() {
      const stats = window.TodoStore.getTodayStats();
      const now = new Date();
      const currentHour = now.getHours();

      // 1. 기한 지난 할 일이 있는 경우 (충격/깜짝)
      if (stats.overdueCount > 0) {
        return 'shocked';
      }

      // 2. 밤 11시 이후 (밤 23시 ~ 새벽 4시)
      if (currentHour >= 23 || currentHour < 4) {
        return 'night';
      }

      // 3. 오늘 할 일이 0개인 경우 (낮잠)
      if (stats.total === 0) {
        return 'sleep';
      }

      // 4. 오늘 할 일 모두 완료 (대성공)
      if (stats.total > 0 && stats.remaining === 0) {
        return 'celebrate';
      }

      // 5. 절반 이상 완료 (신남)
      if (stats.percent >= 50) {
        return 'excited';
      }

      // 6. 1개 이상 완료, 절반 미만 (응원)
      if (stats.completed >= 1 && stats.percent < 50) {
        return 'cheer';
      }

      // 7. 할 일이 있고 완료 0개 (기다림)
      return 'waiting';
    }

    updateState(forceState = null) {
      const newState = forceState || this.determineState();
      this.state = newState;

      // 대사 설정
      const dialogues = CAT_DIALOGUES[newState] || CAT_DIALOGUES.waiting;
      this.dialogue = dialogues[Math.floor(Math.random() * dialogues.length)];

      this.render();
    }

    // 고양이 쓰다듬기(클릭) 이벤트
    handleCatClick() {
      if (window.Sound) {
        window.Sound.playMeow();
      }

      // 파티클 생성
      this.spawnHeartParticles();

      // 잠시 쓰다듬기 반응 대사 출력
      const petList = CAT_DIALOGUES.petted;
      const petMsg = petList[Math.floor(Math.random() * petList.length)];
      this.setBubbleText(petMsg);

      // 흔들림 애니메이션 클래스
      if (this.spriteEl) {
        this.spriteEl.classList.remove('cat-bounce-active');
        void this.spriteEl.offsetWidth; // 트리거
        this.spriteEl.classList.add('cat-bounce-active');
      }

      // 3초 후 원래 상태 대사로 복귀
      if (this.resetTimer) clearTimeout(this.resetTimer);
      this.resetTimer = setTimeout(() => {
        this.updateState();
      }, 3500);
    }

    setBubbleText(text) {
      if (this.speechEl) {
        this.speechEl.innerHTML = `<span class="pixel-speech-text">${text}</span>`;
      }
    }

    render() {
      if (!this.container || !this.spriteEl) return;

      this.setBubbleText(this.dialogue);

      // 컨테이너 상태 클래스 적용
      this.container.setAttribute('data-cat-state', this.state);

      // 픽셀 고양이 SVG 렌더링
      this.spriteEl.innerHTML = this.getCatSvg(this.state);
    }

    // 7가지 상태별 정교한 도트 픽셀 고양이 SVG
    // 채도 낮은 보라(#1E1633), 크림(#FFF3D6), 분홍(#FF9EC7), 라벤더(#B794F6), 산호(#FF7A8A)
    getCatSvg(state) {
      switch (state) {
        case 'sleep':
          return `
          <svg viewBox="0 0 32 32" class="pixel-cat-svg cat-state-sleep" shape-rendering="crispEdges">
            <!-- 웅크린 몸체 -->
            <rect x="7" y="16" width="18" height="9" fill="#FFF3D6" />
            <rect x="5" y="18" width="22" height="6" fill="#FFF3D6" />
            <rect x="9" y="14" width="14" height="3" fill="#FFF3D6" />
            <!-- 귀 접힌 모습 -->
            <rect x="7" y="13" width="3" height="3" fill="#FF9EC7" />
            <rect x="13" y="13" width="3" height="3" fill="#FF9EC7" />
            <!-- 감은 눈 (ㅡ ㅡ) -->
            <rect x="8" y="19" width="3" height="1" fill="#4B3A6B" />
            <rect x="13" y="19" width="3" height="1" fill="#4B3A6B" />
            <!-- 코와 수염 -->
            <rect x="11" y="21" width="2" height="1" fill="#FF9EC7" />
            <rect x="6" y="20" width="2" height="1" fill="#B794F6" />
            <rect x="15" y="20" width="2" height="1" fill="#B794F6" />
            <!-- 감긴 꼬리 -->
            <rect x="23" y="17" width="3" height="6" fill="#E8D5AA" />
            <!-- zzz 텍스트 애니메이션 -->
            <g class="pixel-zzz">
              <text x="21" y="12" fill="#D6C6FF" font-family="'Galmuri11', monospace" font-size="6" font-weight="bold">z</text>
              <text x="25" y="8" fill="#B794F6" font-family="'Galmuri11', monospace" font-size="8" font-weight="bold">Z</text>
            </g>
          </svg>`;

        case 'waiting':
          return `
          <svg viewBox="0 0 32 32" class="pixel-cat-svg cat-state-waiting" shape-rendering="crispEdges">
            <!-- 귀 -->
            <polygon points="8,8 12,8 10,4" fill="#FF9EC7" />
            <polygon points="19,8 23,8 21,4" fill="#FF9EC7" />
            <rect x="8" y="6" width="3" height="3" fill="#FFF3D6" />
            <rect x="20" y="6" width="3" height="3" fill="#FFF3D6" />
            <!-- 머리 -->
            <rect x="8" y="8" width="15" height="10" fill="#FFF3D6" />
            <!-- 똘망한 눈 -->
            <rect x="10" y="11" width="3" height="3" fill="#2D2347" />
            <rect x="11" y="11" width="1" height="1" fill="#FFF3D6" />
            <rect x="18" y="11" width="3" height="3" fill="#2D2347" />
            <rect x="19" y="11" width="1" height="1" fill="#FFF3D6" />
            <!-- 코와 입 (ㅅ) -->
            <rect x="15" y="14" width="1" height="1" fill="#FF9EC7" />
            <rect x="14" y="15" width="3" height="1" fill="#7E68A8" />
            <!-- 볼터치 분홍 -->
            <rect x="9" y="14" width="2" height="1" fill="#FF9EC7" />
            <rect x="20" y="14" width="2" height="1" fill="#FF9EC7" />
            <!-- 몸통 -->
            <rect x="10" y="18" width="11" height="8" fill="#FFF3D6" />
            <!-- 앞발 -->
            <rect x="11" y="24" width="3" height="3" fill="#FFF3D6" />
            <rect x="17" y="24" width="3" height="3" fill="#FFF3D6" />
            <rect x="11" y="26" width="3" height="1" fill="#E8D5AA" />
            <rect x="17" y="26" width="3" height="1" fill="#E8D5AA" />
            <!-- 살랑거리는 꼬리 (애니메이션) -->
            <path class="cat-tail-wag" d="M 21 22 Q 26 20 25 15" stroke="#FFF3D6" stroke-width="2.5" fill="none" />
          </svg>`;

        case 'cheer':
          return `
          <svg viewBox="0 0 32 32" class="pixel-cat-svg cat-state-cheer" shape-rendering="crispEdges">
            <!-- 번쩍 든 앞발 (응원) -->
            <g class="cheer-paw">
              <rect x="6" y="8" width="4" height="4" fill="#FFF3D6" />
              <rect x="7" y="9" width="2" height="2" fill="#FF9EC7" />
            </g>
            <!-- 귀 -->
            <rect x="9" y="5" width="3" height="4" fill="#FFF3D6" />
            <rect x="10" y="6" width="2" height="2" fill="#FF9EC7" />
            <rect x="20" y="5" width="3" height="4" fill="#FFF3D6" />
            <rect x="21" y="6" width="2" height="2" fill="#FF9EC7" />
            <!-- 머리 -->
            <rect x="9" y="8" width="14" height="9" fill="#FFF3D6" />
            <!-- 웃는 눈 (^ ^) -->
            <rect x="11" y="11" width="3" height="1" fill="#2D2347" />
            <rect x="10" y="12" width="1" height="1" fill="#2D2347" />
            <rect x="14" y="12" width="1" height="1" fill="#2D2347" />
            <rect x="18" y="11" width="3" height="1" fill="#2D2347" />
            <rect x="17" y="12" width="1" height="1" fill="#2D2347" />
            <rect x="21" y="12" width="1" height="1" fill="#2D2347" />
            <!-- 볼터치 & 입 -->
            <rect x="10" y="14" width="2" height="1" fill="#FF9EC7" />
            <rect x="20" y="14" width="2" height="1" fill="#FF9EC7" />
            <rect x="15" y="13" width="2" height="2" fill="#FF9EC7" />
            <!-- 몸통과 다른 발 -->
            <rect x="11" y="17" width="11" height="9" fill="#FFF3D6" />
            <rect x="18" y="24" width="3" height="3" fill="#FFF3D6" />
            <!-- 응원 별 반짝임 -->
            <rect x="4" y="6" width="2" height="2" fill="#8FE3C0" class="pixel-sparkle" />
          </svg>`;

        case 'excited':
          return `
          <svg viewBox="0 0 32 32" class="pixel-cat-svg cat-state-excited" shape-rendering="crispEdges">
            <!-- 쫑긋한 귀 -->
            <rect x="8" y="4" width="3" height="4" fill="#FFF3D6" />
            <rect x="9" y="5" width="2" height="2" fill="#FF9EC7" />
            <rect x="20" y="4" width="3" height="4" fill="#FFF3D6" />
            <rect x="21" y="5" width="2" height="2" fill="#FF9EC7" />
            <!-- 머리 -->
            <rect x="8" y="7" width="15" height="10" fill="#FFF3D6" />
            <!-- 반짝이는 눈 (> <) -->
            <rect x="10" y="10" width="3" height="2" fill="#FF9EC7" />
            <rect x="18" y="10" width="3" height="2" fill="#FF9EC7" />
            <rect x="14" y="12" width="3" height="2" fill="#7E68A8" />
            <!-- 볼터치 진하게 -->
            <rect x="9" y="13" width="3" height="2" fill="#FF7A8A" />
            <rect x="19" y="13" width="3" height="2" fill="#FF7A8A" />
            <!-- 춤추는 몸통 & 발 -->
            <rect x="9" y="17" width="13" height="8" fill="#FFF3D6" />
            <rect x="8" y="23" width="4" height="3" fill="#FFF3D6" />
            <rect x="19" y="22" width="4" height="3" fill="#FFF3D6" />
            <!-- 신난 꼬리 -->
            <rect x="22" y="15" width="3" height="6" fill="#FFF3D6" />
            <!-- 음표 기호 -->
            <text x="24" y="9" fill="#FF9EC7" font-size="8">♪</text>
          </svg>`;

        case 'celebrate':
          return `
          <svg viewBox="0 0 32 32" class="pixel-cat-svg cat-state-celebrate" shape-rendering="crispEdges">
            <!-- 머리 위 미니 왕관 or 파티 리본 -->
            <polygon points="12,5 15,3 18,5 16,6 14,6" fill="#FFF3D6" />
            <rect x="14" y="2" width="3" height="2" fill="#FF9EC7" />
            <!-- 귀 -->
            <rect x="7" y="6" width="3" height="3" fill="#FFF3D6" />
            <rect x="8" y="7" width="2" height="2" fill="#FF9EC7" />
            <rect x="21" y="6" width="3" height="3" fill="#FFF3D6" />
            <rect x="22" y="7" width="2" height="2" fill="#FF9EC7" />
            <!-- 머리 -->
            <rect x="8" y="8" width="15" height="9" fill="#FFF3D6" />
            <!-- 기쁨의 눈과 하트 -->
            <text x="9" y="14" fill="#FF9EC7" font-size="6">♥</text>
            <text x="17" y="14" fill="#FF9EC7" font-size="6">♥</text>
            <rect x="14" y="13" width="3" height="2" fill="#FF7A8A" />
            <!-- 몸통 & 양발 들고 댄스 -->
            <rect x="10" y="17" width="12" height="8" fill="#FFF3D6" />
            <rect x="6" y="14" width="4" height="4" fill="#FFF3D6" />
            <rect x="22" y="14" width="4" height="4" fill="#FFF3D6" />
            <rect x="10" y="24" width="3" height="3" fill="#FFF3D6" />
            <rect x="18" y="24" width="3" height="3" fill="#FFF3D6" />
            <!-- 하트 파티클 -->
            <text x="2" y="10" fill="#FF9EC7" font-size="7" class="floating-heart">♥</text>
            <text x="24" y="8" fill="#8FE3C0" font-size="7" class="floating-sparkle">✦</text>
          </svg>`;

        case 'shocked':
          return `
          <svg viewBox="0 0 32 32" class="pixel-cat-svg cat-state-shocked" shape-rendering="crispEdges">
            <!-- 느낌표 (!) 마크 -->
            <g class="shock-mark">
              <rect x="24" y="2" width="2" height="6" fill="#FF7A8A" />
              <rect x="24" y="9" width="2" height="2" fill="#FF7A8A" />
            </g>
            <!-- 털 곤두선 귀 -->
            <polygon points="7,4 11,8 8,9" fill="#FFF3D6" />
            <polygon points="23,4 20,8 24,9" fill="#FFF3D6" />
            <!-- 머리 -->
            <rect x="8" y="8" width="15" height="10" fill="#FFF3D6" />
            <!-- 놀란 땡글한 눈 (O O) -->
            <rect x="10" y="10" width="4" height="5" fill="#1E1633" />
            <rect x="11" y="11" width="2" height="2" fill="#FF7A8A" />
            <rect x="17" y="10" width="4" height="5" fill="#1E1633" />
            <rect x="18" y="11" width="2" height="2" fill="#FF7A8A" />
            <!-- 벌어진 입 -->
            <rect x="14" y="15" width="3" height="3" fill="#1E1633" />
            <!-- 곤두선 등 털과 몸통 -->
            <rect x="9" y="18" width="13" height="8" fill="#FFF3D6" />
            <polygon points="21,17 23,19 21,21" fill="#FFF3D6" />
            <polygon points="21,22 23,24 21,25" fill="#FFF3D6" />
            <!-- 뻣뻣한 꼬리 -->
            <rect x="23" y="15" width="2" height="8" fill="#FFF3D6" />
          </svg>`;

        case 'night':
          return `
          <svg viewBox="0 0 32 32" class="pixel-cat-svg cat-state-night" shape-rendering="crispEdges">
            <!-- 반쯤 접힌 귀 -->
            <rect x="8" y="7" width="3" height="3" fill="#FFF3D6" />
            <rect x="9" y="8" width="2" height="2" fill="#FF9EC7" />
            <rect x="20" y="7" width="3" height="3" fill="#FFF3D6" />
            <rect x="21" y="8" width="2" height="2" fill="#FF9EC7" />
            <!-- 머리 -->
            <rect x="8" y="9" width="15" height="9" fill="#FFF3D6" />
            <!-- 게슴츠레한 졸린 눈 -->
            <rect x="10" y="12" width="3" height="1" fill="#2D2347" />
            <rect x="11" y="13" width="2" height="1" fill="#7E68A8" />
            <rect x="18" y="12" width="3" height="1" fill="#2D2347" />
            <rect x="19" y="13" width="2" height="1" fill="#7E68A8" />
            <!-- 하품하는 입 -->
            <rect x="14" y="14" width="3" height="2" fill="#FF9EC7" />
            <!-- 조용히 웅크린 몸 -->
            <rect x="9" y="17" width="13" height="8" fill="#FFF3D6" />
            <rect x="10" y="24" width="3" height="2" fill="#FFF3D6" />
            <rect x="18" y="24" width="3" height="2" fill="#FFF3D6" />
            <!-- 달 모양 조각 -->
            <text x="24" y="9" fill="#FFF3D6" font-size="7">🌙</text>
          </svg>`;

        default:
          return '';
      }
    }

    // 픽셀 하트 파티클 생성 (고양이 터치 시)
    spawnHeartParticles() {
      if (!this.container) return;
      const rect = this.spriteEl.getBoundingClientRect();
      const containerRect = this.container.getBoundingClientRect();

      for (let i = 0; i < 4; i++) {
        const particle = document.createElement('div');
        particle.className = 'pixel-heart-particle';
        particle.textContent = '♥';

        const startX = rect.left - containerRect.left + rect.width / 2 + (Math.random() * 20 - 10);
        const startY = rect.top - containerRect.top + (Math.random() * 10);

        particle.style.left = `${startX}px`;
        particle.style.top = `${startY}px`;
        particle.style.animationDelay = `${i * 0.1}s`;

        this.container.appendChild(particle);
        setTimeout(() => particle.remove(), 1200);
      }
    }

    // 할 일 체크 완료 시 별가루 파티클 (PRD 3.3)
    spawnTaskCompleteParticles(element) {
      if (!window.TodoStore.settings.particlesEnabled) return;
      if (!element) return;

      const rect = element.getBoundingClientRect();
      const numParticles = 6;
      const colors = ['#8FE3C0', '#FF9EC7', '#FFF3D6', '#B794F6'];

      for (let i = 0; i < numParticles; i++) {
        const p = document.createElement('div');
        p.className = 'task-complete-particle';
        p.textContent = ['✦', '★', '◆', '♥'][Math.floor(Math.random() * 4)];
        p.style.color = colors[Math.floor(Math.random() * colors.length)];
        p.style.left = `${rect.left + 16}px`;
        p.style.top = `${rect.top + 16}px`;

        const angle = (Math.PI * 2 * i) / numParticles + (Math.random() - 0.5);
        const dist = 30 + Math.random() * 35;
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist;

        p.style.setProperty('--dx', `${dx}px`);
        p.style.setProperty('--dy', `${dy}px`);

        document.body.appendChild(p);
        setTimeout(() => p.remove(), 700);
      }
    }
  }

  window.CatMascot = new CatMascot();
})();

