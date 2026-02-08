const storage = chrome.storage.local;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await i18n.init();
        applyI18n();

        const data = await storage.get(['lastStatus', 'lastCheckDate', 'lastCheckTime', 'lastSignCount', 'accountInfo', 'checkInLogs', 'isRunning', 'discordConfig']);

        renderStatus(data);
        renderLogs(data.checkInLogs);

        renderDiscordConfig(data.discordConfig);

        checkUpdateStatus();
        checkAnnouncement();
        renderVersionInfo();

        document.getElementById('btnLang').addEventListener('click', async () => {
            const selectedLang = await showLanguageModal();
            if (selectedLang) {
                await i18n.setLanguage(selectedLang);
                applyI18n();
                storage.get(['lastStatus', 'lastCheckTime', 'accountInfo', 'checkInLogs', 'discordConfig'], (d) => {
                    renderStatus(d);
                    renderLogs(d.checkInLogs);

                    renderDiscordConfig(d.discordConfig);
                });
            }
        });

        document.getElementById('btnSettings').addEventListener('click', () => {
            const settingsView = document.getElementById('settingsView');
            const mainView = document.getElementById('mainView');
            const discordView = document.getElementById('discordView');
            if (settingsView.style.display === 'flex') {
                mainView.style.display = 'flex';
                settingsView.style.display = 'none';
                discordView.style.display = 'none';
            } else {
                mainView.style.display = 'none';
                settingsView.style.display = 'flex';
                discordView.style.display = 'none';
            }
        });

        document.getElementById('btnDiscord').addEventListener('click', () => {
            const settingsView = document.getElementById('settingsView');
            const mainView = document.getElementById('mainView');
            const discordView = document.getElementById('discordView');

            if (discordView.style.display === 'flex') {
                mainView.style.display = 'flex';
                settingsView.style.display = 'none';
                discordView.style.display = 'none';
            } else {
                mainView.style.display = 'none';
                settingsView.style.display = 'none';
                discordView.style.display = 'flex';
            }
        });

        document.getElementById('btnBack').addEventListener('click', () => {
            document.getElementById('settingsView').style.display = 'none';
            document.getElementById('discordView').style.display = 'none';
            document.getElementById('mainView').style.display = 'flex';
        });

        document.getElementById('btnBackFromDiscord').addEventListener('click', () => {
            document.getElementById('settingsView').style.display = 'none';
            document.getElementById('discordView').style.display = 'none';
            document.getElementById('mainView').style.display = 'flex';
        });

        document.getElementById('runNowBtn').addEventListener('click', handleManualRun);
        document.getElementById('btnSaveWebhook').addEventListener('click', handleSaveWebhook);
        document.getElementById('btnTestWebhook').addEventListener('click', handleTestWebhook);

        document.getElementById('btnWebhookHelp').addEventListener('click', async () => {
            await Modal.alert(
                i18n.get('msg_webhook_help'),
                i18n.get('btn_webhook_help')
            );
        });

        const btnGoGithub = document.getElementById('btnGoGithub');
        if (btnGoGithub) {
            btnGoGithub.addEventListener('click', () => {
                chrome.tabs.create({ url: "https://github.com/kgyujin/endfield-auto-checkin" });
            });
        }

        chrome.storage.onChanged.addListener((changes) => {
            storage.get(null, (newData) => {
                renderStatus(newData);
                if (changes.checkInLogs) renderLogs(newData.checkInLogs);

                if (changes.discordConfig) renderDiscordConfig(newData.discordConfig);
                if (changes.updateInfo) renderVersionInfo();
            });
        });
    } catch (e) {
        console.error("Popup Init Error:", e);
    }
});

class Modal {
    static init() {
        this.overlay = document.getElementById('customModal');
        this.titleEl = document.getElementById('modalTitle');
        this.msgEl = document.getElementById('modalMessage');
        this.btnOk = document.getElementById('modalBtnOk');
        this.btnCancel = document.getElementById('modalBtnCancel');

        this.resolve = null;

        this.btnOk.addEventListener('click', () => this.close(true));
        this.btnCancel.addEventListener('click', () => this.close(false));
    }

    static show(title, msg, isConfirm = false, useHtml = false) {
        return new Promise((resolve) => {
            this.resolve = resolve;
            this.titleEl.innerText = title;

            this.msgEl.innerHTML = '';
            if (msg instanceof Node) {
                this.msgEl.appendChild(msg);
            } else if (useHtml) {
                this.msgEl.innerHTML = msg;
            } else {
                this.msgEl.innerText = msg;
            }

            if (isConfirm) {
                this.btnCancel.style.display = 'block';
                this.btnOk.innerText = i18n.get('btn_yes');
                this.btnCancel.innerText = i18n.get('btn_no');
            } else {
                this.btnCancel.style.display = 'none';
                this.btnOk.innerText = i18n.get('btn_ok');
            }

            this.overlay.classList.add('active');
        });
    }

    static close(result) {
        this.overlay.classList.remove('active');
        if (this.resolve) {
            this.resolve(result);
            this.resolve = null;
        }
    }

    static async alert(msg, title = null, useHtml = false) {
        return await this.show(title || i18n.get('modal_alert_title'), msg, false, useHtml);
    }

    static async confirm(msg, title = null, useHtml = false) {
        return await this.show(title || i18n.get('modal_confirm_title'), msg, true, useHtml);
    }
}

Modal.init();

function handleManualRun() {
    chrome.runtime.sendMessage({ action: "manualRun" }, (res) => {
        if (chrome.runtime.lastError) {
            console.error("Manual Run Error:", chrome.runtime.lastError);
        }
    });
    document.getElementById('statusDisplay').innerHTML = `<span style="color:#FF9500">${i18n.get('status_checking')}</span>`;
}

function renderStatus(data) {
    const statusEl = document.getElementById('statusDisplay');
    const timeEl = document.getElementById('lastRunDisplay');

    document.getElementById('btnSettings').style.display = '';
    document.getElementById('runNowBtn').style.display = '';

    if (data.isRunning) {
        statusEl.innerHTML = `<span style="color:#FF9500">${i18n.get('status_checking')}</span>`;

    } else if (data.lastStatus === "SUCCESS" || data.lastStatus === "ALREADY_DONE") {
        statusEl.innerHTML = `<span style="color:#34C759">${i18n.get('status_success')}</span>`;

    } else if (data.lastStatus === "FAIL" || data.lastStatus === "NOT_LOGGED_IN") {
        statusEl.innerHTML = `<span style="color:#FF3B30">${i18n.get('status_fail')}</span>`;

    } else {
        statusEl.innerHTML = `<span style="color:#FF9500">${i18n.get('status_waiting')}</span>`;

    }

    const accDaysEl = document.getElementById('accDaysDisplay');
    if (data.lastSignCount) {
        accDaysEl.innerText = `${i18n.get('field_accumulated') || 'Accumulated'}: ${data.lastSignCount}${i18n.get('val_days') || 'Days'}`;
    } else {
        accDaysEl.innerText = "";
    }

    timeEl.innerText = data.lastCheckTime ? `${i18n.get('last_run_prefix')}${data.lastCheckTime}` : `${i18n.get('last_run_prefix')}-`;
}

function renderLogs(logs) {
    const list = document.getElementById('logList');
    list.innerHTML = "";

    if (!logs || logs.length === 0) {
        list.innerHTML = `<div style='text-align:center; color:#666; padding:10px;'>${i18n.get('msg_no_logs')}</div>`;
        return;
    }

    logs.forEach(log => {
        const div = document.createElement('div');
        div.className = "log-item";
        let statusText = log.status;
        if (log.status === 'SUCCESS') statusText = i18n.get('status_success');
        else if (log.status === 'ALREADY_DONE') statusText = i18n.get('status_success');
        else if (log.status === 'FAIL') statusText = i18n.get('status_fail');

        div.innerHTML = `
            <div>
                <div class="log-date">${log.date}</div>
                <div class="log-msg">${log.msg}</div>
            </div>
            <div class="log-status ${log.status}">${statusText}</div>
        `;
        list.appendChild(div);
    });
}

async function handleSaveWebhook() {
    const webhookUrl = document.getElementById('webhookUrl').value.trim();

    if (!webhookUrl) {
        const config = { webhookUrl: "" };
        await storage.set({ discordConfig: config });
        await Modal.alert(i18n.get('msg_webhook_disabled'), i18n.get('modal_alert_title'));
        renderDiscordConfig(config);
        return;
    }

    if (!webhookUrl.startsWith('https://discord.com/api/webhooks/') && !webhookUrl.startsWith('https://discordapp.com/api/webhooks/')) {
        await Modal.alert(i18n.get('msg_webhook_invalid'), i18n.get('modal_error_title'));
        return;
    }

    const config = {
        webhookUrl: webhookUrl,
        lastSync: new Date().toLocaleString('ko-KR')
    };

    await storage.set({ discordConfig: config });
    await Modal.alert(i18n.get('msg_webhook_saved'), i18n.get('modal_success_title'));
    renderDiscordConfig(config);
}

async function handleTestWebhook() {
    const webhookUrl = document.getElementById('webhookUrl').value.trim();

    if (!webhookUrl) {
        await Modal.alert(i18n.get('msg_webhook_req_save'), i18n.get('modal_error_title'));
        return;
    }

    const data = await storage.get(['discordConfig']);
    const config = data.discordConfig || {};

    const testType = await showTestTypeModal();
    if (!testType) return;

    const btn = document.getElementById('btnTestWebhook');
    const originalText = btn.innerText;
    btn.innerText = i18n.get('msg_test_sending');
    btn.disabled = true;

    try {
        const response = await new Promise((resolve) => {
            chrome.runtime.sendMessage({ action: "sendTestWebhook", testType: testType }, resolve);
        });

        if (response && response.code === "SUCCESS") {
            await Modal.alert(i18n.get('msg_test_success'), i18n.get('modal_success_title'));
        } else {
            const errorMsg = response ? response.msg : "Unknown Error";
            await Modal.alert(i18n.get('msg_test_fail') + errorMsg, i18n.get('modal_error_title'));
        }
    } catch (error) {
        await Modal.alert(i18n.get('msg_test_fail') + error.message, i18n.get('modal_error_title'));
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

function showTestTypeModal() {
    return new Promise((resolve) => {
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay active';
        modalOverlay.style.zIndex = '10000';

        modalOverlay.innerHTML = `
            <div class="modal-container">
                <div class="modal-title">${i18n.get('test_modal_title')}</div>
                <div class="modal-message" style="text-align: left;">
                    <button id="tempTestSuccess" class="btn-primary full-width" style="margin-bottom: 8px;">${i18n.get('test_btn_success')}</button>
                    <button id="tempTestAlready" class="btn-primary full-width" style="margin-bottom: 8px; background: rgba(52, 112, 219, 0.3); color: #3498db;">${i18n.get('test_btn_already')}</button>
                    <button id="tempTestFail" class="btn-primary full-width" style="margin-bottom: 8px; background: rgba(255, 59, 48, 0.3); color: #FF3B30;">${i18n.get('test_btn_fail')}</button>
                </div>
                <div class="modal-buttons">
                    <button class="modal-btn secondary" id="tempTestCancel">${i18n.get('btn_cancel')}</button>
                </div>
            </div>
        `;

        document.body.appendChild(modalOverlay);

        const close = (result) => {
            document.body.removeChild(modalOverlay);
            resolve(result);
        };

        document.getElementById('tempTestSuccess').onclick = () => close('SUCCESS');
        document.getElementById('tempTestAlready').onclick = () => close('ALREADY_DONE');
        document.getElementById('tempTestFail').onclick = () => close('FAIL');
        document.getElementById('tempTestCancel').onclick = () => close(null);
    });
}

function showLanguageModal() {
    return new Promise((resolve) => {
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay active';
        modalOverlay.style.zIndex = '10000';

        modalOverlay.innerHTML = `
            <div class="modal-container">
                <div class="modal-title">${i18n.get('modal_lang_title')}</div>
                <div class="modal-message" style="text-align: center;">
                    <button id="langKo" class="btn-primary full-width" style="margin-bottom: 8px; background: rgba(255, 255, 255, 0.1); color: #fff; border: 1px solid rgba(255,255,255,0.2);">한국어</button>
                    <button id="langEn" class="btn-primary full-width" style="margin-bottom: 8px; background: rgba(255, 255, 255, 0.1); color: #fff; border: 1px solid rgba(255,255,255,0.2);">English</button>
                    <button id="langJa" class="btn-primary full-width" style="margin-bottom: 8px; background: rgba(255, 255, 255, 0.1); color: #fff; border: 1px solid rgba(255,255,255,0.2);">日本語</button>
                    <button id="langZh" class="btn-primary full-width" style="margin-bottom: 8px; background: rgba(255, 255, 255, 0.1); color: #fff; border: 1px solid rgba(255,255,255,0.2);">简体中文</button>
                </div>
                <div class="modal-buttons">
                    <button class="modal-btn secondary" id="langCancel">${i18n.get('btn_cancel')}</button>
                </div>
            </div>
        `;

        document.body.appendChild(modalOverlay);

        const close = (result) => {
            document.body.removeChild(modalOverlay);
            resolve(result);
        };

        document.getElementById('langKo').onclick = () => close('ko');
        document.getElementById('langEn').onclick = () => close('en');
        document.getElementById('langJa').onclick = () => close('ja');
        document.getElementById('langZh').onclick = () => close('zh');
        document.getElementById('langCancel').onclick = () => close(null);
    });
}

function renderDiscordConfig(config) {
    const webhookUrlInput = document.getElementById('webhookUrl');
    const statusDiv = document.getElementById('discordStatus');

    if (config) {
        webhookUrlInput.value = config.webhookUrl || '';

        if (config.webhookUrl) {
            const status = i18n.get('status_active');
            const color = '#34C759';
            statusDiv.innerHTML = `<span style="color:${color}">●</span> ${status}<br><span style="font-size:10px; color:#888;">${i18n.get('last_edit')}${config.lastSync || '-'}</span>`;
        } else {
            const status = i18n.get('status_disabled');
            const color = '#888';
            statusDiv.innerHTML = `<span style="color:${color}">●</span> ${status}`;
        }
    } else {
        webhookUrlInput.value = '';
        const status = i18n.get('status_not_set');
        const color = '#888';
        statusDiv.innerHTML = `<span style="color:${color}">●</span> ${status}`;
    }
}

function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.innerText = i18n.get(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        el.title = i18n.get(el.dataset.i18nTitle);
    });
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
        el.innerHTML = i18n.get(el.dataset.i18nHtml);
    });

    const btnLang = document.getElementById('btnLang');
    if (btnLang) btnLang.innerText = i18n.lang.toUpperCase();
}

async function checkAnnouncement() {
    try {
        const gistId = "f866bc3f043a0da3ddd231891bb1d6f7";
        const apiUrl = `https://api.github.com/gists/${gistId}?t=${new Date().getTime()}`;

        const response = await fetch(apiUrl);
        if (!response.ok) return;

        const data = await response.json();
        if (!data.files || !data.files['extension-announce-modal.json']) return;

        const fileContent = data.files['extension-announce-modal.json'].content;
        const announceData = JSON.parse(fileContent);

        if (!announceData.active) return;

        if (announceData.target_version && announceData.check_version) {
            const currentVersion = chrome.runtime.getManifest().version;
            if (compareVersions(currentVersion, announceData.target_version) >= 0) {
                return;
            }
        }

        const storageData = await storage.get('lastSeenAnnouncementDate');
        const lastSeen = storageData.lastSeenAnnouncementDate;
        const updatedAt = data.updated_at;

        if (lastSeen === updatedAt) return;

        const lang = i18n.lang || 'ko';
        const content = announceData.contents[lang] || announceData.contents['ko'];

        if (!content) return;

        const fragment = document.createDocumentFragment();
        const p = document.createElement('p');
        p.innerText = content.message;
        p.style.marginBottom = '10px';
        p.style.whiteSpace = 'pre-wrap';
        fragment.appendChild(p);

        if (content.link) {
            const linkTitles = {
                'ko': "🔗 링크 확인하기",
                'en': "🔗 Check Link",
                'ja': "🔗 リンクを確認",
                'zh': "🔗 查看链接"
            };
            const linkTitle = linkTitles[lang] || linkTitles['en'];

            const a = document.createElement('a');
            a.href = content.link;
            a.target = "_blank";
            a.innerText = linkTitle;
            a.style.color = "#4A90E2";
            a.style.textDecoration = "none";
            a.style.fontWeight = "bold";
            a.style.display = "block";
            a.style.marginTop = "10px";

            fragment.appendChild(a);
        }

        await Modal.alert(fragment, content.title);

        await storage.set({ lastSeenAnnouncementDate: updatedAt });

    } catch (e) {
        console.log("Announcement check failed:", e);
    }
}

function compareVersions(v1, v2) {
    const p1 = v1.split('.').map(Number);
    const p2 = v2.split('.').map(Number);
    const len = Math.max(p1.length, p2.length);

    for (let i = 0; i < len; i++) {
        const num1 = p1[i] || 0;
        const num2 = p2[i] || 0;
        if (num1 > num2) return 1;
        if (num1 < num2) return -1;
    }
    return 0;
}

function checkUpdateStatus() {
    storage.get(['updateAvailable'], (data) => {
        const banner = document.getElementById('updateBanner');
        if (data.updateAvailable) {
            banner.style.display = 'flex';
            banner.onclick = () => {
            };

            const dismissBtn = banner.querySelector('.update-dismiss');
            if (dismissBtn) {
                dismissBtn.onclick = (e) => {
                    e.stopPropagation();
                    banner.style.display = 'none';
                };
            }

            banner.onclick = () => {
                Modal.alert(i18n.get('update_avail_desc') + "\n\n(Folder: Extension Root)", i18n.get('update_avail_title'));
            };
        } else {
            banner.style.display = 'none';
        }
    });
}

function renderVersionInfo() {
    storage.get(['updateInfo'], (data) => {
        const info = data.updateInfo;
        const verCurrent = document.getElementById('verCurrent');
        const verStable = document.getElementById('verStable');
        const verBeta = document.getElementById('verBeta');

        const dropdown = document.getElementById('verHistoryDropdown');
        const trigger = document.getElementById('verHistoryTrigger');
        const triggerText = document.getElementById('verHistorySelectedText');
        const optionsContainer = document.getElementById('verHistoryOptions');
        const btnDl = document.getElementById('btnDlHistory');

        let selectedUrl = null;
        let selectedVersion = null;

        if (!info || !info.lastCheck) {
            chrome.runtime.sendMessage({ action: "checkUpdate" }, (response) => {
                if (response && response.code === "SUCCESS" && response.data) {
                }
            });
            if (verStable) verStable.innerText = "Check...";
            if (verBeta) verBeta.innerText = "Check...";
            return;
        }

        const manifest = chrome.runtime.getManifest();
        const currentVersion = manifest.version;

        if (verCurrent) verCurrent.innerText = "v" + currentVersion;
        if (verStable) verStable.innerText = info.latestStable ? "v" + info.latestStable : "-";
        if (verBeta) verBeta.innerText = info.latestBeta ? "v" + info.latestBeta : "-";

        const stableRel = info.releases ? info.releases.find(r => !r.isPrerelease) : null;
        const betaRel = info.releases ? info.releases.find(r => r.isPrerelease) : null;

        const btnDlStable = document.getElementById('btnDlStable');
        const btnDlBeta = document.getElementById('btnDlBeta');

        if (btnDlStable) {
            if (stableRel) {
                btnDlStable.style.display = 'inline-block';
                btnDlStable.onclick = () => chrome.tabs.create({ url: stableRel.zipUrl });
            } else {
                btnDlStable.style.display = 'none';
            }
        }

        if (btnDlBeta) {
            if (betaRel) {
                btnDlBeta.style.display = 'inline-block';
                btnDlBeta.onclick = () => chrome.tabs.create({ url: betaRel.zipUrl });
            } else {
                btnDlBeta.style.display = 'none';
            }
        }

        if (optionsContainer && info.releases) {
            optionsContainer.innerHTML = '';

            const defaultOpt = document.createElement('div');
            defaultOpt.className = 'dropdown-option selected';
            defaultOpt.innerText = "- Select Version -";
            defaultOpt.dataset.value = "";
            defaultOpt.onclick = () => selectOption(defaultOpt);
            optionsContainer.appendChild(defaultOpt);

            info.releases.forEach(rel => {
                const isBeta = rel.isPrerelease;
                const type = isBeta ? "[Preview]" : "[Stable]";

                const opt = document.createElement('div');
                opt.className = 'dropdown-option';
                opt.innerText = `v${rel.version} ${type}`;
                opt.dataset.value = rel.zipUrl;
                opt.dataset.version = rel.version;

                opt.onclick = () => selectOption(opt);
                optionsContainer.appendChild(opt);
            });

            trigger.onclick = (e) => {
                e.stopPropagation();
                trigger.classList.toggle('active');
                if (trigger.classList.contains('active')) {
                    optionsContainer.classList.add('open');
                } else {
                    optionsContainer.classList.remove('open');
                }
            };

            window.addEventListener('click', (e) => {
                if (!dropdown.contains(e.target)) {
                    trigger.classList.remove('active');
                    optionsContainer.classList.remove('open');
                }
            });

            function selectOption(element) {
                triggerText.innerText = element.innerText;

                document.querySelectorAll('.dropdown-option').forEach(el => el.classList.remove('selected'));
                element.classList.add('selected');

                selectedUrl = element.dataset.value;
                selectedVersion = element.dataset.version;

                trigger.classList.remove('active');
                optionsContainer.classList.remove('open');
            }
        }

        if (btnDl) {
            btnDl.onclick = async () => {
                if (!selectedUrl) return;

                const currentVer = chrome.runtime.getManifest().version;
                let isDowngrade = selectedVersion && compareVersions(currentVer, selectedVersion) > 0;

                if (isDowngrade) {
                    const confirm = await Modal.confirm(
                        i18n.get('msg_downgrade_warn'),
                        i18n.get('modal_alert_title')
                    );
                    if (!confirm) return;
                }

                chrome.tabs.create({ url: selectedUrl });
            };
        }
    });
}
