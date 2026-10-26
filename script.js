/* ==========================================================================
   ROADKEEP — script.js
   카피는 전부 index.html 에 있다. 이 파일은 동작만 담당하고 텍스트를 만들지 않는다.
   (번호 01~0N 은 CSS counter 로 자동. 어절·글자 나누기처럼 HTML 글자를 감싸기만 한다)
   ========================================================================== */
(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  if (hasGSAP) gsap.registerPlugin(ScrollTrigger);

  const pad = (n) => String(n).padStart(2, '0');

  /* ---------- 부드러운 스크롤 (Lenis): ScrollTrigger 와 같은 시계로 돈다. 모션 줄이기면 끈다 ---------- */
  let lenis = null;
  let navigating = false; // 메뉴 앵커로 이동하는 중 (2번 창의 자동 스크롤이 끼어들지 않게)
  function initSmoothScroll() {
    if (reduceMotion || typeof window.Lenis === 'undefined') return;
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    if (hasGSAP) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((time) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
    // 전체 메뉴가 열려 있는 동안은 휠 스크롤을 멈춘다
    document.addEventListener('roadkeep:menu', (e) => (e.detail.open ? lenis.stop() : lenis.start()));
  }

  /* 마퀴용: 트랙의 자식을 화면 폭 이상이 되도록 복제하고, 그 묶음을 한 번 더 붙인다.
     CSS 애니메이션이 -50% 이동하면 이음새 없이 반복된다. */
  function buildLoop(track) {
    const originals = [...track.children];
    const setWidth = track.getBoundingClientRect().width;
    if (!originals.length || !setWidth) return;
    const need = Math.max(window.innerWidth, window.screen.width);
    const repeats = Math.max(1, Math.ceil(need / setWidth));
    for (let r = 1; r < repeats * 2; r++) {
      originals.forEach((item) => {
        const clone = item.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        track.append(clone);
      });
    }
    return originals.length * repeats;
  }

  /* ---------- Header: 가운데 떠 있는 바. 아래로 스크롤하면 숨고 위로 스크롤하면 내려온다 (메뉴가 열려 있으면 고정) ---------- */
  function initHeader() {
    const header = document.querySelector('[data-header]');
    if (!header) return;
    let lastY = window.scrollY;
    let hidden = false;
    // 숨길 때는 상단 여백까지 포함해 화면 밖으로
    const hideY = () => -(header.offsetTop + header.offsetHeight + 8);
    const setHidden = (value) => {
      if (value === hidden) return;
      hidden = value;
      if (hasGSAP && !reduceMotion) gsap.to(header, { y: value ? hideY : 0, duration: 0.4, ease: 'power3.out', overwrite: 'auto' });
      else header.style.transform = value ? `translateY(${hideY()}px)` : '';
    };
    const update = () => {
      const y = window.scrollY;
      if (document.body.classList.contains('is-menu-open')) setHidden(false);
      else if (Math.abs(y - lastY) > 4) setHidden(y > lastY && y > header.offsetTop + header.offsetHeight);
      lastY = y;
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    document.addEventListener('roadkeep:menu', (e) => { if (e.detail.open) setHidden(false); });
  }

  /* ---------- 전체 화면 메뉴 ----------
     열기: 패널이 위에서 내려옴(0.7s expo.inOut) → 항목이 마스크 안에서 올라옴(0.8s expo.out, 간격 0.06s)
     닫기: 항목이 위로 빠짐(0.3s) → 패널이 위로 걷힘(0.6s). CLOSE · ESC · 항목 클릭
     항목 클릭: 메뉴를 닫은 뒤 해당 섹션으로 부드럽게 스크롤 (페이지 이동 없음)
     열려 있는 동안 스크롤 잠금, 히어로 손전등·롤링 타이틀 일시정지(roadkeep:menu 이벤트) */
  function initMenu() {
    const header = document.querySelector('[data-header]');
    const toggle = document.querySelector('[data-menu-toggle]');
    const menu = document.querySelector('[data-menu]');
    if (!header || !toggle || !menu) return;
    const label = toggle.querySelector('[data-menu-label]');
    const links = [...menu.querySelectorAll('.menu__link')];
    const rows = [...menu.querySelectorAll('.menu__row')];
    const animate = hasGSAP && !reduceMotion;
    let open = false;
    let tl = null;

    const announce = (value) => document.dispatchEvent(new CustomEvent('roadkeep:menu', { detail: { open: value } }));
    const setButton = (value) => {
      toggle.setAttribute('aria-expanded', String(value));
      if (label) label.textContent = value ? toggle.dataset.labelClose : toggle.dataset.labelOpen;
    };
    const lock = (value) => {
      document.body.classList.toggle('is-menu-open', value);
      document.body.classList.toggle('is-locked', value);
      announce(value);
    };

    const openMenu = () => {
      if (open) return;
      open = true;
      if (tl) tl.kill();
      setButton(true);
      lock(true);
      menu.classList.add('is-open');
      if (animate) {
        gsap.set(menu, { clipPath: 'inset(0% 0% 100% 0%)' });
        gsap.set(rows, { yPercent: 100 });
        tl = gsap.timeline()
          .to(menu, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.7, ease: 'expo.inOut' })
          .to(rows, { yPercent: 0, duration: 0.8, ease: 'expo.out', stagger: 0.06 }, '-=0.2');
      }
      if (links[0]) links[0].focus({ preventScroll: true }); // 열리면 첫 항목에 포커스
    };

    const closeMenu = (after) => {
      if (!open) return;
      open = false;
      if (tl) tl.kill();
      setButton(false);
      const done = () => {
        menu.classList.remove('is-open');
        if (animate) {
          gsap.set(menu, { clearProps: 'clipPath' });
          gsap.set(rows, { clearProps: 'transform' });
        }
        lock(false);
        toggle.focus({ preventScroll: true }); // 닫히면 MENU 버튼으로 포커스 복귀
        if (typeof after === 'function') after();
      };
      if (!animate) { done(); return; }
      tl = gsap.timeline({ onComplete: done })
        .to(rows, { yPercent: -100, duration: 0.3, ease: 'power2.in', stagger: 0.03 })
        .to(menu, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.6, ease: 'expo.inOut' }, '-=0.1');
    };

    // 섹션으로 부드럽게 이동: 실제 문서상 위치에서 헤더 높이만큼 위.
    // 도착한 섹션으로 포커스를 옮겨 키보드·스크린리더 사용자도 이어서 읽을 수 있게 한다
    const scrollToTarget = (target) => {
      let top = target.getBoundingClientRect().top + window.scrollY - (header.offsetTop + header.offsetHeight); // 바 아래 끝
      // 2번 창: 무대가 붙어 있는 구간의 끝(창이 다 펼쳐진 위치)으로. 지나가면서 펼침이 재생된다
      const intro = target.closest('.intro.is-staged');
      const stage = intro && intro.querySelector('[data-intro-stage]');
      if (stage) top = intro.getBoundingClientRect().top + window.scrollY + intro.offsetHeight - stage.offsetHeight;
      // pin 연출이 있는 섹션: 3번 대각선 베기는 연출이 끝나 펼쳐진 위치로, 서비스 A to Z·진행 과정은 연출이 시작하는 위치로
      const pinned = window.ScrollTrigger && ScrollTrigger.getAll().find((st) => st.pin && (st.pin === target || st.pin.contains(target)));
      if (pinned) top = 'trust' in target.dataset ? pinned.end : pinned.start;
      // 메뉴가 닫히며 Lenis 를 다시 켤 때 진행 중인 스크롤을 리셋하므로, 먼저 켜 두고 이동한다
      if (lenis) {
        lenis.start();
        navigating = true;
        const end = () => { navigating = false; };
        setTimeout(end, 1600); // 사용자가 도중에 휠로 끊어도 풀리게
        lenis.scrollTo(top, { force: true, duration: 1.4, easing: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2), onComplete: end });
      }
      else window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    };

    toggle.addEventListener('click', () => (open ? closeMenu() : openMenu()));
    links.forEach((link) => {
      link.addEventListener('click', (e) => {
        const target = document.querySelector(link.getAttribute('href'));
        if (!target) return;
        e.preventDefault();
        closeMenu(() => scrollToTarget(target));
      });
    });
    document.addEventListener('keydown', (e) => {
      if (!open) return;
      if (e.key === 'Escape') { closeMenu(); return; }
      // 포커스는 MENU 버튼 + 메뉴 항목 안에서만 돈다
      if (e.key === 'Tab') {
        const items = [toggle, ...links];
        const i = items.indexOf(document.activeElement);
        const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : (i === items.length - 1 ? 0 : i + 1);
        e.preventDefault();
        items[next].focus();
      }
    });
  }

  /* ---------- 1. Hero: 조각 오프닝 → 바닥 빛 → 롤링 타이틀 → 작업등으로 비춰 보기 ----------
     오프닝(이미지 로드 후 1회, GSAP 타임라인 1개)
       0.0~0.3s   완전한 어둠
       0.3s~      사진을 세로 조각(PC 8 / 모바일 4)으로 나눠 왼쪽부터 차례로 착지 (홀수 위에서, 짝수 아래에서)
                  각 0.55s power4.out, 간격 0.09s(모바일 0.12s), 조각 안의 사진은 scale 1.15 → 1
                  조각 사이 2px 틈 → 마지막 조각 착지와 함께 0.3s에 닫힘
       ~1.5s      조각 레이어를 숨기고 단일 사진 래퍼로 교체 (화면 변화 없음)
       1.6~2.4s   바닥 빛이 차오름: 어둠 레이어의 바닥 타원 구멍이 반경 0 → 최종값 (power2.out)
       2.0~2.8s   롤링 타이틀이 오른쪽 밖에서 미끄러져 들어와 기본 속도로 이어짐 + 한글 한 줄·헤더 등장
       2.8s~      손전등 인터랙션과 점검 메모 활성화
     바닥 빛은 오프닝 이후에도 켜진 채로 남는다 */
  function initHero() {
    const root = document.documentElement;
    const release = () => root.classList.remove('hero-intro');
    const hero = document.querySelector('[data-hero]');
    if (!hero) { release(); return; }

    const media = hero.querySelector('.hero__media');
    const frame = hero.querySelector('.hero__frame');
    const scene = hero.querySelector('.hero__scene');
    const photo = hero.querySelector('[data-hero-photo]');
    const dark = hero.querySelector('.hero__dark');
    const spotsLayer = hero.querySelector('.hero__spots');
    const roll = hero.querySelector('[data-hero-roll]');
    const title = hero.querySelector('.hero__title');
    // 손전등이 작아지는 영역: 한글 한 줄만 (롤링 타이틀 위에서는 그대로 비춘다)
    const textEls = [title].filter(Boolean);
    const items = [...hero.querySelectorAll('[data-hero-item]')];
    const header = document.querySelector('[data-header]');
    const heroStyle = getComputedStyle(hero);
    const cssNum = (name, fallback) => parseFloat(heroStyle.getPropertyValue(name)) || fallback;

    const spots = [...hero.querySelectorAll('.spot')].map((el) => {
      const cs = getComputedStyle(el);
      return { el, x: parseFloat(cs.getPropertyValue('--x')) / 100, y: parseFloat(cs.getPropertyValue('--y')) / 100, px: 0, py: 0 };
    });
    const home = spots.find((sp) => 'home' in sp.el.dataset) || spots[0];

    const SPOT_RADIUS = 90;    // 빛의 중심이 이 거리 안에 들어오면 메모 표시
    const LOOP_MS = 10000;     // 터치 기기 자동 8자 루프 주기
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const isMobile = () => window.matchMedia('(max-width: 760px)').matches;

    let W = 0, H = 0, R = 220, R_TEXT = 120, textRects = [], homePt = { x: 0, y: 0 }, path = [];
    let sceneBox = { x: 0, y: 0 }; // 래퍼 안에서 사진 상자(.hero__scene = object-fit: cover 영역)의 위치

    // 사진 상자를 기준으로 사진 % 좌표 → 화면 px
    function layout() {
      W = media.clientWidth;
      H = media.clientHeight;
      const sx = scene.offsetLeft;
      const sy = scene.offsetTop;
      const sw = scene.offsetWidth;
      const sh = scene.offsetHeight;
      sceneBox = { x: sx, y: sy };

      spots.forEach((sp) => {
        sp.px = sx + sp.x * sw;
        sp.py = sy + sp.y * sh;
        sp.el.style.setProperty('--px', `${sp.px}px`);
        sp.el.style.setProperty('--py', `${sp.py}px`);
        // 메모가 화면 오른쪽 밖으로 넘치면 왼쪽으로 뒤집기
        if (!sp.el.classList.contains('spot--down')) {
          sp.el.classList.remove('spot--left');
          const tag = sp.el.querySelector('.spot__tag');
          sp.el.classList.toggle('spot--left', sp.px + 10 + tag.offsetWidth > W - 16);
        }
      });

      homePt = home ? { x: home.px, y: home.py } : { x: W * 0.7, y: H * 0.4 };
      if (rollLit) litBox = { x: roll.offsetLeft + rollLit.offsetLeft, y: roll.offsetTop + rollLit.offsetTop };
      // 작은 화면에서는 빛 반경도 화면에 맞춰 줄인다
      R = Math.min(cssNum('--light-r', 220), W * 0.3);
      R_TEXT = Math.min(cssNum('--light-r-text', 120), R * 0.55);

      const m = media.getBoundingClientRect();
      textRects = textEls.map((el) => {
        // 블록 상자가 아니라 글자가 실제로 차지하는 폭만 (같은 높이의 점검 메모 위에서 빛이 줄지 않게)
        const range = document.createRange();
        range.selectNodeContents(el);
        const c = range.getBoundingClientRect();
        return { l: c.left - m.left, t: c.top - m.top, r: c.right - m.left, b: c.bottom - m.top };
      });
      buildPath();
    }

    // 8자 경로: 핫스팟 중심점 C 를 두 번 지나며 오른쪽 핫스팟은 시계 방향, 왼쪽은 반시계 방향으로 잇는다
    function buildPath() {
      const pts = spots.map((sp) => ({ x: sp.px, y: sp.py }));
      if (pts.length < 2) { path = [homePt]; return; }
      const c = { x: pts.reduce((sum, p) => sum + p.x, 0) / pts.length, y: pts.reduce((sum, p) => sum + p.y, 0) / pts.length };
      const angle = (p) => Math.atan2(p.y - c.y, p.x - c.x);
      const norm = (a) => (a + Math.PI * 2) % (Math.PI * 2);
      const right = pts.filter((p) => p.x >= c.x).sort((a, b) => angle(a) - angle(b));
      const left = pts.filter((p) => p.x < c.x).sort((a, b) => norm(angle(b)) - norm(angle(a)));
      path = [c, ...right, c, ...left];
    }
    // 닫힌 Catmull-Rom 곡선 위의 점 (t: 0~1)
    function pathAt(t) {
      const n = path.length;
      if (n === 1) return path[0];
      const f = t * n;
      const i = Math.floor(f);
      const u = f - i;
      const [p0, p1, p2, p3] = [-1, 0, 1, 2].map((d) => path[(i + d + n) % n]);
      const cr = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u);
      return { x: cr(p0.x, p1.x, p2.x, p3.x), y: cr(p0.y, p1.y, p2.y, p3.y) };
    }

    // 렌더 상태: 작업등 원 + 어둠
    const st = { lx: 0, ly: 0, lr: 0, dark: cssNum('--dark', 0.55) };
    const target = { x: 0, y: 0 };
    let ease = 0.12;
    let active = false;
    let menuOpen = false;      // 전체 메뉴가 열려 있으면 손전등·롤링 일시정지
    document.addEventListener('roadkeep:menu', (e) => { menuOpen = e.detail.open; });
    let atTop = true;          // 히어로 → 2번 전환이 0%일 때만 손전등이 켜진다
    let dragging = false;
    let loopStart = 0;
    let visible = true;
    let raf = 0;

    function render() {
      // 빛은 화면 좌표로 계산하고, 어둠 레이어(래퍼 안, 스크롤 패럴랙스가 걸린 상태)의 좌표로 바꿔서 넣는다
      const ty = hasGSAP ? (gsap.getProperty(frame, 'yPercent') || 0) * H / 100 : 0;
      const d = dark.style;
      d.setProperty('--lx', `${st.lx - sceneBox.x}px`);
      d.setProperty('--ly', `${st.ly - ty - sceneBox.y}px`);
      d.setProperty('--lr', `${Math.max(0.01, st.lr)}px`);
      d.opacity = st.dark;
      // 롤링 타이틀 밝은 외곽선 레이어: 같은 손전등 원 (롤링 타이틀은 패럴랙스 밖이라 화면 좌표 그대로)
      if (rollLit) {
        const r = rollLit.style;
        r.setProperty('--rx', `${st.lx - litBox.x}px`);
        r.setProperty('--ry', `${st.ly - litBox.y}px`);
        r.setProperty('--rr', `${active && atTop ? Math.max(0.01, st.lr) : 0.01}px`);
      }

      // 점검 메모: 스크롤 패럴랙스로 메모 레이어가 내려간 만큼 보정
      const dy = hasGSAP ? (gsap.getProperty(spotsLayer, 'yPercent') || 0) * H / 100 : 0;
      spots.forEach((sp) => {
        const near = active && atTop && Math.hypot(st.lx - sp.px, st.ly - sp.py - dy) < SPOT_RADIUS && st.lr > R * 0.5;
        sp.el.classList.toggle('is-on', near);
      });
    }

    function tick(now) {
      if (menuOpen) { raf = visible ? requestAnimationFrame(tick) : 0; return; }
      if (active && !atTop) {
        st.lr += (0 - st.lr) * 0.15; // 전환이 시작되면 손전등을 닫는다
      } else if (active) {
        if (!finePointer && !dragging) {
          const p = pathAt(((now - loopStart) % LOOP_MS) / LOOP_MS);
          target.x = p.x;
          target.y = p.y;
        }
        st.lx += (target.x - st.lx) * ease;
        st.ly += (target.y - st.ly) * ease;
        const inText = textRects.some((r) => st.lx > r.l && st.lx < r.r && st.ly > r.t && st.ly < r.b);
        st.lr += ((inText ? R_TEXT : R) - st.lr) * 0.12;
      }
      render();
      raf = visible ? requestAnimationFrame(tick) : 0;
    }
    const start = () => { if (!raf) raf = requestAnimationFrame(tick); };

    const pointFromEvent = (e) => {
      const rect = media.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    // 롤링 타이틀: 오른쪽 → 왼쪽 무한 루프 (PC 40s / 모바일 28s 한 바퀴). 스크롤하는 동안 최대 4배, 멈추면 0.6s에 걸쳐 복귀
    const rollTrack = roll && roll.querySelector('.hero__roll-track');
    const rollSet = rollTrack && rollTrack.querySelector('.hero__roll-set');
    let rollX = 0, rollW = 0, rollMult = 1, rollRaf = 0, rollLast = 0, scrollEndAt = 0, lastScrollY = window.scrollY, lastScrollT = 0;
    const measureRoll = () => { rollW = rollSet ? rollSet.offsetWidth : 0; };
    // 손전등이 지나가는 자리만 외곽선이 밝아지는 두 번째 레이어: 트랙을 복제해 겹친다 (글자는 HTML 그대로), 흐름은 같은 값으로 맞춘다
    const rollTracks = rollTrack ? [rollTrack] : [];
    let rollLit = null, litBox = { x: 0, y: 0 };
    if (rollTrack) {
      rollLit = document.createElement('div');
      rollLit.className = 'hero__roll-lit';
      const litTrack = rollTrack.cloneNode(true);
      rollLit.append(litTrack);
      roll.append(rollLit);
      rollTracks.push(litTrack);
    }
    function rollTick(now) {
      const dt = Math.min(64, now - (rollLast || now));
      rollLast = now;
      if (now > scrollEndAt) rollMult = 1 + (rollMult - 1) * Math.exp(-dt / 150); // τ 150ms → 약 0.6s에 원래 속도
      if (rollW && !menuOpen) {
        const period = (isMobile() ? 28 : 40) * 1000;
        rollX -= (rollW / period) * rollMult * dt;
        if (rollX <= -rollW) rollX += rollW;
        rollTracks.forEach((track) => { track.style.transform = `translate3d(${rollX}px, 0, 0)`; });
      }
      rollRaf = visible ? requestAnimationFrame(rollTick) : 0;
    }
    const startRoll = () => { if (!rollRaf && rollTrack) { rollLast = 0; rollRaf = requestAnimationFrame(rollTick); } };
    window.addEventListener('scroll', () => {
      const now = performance.now();
      const v = Math.abs(window.scrollY - lastScrollY) / Math.max(16, now - lastScrollT) * 1000; // px/s
      lastScrollY = window.scrollY;
      lastScrollT = now;
      rollMult = Math.max(rollMult, Math.min(4, 1 + v / 800));
      scrollEndAt = now + 120;
    }, { passive: true });

    // 히어로 → 2번: 화면 가운데의 가로형 창이 화면 전체로 펼쳐진다 — 스크롤 연동(scrub·snap·pin) 없이 시간 기반 1회 재생
    //   스크롤이 히어로 15% 지점(start "top top-=15%")을 넘으면 타임라인을 처음부터 끝까지 재생하고,
    //   같은 1.4s 동안 Lenis 로 2번 위치(무대가 화면에 붙어 있는 구간 끝)까지 부드럽게 이동 → 화면 이동과 펼침이 한 동작
    //   그 지점 위로 다시 올라가면 같은 타임라인을 역재생 (timeScale 1.3)
    //   무대(.intro__stage)는 CSS sticky 라서 이동하는 동안 화면은 움직이지 않는다
    // 타임라인 (초)
    //   0.00~1.20  창 inset(30% 34% round 28px) → inset(0 round 0), 창 안 사진 scale 1.2 → 1 (power3.inOut). 창은 처음 0.2s 에 페이드인
    //   0.00~0.60  롤링 타이틀 y +60%·opacity 0, 한글 한 줄 opacity 0
    //   0.00~1.20  히어로 사진 scale 0.94, 어둠 0.55 → 0.75 (블러 없음: 화면 전체 블러는 무거워 프레임이 끊긴다)
    //   0.70~1.40  창 안이 계단 없이 서서히 어두워짐: 어둠 그라데이션 0 → 1, 사진 0.75 → 0.38 (power1.inOut)
    //   0.90~      헤드라인 → 서브 → 카드 1·2·3 (expo.out, 간격 0.08s / 카드끼리 0.12s, 키워드는 카드보다 0.15s 늦게, 번호는 0.1s 늦게)
    // 쓰는 속성은 transform · opacity · clip-path 뿐 (CSS 에서 will-change 지정)
    function initRevealOpen() {
      const intro = document.querySelector('[data-intro]');
      const stage = intro && intro.querySelector('[data-intro-stage]');
      const reveal = document.querySelector('[data-reveal]');
      if (!intro || !stage || !reveal || !hasGSAP || reduceMotion) return;
      const revealPhoto = reveal.querySelector('.reveal__photo');
      const revealShade = reveal.querySelector('.reveal__shade');
      const titleSpan = reveal.querySelector('[data-reveal-title]');
      const sub = reveal.querySelector('[data-reveal-sub]');
      const list = reveal.querySelector('[data-worry-list]');
      const listHome = list && list.parentElement;
      const slot = document.querySelector('[data-worry-slot]');
      const cards = list ? [...list.children] : [];
      const nums = cards.map((card) => card.querySelector('.worry__num')).filter(Boolean);
      const keys = cards.map((card) => card.querySelector('.worry__key'));
      const OPEN = 'power3.inOut';
      const OPEN_END = 1.4; // 창 펼침·어두워짐이 끝나는 시간 (이후는 글자 등장)
      const openEase = gsap.parseEase(OPEN);

      gsap.matchMedia().add({ mobile: '(max-width: 760px)', desktop: '(min-width: 761px)' }, (ctx) => {
        const { mobile } = ctx.conditions;
        intro.classList.add('is-staged');
        // 모바일: 카드 3장은 창에 다 안 들어가므로 창 아래로 옮겨 일반 스크롤로 올라오게
        if (mobile && list && slot) slot.append(list);
        const inWindowCards = mobile ? [] : cards;

        // 대기 상태: 전부 opacity 0, 아래로 내려가 있음
        gsap.set(titleSpan, { yPercent: 100 });
        gsap.set(sub, { y: 24, opacity: 0 });
        gsap.set(cards, { y: mobile ? 48 : 56, opacity: 0 });
        gsap.set(nums, { opacity: 0 });
        gsap.set(keys.filter(Boolean), { y: 24, opacity: 0 }); // 키워드: 외곽선 상태로 카드보다 0.15s 늦게
        // 등장하는 동안(그리고 숨어 있는 동안) 카드 hover 를 막는다 → 움직이는 카드 위에서 테두리가 깜빡이지 않게
        const lockCards = (on) => { if (inWindowCards.length) gsap.set(inWindowCards, { pointerEvents: on ? 'none' : 'auto' }); };
        lockCards(true);

        // 모바일 카드: 창이 열린 뒤 아래로 스크롤해 화면에 들어오면 하나씩 (y 48 → 0, 간격 0.1s)
        let cardObserver;
        if (mobile && 'IntersectionObserver' in window) {
          cardObserver = new IntersectionObserver(([entry]) => {
            if (!entry.isIntersecting) return;
            cardObserver.disconnect();
            gsap.to(cards, { y: 0, opacity: 1, duration: 0.9, ease: 'expo.out', stagger: 0.1 });
            gsap.to(keys.filter(Boolean), { y: 0, opacity: 1, duration: 0.9, ease: 'expo.out', stagger: 0.1, delay: 0.15, onComplete: () => list.dispatchEvent(new Event('worry:ready')) });
            gsap.to(nums, { opacity: 1, duration: 0.4, ease: 'power2.out', stagger: 0.1, delay: 0.6 });
          }, { rootMargin: '0px 0px -15% 0px' });
          cardObserver.observe(list);
        }

        const startWindow = mobile ? [36, 14, 36, 14] : [30, 34, 30, 34];
        const inset = ([t, r, b, l], round) => `inset(${t}% ${r}% ${b}% ${l}% round ${round}px)`;

        const tl = gsap.timeline({
          paused: true,
          defaults: { ease: OPEN },
          onUpdate() {
            atTop = this.progress() < 0.001; // 창이 조금이라도 열려 있으면 손전등을 닫는다
            // 역재생: 글자 등장 구간은 빠르게 걷어 내고, 창이 닫히는 구간(1.4s 이전)부터 1.3배속 → 올리자마자 창이 닫히기 시작한다
            // (timeScale(값)은 방향을 정방향으로 되돌리므로 reversed(true)로 다시 역방향 고정)
            if (this.reversed() && this.time() <= OPEN_END && Math.abs(this.timeScale()) !== 1.3) this.timeScale(1.3).reversed(true);
          },
          onComplete: () => { lockCards(false); if (list) list.dispatchEvent(new Event('worry:ready')); },
          onReverseComplete: () => { atTop = true; },
        });

        // 창 + 창 안 사진 (브라우저가 계산값을 줄여 돌려주므로 clip-path 시작값을 4값으로 명시)
        tl.fromTo(reveal, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2, ease: 'power1.out' }, 0)
          .fromTo(reveal, { clipPath: inset(startWindow, 28) }, { clipPath: inset([0, 0, 0, 0], 0), duration: 1.2 }, 0)
          .fromTo(revealPhoto, { scale: 1.2, opacity: 0.75 }, { scale: 1, duration: 1.2 }, 0)
          // 히어로가 물러난다 (scale + 어둠만)
          .to(roll, { yPercent: 60, opacity: 0, duration: 0.6 }, 0) // 롤링은 계속 흐르는 채로
          .to(textEls, { opacity: 0, duration: 0.6 }, 0)
          .fromTo(frame, { scale: 1 }, { scale: 0.94, duration: 1.2 }, 0)
          .to(st, { dark: 0.75, duration: 1.2 }, 0)
          // 창 안이 계단 없이 서서히 어두워진다
          .to(revealPhoto, { opacity: 0.38, duration: 0.7, ease: 'power1.inOut' }, 0.7)
          .fromTo(revealShade, { opacity: 0 }, { opacity: 1, duration: 0.7, ease: 'power1.inOut' }, 0.7);

        // 0.9s~ 창 안 요소 등장
        const IN = 0.9;
        tl.to(titleSpan, { yPercent: 0, duration: 0.9, ease: 'expo.out' }, IN)
          .to(sub, { y: 0, opacity: 1, duration: 0.7, ease: 'expo.out' }, IN + 0.08);
        inWindowCards.forEach((card, i) => {
          const at = IN + 0.16 + i * 0.12;
          tl.to(card, { y: 0, opacity: 1, duration: 0.9, ease: 'expo.out' }, at);
          if (keys[i]) tl.to(keys[i], { y: 0, opacity: 1, duration: 0.9, ease: 'expo.out' }, at + 0.15);
          if (nums[i]) tl.to(nums[i], { opacity: 1, duration: 0.4, ease: 'power2.out' }, at + 0.6);
        });

        // 2번 위치 = 무대가 화면에 붙어 있는 구간의 끝
        const openAt = () => intro.getBoundingClientRect().top + window.scrollY + intro.offsetHeight - stage.offsetHeight;
        let booted = false;
        const open = () => {
          lockCards(true);
          tl.timeScale(1).play();
          if (!booted) return;
          // 펼침과 같은 1.4s·같은 이징으로 2번 위치까지 (이미 그보다 아래로 가는 중이면 건드리지 않는다: 메뉴 이동 등)
          // 메뉴로 다른 섹션에 가는 중이거나, 이미 2번 위치보다 아래면(뒤로 가기 복원 등) 끌어올리지 않는다
          if (navigating) return;
          const target = openAt();
          if (window.scrollY >= target - 1) return;
          if (lenis) lenis.scrollTo(target, { duration: 1.4, easing: openEase, lock: true });
          else window.scrollTo({ top: target, behavior: 'smooth' });
        };
        const close = () => {
          lockCards(true);
          tl.timeScale(tl.time() > OPEN_END ? 4 : 1.3).reverse();
        };
        const trigger = ScrollTrigger.create({
          trigger: intro,
          start: 'top top-=15%',
          onEnter: open,
          onLeaveBack: close,
        });
        // 처음 열었을 때 이미 그 지점보다 아래면(새로고침 등) 스크롤 이동 없이 열린 상태로
        if (trigger.progress > 0 || window.scrollY > trigger.start) tl.progress(1);
        requestAnimationFrame(() => { booted = true; });

        return () => {
          intro.classList.remove('is-staged');
          if (cardObserver) cardObserver.disconnect();
          if (list && listHome && list.parentElement !== listHome) listHome.append(list);
          gsap.set([reveal, revealPhoto, revealShade, frame, roll, ...textEls, titleSpan, sub, ...cards, ...nums, ...keys.filter(Boolean)], { clearProps: 'all' });
        };
      });
    }
    initRevealOpen();

    // 접근성: 모션 줄이기 → 분할 연출 없이 사진 바로, 롤링 정지(CSS), 바닥 빛 켜진 상태, 어둠 0.45(CSS), 메모 상시 표시(CSS)
    if (reduceMotion) {
      release();
      const place = () => layout();
      if (photo.complete) place(); else photo.addEventListener('load', place, { once: true });
      window.addEventListener('resize', place);
      return;
    }

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const wasHome = !active || (target.x === homePt.x && target.y === homePt.y);
        layout();
        measureRoll();
        if (wasHome) { target.x = homePt.x; target.y = homePt.y; }
      }, 120);
    });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible) { start(); if (active || rollX !== 0) startRoll(); }
      }).observe(hero);
    }

    // PC: 커서를 lerp(0.12)로 늦게 따라감. 히어로 밖으로 나가면 헤드라이트로 천천히 복귀
    // 고정 헤더가 히어로 위쪽을 덮고 있어서, 히어로 영역 판정은 요소 이벤트가 아니라 좌표로 한다
    const goHome = () => {
      target.x = homePt.x;
      target.y = homePt.y;
      ease = 0.04;
    };
    window.addEventListener('pointermove', (e) => {
      if (!active || e.pointerType !== 'mouse') return;
      const rect = hero.getBoundingClientRect();
      const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
      if (inside) {
        Object.assign(target, pointFromEvent(e));
        ease = 0.12;
      } else goHome();
    }, { passive: true });
    document.documentElement.addEventListener('mouseleave', () => { if (active) goHome(); });
    // 터치: 드래그하면 그 자리로, 손을 떼면 다시 8자 루프
    hero.addEventListener('pointerdown', (e) => {
      if (!active || e.pointerType === 'mouse') return;
      dragging = true;
      Object.assign(target, pointFromEvent(e));
    });
    hero.addEventListener('pointermove', (e) => {
      if (active && dragging && e.pointerType !== 'mouse') Object.assign(target, pointFromEvent(e));
    });
    const endDrag = () => { dragging = false; };
    hero.addEventListener('pointerup', endDrag);
    hero.addEventListener('pointercancel', endDrag);

    const activate = () => {
      layout();
      active = true;
      ease = finePointer ? 0.12 : 0.08;
      target.x = homePt.x;
      target.y = homePt.y;
      if (!finePointer) {
        // 루프를 헤드라이트에서 가장 가까운 지점부터 시작
        let best = 0, bestD = Infinity;
        for (let k = 0; k < 200; k++) {
          const p = pathAt(k / 200);
          const dist = Math.hypot(p.x - homePt.x, p.y - homePt.y);
          if (dist < bestD) { bestD = dist; best = k / 200; }
        }
        loopStart = performance.now() - best * LOOP_MS;
      }
    };

    // 오프닝 조각: 같은 사진을 깐 레이어 N장, 각자의 세로 구간만 clip-path 로 남긴다 (어둠은 레이어 전체에 한 장, CSS)
    function buildSlices(count) {
      const wrap = document.createElement('div');
      wrap.className = 'hero__slices';
      wrap.setAttribute('aria-hidden', 'true');
      const slices = [];
      for (let i = 0; i < count; i++) {
        const slice = document.createElement('div');
        slice.className = 'hero__slice';
        slice.style.setProperty('--l', `${(i / count) * 100}%`);
        slice.style.setProperty('--r', i === count - 1 ? '100%' : `${((i + 1) / count) * 100}%`);
        const inner = document.createElement('div');
        inner.className = 'hero__slice-inner';
        inner.style.transformOrigin = `${((i + 0.5) / count) * 100}% 50%`; // 자기 구간 가운데를 기준으로 줌
        const sliceScene = scene.cloneNode(false); // 같은 사진 상자(크기·위치 계산이 동일)
        const img = photo.cloneNode(false);
        img.removeAttribute('data-hero-photo');
        img.removeAttribute('fetchpriority');
        img.alt = '';
        sliceScene.append(img);
        inner.append(sliceScene);
        slice.append(inner);
        wrap.append(slice);
        slices.push({ slice, inner });
      }
      frame.after(wrap);
      return { wrap, slices };
    }

    const boot = () => {
      layout();
      measureRoll();
      if (document.fonts) document.fonts.ready.then(measureRoll);
      Object.assign(st, { lx: homePt.x, ly: homePt.y, lr: 0, dark: cssNum('--dark', 0.55) });
      target.x = homePt.x;
      target.y = homePt.y;

      if (!hasGSAP) {
        st.lr = R;
        release();
        activate();
        start();
        startRoll();
        return;
      }

      const mobile = isMobile();
      const count = mobile ? 4 : 8;
      const step = mobile ? 0.12 : 0.09;
      const { wrap, slices } = buildSlices(count);

      // 0.0s 시작 상태: 단일 사진 래퍼는 숨기고, 조각은 화면 밖(홀수 위 / 짝수 아래)
      gsap.set(frame, { autoAlpha: 0 });
      slices.forEach(({ slice, inner }, i) => {
        gsap.set(slice, { yPercent: i % 2 === 0 ? -100 : 100 }); // 1·3·5·7번째(홀수) 위에서, 짝수 아래에서
        gsap.set(inner, { scale: 1.15 });
      });
      gsap.set(dark, { '--floor': 0 });
      gsap.set(items, { yPercent: 100 });
      gsap.set(header, { opacity: 0 });
      gsap.set(roll, { x: () => window.innerWidth });
      render();
      release();
      start();

      const tl = gsap.timeline();

      // 0.3s~ 조각 착지 ("두-둥-둥-둥")
      slices.forEach(({ slice, inner }, i) => {
        const at = 0.3 + i * step;
        tl.to(slice, { yPercent: 0, duration: 0.55, ease: 'power4.out' }, at)
          .to(inner, { scale: 1, duration: 0.55, ease: 'power4.out' }, at);
      });
      // 마지막 조각이 착지하면서 틈이 0.3s에 걸쳐 닫힘 (-2px = 1px씩 겹쳐 이음새 방지)
      const lastStart = 0.3 + (count - 1) * step;
      const gapAt = lastStart + 0.25;
      tl.to(wrap, { '--gap': '-2px', duration: 0.3, ease: 'power2.inOut' }, gapAt);
      // 조각 → 단일 사진 래퍼 교체 (같은 사진·같은 어둠이라 화면 변화 없음)
      const swapAt = Math.max(1.5, gapAt + 0.32);
      tl.add(() => {
        gsap.set(frame, { autoAlpha: 1 });
        wrap.remove();
      }, swapAt);

      // 1.6~2.4s 바닥 빛이 차오름: 바이크 아래 타원 구멍이 반경 0 → 최종값으로 커지며 붉은 바닥 조명이 아래에서부터 밝아진다
      tl.to(dark, { '--floor': 1, duration: 0.8, ease: 'power2.out' }, 1.6);

      // 2.0~2.8s 롤링 타이틀이 오른쪽 밖에서 미끄러져 들어와 그대로 기본 속도로 + 한글 한 줄·헤더
      tl.add(startRoll, 2.0)
        .to(roll, { x: 0, duration: 0.8, ease: 'expo.out' }, 2.0)
        .to(items, { yPercent: 0, duration: 0.6, ease: 'expo.out', stagger: 0.08 }, 2.0)
        .to(header, { opacity: 1, duration: 0.6, ease: 'power2.out' }, 2.0);

      // 2.8s~ 손전등 + 점검 메모
      tl.add(activate, 2.8)
        .add(() => {
          gsap.set(header, { clearProps: 'opacity' }); // transform 은 스크롤 숨김이 쓰므로 남긴다
          gsap.set(items, { clearProps: 'transform,opacity' });
          dark.style.removeProperty('--floor');
          layout();
        });
    };

    // 사진이 로드된 뒤에 시작 (실패해도 숨은 채 남지 않도록 error 에서도 시작)
    if (photo.complete && photo.naturalWidth) boot();
    else {
      photo.addEventListener('load', boot, { once: true });
      photo.addEventListener('error', boot, { once: true });
    }
  }

  /* ---------- 2. 걱정 카드: 큰 키워드 채움 레이어 + 한 줄 맞춤 + 터치 기기 자동 hover ---------- */
  function initWorryCards() {
    const list = document.querySelector('[data-worry-list]');
    if (!list) return;
    const cards = [...list.querySelectorAll('.worry__card')];
    const keys = cards.map((card) => card.querySelector('.worry__key')).filter(Boolean);

    // 채워진 레이어: 외곽선 레이어를 복제해 겹친다 (키워드 글자는 HTML 한 곳에만)
    keys.forEach((key) => {
      const line = key.querySelector('.worry__key-line');
      if (!line || key.querySelector('.worry__key-fill')) return;
      const fill = line.cloneNode(true);
      fill.className = 'worry__key-fill';
      key.append(fill);
    });

    // 카드 폭을 넘는 키워드가 있으면 세 장 모두 같은 비율로 줄여 한 줄 유지 (카드끼리 글자 크기를 맞춘다)
    function fit() {
      keys.forEach((key) => { key.style.fontSize = ''; });
      let ratio = 1;
      keys.forEach((key) => {
        const line = key.querySelector('.worry__key-line');
        if (line && line.offsetWidth > 0) ratio = Math.min(ratio, (key.clientWidth - 4) / line.offsetWidth);
      });
      if (ratio < 1) {
        const base = parseFloat(getComputedStyle(keys[0]).fontSize);
        keys.forEach((key) => { key.style.fontSize = `${Math.floor(base * ratio)}px`; });
      }
    }
    fit();
    requestAnimationFrame(fit); // 모바일에서 카드 목록이 창 아래로 옮겨진 뒤 다시
    if (document.fonts) document.fonts.ready.then(fit);
    let timer;
    window.addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(fit, 120); });

    // hover 가 없는 기기: 화면 가운데(위아래 40%를 뺀 띠)에 들어온 카드가 hover 상태. 등장 중인 카드는 끝난 뒤에 켠다
    if (!window.matchMedia('(hover: none)').matches || !('IntersectionObserver' in window)) return;
    const centered = new Set();
    const apply = () => cards.forEach((card) => {
      const busy = hasGSAP && gsap.isTweening(card.querySelector('.worry__key') || card);
      card.classList.toggle('is-hot', centered.has(card) && !busy);
    });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { if (entry.isIntersecting) centered.add(entry.target); else centered.delete(entry.target); });
      apply();
    }, { rootMargin: '-40% 0px -40% 0px' });
    cards.forEach((card) => io.observe(card));
    list.addEventListener('worry:ready', apply);
  }

  /* ---------- Scroll reveal ---------- */
  function initReveal() {
    document.querySelectorAll('[data-stagger]').forEach((group) => {
      [...group.children].forEach((child, i) => child.style.setProperty('--d', i));
    });

    const els = document.querySelectorAll('.fade-up, .fade-img');
    if (reduceMotion || !('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -10% 0px' });
    els.forEach((el) => io.observe(el));
  }

  /* ---------- 3. 믿고 맡길 이유: 대각선 베기 전환 → 이유 01 → 02 → 03 (GSAP ScrollTrigger, pin 하나) ----------
     섹션을 pin (end +=400%), 타임라인 1개, scrub 1.2. 타임라인 시간 단위(전체 4 = 3단계 기준)
       베기 0~1     0~0.18    레드 컷 선이 위에서 아래로 그어짐 (scaleY 0 → 1, power2.inOut)
                    0.18~0.28 어긋남: 왼쪽 조각 y +12px, 오른쪽 조각 y -12px, 컷 선 사라짐
                    0.28~0.9  벌어짐 (power3.inOut): 왼쪽 x -60vw·rotate -2deg / 오른쪽 x +60vw·rotate 2deg
                              틈으로 보이는 이유 화면: scale 1.08 → 1, brightness 0.5 → 1
       이유 01 머묾 1~1.4
       단계 전환 0.6 + 머묾 0.6 씩: 다음 사진이 아래에서 위로 덮고(clip-path), 이전 사진은 scale 1.06·brightness 0.6
                    이전 글자 y -24·사라짐 → 새 글자 y 24 → 0·나타남, 사진 왼쪽 세로선 1/3 → 2/3 → 1 레드로
     영문 키워드는 scrub 이 아니라 단계가 바뀌는 순간 시간 기반으로 1회: 모든 글자 opacity 0.12 → 왼쪽부터 0.05s 간격으로 밝아지고,
     지금 밝아지는 맨 앞 글자 하나만 레드였다가 다음 글자로 넘어가며 본 색으로. 끝나면 모든 글자 --bone 100% (거꾸로 스크롤하면 이전 단계를 다시 재생)
     단계는 스크롤 위치가 아니라 scrub 으로 실제 그려지고 있는 타임라인 위치로 판단한다 → 화면의 사진·글자와 키워드 재생이 어긋나지 않는다
     모션 줄이기: pin 없이 세로 나열, 섹션이 화면에 들어오면 전환 막만 페이드아웃 */
  function initTrust() {
    const section = document.querySelector('[data-trust]');
    const cut = section && section.querySelector('[data-cut]');
    if (!section || !hasGSAP) return;

    // 전환 막: 오른쪽 조각은 왼쪽 조각을 복제 (카피는 HTML 한 곳에만)
    let left = null, right = null;
    if (cut) {
      left = cut.querySelector('.cut__piece--left');
      right = left.cloneNode(true);
      right.className = 'cut__piece cut__piece--right';
      right.setAttribute('aria-hidden', 'true');
      left.after(right);
      section.classList.add('has-cut');
    }

    if (reduceMotion) {
      if (cut) {
        ScrollTrigger.create({
          trigger: section,
          start: 'top 60%',
          onEnter: () => gsap.to(cut, { autoAlpha: 0, duration: 0.6, ease: 'power1.out' }),
          onLeaveBack: () => gsap.to(cut, { autoAlpha: 1, duration: 0.3 }),
        });
      }
      return;
    }

    const stage = section.querySelector('[data-trust-stage]');
    const steps = [...section.querySelectorAll('[data-trust-step]')];
    const photos = steps.map((step) => step.querySelector('.trust__photo'));
    const photoImgs = photos.map((photo) => photo && photo.querySelector('img')); // 물러나는 줌·어둡게는 안쪽 이미지에 (사진 칸 밖으로 넘치지 않게)
    const copies = steps.map((step) => step.querySelector('[data-trust-copy]'));
    const rail = section.querySelector('[data-trust-rail]');
    const bar = cut && cut.querySelector('.cut__mark-bar');
    const mark = cut && cut.querySelector('.cut__mark');
    const N = steps.length;
    if (!N) return;
    section.classList.add('is-pinned');

    // 영문 키워드를 글자 단위 span 으로 (공백은 그대로 둔다)
    const rootStyle = getComputedStyle(document.documentElement);
    const BONE = rootStyle.getPropertyValue('--bone').trim() || '#F1ECE3';
    const RED = rootStyle.getPropertyValue('--ignite').trim() || '#D93A2B';
    const keyChars = steps.map((step) => {
      const key = step.querySelector('[data-trust-key]');
      if (!key) return [];
      const text = key.textContent;
      key.textContent = '';
      const chars = [];
      Array.from(text).forEach((ch) => {
        if (ch.trim() === '') { key.append(ch); return; }
        const span = document.createElement('span');
        span.className = 'trust__char';
        span.textContent = ch;
        key.append(span);
        chars.push(span);
      });
      return chars;
    });
    const DIM = 0.12;
    let keyTl = null;
    const dimKey = (k) => { if (keyChars[k] && keyChars[k].length) gsap.set(keyChars[k], { opacity: DIM, color: BONE }); };
    const brightKey = (k) => { if (keyChars[k] && keyChars[k].length) gsap.set(keyChars[k], { opacity: 1, color: BONE }); };
    const playKey = (k) => {
      if (keyTl) keyTl.kill();
      keyChars.forEach((_, i) => dimKey(i));
      const chars = keyChars[k] || [];
      keyTl = gsap.timeline({ onComplete: () => brightKey(k) }); // 끝나면 반드시 모든 글자 --bone 100%
      chars.forEach((ch, i) => {
        keyTl.set(ch, { opacity: 1, color: RED }, i * 0.05)                          // 맨 앞 글자 하나만 레드
          .set(ch, { color: BONE }, (i + 1) * 0.05);                                  // 다음 글자로 넘어가는 순간 본 색으로 (레드는 늘 한 글자)
      });
    };

    // 시작 상태: 이유 01 만 보이고, 나머지 사진은 아래로 접혀 있음
    gsap.set(photos.slice(1), { clipPath: 'inset(100% 0% 0% 0%)' });
    gsap.set(copies.slice(1), { y: 24, opacity: 0 });
    if (rail) gsap.set(rail, { scaleY: 1 / N });
    keyChars.forEach((_, i) => dimKey(i));

    // 영문 키워드가 왼쪽 영역보다 길면 모든 단계를 같은 비율로 줄여 한 줄 유지
    const keys = steps.map((step) => step.querySelector('[data-trust-key]')).filter(Boolean);
    const fitKeys = () => {
      keys.forEach((key) => { key.style.fontSize = ''; });
      let ratio = 1;
      keys.forEach((key) => { if (key.scrollWidth > 0) ratio = Math.min(ratio, key.parentElement.clientWidth / key.scrollWidth); });
      if (ratio < 1) {
        const base = parseFloat(getComputedStyle(keys[0]).fontSize);
        keys.forEach((key) => { key.style.fontSize = `${Math.floor(base * ratio)}px`; });
      }
    };
    fitKeys();
    if (document.fonts) document.fonts.ready.then(fitKeys);
    ScrollTrigger.addEventListener('refreshInit', fitKeys);

    // 타임라인 시간 배치
    const SLICE = 1, HOLD0 = 0.4, TRANS = 0.6, HOLD = 0.6;
    const transAt = (k) => SLICE + HOLD0 + (k - 1) * (TRANS + HOLD); // k 번째 단계(0부터)로 넘어가기 시작하는 시간
    const TOTAL = N > 1 ? transAt(N - 1) + TRANS + 0.8 : SLICE + HOLD0; // 마지막 단계는 조금 더 길게 머문 뒤 pin 해제
    // snap: 처음 / 각 단계가 머무는 가운데 / 끝
    const snapPoints = [0, (SLICE + HOLD0 / 2) / TOTAL];
    for (let k = 1; k < N - 1; k++) snapPoints.push((transAt(k) + TRANS + HOLD / 2) / TOTAL);
    if (N > 1) snapPoints.push(1);

    // 지금 단계: 베기가 72% 넘게 열리면 01, 이후 각 전환의 중간을 넘으면 다음 단계
    let current = -2;
    const stepAt = (t) => {
      if (t < 0.72) return -1;
      let k = 0;
      for (let i = 1; i < N; i++) if (t >= transAt(i) + TRANS / 2) k = i;
      return k;
    };
    const setStep = (k) => {
      if (k === current) return;
      current = k;
      if (k < 0) { if (keyTl) keyTl.kill(); keyChars.forEach((_, i) => dimKey(i)); return; }
      playKey(k);
    };

    const snapStep = ScrollTrigger.snapDirectional(snapPoints);
    let trigger = null;
    const vw = (n) => () => window.innerWidth * n / 100;
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: '+=400%',
        pin: true,
        scrub: 1.2,
        // 스크롤한 방향으로 한 단계씩만 붙는다 (빠르게 튕겨도 단계를 건너뛰지 않게 속도 예측은 끔)
        snap: {
          snapTo: (value) => snapStep(value, trigger ? trigger.direction : 1),
          inertia: false,
          duration: { min: 0.9, max: 1.4 },
          ease: 'power2.inOut',
          delay: 0.1,
        },
        invalidateOnRefresh: true,
      },
      // 스크롤 위치(진행도)가 아니라 실제로 그려지는 타임라인 시간으로 단계를 정한다 (scrub 지연 동안 어긋나지 않게)
      onUpdate() { setStep(stepAt(this.time())); },
    });

    // 베기
    if (cut) {
      tl.fromTo(bar, { scaleY: 0 }, { scaleY: 1, duration: 0.18, ease: 'power2.inOut' }, 0)
        .fromTo(left, { x: 0, y: 0, rotation: 0 }, { y: 12, duration: 0.1 }, 0.18)
        .fromTo(right, { x: 0, y: 0, rotation: 0 }, { y: -12, duration: 0.1 }, 0.18)
        .fromTo(mark, { opacity: 1 }, { opacity: 0, duration: 0.1 }, 0.18)
        .to(left, { x: vw(-60), rotation: -2, duration: 0.62, ease: 'power3.inOut' }, 0.28)
        .to(right, { x: vw(60), rotation: 2, duration: 0.62, ease: 'power3.inOut' }, 0.28)
        .set(cut, { pointerEvents: 'none' }, 0.9);
    }
    tl.fromTo(stage, { scale: 1.08, filter: 'brightness(0.5)' }, { scale: 1, filter: 'brightness(1)', duration: 0.62, ease: 'power3.inOut' }, 0.28);

    // 단계 전환
    for (let k = 1; k < N; k++) {
      const at = transAt(k);
      tl.fromTo(photos[k], { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: TRANS, ease: 'power2.inOut', immediateRender: false }, at)
        .fromTo(photoImgs[k - 1], { scale: 1, filter: 'brightness(1)' }, { scale: 1.06, filter: 'brightness(0.6)', duration: TRANS, ease: 'power2.inOut', immediateRender: false }, at)
        // 이전 글자가 빠지는 끝과 새 글자가 들어오는 시작을 살짝 겹쳐 빈 순간이 없게
        .to(copies[k - 1], { y: -24, opacity: 0, duration: TRANS * 0.55, ease: 'power2.in' }, at)
        .fromTo(copies[k], { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: TRANS * 0.55, ease: 'power2.out', immediateRender: false }, at + TRANS * 0.45);
      if (rail) tl.to(rail, { scaleY: (k + 1) / N, duration: TRANS, ease: 'power2.inOut' }, at);
    }
    tl.set({}, {}, TOTAL);
    trigger = tl.scrollTrigger;
  }

  /* ---------- 3-1. 서비스 "A to Z": A·Z 가 벌어지고 그 사이로 서비스가 릴처럼 지나간다 (GSAP ScrollTrigger) ----------
     섹션 pin (PC +=650% / 모바일 +=550%), 타임라인 1개 scrub 1 (진행도 기준)
       0~12%    A → 컨테이너 왼쪽 끝, Z → 오른쪽 끝 (power3.inOut. 모바일은 A·Z 가운데가 화면 끝까지 → 절반쯤 잘림)
                "TO"·한글 한 줄은 0~6%에 y -16·사라짐, START/FINISH 라벨이 나타남
       12~88%   서비스 릴: 항목 수(N)를 읽어 구간을 나눈다. 릴 위치(p)가 한 칸씩 power2.inOut 으로 움직여 가운데에서 잠깐 머문다
                각 항목은 릴 위치와의 거리(d)로 계산: 가운데(d 0) 불투명·scale 1·설명 보임·번호 레드 / 한 칸 위·아래(d ±1) 0.12·scale 0.8
                한 칸 = PC 28vh·모바일 22vh, 단 가운데 항목 설명과 다음 항목 사이가 120px 이상 벌어지게 늘린다
                → 바로 이전·다음 항목이 위아래에 흐리게 보여 "릴이 돌아가는" 느낌
       88~100%  마지막 항목이 위로 빠지고 A·Z 가 다시 가운데로, "TO"·한글 한 줄이 다시 나타남
     배경: 유일한 밝은 섹션. 섹션 위쪽이 화면 아래에 닿을 때부터 pin 이 시작될 때까지 --lt 0 → 1 (검정 → 본, 글자색도 함께),
           pin 이 끝나고 다음 섹션이 올라오는 동안 1 → 0 으로 되돌린다 (scrub)
     모션 줄이기: pin 없이 세로 리스트, 밝은 배경 고정 (CSS 기본 배치) */
  function initAtoZ() {
    const section = document.querySelector('[data-atoz]');
    if (!section || !hasGSAP || reduceMotion) return;
    const a = section.querySelector('[data-atoz-a]');
    const z = section.querySelector('[data-atoz-z]');
    const to = section.querySelector('[data-atoz-to]');
    const line = section.querySelector('[data-atoz-line]');
    const tags = [...section.querySelectorAll('.atoz__tag')];
    const items = [...section.querySelectorAll('[data-atoz-item]')];
    const descs = items.map((item) => item.querySelector('.atoz__desc'));
    const N = items.length;
    if (!a || !z || !N) return;
    section.classList.add('is-reel');
    const isMobile = () => window.matchMedia('(max-width: 760px)').matches;

    // A·Z 가 벌어질 자리 (transform 이 없는 원래 위치 기준 이동량)
    const spread = () => {
      const W = section.clientWidth;
      const aLeft = a.offsetLeft, aW = a.offsetWidth, zLeft = z.offsetLeft, zW = z.offsetWidth;
      if (isMobile()) return { a: -(aLeft + aW / 2), z: W - (zLeft + zW / 2) };
      const gutter = parseFloat(getComputedStyle(section).getPropertyValue('--gutter')) || 56;
      const container = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--container')) || 1360;
      const edge = Math.max(gutter, (W - container) / 2);
      return { a: edge - aLeft, z: (W - edge) - (zLeft + zW) };
    };

    // 릴: p = 지금 가운데에 있는 항목 번호(소수). 항목 i 는 d = i - p 만큼 떨어져 있다
    const FAR = 1.8; // 이만큼 떨어지면 완전히 사라짐
    const WAIT_OPACITY = 0.12, WAIT_SCALE = 0.8, GAP = 120;
    const reel = { p: -FAR };
    // 한 칸 거리: PC 28vh / 모바일 22vh. 단 (가운데 항목 아래 절반 + 120px + 대기 항목 위 절반 × 0.8)보다는 멀게
    let step = 0;
    const measureStep = () => {
      const tallest = Math.max(...items.map((item) => item.offsetHeight));
      step = Math.max(window.innerHeight * (isMobile() ? 0.22 : 0.28), tallest / 2 + GAP + (tallest / 2) * WAIT_SCALE);
    };
    const render = () => {
      if (!step) measureStep();
      items.forEach((item, i) => {
        const d = i - reel.p;
        const ad = Math.abs(d);
        const opacity = ad <= 1 ? 1 - (1 - WAIT_OPACITY) * ad : Math.max(0, WAIT_OPACITY * (1 - (ad - 1) / (FAR - 1)));
        const scale = 1 - (1 - WAIT_SCALE) * Math.min(ad, 1);
        item.style.transform = `translate(-50%, calc(-50% + ${(d * step).toFixed(1)}px)) scale(${scale.toFixed(3)})`;
        item.style.opacity = opacity.toFixed(3);
        if (descs[i]) descs[i].style.opacity = Math.max(0, 1 - ad * 2.5).toFixed(3); // 가운데에 온 항목만 설명
        item.classList.toggle('is-center', ad < 0.3);
      });
    };
    render();
    ScrollTrigger.addEventListener('refresh', () => { measureStep(); render(); });

    const SPREAD = 0.12, END = 0.88, S = (END - SPREAD) / N; // 항목당 구간 (6개면 약 12.7%)
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      onUpdate: render,
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: () => `+=${(isMobile() ? 5.5 : 6.5) * window.innerHeight}`,
        pin: true,
        scrub: 1,
        invalidateOnRefresh: true,
      },
    });

    // 0~12% 벌어짐
    tl.to(a, { x: () => spread().a, duration: SPREAD, ease: 'power3.inOut' }, 0)
      .to(z, { x: () => spread().z, duration: SPREAD, ease: 'power3.inOut' }, 0)
      .to([to, line], { y: -16, opacity: 0, duration: 0.06, ease: 'power2.in' }, 0)
      .to(tags, { opacity: 1, duration: 0.06 }, 0.06);

    // 12~88% 릴: 첫 항목은 반 구간에 들어오고, 한 칸씩 power2.inOut, 마지막 항목은 반 구간에 빠진다
    tl.to(reel, { p: 0, duration: S / 2, ease: 'power2.out' }, SPREAD);
    for (let k = 0; k < N - 1; k++) tl.to(reel, { p: k + 1, duration: S, ease: 'power2.inOut' }, SPREAD + S / 2 + k * S);
    tl.to(reel, { p: N - 1 + FAR, duration: S / 2, ease: 'power2.in' }, END - S / 2);

    // 88~100% 다시 모임
    tl.to([a, z], { x: 0, duration: 1 - END, ease: 'power3.inOut' }, END)
      .to(tags, { opacity: 0, duration: 0.05 }, END)
      .to([to, line], { y: 0, opacity: 1, duration: 0.06, ease: 'power2.out' }, 1 - 0.06);

    // 배경 전환: 들어올 때 검정 → 본, 나갈 때 본 → 검정 (글자색도 --lt 로 함께 반전)
    // 두 구간의 진행도를 곱해 하나의 값으로 → 서로 덮어쓰지 않는다
    let enterP = 0, exitP = 0;
    const applyLight = () => {
      const lt = enterP * (1 - exitP);
      section.style.setProperty('--lt', lt.toFixed(4));
      section.classList.toggle('is-dark', lt < 0.5); // 글자색은 절반에서 뒤집는다
    };
    ScrollTrigger.create({
      trigger: section, start: 'top bottom', end: 'top top',
      onUpdate: (self) => { enterP = self.progress; applyLight(); },
      onRefresh: (self) => { enterP = self.progress; applyLight(); },
    });
    const next = section.parentElement && section.parentElement.classList.contains('pin-spacer')
      ? section.parentElement.nextElementSibling
      : section.nextElementSibling;
    if (next) {
      ScrollTrigger.create({
        trigger: next, start: 'top bottom', end: 'top top',
        onUpdate: (self) => { exitP = self.progress; applyLight(); },
        onRefresh: (self) => { exitP = self.progress; applyLight(); },
      });
    }
    applyLight();
  }

  /* ---------- 4. Process: 화면 한 장 = 패널 하나, 오른쪽 → 왼쪽 가로 스크롤 (GSAP ScrollTrigger) ----------
     패널 N개(선언 → 단계 → 마무리)를 가로로 늘어놓고 섹션을 pin. 트랙이 x 0 → -(N - 1) × 100% (선형, scrub 1)
       pin 길이 = (N - 1) × 화면 높이, snap = 패널 단위(1 / (N - 1)) → 스크롤을 멈추면 가까운 패널이 화면에 딱 맞음
     선언 문장(패널 0): 섹션 위쪽이 화면 40% 지점에 닿으면 어절이 하나씩 "두두두두" 떨어진다 (시간 기반 1회, 위로 되돌아가면 2.5배속 역재생)
       각 어절 y -48 → 0, opacity 0 → 1, back.out(1.7) 0.5s, 간격 0.07s. 강조 어절(<em>)은 착지하는 순간 scale 1.15 → 1
     들어오는 패널 (containerAnimation, 패널 왼쪽 끝이 화면 오른쪽 끝 → 10% 지점을 지나는 동안 scrub):
       사진이 오른쪽에서 열림 clip-path inset(0 0 0 100%) → inset(0), 안쪽 사진 x 15% → 0
       글: 숫자 → 라벨 → 단계명 → 설명 → 칩 순서로 x 120 → 0, opacity 0 → 1 (조금씩 늦게)
     나가는 패널: 그대로 밀려 나가며 opacity 1 → 0.4
     모션 줄이기: pin 없이 세로 나열 (CSS 기본 배치) */
  function initProcess() {
    const section = document.querySelector('[data-process]');
    if (!section) return;
    const title = section.querySelector('[data-process-title]');
    const track = section.querySelector('[data-process-track]');
    const panels = [...section.querySelectorAll('[data-process-panel]')];
    const N = panels.length;
    if (!track || N < 2 || !hasGSAP || reduceMotion) return;

    // 선언 문장을 어절 단위 span 으로 (강조 <em> 은 통째로 한 어절)
    const words = [];
    if (title) {
      title.querySelectorAll('.process__line').forEach((line) => {
        [...line.childNodes].forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            const frag = document.createDocumentFragment();
            node.textContent.split(/(\s+)/).forEach((part) => {
              if (!part) return;
              if (/^\s+$/.test(part)) { frag.append(part); return; }
              const span = document.createElement('span');
              span.className = 'process__word';
              span.textContent = part;
              frag.append(span);
              words.push(span);
            });
            node.replaceWith(frag);
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            node.classList.add('process__word');
            words.push(node);
          }
        });
      });
    }
    // 등장 "두두두두"
    if (words.length) {
      gsap.set(words, { y: -48, opacity: 0 });
      const drop = gsap.timeline({ paused: true });
      words.forEach((w, i) => {
        const at = i * 0.07;
        drop.to(w, { y: 0, opacity: 1, duration: 0.5, ease: 'back.out(1.7)' }, at);
        if (w.tagName === 'EM') drop.fromTo(w, { scale: 1.15 }, { scale: 1, duration: 0.35, ease: 'back.out(3)', immediateRender: false }, at + 0.32);
      });
      ScrollTrigger.create({
        trigger: section,
        start: 'top 40%',
        onEnter: () => drop.timeScale(1).play(),
        onLeaveBack: () => drop.timeScale(2.5).reverse(),
      });
    }

    section.classList.add('is-hscroll');

    // 가로 이동: 한 패널 = 섹션 폭 = 트랙 폭(100%) → xPercent 로 정확히 한 패널씩
    const slide = gsap.to(track, {
      xPercent: -100 * (N - 1),
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: () => `+=${(N - 1) * window.innerHeight}`,
        pin: true,
        pinSpacing: true,
        scrub: 1,
        snap: { snapTo: 1 / (N - 1), duration: { min: 0.4, max: 0.8 }, ease: 'power2.inOut', delay: 0.08 },
        invalidateOnRefresh: true,
      },
    });

    panels.forEach((panel, i) => {
      // 들어오는 패널 (첫 패널은 처음부터 화면에 있음)
      if (i > 0) {
        const media = panel.querySelector('.process__media');
        const img = media && media.querySelector('img');
        const texts = [...panel.querySelectorAll('.process__body > *, .process__outro')];
        const enter = gsap.timeline({
          defaults: { ease: 'power2.out' },
          scrollTrigger: { trigger: panel, containerAnimation: slide, start: 'left right', end: 'left 10%', scrub: true },
        });
        if (media) {
          enter.fromTo(media, { clipPath: 'inset(0% 0% 0% 100%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1 }, 0);
          if (img) enter.fromTo(img, { xPercent: 15 }, { xPercent: 0, duration: 1 }, 0);
        }
        texts.forEach((el, k) => enter.fromTo(el, { x: 120, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7 }, 0.12 + k * 0.08));
      }
      // 나가는 패널: 밀려 나가며 흐려짐 (마지막 패널은 나가지 않음)
      if (i < N - 1) {
        gsap.fromTo(panel, { opacity: 1 }, {
          opacity: 0.4,
          ease: 'none',
          immediateRender: false,
          scrollTrigger: { trigger: panel, containerAnimation: slide, start: 'left left', end: 'right left', scrub: true },
        });
      }
    });

    // 이미지·폰트가 늦게 들어와 위쪽 섹션 높이가 바뀌어도, pin 구간과 다음 섹션 시작 위치가 맞도록 다시 계산
    const refresh = () => ScrollTrigger.refresh();
    if (document.readyState === 'complete') requestAnimationFrame(refresh);
    else window.addEventListener('load', refresh, { once: true });
    if (document.fonts) document.fonts.ready.then(refresh);
  }

  /* ---------- 5. Before / After: 화면 꽉 채운 비교 슬라이더 ----------
     --pos(기본 50%)가 손잡이 위치. before 사진은 손잡이 왼쪽만 보인다
     마우스: 패널 아무 곳이나 누르면 그 위치로, 그대로 드래그
     터치: 가로로 밀거나 톡 누르면 그 위치로 (세로로 쓸면 페이지 스크롤 — touch-action: pan-y)
     드래그하는 동안 Lenis 일시정지. 키보드: 손잡이 포커스 후 ←/→ 5%씩, Home/End
     힌트: 패널이 화면 가운데에 처음 들어오면 1회 50 → 35 → 65 → 50 (1.6s, power2.inOut). 먼저 만지면 생략
     등장: 패널이 들어오는 동안 사진 scale 1.08 → 1 (scrub), 사례 글 y 24 → 0 페이드인 (1회)
     모션 줄이기: 힌트·scale 없음, 50%에서 드래그만 */
  function initCompare() {
    document.querySelectorAll('[data-compare]').forEach((box) => {
      const handle = box.querySelector('.case__handle');
      const knob = box.querySelector('.case__knob');
      const imgs = [...box.querySelectorAll('.case__photo img')];
      const info = box.querySelector('[data-case-info]');
      if (!handle) return;
      const state = { pos: 50 };
      let hint = null;
      let touched = false;

      // 손잡이 원이 화면 밖으로 잘리지 않도록 반지름만큼 안쪽에서 멈춘다
      const set = (value) => {
        const width = box.clientWidth || 1;
        const min = ((knob ? knob.offsetWidth : 56) / 2 / width) * 100;
        state.pos = Math.min(100 - min, Math.max(min, value));
        box.style.setProperty('--pos', `${state.pos}%`);
        handle.setAttribute('aria-valuenow', String(Math.round(state.pos)));
      };
      const toPointer = (e) => {
        const rect = box.getBoundingClientRect();
        set(((e.clientX - rect.left) / rect.width) * 100);
      };
      const touch = () => {
        touched = true;
        if (hint) { hint.kill(); hint = null; }
      };

      let pointer = null; // { id, type, x, y, dragging }
      const begin = () => {
        pointer.dragging = true;
        box.classList.add('is-dragging');
        if (lenis) lenis.stop();
      };
      const end = () => {
        if (pointer && pointer.dragging) {
          box.classList.remove('is-dragging');
          if (lenis) lenis.start();
        }
        pointer = null;
      };
      box.addEventListener('pointerdown', (e) => {
        if (e.button > 0) return;
        touch();
        pointer = { id: e.pointerId, type: e.pointerType, x: e.clientX, y: e.clientY, dragging: false };
        box.setPointerCapture(e.pointerId);
        if (e.pointerType === 'mouse') { begin(); toPointer(e); } // 마우스는 누른 자리로 바로
      });
      box.addEventListener('pointermove', (e) => {
        if (!pointer || e.pointerId !== pointer.id) return;
        if (!pointer.dragging) {
          // 터치: 가로로 8px 이상 밀면 드래그 시작 (세로 움직임이 더 크면 브라우저가 스크롤하고 pointercancel 이 온다)
          if (Math.abs(e.clientX - pointer.x) > 8 && Math.abs(e.clientX - pointer.x) > Math.abs(e.clientY - pointer.y)) begin();
          else return;
        }
        toPointer(e);
      });
      box.addEventListener('pointerup', (e) => {
        if (pointer && !pointer.dragging && pointer.type !== 'mouse') toPointer(e); // 톡 누르면 그 위치로
        end();
      });
      box.addEventListener('pointercancel', end);

      handle.addEventListener('keydown', (e) => {
        const keys = { ArrowLeft: state.pos - 5, ArrowRight: state.pos + 5, Home: 0, End: 100 };
        if (!(e.key in keys)) return;
        e.preventDefault();
        touch();
        set(keys[e.key]);
      });
      window.addEventListener('resize', () => set(state.pos));
      set(50);

      if (reduceMotion || !hasGSAP) return;

      // 힌트: 화면 가운데에 처음 들어올 때 1회
      ScrollTrigger.create({
        trigger: box,
        start: 'top 50%',
        once: true,
        onEnter: () => {
          if (touched) return;
          hint = gsap.timeline({ onUpdate: () => set(state.pos), defaults: { ease: 'power2.inOut' } })
            .to(state, { pos: 35, duration: 0.4 })
            .to(state, { pos: 65, duration: 0.8 })
            .to(state, { pos: 50, duration: 0.4 });
        },
      });
      // 등장: 사진 줌아웃(scrub) + 사례 글 페이드인(1회)
      gsap.fromTo(imgs, { scale: 1.08 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: box, start: 'top bottom', end: 'top top', scrub: true } });
      if (info) {
        gsap.fromTo(info, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: box, start: 'top 40%', once: true } });
      }
    });
  }

  /* ---------- 6. 숫자 카운트업: HTML에 적힌 값이 목표값 ---------- */
  function initCounters() {
    const nums = document.querySelectorAll('[data-count]');
    if (reduceMotion || !('IntersectionObserver' in window)) return;

    nums.forEach((el) => {
      const raw = el.textContent.trim();
      const target = parseFloat(raw.replace(/,/g, ''));
      if (Number.isNaN(target)) return;
      const useComma = raw.includes(',');
      const format = (n) => (useComma ? Math.round(n).toLocaleString('en-US') : String(Math.round(n)));

      el.textContent = format(0);

      const io = new IntersectionObserver((entries) => {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        // 카운트 중 폭이 흔들리지 않도록 최종값 폭을 먼저 잡아 둔다
        el.textContent = raw;
        el.style.minWidth = `${el.getBoundingClientRect().width}px`;
        el.textContent = format(0);
        const duration = 1200;
        const start = performance.now();
        const tick = (time) => {
          const t = Math.min(1, (time - start) / duration);
          el.textContent = format(target * (1 - Math.pow(1 - t, 3)));
          if (t < 1) requestAnimationFrame(tick);
          else el.textContent = raw;
        };
        requestAnimationFrame(tick);
      }, { threshold: 0.5 });
      io.observe(el);
    });
  }

  /* ---------- 7. 후기 마퀴 ---------- */
  function initReviews() {
    const track = document.querySelector('[data-marquee] .reviews__track');
    if (!track) return;
    const perLoop = buildLoop(track);
    if (perLoop) track.style.setProperty('--duration', `${perLoop * 8}s`);
  }

  /* ---------- 9. FAQ 아코디언 (한 번에 하나만 열림) ---------- */
  function initFaq() {
    const items = [...document.querySelectorAll('[data-faq] .faq__item')];
    items.forEach((item, i) => {
      const button = item.querySelector('.faq__q');
      const panel = item.querySelector('.faq__a');
      panel.id = `faq-panel-${i + 1}`;
      button.setAttribute('aria-controls', panel.id);

      button.addEventListener('click', () => {
        const willOpen = !item.classList.contains('is-open');
        items.forEach((other) => {
          other.classList.remove('is-open');
          other.querySelector('.faq__q').setAttribute('aria-expanded', 'false');
        });
        if (willOpen) {
          item.classList.add('is-open');
          button.setAttribute('aria-expanded', 'true');
        }
      });
    });
  }

  /* ---------- 10. 예약 문의 폼: 제출하면 폼 자리에 완료 메시지 ---------- */
  function initForm() {
    const form = document.querySelector('[data-form]');
    const done = document.querySelector('[data-form-done]');
    if (!form || !done) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      // TODO: 실제 접수 연동(메일·시트 등)은 템플릿 사용자가 여기에 추가
      form.hidden = true;
      done.hidden = false;
      done.focus();
    });
  }

  initSmoothScroll();
  initHeader();
  initMenu();
  initWorryCards();
  initHero();
  initReveal();
  initTrust();
  initAtoZ();
  initProcess();
  initCompare();
  initCounters();
  initReviews();
  initFaq();
  initForm();

  if (hasGSAP) {
    window.addEventListener('load', () => ScrollTrigger.refresh());
    if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());
  }
})();
