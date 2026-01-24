const storage = chrome.storage.local;

document.addEventListener('DOMContentLoaded', async () => {
    // 로드
    const data = await storage.get(['isGlobalActive', 'lastStatus', 'lastCheckDate', 'lastCheckTime', 'accountInfo', 'checkInLogs', 'isRunning']);
    
    // UI 반영
    document.getElementById('globalToggle').checked = data.isGlobalActive !== false;
    renderStatus(data);
    renderLogs(data.checkInLogs);
    renderAccountInfo(data.accountInfo);

    // [이벤트] 톱니바퀴
    document.getElementById('btnSettings').addEventListener('click', () => {
        document.getElementById('mainView').style.display = 'none';
        document.getElementById('settingsView').style.display = 'flex';
    });

    // [이벤트] 뒤로가기
    document.getElementById('btnBack').addEventListener('click', () => {
        document.getElementById('settingsView').style.display = 'none';
        document.getElementById('mainView').style.display = 'block';
    });

    // [이벤트] 계정 연동 (팝업에서 버튼 누를 때)
    document.getElementById('btnSync').addEventListener('click', async () => {
        const btn = document.getElementById('btnSync');
        btn.innerText = "분석 중...";
        btn.disabled = true;

        // 현재 탭에서 실행
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab.url.includes("skport.com")) {
            alert("엔드필드 출석체크 페이지에서 실행해주세요.");
            btn.innerText = "계정 연동 갱신";
            btn.disabled = false;
            return;
        }

        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                // 브라우저 컨텍스트
                return {
                    cred: localStorage.getItem('cred'),
                    role: localStorage.getItem('sk-game-role') || localStorage.getItem('current_role_id')
                };
            }
        }, (results) => {
            const data = results[0]?.result;
            
            if (!data || !data.cred) {
                 alert("로그인 정보를 찾을 수 없습니다. 사이트에 로그인되어 있는지 확인해주세요.");
                 btn.innerText = "계정 연동 갱신";
                 btn.disabled = false;
                 return;
            }

            chrome.runtime.sendMessage({ action: "syncAccount", data: data }, (res) => {
                btn.innerText = "계정 연동 갱신";
                btn.disabled = false;
                
                if (res && res.code === "SUCCESS") {
                    renderAccountInfo(res.data);
                    storage.get(['checkInLogs'], (d) => renderLogs(d.checkInLogs));
                    alert("연동 완료!");
                } else {
                    alert("연동 실패: " + (res ? res.msg : "오류"));
                }
            });
        });
    });

    // ... (나머지 수동 실행, 토글 이벤트 등은 기존과 동일)
    document.getElementById('runNowBtn').addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: "manualRun" });
        document.getElementById('statusDisplay').innerHTML = '<span style="color:#FF9500">Checking...</span>';
    });
    
    document.getElementById('globalToggle').addEventListener('change', (e) => {
        storage.set({ isGlobalActive: e.target.checked });
        location.reload();
    });

    chrome.storage.onChanged.addListener((changes) => {
        storage.get(null, (newData) => {
            renderStatus(newData);
            if(changes.checkInLogs) renderLogs(newData.checkInLogs);
            if(changes.accountInfo) renderAccountInfo(newData.accountInfo);
        });
    });
});

function renderStatus(data) {
    const statusEl = document.getElementById('statusDisplay');
    const timeEl = document.getElementById('lastRunDisplay');

    if (data.isGlobalActive === false) {
        statusEl.innerHTML = '<span style="color:#666">OFF</span>';
        return;
    }

    // 성공 또는 이미 완료 -> 그냥 초록색 완료
    if (data.lastStatus === "SUCCESS" || data.lastStatus === "ALREADY_DONE") {
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

    // 3개만 자르기 (혹시 모르니)
    logs.slice(0, 3).forEach(log => {
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
    const btn = document.getElementById('btnSync');
    
    if (info && info.lastSync) {
        el.innerHTML = `연동됨 <span style="color:#34C759">●</span><br><span style="font-size:10px;color:#888; font-weight:400">${info.lastSync}</span>`;
        btn.innerText = "연동 갱신";
    } else {
        el.innerHTML = `연동 안됨 <span style="color:#FF3B30">●</span>`;
        btn.innerText = "계정 연동하기";
    }
}