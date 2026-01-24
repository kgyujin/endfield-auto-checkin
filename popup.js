const storage = chrome.storage.local;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. 데이터 로드 및 UI 초기화
    const data = await storage.get(['isGlobalActive', 'lastStatus', 'lastCheckDate', 'lastCheckTime', 'accountInfo', 'checkInLogs', 'isRunning']);
    
    document.getElementById('globalToggle').checked = data.isGlobalActive !== false;
    renderStatus(data);
    renderLogs(data.checkInLogs);
    renderAccountInfo(data.accountInfo);

    // 2. 이벤트 리스너
    document.getElementById('btnSettings').addEventListener('click', () => {
        document.getElementById('mainView').style.display = 'none';
        document.getElementById('settingsView').style.display = 'flex';
    });

    document.getElementById('btnBack').addEventListener('click', () => {
        document.getElementById('settingsView').style.display = 'none';
        document.getElementById('mainView').style.display = 'block';
    });

    // [핵심] 계정 연동 버튼
    document.getElementById('btnSync').addEventListener('click', handleSyncClick);
    
    document.getElementById('runNowBtn').addEventListener('click', handleManualRun);
    
    document.getElementById('globalToggle').addEventListener('change', (e) => {
        storage.set({ isGlobalActive: e.target.checked });
        location.reload();
    });

    document.getElementById('btnUnlink').addEventListener('click', () => {
        if (!confirm("정말 계정 연동을 해제하시겠습니까?\n자동 출석이 중단됩니다.")) return;
        chrome.runtime.sendMessage({ action: "logout" }, (res) => {
            if (res && res.code === "SUCCESS") {
                alert("연동이 해제되었습니다.");
                renderAccountInfo(null);
                storage.get(['checkInLogs'], (d) => renderLogs(d.checkInLogs));
            }
        });
    });

    // 3. 상태 변화 감지
    chrome.storage.onChanged.addListener((changes) => {
        storage.get(null, (newData) => {
            renderStatus(newData);
            if(changes.checkInLogs) renderLogs(newData.checkInLogs);
            if(changes.accountInfo) renderAccountInfo(newData.accountInfo);
        });
    });
});

// --- 핸들러 함수 ---

async function handleSyncClick() {
    const btn = document.getElementById('btnSync');
    btn.innerText = "분석 중...";
    btn.disabled = true;

    // 현재 탭 확인
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // 1. 엔드필드 사이트인지 확인
    if (!tab.url.includes("skport.com")) {
        alert("SKPORT 엔드필드 출석체크 페이지에서 실행해주세요.");
        btn.innerText = "계정 연동 갱신";
        btn.disabled = false;
        return;
    }

    // 2. content.js에 로컬 스토리지 데이터 요청
    chrome.tabs.sendMessage(tab.id, { action: "getLocalStorage" }, (response) => {
        // 응답이 없어도(null) 백그라운드에서 쿠키로 시도하도록 함
        const storageData = response || {};

        // 3. 백그라운드에 최종 연동 요청 (스토리지 데이터 + 쿠키 스캔 요청)
        chrome.runtime.sendMessage({ 
            action: "syncAccount", 
            storageData: storageData 
        }, (res) => {
            btn.innerText = "계정 연동 갱신";
            btn.disabled = false;
            
            if (res && res.code === "SUCCESS") {
                renderAccountInfo(res.data);
                storage.get(['checkInLogs'], (d) => renderLogs(d.checkInLogs));
                alert("연동 완료! 모든 인증 정보가 안전하게 저장되었습니다.");
            } else {
                alert("연동 실패: " + (res ? res.msg : "알 수 없는 오류"));
            }
        });
    });
}

function handleManualRun() {
    chrome.runtime.sendMessage({ action: "manualRun" });
    document.getElementById('statusDisplay').innerHTML = '<span style="color:#FF9500">Checking...</span>';
}

// --- 렌더링 함수 ---

function renderStatus(data) {
    const statusEl = document.getElementById('statusDisplay');
    const timeEl = document.getElementById('lastRunDisplay');

    if (data.isGlobalActive === false) {
        statusEl.innerHTML = '<span style="color:#666">OFF</span>';
        return;
    }

    // ALREADY_DONE도 SUCCESS로 통합 저장되므로 SUCCESS만 체크
    if (data.lastStatus === "SUCCESS") {
        statusEl.innerHTML = '<span style="color:#34C759">완료 (O)</span>';
    } else if (data.lastStatus === "FAIL" || data.lastStatus === "NOT_LOGGED_IN") {
        statusEl.innerHTML = '<span style="color:#FF3B30">실패 (X)</span>';
    } else {
        statusEl.innerHTML = '<span style="color:#FF9500">대기 중</span>';
    }

    timeEl.innerText = data.lastCheckTime ? `마지막 실행: ${data.lastCheckTime}` : "마지막 실행: -";
}

function renderLogs(logs) {
    const list = document.getElementById('logList');
    list.innerHTML = "";
    
    if (!logs || logs.length === 0) {
        list.innerHTML = "<div style='text-align:center; color:#666; padding:10px;'>기록 없음</div>";
        return;
    }

    logs.forEach(log => {
        const div = document.createElement('div');
        div.className = "log-item";
        div.innerHTML = `
            <div>
                <div class="log-date">${log.date}</div>
                <div class="log-msg">${log.msg}</div>
            </div>
            <div class="log-status ${log.status}">${log.status}</div>
        `;
        list.appendChild(div);
    });
}

function renderAccountInfo(info) {
    const el = document.getElementById('userInfo');
    const btnSync = document.getElementById('btnSync');
    const btnUnlink = document.getElementById('btnUnlink');
    
    if (info && info.cred) {
        el.innerHTML = `연동됨 <span style="color:#34C759">●</span><br><span style="font-size:10px;color:#888; font-weight:400">최근: ${info.lastSync}</span>`;
        btnSync.innerText = "연동 갱신";
        btnUnlink.style.display = "block";
    } else {
        el.innerHTML = `연동 안됨 <span style="color:#FF3B30">●</span><br><span style="font-size:10px;color:#888; font-weight:400">로그인 후 버튼을 눌러주세요</span>`;
        btnSync.innerText = "계정 연동하기";
        btnUnlink.style.display = "none";
    }
}