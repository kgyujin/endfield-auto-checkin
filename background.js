const storage = chrome.storage.sync;
const ALARM_NAME = "dailyCheckIn";

// --- 초기화 ---
chrome.runtime.onStartup.addListener(() => startAutoCheck(false));
chrome.runtime.onInstalled.addListener(() => startAutoCheck(false));
chrome.alarms.onAlarm.addListener((alarm) => { if (alarm.name === ALARM_NAME) startAutoCheck(false); });

// 메시지 수신 핸들러
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "manualRun") {
        startAutoCheck(true); // 강제 실행
    } 
    else if (message.action === "checkInResult") {
        // Content Script에서 온 결과 처리
        handleDomResult(message.status, message.url, sender.tab?.id);
    } 
});

// [수정됨] 엔드필드 서버 시간(UTC+8) 기준 오늘 날짜 반환 (YYYY-MM-DD)
// 출처: 엔드필드 출석 보상 및 진행도는 매월 1일 00:00(UTC+8)에 새로고침됨
function getServerTodayString() {
    const now = new Date();
    // 현재 시간을 UTC 밀리초로 변환 후 8시간(UTC+8)을 더함
    const utc8Time = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (3600000 * 8));
    return utc8Time.toISOString().split('T')[0];
}

// --- 메인 실행 로직 ---
async function startAutoCheck(force = false) {
    // 1. 전체 토글 체크
    if (!force) {
        const config = await storage.get(['isGlobalActive']);
        if (config.isGlobalActive === false) {
            console.log("[AutoCheck] 자동 실행이 꺼져있어 건너뜁니다.");
            return;
        }
    }

    // 알람 재설정 (1시간 주기)
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: 60 });
    
    if (force) notify("점검 시작", "등록된 사이트의 출석을 확인합니다.");

    processAllSites(force);
}

async function processAllSites(force) {
    const data = await storage.get(['sites']);
    const sites = data.sites || [];
    const serverToday = getServerTodayString(); // UTC+8 기준 오늘

    // 필터: (오늘 안함 OR 강제실행) AND (사이트 토글 켜짐)
    const pendingSites = sites.filter(s => {
        // 마지막 출석 날짜와 서버 기준 오늘 날짜 비교
        const dateCheck = force ? true : s.lastCheckIn !== serverToday;
        const toggleCheck = s.isEnabled !== false; // 기본값 true
        return dateCheck && toggleCheck;
    });

    if (pendingSites.length === 0) {
        if (force) notify("완료", "모든 사이트가 이미 출석 완료 상태입니다.");
        return;
    }

    for (const site of pendingSites) {
        await processDomSite(site);
        // 요청 간 딜레이
        await new Promise(r => setTimeout(r, 2000));
    }
}

// --- DOM 사이트(SKPORT) 처리 ---
function processDomSite(site) {
    return new Promise((resolve) => {
        // 1. 탭을 백그라운드(active:false)로 엽니다.
        chrome.tabs.create({ url: site.url, active: false }, (tab) => {
            // 2. 페이지 로딩 대기 (5초)
            setTimeout(() => {
                // 3. 해당 탭에만 "명령"을 보냅니다.
                chrome.tabs.sendMessage(tab.id, { 
                    action: "EXECUTE_DOM_CHECK",
                    siteName: site.name 
                }).catch(() => {
                    // 탭이 그새 닫혔거나 로드 실패 시 무시
                });

                // 4. 타임아웃 안전장치 (25초 후 닫기)
                setTimeout(() => {
                    chrome.tabs.get(tab.id, (t) => {
                        if (!chrome.runtime.lastError && t) chrome.tabs.remove(tab.id);
                        resolve();
                    });
                }, 20000);

            }, 5000); 
        });
    });
}

// 결과 처리
function handleDomResult(status, url, tabId) {
    const serverToday = getServerTodayString(); // UTC+8 기준
    
    storage.get(['sites'], (result) => {
        const sites = result.sites || [];
        // URL 매칭
        const target = sites.find(s => url.includes(s.url.split('?')[0]));
        
        if (target) {
            if (status === "success") {
                updateSiteStatus(target.id, serverToday);
                notify("출석 성공 ✅", `${target.name}: 출석 체크 완료!`);
            } else if (status === "already_done") {
                updateSiteStatus(target.id, serverToday);
                console.log(`[AutoCheck] ${target.name}: 이미 완료되어 있음 (UTC+8 기준)`);
                // 이미 된 건은 사용자 방해 방지를 위해 알림 생략 가능
            } else {
                notify("출석 실패 ❌", `${target.name}: 확인이 필요합니다.`);
            }
        }
    });

    // 백그라운드가 연 탭이면 닫기
    if (tabId) {
        setTimeout(() => chrome.tabs.remove(tabId).catch(() => {}), 1000);
    }
}

function updateSiteStatus(id, date) {
    storage.get(['sites'], (result) => {
        const sites = result.sites || [];
        const index = sites.findIndex(s => s.id === id);
        if (index !== -1) {
            sites[index].lastCheckIn = date;
            storage.set({ sites });
        }
    });
}

// 토스트 알림 함수 (iconUrl 수정됨)
function notify(title, msg) {
    const iconPath = chrome.runtime.getURL("icon.png");
    
    chrome.notifications.create({
        type: "basic",
        iconUrl: iconPath,
        title: title,
        message: msg,
        priority: 2,
        silent: false 
    }, (notificationId) => {
        if (chrome.runtime.lastError) {
            console.error("알림 오류:", chrome.runtime.lastError);
        }
    });
}