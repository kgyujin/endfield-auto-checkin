// 1. 페이지 로드 시 자동 팝업 (기존 유지)
chrome.storage.local.get(['accountInfo'], (data) => {
    if (data.accountInfo && data.accountInfo.cred) return;
    showSyncPrompt();
});

// [핵심 추가] popup.js의 요청을 듣는 리스너 (이게 없어서 실패했던 것임)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getLocalStorage") {
        try {
            const data = scanForAccountData();
            sendResponse(data);
        } catch (e) {
            console.error('Error scanning account data:', e);
            sendResponse({ cred: null, role: null });
        }
        // Return true to indicate we will send a response asynchronously
        return true;
    }
});

// [기능 강화] 정밀 데이터 탐색 함수 (단순 키 조회 -> 패턴 매칭으로 변경)
function scanForAccountData() {
    let cred = null;
    let role = null;

    // A. Storage (Local & Session) 정밀 스캔
    const storages = [localStorage, sessionStorage];
    const credRegex = /^[A-Za-z0-9]{32}$/; // 32자리 영문+숫자 (cred 토큰 패턴)
    const roleRegex = /^\d+_\d+_\d+$/;     // 숫자_숫자_숫자 (role 패턴)

    storages.forEach(store => {
        try {
            for (let i = 0; i < store.length; i++) {
                const key = store.key(i);
                const val = store.getItem(key);

                if (!val) continue;

                // 1) 키 이름으로 찾기
                if (!cred && (key === 'cred' || key === 'CRED' || key === 'sk_cred')) cred = val;
                if (!role && (key === 'sk-game-role' || key === 'current_role_id')) role = val;

                // 2) 값의 패턴으로 찾기 (키 이름이 달라도 찾음)
                if (!cred && credRegex.test(val)) cred = val;
                if (!role && roleRegex.test(val)) role = val;

                // 3) JSON 내부 탐색 (auth_data 같은 객체 안에 숨은 경우)
                if ((!cred || !role) && val.startsWith('{')) {
                    try {
                        const parsed = JSON.parse(val);
                        // cred 찾기
                        if (!cred) {
                            if (parsed.cred) cred = parsed.cred;
                            else if (parsed.token && credRegex.test(parsed.token)) cred = parsed.token;
                        }
                        // role 찾기
                        if (!role) {
                            if (parsed.role) role = parsed.role;
                            else if (parsed.gameRole) role = parsed.gameRole;
                        }
                    } catch (e) { /* JSON 파싱 에러 무시 */ }
                }
            }
        } catch(e) { console.error("Storage Access Error:", e); }
    });

    // B. Cookie 스캔 (HttpOnly가 아닌 것들, 2차 백업)
    if (!cred || !role) {
        const cookies = document.cookie.split(';');
        for (let c of cookies) {
            const parts = c.trim().split('=');
            if(parts.length < 2) continue;
            const k = parts[0];
            const v = parts.slice(1).join('='); // 값에 =이 포함될 경우 대비

            if (!cred && (k === 'cred' || k === 'sk_cred')) cred = v;
            if (!role && (k === 'sk-game-role' || k === 'sk_game_role')) role = decodeURIComponent(v);
        }
    }

    return { cred, role };
}

// 화면 좌측 하단 팝업 생성
function showSyncPrompt() {
    if (document.getElementById('endfield-sync-prompt')) return;

    const div = document.createElement('div');
    div.id = "endfield-sync-prompt";
    div.style.cssText = `
        position: fixed; bottom: 20px; left: 20px; z-index: 10000;
        background: rgba(26, 26, 26, 0.95); border: 1px solid rgba(255, 255, 255, 0.15);
        backdrop-filter: blur(10px); padding: 16px; border-radius: 12px;
        color: white; font-family: sans-serif; box-shadow: 0 10px 30px rgba(0,0,0,0.6);
        display: flex; flex-direction: column; gap: 10px; width: 260px; font-size: 13px;
    `;

    div.innerHTML = `
        <div style="font-weight:700; color:#D4D94A;">⚡ 자동 출석 계정 연동</div>
        <div style="color:#ccc; line-height:1.4;">로그인된 계정으로<br>자동 출석을 설정하시겠습니까?</div>
        <div style="display:flex; gap:8px;">
            <button id="btn-sync-yes" style="flex:1; background:#D4D94A; border:none; padding:8px 0; border-radius:6px; font-weight:700; cursor:pointer; color:#1A1A1A;">네</button>
            <button id="btn-sync-no" style="flex:1; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.1); padding:8px 0; border-radius:6px; color:#fff; cursor:pointer;">아니오</button>
        </div>
    `;

    document.body.appendChild(div);

    document.getElementById('btn-sync-yes').addEventListener('click', () => {
        const data = scanForAccountData();
        chrome.runtime.sendMessage({ action: "syncAccount", storageData: data }, (res) => {
            if (res && res.code === "SUCCESS") {
                alert("연동 완료!");
                div.remove();
            } else {
                alert("연동 실패: " + (res ? res.msg : "응답 없음"));
            }
        });
    });

    document.getElementById('btn-sync-no').addEventListener('click', () => {
        div.remove();
    });
}