/**
 * Internationalization (i18n) Support
 * Supports Korean and English
 */

(function() {
'use strict';

const i18n = {
    currentLang: 'ko',
    
    translations: {
        ko: {
            // Status
            'status.completed': '완료',
            'status.failed': '실패',
            'status.waiting': '대기 중',
            'status.off': 'OFF',
            'status.checking': '확인 중...',
            
            // Account
            'account.linked': '연동됨',
            'account.notLinked': '연동 안됨',
            'account.id': '계정 ID',
            'account.server': '서버',
            'account.checking': '계정 정보 확인 중...',
            'account.lastSync': '최근 연동',
            'account.syncButton': '계정 연동하기',
            'account.syncUpdate': '연동 갱신',
            'account.analyzing': '분석 중...',
            'account.unlink': '연동 해제',
            'account.unlinkConfirm': '정말 계정 연동을 해제하시겠습니까?\n자동 출석이 중단됩니다.',
            'account.unlinkSuccess': '연동이 해제되었습니다.',
            'account.syncSuccess': '연동 완료! 모든 인증 정보가 안전하게 저장되었습니다.',
            'account.syncFail': '연동 실패',
            'account.syncRequired': 'SKPORT 엔드필드 출석체크 페이지에서 실행해주세요.',
            'account.loginRequired': '로그인 후 버튼을 눌러주세요',
            
            // Check-in
            'checkin.now': 'CHECK NOW',
            'checkin.lastRun': '마지막 실행',
            'checkin.success': '출석 성공',
            'checkin.alreadyDone': '이미 완료됨',
            'checkin.fail': '출석 실패',
            'checkin.needAccount': '계정 연동 필요',
            
            // Logs
            'logs.empty': '기록 없음',
            'logs.syncSuccess': '계정 연동 성공',
            'logs.unlink': '연동 해제',
            
            // Notifications
            'notif.checkinComplete': '출석 완료',
            'notif.rewardReceived': '보상 지급됨',
            'notif.error': '오류',
            'notif.checkLogs': '로그를 확인하세요.',
            
            // Settings
            'settings.title': '계정 연동 상태',
            'settings.logs': '최근 기록',
            'settings.back': '← 돌아가기',
            'settings.siteLink': '출석 사이트 바로가기 ↗',
            
            // Errors
            'error.unknown': '알 수 없는 오류',
            'error.noLogin': '로그인 정보를 찾을 수 없습니다. 사이트 로그인 상태를 확인해주세요.',
            'error.apiTest': 'API 테스트 실패',
            'error.unauthorized': '인증 실패',
            'error.network': '네트워크 오류',
        },
        en: {
            // Status
            'status.completed': 'Completed',
            'status.failed': 'Failed',
            'status.waiting': 'Waiting',
            'status.off': 'OFF',
            'status.checking': 'Checking...',
            
            // Account
            'account.linked': 'Linked',
            'account.notLinked': 'Not Linked',
            'account.id': 'Account ID',
            'account.server': 'Server',
            'account.checking': 'Checking account info...',
            'account.lastSync': 'Last Sync',
            'account.syncButton': 'Link Account',
            'account.syncUpdate': 'Update Link',
            'account.analyzing': 'Analyzing...',
            'account.unlink': 'Unlink',
            'account.unlinkConfirm': 'Are you sure you want to unlink your account?\nAuto check-in will be stopped.',
            'account.unlinkSuccess': 'Account unlinked successfully.',
            'account.syncSuccess': 'Link complete! All authentication info has been securely saved.',
            'account.syncFail': 'Link failed',
            'account.syncRequired': 'Please run this on the SKPORT Endfield check-in page.',
            'account.loginRequired': 'Please log in and click the button',
            
            // Check-in
            'checkin.now': 'CHECK NOW',
            'checkin.lastRun': 'Last Run',
            'checkin.success': 'Check-in Success',
            'checkin.alreadyDone': 'Already Done',
            'checkin.fail': 'Check-in Failed',
            'checkin.needAccount': 'Account link required',
            
            // Logs
            'logs.empty': 'No Records',
            'logs.syncSuccess': 'Account link success',
            'logs.unlink': 'Unlinked',
            
            // Notifications
            'notif.checkinComplete': 'Check-in Complete',
            'notif.rewardReceived': 'Reward received',
            'notif.error': 'Error',
            'notif.checkLogs': 'Please check logs.',
            
            // Settings
            'settings.title': 'Account Link Status',
            'settings.logs': 'Recent Records',
            'settings.back': '← Back',
            'settings.siteLink': 'Go to Check-in Site ↗',
            
            // Errors
            'error.unknown': 'Unknown error',
            'error.noLogin': 'Login info not found. Please check your login status on the site.',
            'error.apiTest': 'API test failed',
            'error.unauthorized': 'Authentication failed',
            'error.network': 'Network error',
        }
    },
    
    init() {
        // Load saved language preference
        chrome.storage.local.get(['language'], (data) => {
            if (data.language && this.translations[data.language]) {
                this.currentLang = data.language;
            } else {
                // Auto-detect from browser language
                const browserLang = navigator.language || navigator.userLanguage;
                this.currentLang = browserLang.startsWith('ko') ? 'ko' : 'en';
            }
            this.applyLanguage();
        });
    },
    
    setLanguage(lang) {
        if (this.translations[lang]) {
            this.currentLang = lang;
            chrome.storage.local.set({ language: lang });
            this.applyLanguage();
        }
    },
    
    t(key, ...args) {
        const translation = this.translations[this.currentLang]?.[key] || key;
        if (args.length > 0) {
            return translation.replace(/\{(\d+)\}/g, (match, index) => {
                return args[parseInt(index)] || match;
            });
        }
        return translation;
    },
    
    applyLanguage() {
        // This will be called by popup.js after i18n is loaded
        if (typeof window.updateUIWithLanguage === 'function') {
            window.updateUIWithLanguage();
        }
    }
};

// Initialize on load
if (typeof window !== 'undefined') {
    window.i18n = i18n;
}

})();

