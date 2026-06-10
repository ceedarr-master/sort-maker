// ── 항목 관리 ──
let itemData = []; // [{name, img}]
let editingImgIdx = -1;
let currentSortData = null;
let editingSortId = null; // 현재 수정 중인 소트의 고유 ID를 추적 (신규 추가)

function addItem(name='', img='') {
  itemData.push({ name, img });
  renderItems();
}

function renderItems() {
  const list = document.getElementById('items-list');
  list.innerHTML = itemData.map((item, i) => `
    <div class="item-row">
      ${item.img
        ? `<img class="item-thumb" src="${escHtml(item.img)}" onclick="openImgModal(${i})" onerror="this.style.display='none'">`
        : `<div class="item-thumb-placeholder" onclick="openImgModal(${i})" title="이미지 추가">이미지</div>`
      }
      <input class="item-name-input" value="${escHtml(item.name)}" placeholder="항목 이름"
        oninput="itemData[${i}].name=this.value">
      <button class="item-del" onclick="delItem(${i})">✕</button>
    </div>`).join('');
}

function delItem(i) {
  itemData.splice(i, 1);
  renderItems();
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── 이미지 모달 ──
function openImgModal(idx) {
  editingImgIdx = idx;
  document.getElementById('img-url-input').value = itemData[idx].img || '';
  const preview = document.getElementById('img-preview');
  if (itemData[idx].img) { preview.src = itemData[idx].img; preview.style.display = 'block'; }
  else { preview.style.display = 'none'; }
  document.getElementById('img-modal').classList.add('open');
}

function closeImgModal() {
  document.getElementById('img-modal').classList.remove('open');
  editingImgIdx = -1;
}

function previewImg() {
  const url = document.getElementById('img-url-input').value.trim();
  const preview = document.getElementById('img-preview');
  if (url) { preview.src = url; preview.style.display = 'block'; }
  else { preview.style.display = 'none'; }
}

function applyImg() {
  if (editingImgIdx < 0) return;
  itemData[editingImgIdx].img = document.getElementById('img-url-input').value.trim();
  renderItems();
  closeImgModal();
}

function removeImg() {
  if (editingImgIdx < 0) return;
  itemData[editingImgIdx].img = '';
  renderItems();
  closeImgModal();
}

document.getElementById('img-modal').addEventListener('click', function(e) {
  if (e.target === this) closeImgModal();
});

// ── 탭 ──
function switchTab(tab, el) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('tab-make').style.display = tab === 'make' ? 'block' : 'none';
  document.getElementById('tab-my').style.display = tab === 'my' ? 'block' : 'none';
  if (tab === 'my') renderMySorts();
}

// ── 유틸 ──
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

function shuffle(a) {
  for (let i = a.length-1; i > 0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

function showAppScreen(appId, screenId) {
  document.querySelectorAll('#'+appId+' .screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
}

function switchApp(id) {
  document.querySelectorAll('#main-app,#play-app').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ── 로컬 저장 ──
function getMySorts() { try { return JSON.parse(localStorage.getItem('sortmaker_sorts')||'[]'); } catch { return []; } }
function saveMySorts(arr) { localStorage.setItem('sortmaker_sorts', JSON.stringify(arr)); }
function genId() { return Math.random().toString(36).slice(2,8).toUpperCase(); }


function makeSortData() {
  const title = document.getElementById('make-title').value.trim();
  const items = itemData.filter(it => it.name.trim()); // 이름이 비어있는 항목은 제외
  return { title, items };
}

// ── 저장 & 공유 링크 ──
// ── 저장 & 공유 링크 (파이어베이스 연동 버전) ──
async function saveSortAndPlay() {
  const { title, items } = makeSortData();
  if (!title) { showToast('제목을 입력해주세요'); return; }
  if (items.length < 2) { showToast('항목을 2개 이상 입력해주세요'); return; }
  
  const sorts = getMySorts();
  let sortObj;

  // 1. 내 브라우저(내 소트 목록)에 저장하는 로직
  if (editingSortId) {
    const idx = sorts.findIndex(x => x.id === editingSortId);
    if (idx !== -1) {
      sorts[idx].title = title;
      sorts[idx].items = items;
      sortObj = sorts[idx];
      showToast('소트가 수정되었습니다');
    } else {
      const id = genId();
      sortObj = { id, title, items, createdAt: Date.now() };
      sorts.unshift(sortObj);
    }
    editingSortId = null;
    document.querySelector('#tab-make .btn-primary').innerHTML = '✅ 저장하고 공유 링크 받기';
    const cancelBtn = document.getElementById('cancel-edit-btn');
    if (cancelBtn) cancelBtn.style.display = 'none';
  } else {
    const id = genId();
    sortObj = { id, title, items, createdAt: Date.now() };
    sorts.unshift(sortObj);
    showToast('소트가 저장되었습니다');
  }
  saveMySorts(sorts);
  
  document.getElementById('make-title').value = '';
  itemData = [];
  addItem(); addItem(); addItem();

// 2. 파이어베이스 클라우드에 데이터 저장하고 '짧은 URL' 받아오기
let shareUrl = '';
try {
  showToast('서버에 링크를 생성 중입니다...');
  
  // 무한 대기 방지용 5초 타이머 강제 생성
  const timeout = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('서버 응답 지연')), 5000)
  );

  let docId = sortObj.fbId;
  let dbTask;
  if (docId) {
    // 기존 문서가 있으면 같은 ID에 덮어써서 링크가 유지되도록 함
    dbTask = window.setDoc(window.doc(window.db, "sorts", docId), {
      title: sortObj.title,
      items: sortObj.items,
      createdAt: Date.now()
    });
  } else {
    dbTask = window.addDoc(window.collection(window.db, "sorts"), {
      title: sortObj.title,
      items: sortObj.items,
      createdAt: Date.now()
    });
  }

  // Promise.race: 5초 안에 DB 저장이 안 되면 강제로 에러 처리(catch)로 넘김
  const result = await Promise.race([dbTask, timeout]);
  if (!docId) docId = result.id;

  // 새로 생성된 문서 ID를 내 소트 목록에도 저장해두어 다음 수정 시 재사용
  if (sortObj.fbId !== docId) {
    sortObj.fbId = docId;
    saveMySorts(sorts);
  }

  // 성공 시 짧은 URL 생성
  shareUrl = location.origin + location.pathname + '#id=' + docId;
} catch (error) {
  console.error("서버 연결 실패: ", error);
  showToast('서버 연결 실패. 기존 긴 링크로 플레이합니다.');
  shareUrl = makeShareUrl({ title: sortObj.title, items: sortObj.items }); // 긴 링크로 우회
}

loadPlayScreen(sortObj, shareUrl);
}

// ── URL 해시 파싱 (파이어베이스 연동 버전) ──
async function checkHash() {
  const hash = location.hash;
  
  // 1. 과거에 만들어둔 엄청 긴 URL(#sort=) 하위 호환성 유지
  if (hash.startsWith('#sort=')) {
    try {
      const data = JSON.parse(decodeURIComponent(escape(atob(hash.slice(6)))));
      if (!data.title || !data.items || data.items.length < 2) return false;
      loadPlayScreen(data, location.href);
      return true;
    } catch { return false; }
  }
  
  // 2. 파이어베이스로 생성된 짧은 URL(#id=) 접속 처리
  if (hash.startsWith('#id=')) {
    const docId = hash.slice(4); // '#id=' 글자 제거
    try {
      showToast('데이터를 불러오는 중입니다...');
      const docSnap = await window.getDoc(window.doc(window.db, "sorts", docId));
      if (docSnap.exists()) {
        loadPlayScreen(docSnap.data(), location.href);
        return true;
      } else {
        showToast('존재하지 않거나 삭제된 소트입니다.');
        return false;
      }
    } catch (error) {
      console.error("불러오기 에러:", error);
      showToast('데이터를 불러오는데 실패했습니다.');
      return false;
    }
  }
  
  return false;
}

function makeShareUrl(data) {
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
  return location.origin + location.pathname + '#sort=' + encoded;
}


// ── 내 목록 ──
function renderMySorts() {
  const sorts = getMySorts();
  const el = document.getElementById('my-sort-list');
  if (!sorts.length) {
    el.innerHTML = '<div class="empty-state"><div class="icon">📭</div><p>아직 만든 소트가 없어요.<br>소트 만들기 탭에서 만들어보세요!</p></div>';
    return;
  }
  el.innerHTML = sorts.map(s => `
    <div class="sort-card">
      <div class="sort-card-info">
        <div class="sort-card-title">${escHtml(s.title)}</div>
        <div class="sort-card-meta">${s.items.length}개 항목 · ${new Date(s.createdAt).toLocaleDateString('ko')}</div>
      </div>
      <div class="sort-card-actions">
        <button class="btn btn-secondary btn-sm" onclick="shareSortById('${s.id}')">공유</button>
        <button class="btn btn-secondary btn-sm" onclick="editSortFromList('${s.id}')">수정</button>
        <button class="btn btn-secondary btn-sm" style="color: #e00;" onclick="deleteSortFromList('${s.id}')">삭제</button>
        <button class="btn btn-primary btn-sm" onclick="playFromList('${s.id}')">플레이</button>
      </div>
    </div>`).join('');
}

function shareSortById(id) {
  const s = getMySorts().find(x=>x.id===id);
  if (!s) return;
  const url = s.fbId
    ? location.origin + location.pathname + '#id=' + s.fbId
    : makeShareUrl({ title: s.title, items: s.items });
  navigator.clipboard.writeText(url).then(()=>showToast('링크 복사됐어요! 친구에게 공유하세요 🎉'));
}

function playFromList(id) {
  const s = getMySorts().find(x=>x.id===id);
  if (!s) return;
  const url = s.fbId
    ? location.origin + location.pathname + '#id=' + s.fbId
    : makeShareUrl({ title: s.title, items: s.items });
  loadPlayScreen(s, url);
}

// ── 플레이 화면 로드 ──
function loadPlayScreen(data, shareUrl) {
  currentSortData = data;
  document.getElementById('play-sort-title').textContent = data.title;
  document.getElementById('play-sort-meta').textContent = data.items.length + '개 항목';
  document.getElementById('play-share-url').textContent = shareUrl;
  document.getElementById('result-share-url').textContent = shareUrl;
  switchApp('play-app');
  showAppScreen('play-app', 'play-setup');
}

function copyShareUrl(elId) {
  const url = document.getElementById(elId).textContent;
  navigator.clipboard.writeText(url).then(()=>showToast('링크 복사됐어요! 🎉'));
}

// ── 정렬 로직 (이진 탐색 + 동률 그룹화) ──
let playItems = [], playHistory = [];
let lstMember = [], parent = [], equal = [], rec = [];
let cmp1 = 0, cmp2 = 0, head1 = 0, head2 = 0, nrec = 0;
let playComparesDone = 0, totalSize = 0, finishSize = 0;

function startPlay() {
  if (!currentSortData) return;
  playItems = shuffle([...currentSortData.items]);
  
  // 구형 파일 기반 변수 구조 초기화
  lstMember = [];
  parent = [];
  equal = new Array(playItems.length).fill(-1);
  rec = new Array(playItems.length).fill(0);
  nrec = 0;
  playComparesDone = 0;
  playHistory = [];
  finishSize = 0;
  totalSize = 0;

  // 순위 배열의 최상단(루트)에 모든 항목 인덱스 할당
  lstMember[0] = [];
  for (let i = 0; i < playItems.length; i++) {
    lstMember[0][i] = i;
  }
  parent[0] = -1;
  
  // 상향식 분할 트리 생성 로직
  let n = 1;
  for (let i = 0; i < lstMember.length; i++) {
    if (lstMember[i].length >= 2) {
      const mid = Math.ceil(lstMember[i].length / 2);
      
      lstMember[n] = lstMember[i].slice(0, mid);
      totalSize += lstMember[n].length;
      parent[n] = i;
      n++;
      
      lstMember[n] = lstMember[i].slice(mid, lstMember[i].length);
      totalSize += lstMember[n].length;
      parent[n] = i;
      n++;
    }
  }
  
  // 비교할 최하위 두 그룹 지정
  cmp1 = lstMember.length - 2;
  cmp2 = lstMember.length - 1;
  head1 = 0;
  head2 = 0;
  
  document.getElementById('play-title-label').textContent = currentSortData.title;
  switchApp('play-app');
  showAppScreen('play-app', 'play-sorting');
  playNext();
}

function renderChoiceBtn(btnEl, item) {
  btnEl.innerHTML = '';
  if (item.img) {
    btnEl.classList.remove('text-only');
    const img = document.createElement('img');
    img.className = 'choice-img';
    img.src = item.img;
    img.alt = item.name;
    img.onerror = () => img.remove();
    btnEl.appendChild(img);
  } else {
    btnEl.classList.add('text-only');
  }
  const lbl = document.createElement('div');
  lbl.className = 'choice-label';
  lbl.textContent = item.name;
  btnEl.appendChild(lbl);
}

function playNext() {
  if (cmp1 < 0) { showPlayResult(); return; }
  
  renderChoiceBtn(document.getElementById('play-btn-left'), playItems[lstMember[cmp1][head1]]);
  renderChoiceBtn(document.getElementById('play-btn-right'), playItems[lstMember[cmp2][head2]]); 
  updatePlayProgress();
}

function playChoose(side) {
  if (cmp1 < 0) return;
  
  // 되돌리기(Undo)용 이전 상태 보존 (배열 깊은 복사 포함)
  playHistory.push({
    lstMember: lstMember.map(arr => [...arr]),
    parent: [...parent],
    equal: [...equal],
    rec: [...rec],
    cmp1: cmp1,
    cmp2: cmp2,
    head1: head1,
    head2: head2,
    nrec: nrec,
    finishSize: finishSize,
    playComparesDone: playComparesDone
  });
  
  playComparesDone++;
  
  let flag = 0;
  if (side === 'left') flag = -1;
  else if (side === 'right') flag = 1;
  else flag = 0; // 'both' 또는 'neither' 선택 시 동률 처리

  // 구형 파일의 원본 병합 정렬 소팅 알고리즘 메커니즘
  if (flag < 0) {
    rec[nrec] = lstMember[cmp1][head1];
    head1++;
    nrec++;
    finishSize++;
    while (equal[rec[nrec - 1]] !== -1) {
      rec[nrec] = lstMember[cmp1][head1];
      head1++;
      nrec++;
      finishSize++;
    }
  } else if (flag > 0) {
    rec[nrec] = lstMember[cmp2][head2];
    head2++;
    nrec++;
    finishSize++;
    while (equal[rec[nrec - 1]] !== -1) {
      rec[nrec] = lstMember[cmp2][head2];
      head2++;
      nrec++;
      finishSize++;
    }
  } else {
    // 동률 발생 시 포인터 체이닝 링크 생성
    rec[nrec] = lstMember[cmp1][head1];
    head1++;
    nrec++;
    finishSize++;
    while (equal[rec[nrec - 1]] !== -1) {
      rec[nrec] = lstMember[cmp1][head1];
      head1++;
      nrec++;
      finishSize++;
    }
    
    equal[rec[nrec - 1]] = lstMember[cmp2][head2];
    
    rec[nrec] = lstMember[cmp2][head2];
    head2++;
    nrec++;
    finishSize++;
    while (equal[rec[nrec - 1]] !== -1) {
      rec[nrec] = lstMember[cmp2][head2];
      head2++;
      nrec++;
      finishSize++;
    }
  }

  // 한쪽 리스트 순회가 끝난 후 남은 요소들 자동 이동 처리
  if (head1 < lstMember[cmp1].length && head2 === lstMember[cmp2].length) {
    while (head1 < lstMember[cmp1].length) {
      rec[nrec] = lstMember[cmp1][head1];
      head1++;
      nrec++;
      finishSize++;
    }
  } else if (head1 === lstMember[cmp1].length && head2 < lstMember[cmp2].length) {
    while (head2 < lstMember[cmp2].length) {
      rec[nrec] = lstMember[cmp2][head2];
      head2++;
      nrec++;
      finishSize++;
    }
  }

  // 두 그룹의 병합이 완수되면 부모 배열 슬롯 갱신 후 메모리 해제
  if (head1 === lstMember[cmp1].length && head2 === lstMember[cmp2].length) {
    for (let i = 0; i < lstMember[cmp1].length + lstMember[cmp2].length; i++) {
      lstMember[parent[cmp1]][i] = rec[i];
    }
    lstMember.pop();
    lstMember.pop();
    cmp1 = cmp1 - 2;
    cmp2 = cmp2 - 2;
    head1 = 0;
    head2 = 0;

    if (head1 === 0 && head2 === 0) {
      for (let i = 0; i < playItems.length; i++) {
        rec[i] = 0;
      }
      nrec = 0;
    }
  }

  playNext();
}

function playUndo() {
  if (!playHistory.length) return;
  const prev = playHistory.pop();
  
  lstMember = prev.lstMember;
  parent = prev.parent;
  equal = prev.equal;
  rec = prev.rec;
  cmp1 = prev.cmp1;
  cmp2 = prev.cmp2;
  head1 = prev.head1;
  head2 = prev.head2;
  nrec = prev.nrec;
  finishSize = prev.finishSize;
  playComparesDone = prev.playComparesDone;
  
  playNext();
}

function updatePlayProgress() {
  // 구형 파일식 연산 기준 적용 (시작 시 정확히 0% 보장됨)
  let pct = Math.floor((finishSize * 100) / (totalSize || 1));
  
  if (pct > 99 && cmp1 >= 0) pct = 99; 
  if (pct < 0) pct = 0;
  
  document.getElementById('play-progress-pct').textContent = pct + '%';
  document.getElementById('play-progress-fill').style.width = pct + '%';
  document.getElementById('play-battle-count').textContent = (playComparesDone + 1) + '번째 배틀';
}

function showPlayResult() {
  document.getElementById('play-progress-fill').style.width = '100%';
  document.getElementById('play-progress-pct').textContent = '100%';
  document.getElementById('play-result-title').textContent = currentSortData.title + ' 결과';  
  
  const medals = ['🥇', '🥈', '🥉'];
  const list = document.getElementById('play-result-list');
  
  let ranking = 1;
  let sameRank = 1;
  let htmlArr = [];
  
  const totalItems = playItems.length;
  const sortedIndices = lstMember[0]; // 최종 합산 및 정렬이 완료된 최상단 인덱스 배열
  
  for (let i = 0; i < totalItems; i++) {
    const currentIdx = sortedIndices[i];
    const rc = ranking <= 3 ? ' rank-' + ranking : '';
    const badge = ranking <= 3 ? `<div class="rank-badge">${medals[ranking - 1]}</div>` : `<div class="rank-num-plain">${ranking}위</div>`;
    
    const item = playItems[currentIdx];
    const imgHtml = item.img ? `<img class="result-thumb" src="${escHtml(item.img)}" alt="${escHtml(item.name)}" onerror="this.remove()">` : '';
    
    htmlArr.push(`<div class="result-item${rc}">${badge}${imgHtml}<div class="result-name">${escHtml(item.name)}</div></div>`);
    
    // 구형 포인터 체인 기법을 통한 표준 경쟁 순위 계산
    if (i < totalItems - 1) {
      const nextIdx = sortedIndices[i + 1];
      if (equal[currentIdx] === nextIdx) {
        sameRank++;
      } else {
        ranking += sameRank;
        sameRank = 1;
      }
    }
  }
  
  list.innerHTML = htmlArr.join('');
  showAppScreen('play-app', 'play-result');
}


// ── 초기화 ──
// ── 초기화 (수정됨) ──
window.addEventListener('load', async () => {
  const hasHash = await checkHash();
  if (!hasHash) {
    addItem(); addItem(); addItem();
  }
});
window.addEventListener('hashchange', checkHash);

// script.js 최하단에 추가

// ── 결과창에서 메인 만들기 화면으로 이동 ──
function goToMakeScreen() {
  // 1. 공유 링크(#sort=...)로 접속해 플레이했던 경우, 주소창의 해시 파라미터를 제거합니다.
  if (location.hash.startsWith('#sort=')) {
    location.hash = '';
    
    // 새로운 소트를 온전히 작성할 수 있도록 기존 입력 폼 데이터를 맑게 비웁니다.
    document.getElementById('make-title').value = '';
    itemData = [];
    addItem(); addItem(); addItem();
  }
  
  // 2. 플레이 앱 화면을 닫고 메인 앱 화면으로 컴포넌트를 전환합니다.
  switchApp('main-app');
  
  // 3. 상단 탭 중 첫 번째인 '소트 만들기' 탭을 활성화 상태로 바꿉니다.
  const makeTabEl = document.querySelector('.tabs .tab:nth-child(1)');
  switchTab('make', makeTabEl);
}

// ── 소트 데이터 수정 및 삭제 제어 로직 ──
function editSortFromList(id) {
  const sorts = getMySorts();
  const s = sorts.find(x => x.id === id);
  if (!s) return;

  editingSortId = id;
  
  document.getElementById('make-title').value = s.title;
  itemData = s.items.map(it => ({ ...it })); 
  renderItems();

  document.querySelector('#tab-make .btn-primary').innerHTML = '💾 수정 완료하고 공유 링크 받기';
  
  const cancelBtn = document.getElementById('cancel-edit-btn');
  if (cancelBtn) cancelBtn.style.display = 'inline-flex'; // 복잡한 생성 코드 삭제됨

  const makeTabEl = document.querySelector('.tabs .tab:nth-child(1)');
  switchTab('make', makeTabEl);
}

function cancelEditing() {
  editingSortId = null;
  document.getElementById('make-title').value = '';
  itemData = [];
  renderItems();
  addItem(); addItem(); addItem();

  document.querySelector('#tab-make .btn-primary').innerHTML = '✅ 저장하고 공유 링크 받기';
  const cancelBtn = document.getElementById('cancel-edit-btn');
  if (cancelBtn) cancelBtn.style.display = 'none';
}

async function deleteSortFromList(id) {
  if (!confirm('정말로 이 소트를 삭제하시겠습니까? 삭제된 데이터는 복구할 수 없습니다.')) return;

  let sorts = getMySorts();
  const target = sorts.find(x => x.id === id);
  sorts = sorts.filter(x => x.id !== id);
  saveMySorts(sorts);

  if (target && target.fbId) {
    try {
      await window.deleteDoc(window.doc(window.db, "sorts", target.fbId));
    } catch (error) {
      console.error("공유 링크 삭제 실패:", error);
    }
  }

  showToast('소트가 삭제되었습니다');
  renderMySorts();
}