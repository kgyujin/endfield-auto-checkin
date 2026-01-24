chrome.storage.local.get(['accountInfo'], (data) => {
    if (data.accountInfo && data.accountInfo.cred) return;
    showSyncPrompt();
});

function getAccountData() {
    let cred = null;
    let role = null;

    // 1. Storage 스캔
    const keys = ['cred', 'CRED', 'sk_cred'];
    const rKeys = ['sk-game-role', 'SK-GAME-ROLE', 'sk_game_role'];
    
    for(let k of keys) {
        cred = localStorage.getItem(k) || sessionStorage.getItem(k);
        if(cred) break;
    }
    for(let k of rKeys) {
        role = localStorage.getItem(k) || sessionStorage.getItem(k);
        if(role) break;
    }

    // 2. Cookie 스캔
    if(!cred || !role) {
        const cookies = document.cookie.split(';');
        for(let c of cookies) {
            const [k, v] = c.trim().split('=');
            if(!cred && (k==='cred' || k==='sk_cred')) cred = v;
            if(!role && (k==='sk-game-role' || k==='sk_game_role')) role = decodeURIComponent(v);
        }
    }

    return { cred, role };
}

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
        const data = getAccountData();
        // cred가 없어도 일단 보냄 (백그라운드가 쿠키를 뒤질 기회를 줌)
        chrome.runtime.sendMessage({ action: "syncAccount", data: data }, (res) => {
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