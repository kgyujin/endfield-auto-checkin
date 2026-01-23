// content.js
const CONSTANTS = {
    CHECK_INTERVAL: 1000,
    MAX_ATTEMPTS: 10
};

// 백그라운드 명령 대기
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "EXECUTE_DOM_CHECK") {
        console.log(`[AutoCheck] ${message.siteName} 자동 점검 시작`);
        attemptSkportCheckIn();
    }
});

function attemptSkportCheckIn() {
    const url = window.location.href;
    let attempts = 0;
    
    // 타겟 아이템(클릭 시도한 아이템)을 추적
    let lastClickedItem = null;

    const interval = setInterval(() => {
        attempts++;
        
        // 1. 아이템 리스트 찾기
        const items = document.querySelectorAll('div[class*="sc-chKHoF"]');
        
        if (items.length > 0) {
            let target = null;
            let allHaveOverlay = true;

            // 2. 미수령 아이템(오버레이가 없는 것) 탐색
            for (const item of items) {
                if (!item.querySelector('#completed-overlay')) {
                    target = item;
                    allHaveOverlay = false;
                    break; // 첫 번째 미수령 아이템 발견 시 중단
                }
            }

            // [Case A] 모든 아이템에 오버레이가 있음 -> 이미 전체 완료
            if (allHaveOverlay) {
                clearInterval(interval);
                sendMessage("already_done", url);
                return;
            }

            // [Case B] 미수령 아이템 발견 -> 클릭 시도
            if (target) {
                // 이전 턴에 클릭했는데 여전히 오버레이가 없다면? -> 클릭 불가능한 미래 날짜임
                if (lastClickedItem === target) {
                    console.log("[AutoCheck] 클릭해도 반응 없음 -> 미래 날짜로 판단 -> 오늘 출석 완료");
                    clearInterval(interval);
                    sendMessage("already_done", url); // 성공으로 처리
                    return;
                }

                console.log("[AutoCheck] 아이템 클릭 시도");
                target.click();
                lastClickedItem = target;
                
                // 클릭 후 잠시 대기 (다음 인터벌에서 오버레이 생성 여부 확인)
                return; 
            }
        }

        // [Case C] 타임아웃
        if (attempts >= CONSTANTS.MAX_ATTEMPTS) {
            clearInterval(interval);
            // 타임아웃이지만 아이템을 찾긴 했다면, 이미 완료된 것으로 간주 (안전장치)
            if (document.querySelectorAll('div[class*="sc-chKHoF"]').length > 0) {
                console.log("[AutoCheck] 타임아웃: 아이템은 존재함 -> 완료 처리");
                sendMessage("already_done", url);
            } else {
                sendMessage("fail", url);
            }
        }

    }, CONSTANTS.CHECK_INTERVAL);
}

function sendMessage(status, url) {
    chrome.runtime.sendMessage({
        action: "checkInResult",
        status: status,
        url: url
    });
}