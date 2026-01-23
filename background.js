const storage = chrome.storage.sync;
const ALARM_NAME = "dailyCheckIn";

const HOYO_API_MAP = {
    'genshin': 'https://sg-hk4e-api.hoyolab.com/event/sol/sign',
    'starrail': 'https://sg-public-api.hoyolab.com/event/luna/os/sign',
    'honkai3rd': 'https://sg-public-api.hoyolab.com/event/mani/sign',
    'zenless': 'https://sg-act-nap-api.hoyolab.com/event/luna/zzz/os/sign',
    'tears': 'https://sg-public-api.hoyolab.com/event/luna/os/sign'
};

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
        // DOM 모드 결과 처리
        handleDomResult(message.status, message.url, sender.tab?.id);
    } 
    else if (message.action === "proxyHoyoAPI") {
        handleHoyoAPI(message.data).then(sendResponse);
        return true; 
    }
});

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
    const today = new Date().toISOString().split('T')[0];

    // 필터: (오늘 안함 OR 강제실행) AND (사이트 토글 켜짐)
    const pendingSites = sites.filter(s => {
        const dateCheck = force ? true : s.lastCheckIn !== today;
        const toggleCheck = s.isEnabled !== false; // 기본값 true
        return dateCheck && toggleCheck;
    });

    if (pendingSites.length === 0) {
        if (force) notify("완료", "모든 사이트가 이미 출석 완료 상태입니다.");
        return;
    }

    for (const site of pendingSites) {
        // 호요랩 API 모드
        if (site.url.includes("hoyolab.com")) {
            await processHoyoLab(site, today);
        } 
        // 일반 사이트 (DOM) 모드
        else {
            await processGenericSite(site);
        }
        // 요청 간 딜레이
        await new Promise(r => setTimeout(r, 2000));
    }
}

// --- [Type 1] 호요랩 API ---
async function processHoyoLab(site, today) {
    let gameKey = null;
    if (site.url.includes("genshin")) gameKey = 'genshin';
    else if (site.url.includes("starrail") || site.url.includes("hsr")) gameKey = 'starrail';
    else if (site.url.includes("honkai3rd")) gameKey = 'honkai3rd';
    else if (site.url.includes("zenless") || site.url.includes("zzz")) gameKey = 'zenless';
    else if (site.url.includes("tears")) gameKey = 'tears';

    const urlObj = new URL(site.url);
    const actId = urlObj.searchParams.get('act_id');

    // 정보 부족 시 DOM 모드로 전환 시도
    if (!gameKey || !actId) {
        await processGenericSite(site);
        return;
    }

    const cookies = await chrome.cookies.getAll({ domain: "hoyolab.com" });
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    try {
        const apiUrl = `${HOYO_API_MAP[gameKey]}?act_id=${actId}&lang=ko-kr`;
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Cookie': cookieString
            },
            body: JSON.stringify({ lang: 'ko-kr', act_id: actId })
        });
        const result = await response.json();

        // [중요] -5003은 "이미 출석함" -> 이것도 성공으로 간주하고 업데이트
        if (result.retcode === 0) {
            updateSiteStatus(site.id, today);
            notify("출석 성공 ✅", `${site.name}: 출석 체크 완료!`);
        } else if (result.retcode === -5003) {
            updateSiteStatus(site.id, today);
            // 이미 된 건은 알림을 띄우지 않고 조용히 처리 (원하면 notify 추가)
            console.log(`[AutoCheck] ${site.name}: 이미 완료됨`);
        } else {
            console.log(`[AutoCheck] ${site.name} 실패: ${result.message}`);
        }
    } catch (e) {
        console.error(e);
    }
}

// --- [Type 2] DOM 사이트 처리 ---
function processGenericSite(site) {
    return new Promise((resolve) => {
        // 1. 탭을 백그라운드(active:false)로 엽니다.
        chrome.tabs.create({ url: site.url, active: false }, (tab) => {
            // 2. 페이지 로딩 대기 (5초)
            setTimeout(() => {
                // 3. 해당 탭에만 "명령"을 보냅니다. (이게 핵심)
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

// DOM 결과 처리
function handleDomResult(status, url, tabId) {
    const today = new Date().toISOString().split('T')[0];
    
    storage.get(['sites'], (result) => {
        const sites = result.sites || [];
        // URL 매칭
        const target = sites.find(s => url.includes(s.url.split('?')[0]));
        
        if (target) {
            if (status === "success") {
                updateSiteStatus(target.id, today);
                notify("출석 성공 ✅", `${target.name}: 출석 체크 완료!`);
            } else if (status === "already_done") {
                updateSiteStatus(target.id, today);
                console.log(`[AutoCheck] ${target.name}: 이미 완료되어 있음`);
                // 여기서는 굳이 알림 안 띄움
            } else {
                // 실패 시 알림
                notify("출석 실패 ❌", `${target.name}: 요소를 찾지 못했습니다.`);
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

// [수정] 토스트 알림 함수 개선
function notify(title, msg) {
    // iconUrl 경로를 확실하게 잡음
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

// 호요랩 API 프록시 (Content Script용)
async function handleHoyoAPI(data) {
    // ... (필요 시 구현, 현재는 background processHoyoLab에서 처리하므로 비워도 됨)
    return { retcode: -1 }; 
}