const TRANSLATIONS = {
    ko: {
        title_main: "ENDFIELD<br>CHECK-IN",
        btn_discord_title: "디스코드 알림 설정",
        btn_settings_title: "설정 및 기록",
        status_header: "오늘의 상태",
        last_run_prefix: "마지막 실행: ",
        btn_check_now: "지금 확인",
        link_site: "출석 사이트 바로가기 ↗",


        section_logs: "최근 기록 (50개)",
        msg_no_logs: "기록 없음",
        btn_back: "← 돌아가기",

        title_discord: "디스코드 웹훅 설정",
        btn_webhook_help: "웹훅 URL 얻는 방법",
        label_webhook_url: "웹훅 URL",
        btn_save: "저장",
        btn_test: "테스트",
        status_not_set: "설정되지 않음",
        status_active: "활성화됨",
        status_disabled: "비활성화됨",
        last_edit: "최근 수정: ",

        status_success: "완료",
        status_fail: "실패",
        status_waiting: "대기 중",
        status_checking: "확인 중...",

        modal_alert_title: "알림",
        modal_confirm_title: "확인",
        modal_error_title: "오류",
        modal_success_title: "성공",
        modal_reset_title: "데이터 초기화",
        btn_yes: "네",
        btn_no: "아니오",
        btn_ok: "확인",
        btn_cancel: "취소",

        msg_webhook_help: "1. 디스코드 서버 → 서버 설정 → 연동\n2. 웹후크 → 새 웹후크\n3. 웹후크 URL 복사 → 위에 붙여넣기",
        msg_webhook_disabled: "디스코드 연동이 비활성화되었습니다.",
        msg_webhook_invalid: "올바른 디스코드 웹훅 URL이 아닙니다.",
        msg_webhook_saved: "디스코드 웹훅이 저장되었습니다!",
        msg_webhook_req_save: "먼저 웹훅 URL을 입력하고 저장해주세요.",
        msg_test_sending: "전송 중...",
        msg_test_success: "테스트 메시지가 성공적으로 전송되었습니다!\n디스코드 채널을 확인해보세요.",
        msg_test_fail: "전송 실패: ",

        log_check_success: "출석 성공",
        log_check_already: "이미 완료됨",
        log_check_fail: "출석 실패",
        log_req_login: "계정 연동 필요",
        log_unknown_error: "알 수 없는 오류",
        log_discord_sent: "출석 완료 알림 전송",
        log_discord_fail: "전송 실패: ",
        log_start_checkin: "출석 체크 시작",

        embed_success_title: "🎉 엔드필드 출석 체크 완료!",
        embed_already_title: "✅ 출석 체크 이미 완료됨",
        embed_fail_title: "⚠️ 엔드필드 출석 체크 실패",
        embed_test_success_title: "[테스트] 🎉 엔드필드 출석 체크 완료!",
        embed_test_already_title: "[테스트] ✅ 출석 체크 이미 완료됨",
        embed_test_fail_title: "[테스트] ⚠️ 엔드필드 출석 체크 실패",
        field_date: "📅 일시",
        field_accumulated: "📊 누적 출석",
        field_reward: "🎁 오늘의 보상",
        field_status: "ℹ️ 상태",
        field_error: "❌ 오류 내용",
        val_days: "일",
        val_success_msg: "출석 성공",
        val_already_msg: "오늘 출석 체크가 이미 완료되었습니다.",
        val_unknown_reward: "알 수 없는 보상",
        val_test_item: "테스트 아이템",
        val_test_error: "테스트 오류 메시지입니다.",

        test_modal_title: "테스트 메시지 유형 선택",
        test_btn_success: "✅ 출석 성공",
        test_btn_already: "ℹ️ 이미 완료됨",
        test_btn_fail: "❌ 출석 실패",

        update_avail_title: "업데이트 가능",
        update_avail_desc: "새로운 버전이 있습니다.",
        ver_current: "현재 버전",
        ver_latest_stable: "최신 정식",
        ver_latest_beta: "최신 프리뷰",
        ver_history: "이전 버전 다운로드",
        btn_download: "다운로드",
        msg_downgrade_warn: "주의: 이전 버전을 다운로드하여 설치할 경우,\n자동 업데이트 기능이 지원되지 않을 수 있습니다.\n계속하시겠습니까?",
        err_no_webhook: "웹훅 URL 없음",
        footer_text: "엔드필드 자동 출석",
        modal_lang_title: "언어 설정",
        msg_version_mismatch: "파일 버전(v{fileVer})과 로드된 버전(v{loadedVer})이 다릅니다.\n확장 프로그램을 리로드하시겠습니까?",
        title_version_mismatch: "⚡ 버전 불일치",
        ver_select_placeholder: "- 버전 선택 -",
        update_folder_note: "(폴더: 확장 프로그램 루트)"
    },
    en: {
        title_main: "ENDFIELD<br>CHECK-IN",
        btn_discord_title: "Discord Notification Settings",
        btn_settings_title: "Settings & Logs",
        status_header: "TODAY'S STATUS",
        last_run_prefix: "Last Run: ",
        btn_check_now: "CHECK NOW",
        link_site: "Go to Check-in Site ↗",


        section_logs: "Recent Logs",
        msg_no_logs: "No logs found",
        btn_back: "← Back",

        title_discord: "Discord Webhook Settings",
        btn_webhook_help: "How to get Webhook URL",
        label_webhook_url: "Webhook URL",
        btn_save: "Save",
        btn_test: "Test",
        status_not_set: "Not Configured",
        status_active: "Active",
        status_disabled: "Disabled",
        last_edit: "Last Modified: ",

        status_success: "Success",
        status_fail: "Fail",
        status_waiting: "Waiting",
        status_checking: "Checking...",

        modal_alert_title: "Alert",
        modal_confirm_title: "Confirm",
        modal_error_title: "Error",
        modal_success_title: "Success",
        modal_reset_title: "Reset Data",
        btn_yes: "Yes",
        btn_no: "No",
        btn_ok: "OK",
        btn_cancel: "Cancel",

        msg_webhook_help: "1. Discord Server → Server Settings → Integrations\n2. Webhooks → New Webhook\n3. Copy Webhook URL → Paste above",
        msg_webhook_disabled: "Discord integration disabled.",
        msg_webhook_invalid: "Invalid Discord Webhook URL.",
        msg_webhook_saved: "Discord Webhook saved!",
        msg_webhook_req_save: "Please enter and save a Webhook URL first.",
        msg_test_sending: "Sending...",
        msg_test_success: "Test message sent successfully!\nCheck your Discord channel.",
        msg_test_fail: "Send failed: ",

        log_check_success: "Check-in Success",
        log_check_already: "Already Done",
        log_check_fail: "Check-in Failed",
        log_req_login: "Account Sync Required",
        log_unknown_error: "Unknown Error",
        log_discord_sent: "Discord Notification Sent",
        log_discord_fail: "Send Failed: ",
        log_start_checkin: "Starting check-in",

        embed_success_title: "🎉 Endfield Check-in Complete!",
        embed_already_title: "✅ Check-in Already Done",
        embed_fail_title: "⚠️ Endfield Check-in Failed",
        embed_test_success_title: "[Test] 🎉 Endfield Check-in Complete!",
        embed_test_already_title: "[Test] ✅ Check-in Already Done",
        embed_test_fail_title: "[Test] ⚠️ Endfield Check-in Failed",
        field_date: "📅 Date",
        field_accumulated: "📊 Total Days",
        field_reward: "🎁 Today's Reward",
        field_status: "ℹ️ Status",
        field_error: "❌ Error Details",
        val_days: "days",
        val_success_msg: "Check-in Success",
        val_already_msg: "Check-in was already completed today.",
        val_unknown_reward: "Unknown Reward",
        val_test_item: "Test Item",
        val_test_error: "This is a test error message.",

        test_modal_title: "Select Test Message Type",
        test_btn_success: "✅ Success",
        test_btn_already: "ℹ️ Already Done",
        test_btn_fail: "❌ Failed",

        update_avail_title: "Update Available",
        update_avail_desc: "A new version is available.",
        ver_current: "Current Version",
        ver_latest_stable: "Latest Stable",
        ver_latest_beta: "Latest Preview",
        ver_history: "Download Older Version",
        btn_download: "Download",
        msg_downgrade_warn: "Warning: If you downgrade,\nthe auto-update feature may not be supported.\nDo you want to continue?",
        err_no_webhook: "No Webhook URL",
        footer_text: "Endfield Auto Check-in",
        modal_lang_title: "Language Settings",
        msg_version_mismatch: "File version (v{fileVer}) and loaded version (v{loadedVer}) differ.\nWould you like to reload the extension?",
        title_version_mismatch: "⚡ Version Mismatch",
        ver_select_placeholder: "- Select Version -",
        update_folder_note: "(Folder: Extension Root)"
    },
    ja: {
        title_main: "ENDFIELD<br>CHECK-IN",
        btn_discord_title: "Discord通知設定",
        btn_settings_title: "設定・ログ",
        status_header: "今日の状態",
        last_run_prefix: "最終実行: ",
        btn_check_now: "今すぐ確認",
        link_site: "チェックインサイトへ ↗",


        section_logs: "最近のログ",
        msg_no_logs: "履歴なし",
        btn_back: "← 戻る",

        title_discord: "Discord Webhook設定",
        btn_webhook_help: "Webhook URL取得方法",
        label_webhook_url: "Webhook URL",
        btn_save: "保存",
        btn_test: "テスト",
        status_not_set: "未設定",
        status_active: "有効",
        status_disabled: "無効",
        last_edit: "最終修正: ",

        status_success: "完了",
        status_fail: "失敗",
        status_waiting: "待機中",
        status_checking: "確認中...",

        modal_alert_title: "通知",
        modal_confirm_title: "確認",
        modal_error_title: "エラー",
        modal_success_title: "成功",
        modal_reset_title: "データ初期化",
        btn_yes: "はい",
        btn_no: "いいえ",
        btn_ok: "確認",
        btn_cancel: "キャンセル",

        msg_webhook_help: "1. Discordサーバー → サーバー設定 → 連携\n2. ウェブフック → 新しいウェブフック\n3. ウェブフックURLをコピー → 上記に入力",
        msg_webhook_disabled: "Discord連携が無効になりました。",
        msg_webhook_invalid: "正しいDiscord Webhook URLではありません。",
        msg_webhook_saved: "Discord Webhookが保存されました！",
        msg_webhook_req_save: "まずWebhook URLを入力して保存してください。",
        msg_test_sending: "送信中...",
        msg_test_success: "テストメッセージが正常に送信されました！\nDiscordチャンネルを確認してください。",
        msg_test_fail: "送信失敗: ",



        log_check_success: "チェックイン成功",
        log_check_already: "すでに完了",
        log_check_fail: "チェックイン失敗",
        log_req_login: "アカウント連携が必要",
        log_unknown_error: "不明なエラー",
        log_discord_sent: "通知送信完了",
        log_discord_fail: "送信失敗: ",
        log_start_checkin: "チェックイン開始",

        embed_success_title: "🎉 エンドフィールド チェックイン完了！",
        embed_already_title: "✅ チェックインはすでに完了しています",
        embed_fail_title: "⚠️ エンドフィールド チェックイン失敗",
        embed_test_success_title: "[Test] 🎉 エンドフィールド チェックイン完了！",
        embed_test_already_title: "[Test] ✅ チェックインはすでに完了しています",
        embed_test_fail_title: "[Test] ⚠️ エンドフィールド チェックイン失敗",
        field_date: "📅 日時",
        field_accumulated: "📊 累計日数",
        field_reward: "🎁 今日の報酬",
        field_status: "ℹ️ 状態",
        field_error: "❌ エラー内容",
        val_days: "日",
        val_success_msg: "チェックイン成功",
        val_already_msg: "今日のチェックインはすでに完了しています。",
        val_unknown_reward: "不明な報酬",
        val_test_item: "テストアイテム",
        val_test_error: "テストエラーメッセージです。",

        test_modal_title: "テストメッセージの種類を選択",
        test_btn_success: "✅ チェックイン成功",
        test_btn_already: "ℹ️ すでに完了",
        test_btn_fail: "❌ チェックイン失敗",

        update_avail_title: "アップデート可能",
        update_avail_desc: "新しいバージョンがあります。",
        ver_current: "現在のバージョン",
        ver_latest_stable: "最新正式版",
        ver_latest_beta: "最新プレビュー",
        ver_history: "旧バージョン",
        btn_download: "DL",
        msg_downgrade_warn: "注意：旧バージョンをインストールする場合、\n自動更新機能がサポートされない可能性があります。\n続けますか？",
        err_no_webhook: "Webhook URLなし",
        footer_text: "エンドフィールド自動チェックイン",
        modal_lang_title: "言語設定",
        msg_version_mismatch: "ファイルバージョン(v{fileVer})と読み込まれたバージョン(v{loadedVer})が異なります。\n拡張機能をリロードしますか？",
        title_version_mismatch: "⚡ バージョン不一致",
        ver_select_placeholder: "- バージョン選択 -",
        update_folder_note: "(フォルダ: 拡張機能ルート)"
    },
    zh: {
        title_main: "ENDFIELD<br>CHECK-IN",
        btn_discord_title: "Discord 通知设置",
        btn_settings_title: "设置与日志",
        status_header: "今日状态",
        last_run_prefix: "上次运行: ",
        btn_check_now: "立即检查",
        link_site: "前往签到页面 ↗",


        section_logs: "最近日志",
        msg_no_logs: "无记录",
        btn_back: "← 返回",

        title_discord: "Discord Webhook 设置",
        btn_webhook_help: "如何获取 Webhook URL",
        label_webhook_url: "Webhook URL",
        btn_save: "保存",
        btn_test: "测试",
        status_not_set: "未设置",
        status_active: "已激活",
        status_disabled: "已禁用",
        last_edit: "上次修改: ",

        status_success: "完成",
        status_fail: "失败",
        status_waiting: "等待中",
        status_checking: "检查中...",

        modal_alert_title: "提示",
        modal_confirm_title: "确认",
        modal_error_title: "错误",
        modal_success_title: "成功",
        modal_reset_title: "重置数据",
        btn_yes: "是",
        btn_no: "否",
        btn_ok: "确认",
        btn_cancel: "取消",

        msg_webhook_help: "1. Discord 服务器 → 服务器设置 → 集成 (Integrations)\n2. Webhooks → 新建 Webhook\n3. 复制 Webhook URL → 粘贴到上方",
        msg_webhook_disabled: "Discord 集成已禁用。",
        msg_webhook_invalid: "无效的 Discord Webhook URL。",
        msg_webhook_saved: "Discord Webhook 已保存！",
        msg_webhook_req_save: "请先输入并保存 Webhook URL。",
        msg_test_sending: "发送中...",
        msg_test_success: "测试消息发送成功！\n请检查您的 Discord 频道。",
        msg_test_fail: "发送失败: ",



        log_check_success: "签到成功",
        log_check_already: "已完成",
        log_check_fail: "签到失败",
        log_req_login: "需绑定账号",
        log_unknown_error: "未知错误",
        log_discord_sent: "通知已发送",
        log_discord_fail: "发送失败: ",
        log_start_checkin: "开始签到",

        embed_success_title: "🎉 Endfield 签到完成！",
        embed_already_title: "✅ 签到已完成",
        embed_fail_title: "⚠️ Endfield 签到失败",
        embed_test_success_title: "[Test] 🎉 Endfield 签到完成！",
        embed_test_already_title: "[Test] ✅ 签到已完成",
        embed_test_fail_title: "[Test] ⚠️ Endfield 签到失败",
        field_date: "📅 日期",
        field_accumulated: "📊 累计天数",
        field_reward: "🎁 今日奖励",
        field_status: "ℹ️ 状态",
        field_error: "❌ 错误详情",
        val_days: "天",
        val_success_msg: "签到成功",
        val_already_msg: "今日签到已完成。",
        val_unknown_reward: "未知奖励",
        val_test_item: "测试物品",
        val_test_error: "这是一条测试错误消息。",

        test_modal_title: "选择测试消息类型",
        test_btn_success: "✅ 签到成功",
        test_btn_already: "ℹ️ 已完成",
        test_btn_fail: "❌ 签到失败",

        update_avail_title: "可更新",
        update_avail_desc: "有新版本可用。",
        ver_current: "当前版本",
        ver_latest_stable: "最新正式版",
        ver_latest_beta: "最新预览版",
        ver_history: "历史版本",
        btn_download: "下载",
        msg_downgrade_warn: "注意：降级安装旧版本时，\n可能不支持自动更新功能。\n是否继续？",
        err_no_webhook: "无 Webhook URL",
        footer_text: "Endfield 自动签到",
        modal_lang_title: "语言设置",
        msg_version_mismatch: "文件版本(v{fileVer})与加载版本(v{loadedVer})不一致。\n是否重新加载扩展程序？",
        title_version_mismatch: "⚡ 版本不一致",
        ver_select_placeholder: "- 选择版本 -",
        update_folder_note: "(文件夹: 扩展程序根目录)"
    }
};

class I18nService {
    constructor() {
        this.language = 'ko';
        this.hasListener = false;
    }

    async init() {
        if (!this.hasListener) {
            chrome.storage.onChanged.addListener((changes, area) => {
                if (area === 'local' && changes.language) {
                    this.language = changes.language.newValue || 'ko';
                }
            });
            this.hasListener = true;
        }

        return new Promise((resolve) => {
            chrome.storage.local.get(['language'], (result) => {
                if (result.language && ['ko', 'en', 'ja', 'zh'].includes(result.language)) {
                    this.language = result.language;
                }
                resolve(this.language);
            });
        });
    }

    async setLanguage(lang) {
        if (!['ko', 'en', 'ja', 'zh'].includes(lang)) return;
        this.language = lang;
        await chrome.storage.local.set({ language: lang });
    }

    get(key, params = {}) {
        const langInfo = TRANSLATIONS[this.language] || TRANSLATIONS['ko'];
        return langInfo[key] || key;
    }

    get lang() {
        return this.language;
    }

    get locale() {
        if (this.language === 'ko') return 'ko-KR';
        if (this.language === 'ja') return 'ja-JP';
        if (this.language === 'zh') return 'zh-CN';
        return 'en-US';
    }
}

const i18n = new I18nService();
