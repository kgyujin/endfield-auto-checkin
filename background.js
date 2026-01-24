const storage = chrome.storage.sync;
const ALARM_NAME = "dailyCheckIn";

const HOYO_API_MAP = {
    'genshin': 'https://sg-hk4e-api.hoyolab.com/event/sol/sign',
    'starrail': 'https://sg-public-api.hoyolab.com/event/luna/os/sign',
    'honkai3rd': 'https://sg-public-api.hoyolab.com/event/mani/sign',
    'zenless': 'https://sg-act-nap-api.hoyolab.com/event/luna/zzz/os/sign',
    'tears': 'https://sg-public-api.hoyolab.com/event/luna/os/sign'
};

// --- [초기화 및 스케줄링] ---
chrome.runtime.onStartup.addListener(() => startAutoCheck(false));
chrome.runtime.onInstalled.addListener(() => {
    startAutoCheck(false);
    // 설치 직후 알람 등록
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: 15 });
});

// 15분마다 실행 (하지만 완료되었으면 조용히 종료됨)
chrome.alarms.onAlarm.addListener((alarm) => { 
    if (alarm.name === ALARM_NAME) startAutoCheck(false); 
});

// 메시지 핸들러
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "manualRun") {
        startAutoCheck(true); // 수동 실행 (강제)
    } 
    else if (message.action === "checkInResult") {
        // DOM 결과 처리 (windowId도 함께 전달받거나 sender로 유추)
        handleDomResult(message.status, message.url, sender.tab?.windowId);
    } 
    else if (message.action === "proxyHoyoAPI") {
        handleHoyoAPI(message.data).then(sendResponse);
        return true; 
    }
});

// UTC+8 기준 오늘 날짜 (엔드필드 서버 기준)
function getServerTodayString() {
    const now = new Date();
    const utc8Time = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (3600000 * 8));
    return utc8Time.toISOString().split('T')[0];
}

// --- [메인 실행 로직] ---
async function startAutoCheck(force = false) {
    // 1. 전체 토글 확인
    if (!force) {
        const config = await storage.get(['isGlobalActive']);
        if (config.isGlobalActive === false) {
            updateBadge("OFF", "#999");
            return;
        }
    }

    // 알람이 삭제되었을 경우를 대비해 재등록
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: 15 });

    processAllSites(force);
}

async function processAllSites(force) {
    const data = await storage.get(['sites']);
    const sites = data.sites || [];
    const serverToday = getServerTodayString();

    // 해야 할 사이트 필터링 (완료 안 됨 + 토글 켜짐)
    const pendingSites = sites.filter(s => {
        const dateCheck = force ? true : s.lastCheckIn !== serverToday;
        const toggleCheck = s.isEnabled !== false;
        return dateCheck && toggleCheck;
    });

    // 모든 출석 완료 시
    if (pendingSites.length === 0) {
        updateBadge("OK", "#34C759"); // 초록색 OK 배지
        if (force) notify("완료", "모든 사이트가 이미 출석 완료 상태입니다.");
        return;
    }

    // 남은 개수 배지 표시
    updateBadge(pendingSites.length.toString(), "#FF9500");

    if (force) notify("점검 시작", `${pendingSites.length}개 사이트의 출석을 진행합니다.`);

    for (const site of pendingSites) {
        // 호요랩 (API)
        if (site.url.includes("hoyolab.com")) {
            await processHoyoLab(site, serverToday);
        } 
        // SKPORT 등 (DOM) - 백그라운드 창 사용
        else {
            await processDomSite(site);
        }
        // 과부하 방지 딜레이
        await new Promise(r => setTimeout(r, 2000));
    }
}

// --- [Type 1] 호요랩 API 처리 ---
async function processHoyoLab(site, today) {
    let gameKey = null;
    if (site.url.includes("genshin")) gameKey = 'genshin';
    else if (site.url.includes("starrail") || site.url.includes("hsr")) gameKey = 'starrail';
    else if (site.url.includes("honkai3rd")) gameKey = 'honkai3rd';
    else if (site.url.includes("zenless") || site.url.includes("zzz")) gameKey = 'zenless';
    else if (site.url.includes("tears")) gameKey = 'tears';

    const urlObj = new URL(site.url);
    const actId = urlObj.searchParams.get('act_id');

    if (!gameKey || !actId) {
        // 정보 부족 시 DOM 모드로 전환
        await processDomSite(site);
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

        // 0: 성공, -5003: 이미 함
        if (result.retcode === 0) {
            updateSiteStatus(site.id, today);
            notify("출석 성공 ✅", `${site.name} 출석을 완료했습니다.`);
        } else if (result.retcode === -5003) {
            updateSiteStatus(site.id, today);
            // 이미 된 건은 알림 생략 (조용히 처리)
        } else {
            notify("출석 실패 ❌", `${site.name}: ${result.message}`);
        }
    } catch (e) {
        console.error(e);
        notify("오류", `${site.name} 통신 중 오류가 발생했습니다.`);
    }
}

// --- [Type 2] DOM 사이트 처리 (Invisible Window) ---
function processDomSite(site) {
    return new Promise((resolve) => {
        // [핵심] 탭 대신 '최소화된 팝업 창'을 생성
        chrome.windows.create({ 
            url: site.url, 
            type: 'popup', 
            state: 'minimized', // 사용자 눈에 거의 안 띔
            focused: false 
        }, (window) => {
            if (!window || !window.tabs || window.tabs.length === 0) {
                resolve();
                return;
            }
            
            const tabId = window.tabs[0].id;

            // 5초 대기 후 스크립트 실행
            setTimeout(() => {
                chrome.tabs.sendMessage(tabId, { 
                    action: "EXECUTE_DOM_CHECK",
                    siteName: site.name 
                }).catch(() => {}); // 오류 무시 (이미 닫혔을 수 있음)

                // 25초 안전장치 (타임아웃 시 창 닫기)
                setTimeout(() => {
                    chrome.windows.get(window.id, (win) => {
                        if (chrome.runtime.lastError) return;
                        if (win) chrome.windows.remove(window.id);
                        resolve();
                    });
                }, 25000);

            }, 5000);
        });
    });
}

// DOM 결과 처리
function handleDomResult(status, url, windowId) {
    const serverToday = getServerTodayString();
    
    storage.get(['sites'], (result) => {
        const sites = result.sites || [];
        const target = sites.find(s => url.includes(s.url.split('?')[0]));
        
        if (target) {
            if (status === "success") {
                updateSiteStatus(target.id, serverToday);
                notify("출석 성공 ✅", `${target.name}: 출석 체크 완료!`);
            } else if (status === "already_done") {
                updateSiteStatus(target.id, serverToday);
                // 이미 완료된 경우 알림 없이 조용히 처리
            } else {
                notify("출석 실패 ❌", `${target.name}: 요소를 찾지 못했습니다.`);
            }
        }
    });

    // 작업이 끝난 '창(Window)'을 닫음
    if (windowId) {
        setTimeout(() => chrome.windows.remove(windowId).catch(() => {}), 1000);
    }
}

function updateSiteStatus(id, date) {
    storage.get(['sites'], (result) => {
        const sites = result.sites || [];
        const index = sites.findIndex(s => s.id === id);
        if (index !== -1) {
            sites[index].lastCheckIn = date;
            storage.set({ sites }, () => {
                // 저장 후 남은 개수 재계산하여 배지 업데이트
                processAllSites(false); 
            });
        }
    });
}

// [개선됨] 알림 함수
function notify(title, msg) {
    // 1. 배지 업데이트 (알림 대용)
    // chrome.action.setBadgeText({ text: "!" });
    // chrome.action.setBadgeBackgroundColor({ color: "#FF3B30" });

    // 2. 크롬 알림
    const options = {
        type: "basic",
        iconUrl: "icon.png", // manifest에 web_accessible_resources 등록 필요 없으나 파일 존재해야 함
        title: title,
        message: msg,
        priority: 2,
        silent: false
    };

    // iconUrl 오류 방지를 위해 try-catch 혹은 안전한 호출
    try {
        chrome.notifications.create(options);
    } catch (e) {
        // 아이콘 로드 실패 시 아이콘 없이 전송 시도
        delete options.iconUrl;
        chrome.notifications.create(options);
    }
}

// 배지 텍스트 업데이트 헬퍼
function updateBadge(text, color) {
    chrome.action.setBadgeText({ text: text });
    chrome.action.setBadgeBackgroundColor({ color: color });
}

async function handleHoyoAPI(data) {
    // Content Script에서 요청 시 처리 (현재는 Background에서 직접 하므로 사용 안 함)
    return { retcode: -1 }; 
}