const storage = chrome.storage.local;

document.addEventListener('DOMContentLoaded', async () => {
    // Load i18n script first
    await loadI18n();
    
    // 1. 데이터 로드 및 UI 초기화
    const data = await storage.get(['isGlobalActive', 'lastStatus', 'lastCheckDate', 'lastCheckTime', 'accountInfo', 'checkInLogs', 'isRunning', 'language']);
    
    // Set language if saved
    if (data.language && window.i18n) {
        window.i18n.setLanguage(data.language);
    }
    
    document.getElementById('globalToggle').checked = data.isGlobalActive !== false;
    renderStatus(data);
    renderLogs(data.checkInLogs);
    renderAccountInfo(data.accountInfo);
    updateUIWithLanguage();
    updateCheckNowButton(data.isGlobalActive);

    // 2. 이벤트 리스너
    document.getElementById('btnSettings').addEventListener('click', () => {
        document.getElementById('mainView').style.display = 'none';
        document.getElementById('settingsView').style.display = 'flex';
    });

    document.getElementById('btnBack').addEventListener('click', () => {
        document.getElementById('settingsView').style.display = 'none';
        document.getElementById('mainView').style.display = 'block';
    });

    // 계정 연동 버튼
    document.getElementById('btnSync').addEventListener('click', handleSyncClick);
    
    // 수동 실행 버튼
    document.getElementById('runNowBtn').addEventListener('click', handleManualRun);
    
    // 토글 스위치
    document.getElementById('globalToggle').addEventListener('change', (e) => {
        const isActive = e.target.checked;
        storage.set({ isGlobalActive: isActive });
        updateCheckNowButton(isActive);
        // Reload is not needed, just update UI
    });

    // 연동 해제 버튼
    document.getElementById('btnUnlink').addEventListener('click', () => {
        const confirmMsg = window.i18n ? window.i18n.t('account.unlinkConfirm') : "정말 계정 연동을 해제하시겠습니까?\n자동 출석이 중단됩니다.";
        if (!confirm(confirmMsg)) return;
        
        chrome.runtime.sendMessage({ action: "logout" }, (res) => {
            if (res && res.code === "SUCCESS") {
                const successMsg = window.i18n ? window.i18n.t('account.unlinkSuccess') : "연동이 해제되었습니다.";
                alert(successMsg);
                renderAccountInfo(null);
                storage.get(['checkInLogs'], (d) => renderLogs(d.checkInLogs));
            } else {
                const errorMsg = window.i18n ? window.i18n.t('error.unknown') : "알 수 없는 오류";
                alert(errorMsg);
            }
        });
    });

    // Language toggle (add to header if needed)
    setupLanguageToggle();

    // 3. 상태 변화 감지
    chrome.storage.onChanged.addListener((changes) => {
        storage.get(null, (newData) => {
            renderStatus(newData);
            if(changes.checkInLogs) renderLogs(newData.checkInLogs);
            if(changes.accountInfo) renderAccountInfo(newData.accountInfo);
            if(changes.isGlobalActive !== undefined) {
                updateCheckNowButton(newData.isGlobalActive);
            }
        });
    });
});

// Load i18n script
function loadI18n() {
    return new Promise((resolve) => {
        // Check if i18n is already loaded
        if (window.i18n) {
            window.i18n.init();
            resolve();
            return;
        }
        
        const script = document.createElement('script');
        script.src = 'i18n.js';
        script.onload = () => {
            if (window.i18n) {
                window.i18n.init();
            }
            resolve();
        };
        script.onerror = () => {
            console.warn('Failed to load i18n.js');
            resolve();
        };
        document.head.appendChild(script);
    });
}

// Setup language toggle
function setupLanguageToggle() {
    // Add language toggle button to header if not exists
    const headerControls = document.querySelector('.header-controls');
    if (headerControls && !document.getElementById('langToggle')) {
        const langBtn = document.createElement('button');
        langBtn.id = 'langToggle';
        langBtn.className = 'icon-btn';
        langBtn.title = 'Language / 언어';
        langBtn.innerHTML = '🌐';
        langBtn.style.fontSize = '16px';
        langBtn.addEventListener('click', () => {
            if (window.i18n) {
                const newLang = window.i18n.currentLang === 'ko' ? 'en' : 'ko';
                window.i18n.setLanguage(newLang);
                updateUIWithLanguage();
            }
        });
        headerControls.insertBefore(langBtn, headerControls.firstChild);
    }
}

// Update UI with current language
window.updateUIWithLanguage = function() {
    if (!window.i18n) return;
    
    const t = window.i18n.t.bind(window.i18n);
    
    // Update buttons
    const btnSync = document.getElementById('btnSync');
    const accountInfo = document.getElementById('userInfo');
    if (accountInfo && accountInfo.textContent.includes('연동')) {
        // Only update if account is not linked
        if (!accountInfo.textContent.includes('연동됨')) {
            btnSync.innerText = t('account.syncButton');
        }
    }
    
    // Update section titles
    const sectionTitles = document.querySelectorAll('.section-title');
    if (sectionTitles.length >= 1) {
        sectionTitles[0].textContent = t('settings.title');
    }
    if (sectionTitles.length >= 2) {
        sectionTitles[1].textContent = t('settings.logs');
    }
    
    // Update back button
    const btnBack = document.getElementById('btnBack');
    if (btnBack) btnBack.textContent = t('settings.back');
    
    // Update site link
    const siteLink = document.querySelector('.site-link');
    if (siteLink) siteLink.textContent = t('settings.siteLink');
    
    // Re-render account info and status
    storage.get(['accountInfo', 'lastStatus', 'lastCheckTime', 'isGlobalActive'], (data) => {
        renderStatus(data);
        renderAccountInfo(data.accountInfo);
    });
};

// --- 핸들러 함수 ---

async function handleSyncClick() {
    if (!window.i18n) {
        await loadI18n();
    }
    const t = window.i18n ? window.i18n.t.bind(window.i18n) : (key) => key;
    
    const btn = document.getElementById('btnSync');
    btn.innerText = t('account.analyzing');
    btn.disabled = true;

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab || !tab.url || !tab.url.includes("skport.com")) {
            alert(t('account.syncRequired'));
            btn.innerText = t('account.syncUpdate');
            btn.disabled = false;
            return;
        }

        chrome.tabs.sendMessage(tab.id, { action: "getLocalStorage" }, (response) => {
            // Handle communication errors
            if (chrome.runtime.lastError) {
                console.warn('Content script communication error:', chrome.runtime.lastError.message);
                // Continue with empty data - background will try to get from cookies
            }
            
            const storageData = response || {};

            chrome.runtime.sendMessage({ 
                action: "syncAccount", 
                storageData: storageData 
            }, (res) => {
                // Handle response errors
                if (chrome.runtime.lastError) {
                    console.error('Runtime error:', chrome.runtime.lastError.message);
                    btn.innerText = t('account.syncUpdate');
                    btn.disabled = false;
                    alert(t('account.syncFail') + ": " + chrome.runtime.lastError.message);
                    return;
                }
                
                btn.innerText = t('account.syncUpdate');
                btn.disabled = false;
                
                if (res && res.code === "SUCCESS") {
                    renderAccountInfo(res.data);
                    storage.get(['checkInLogs'], (d) => renderLogs(d.checkInLogs));
                    alert(t('account.syncSuccess'));
                } else {
                    const failMsg = res ? res.msg : t('error.unknown');
                    alert(t('account.syncFail') + ": " + failMsg);
                }
            });
        });
    } catch (e) {
        console.error('handleSyncClick error:', e);
        btn.innerText = t('account.syncUpdate');
        btn.disabled = false;
        alert(t('error.unknown') + ": " + e.message);
    }
}

async function handleManualRun() {
    if (!window.i18n) {
        await loadI18n();
    }
    const t = window.i18n ? window.i18n.t.bind(window.i18n) : (key) => key;
    
    // Check if toggle is active
    const data = await storage.get(['isGlobalActive']);
    if (data.isGlobalActive === false) {
        const offMsg = t('status.off');
        const disabledMsg = window.i18n && window.i18n.currentLang === 'en' 
            ? 'Please enable auto check-in first' 
            : '자동 출석체크를 먼저 활성화해주세요';
        alert(`${offMsg} - ${disabledMsg}`);
        return;
    }
    
    chrome.runtime.sendMessage({ action: "manualRun" });
    document.getElementById('statusDisplay').innerHTML = `<span style="color:#FF9500">${t('status.checking')}</span>`;
}

// Update CHECK NOW button state based on toggle
function updateCheckNowButton(isActive) {
    const runNowBtn = document.getElementById('runNowBtn');
    if (!runNowBtn) return;
    
    if (isActive === false) {
        runNowBtn.disabled = true;
        runNowBtn.style.opacity = '0.5';
        runNowBtn.style.cursor = 'not-allowed';
    } else {
        runNowBtn.disabled = false;
        runNowBtn.style.opacity = '1';
        runNowBtn.style.cursor = 'pointer';
    }
}

// --- 렌더링 함수 ---

function renderStatus(data) {
    if (!window.i18n) {
        loadI18n().then(() => renderStatus(data));
        return;
    }
    const t = window.i18n.t.bind(window.i18n);
    
    const statusEl = document.getElementById('statusDisplay');
    const timeEl = document.getElementById('lastRunDisplay');

    if (data.isGlobalActive === false) {
        statusEl.innerHTML = `<span style="color:#666">${t('status.off')}</span>`;
        return;
    }

    if (data.lastStatus === "SUCCESS") {
        statusEl.innerHTML = `<span style="color:#34C759">${t('status.completed')}</span>`;
    } else if (data.lastStatus === "FAIL" || data.lastStatus === "NOT_LOGGED_IN") {
        statusEl.innerHTML = `<span style="color:#FF3B30">${t('status.failed')}</span>`;
    } else {
        statusEl.innerHTML = `<span style="color:#FF9500">${t('status.waiting')}</span>`;
    }

    timeEl.innerText = data.lastCheckTime ? `${t('checkin.lastRun')}: ${data.lastCheckTime}` : `${t('checkin.lastRun')}: -`;
}

function renderLogs(logs) {
    if (!window.i18n) {
        loadI18n().then(() => renderLogs(logs));
        return;
    }
    const t = window.i18n.t.bind(window.i18n);
    
    const list = document.getElementById('logList');
    list.innerHTML = "";
    
    if (!logs || logs.length === 0) {
        list.innerHTML = `<div style='text-align:center; color:#666; padding:10px;'>${t('logs.empty')}</div>`;
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
    if (!window.i18n) {
        loadI18n().then(() => renderAccountInfo(info));
        return;
    }
    const t = window.i18n.t.bind(window.i18n);
    
    const el = document.getElementById('userInfo');
    const btnSync = document.getElementById('btnSync');
    const btnUnlink = document.getElementById('btnUnlink');
    
    if (!el || !btnSync || !btnUnlink) {
        console.warn('Required elements not found for renderAccountInfo');
        return;
    }
    
    if (info && info.cred) {
        // role에서 계정 정보 추출 (형식: 3_roleId_serverId)
        let accountInfoText = "";
        if (info.role && typeof info.role === 'string') {
            const parts = info.role.split('_');
            if (parts.length >= 3) {
                const roleId = parts[1];
                const serverId = parts[2];
                accountInfoText = `<div style="margin-top:4px; font-size:12px; color:#D4D94A; font-weight:500;">${t('account.id')}: ${roleId}</div><div style="font-size:11px; color:#999;">${t('account.server')}: ${serverId}</div>`;
            } else if (parts.length >= 2) {
                const roleId = parts[1];
                accountInfoText = `<div style="margin-top:4px; font-size:12px; color:#D4D94A; font-weight:500;">${t('account.id')}: ${roleId}</div>`;
            }
        }
        
        // role 정보가 없으면 기본 정보만 표시
        if (!accountInfoText) {
            accountInfoText = `<div style="margin-top:4px; font-size:11px; color:#999;">${t('account.checking')}</div>`;
        }
        
        el.innerHTML = `<div style="font-size:13px; font-weight:600;">${t('account.linked')} <span style="color:#34C759">●</span></div>${accountInfoText}<div style="margin-top:4px; font-size:10px; color:#888; font-weight:400;">${t('account.lastSync')}: ${info.lastSync || ''}</div>`;
        btnSync.innerText = t('account.syncUpdate');
        btnUnlink.style.display = "block";
    } else {
        el.innerHTML = `<div style="font-size:13px; font-weight:600;">${t('account.notLinked')} <span style="color:#FF3B30">●</span></div><div style="margin-top:4px; font-size:10px; color:#888; font-weight:400;">${t('account.loginRequired')}</div>`;
        btnSync.innerText = t('account.syncButton');
        btnUnlink.style.display = "none";
    }
}
