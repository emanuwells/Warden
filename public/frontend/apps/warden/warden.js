/**
 * Ficheiro: frontend/apps/warden/warden.js
 * Finalidade: Controlador frontend canónico da app Warden.
 * Depende de: DOM da página, config local, shared UI MAIATRON e endpoints/dados da superfície respetiva.
 * Entradas/Saídas principais: Recebe eventos do utilizador, estado remoto/local e atualiza UI, estado e pedidos de rede.
 * Efeitos laterais: Pode manipular DOM, timers, fetch, localStorage/sessionStorage e estados visuais.
 * Relação canónica: ficheiro público em `frontend/`; é servido diretamente pelo Nginx.
 */
/**
 * ============================================
 *  WARDEN — System Monitor Frontend
 *  MAIATRON Design System v1.1
 * ============================================
 */

(function () {
    'use strict';

    const CONFIG = {
        themeKey: 'warden_theme',
        rangeKey: 'warden_range',
        authConfigUrl: '../../config/auth.local.json',
        apiUrl: './api.php',
        refreshInterval: 15000,
        fastIntervalMs: 1200,
        fastMinIntervalMs: 500,
        fastCatchupIntervalMs: 650,
        heavyIntervalMs: 60000,
        fastMaxBackoffMs: 30000,
        heavyMaxBackoffMs: 300000,
        fastRequestTimeoutMs: 2600,
        heavyRequestTimeoutMs: 15000,
    };

    const RANGE_LABEL = {
        '1h': '1h',
        '24h': '24h',
        '7d': '7d',
        '30d': '30d',
    };
    const RANGE_SECONDS = {
        '1h': 3600,
        '24h': 86400,
        '7d': 604800,
        '30d': 2592000,
    };

    let _selectedRange = localStorage.getItem(CONFIG.rangeKey) || '24h';
    if (!RANGE_LABEL[_selectedRange]) _selectedRange = '24h';
    let _selectedAlertKey = null;
    let _dataMode = 'bootstrap';
    let _mergedPayload = null;
    let _fastSnapshot = null;
    let _heavySnapshot = null;
    let _fullSnapshot = null;
    let _streamEtags = { fast: null, heavy: null, full: null };
    let _streamMeta = { fast: null, heavy: null, full: null };
    let _fastPollTimer = null;
    let _heavyPollTimer = null;
    let _fastInFlight = false;
    let _heavyInFlight = false;
    let _fastBackoffMs = CONFIG.fastIntervalMs;
    let _heavyBackoffMs = CONFIG.heavyIntervalMs;
    let _lastFastAt = 0;
    let _lastHeavyAt = 0;
    let _lastUiRefreshAt = 0;
    let _lastFastChartTabRenderAt = 0;
    let _lastFastRenderedTab = null;
    let _lastSampleAtMs = 0;
    let _statusTickTimer = null;
    let _fastFailureStreak = 0;
    let _heavyFailureStreak = 0;
    const FAST_TAB_CHART_MIN_MS = 3000;
    const LIVE_STALE_MS = 45000;
    const LIVE_KEYS = ['cpu', 'ram', 'disk', 'netUp', 'netDown', 'dbQps', 'dbTps', 'dbStorage', 'dbGrowth', 'dbWrite'];
    const TIME_SERIES_CHART_IDS = [
        'chartOverview24h',
        'chartNet24h',
        'chartCpuLive',
        'chartCpu7d',
        'chartMemLive',
        'chartMem7d',
        'chartDiskIo',
        'chartDiskGrowth',
        'chartNetLive',
        'chartNet7d',
        'chartDbLoad',
        'chartDbRates',
        'chartDbStorage',
    ];
    let _lastReceivedSampleAtMs = 0;
    const _historyRowsCache = new WeakMap();

    function makeLiveMetricState() {
        return {
            lastGood: null,
            displayValue: null,
            lastSampleAtMs: 0,
            lastUpdateSource: null,
        };
    }

    const _liveMirror = LIVE_KEYS.reduce((acc, key) => {
        acc[key] = makeLiveMetricState();
        return acc;
    }, {});

    const $ = (id) => document.getElementById(id);
    const el = {
        loginScreen: $('loginScreen'),
        loginForm: $('loginForm'),
        username: $('username'),
        password: $('password'),
        loginError: $('loginError'),
        mainApp: $('mainApp'),
        themeToggle: $('themeToggle'),
        loginThemeToggle: $('loginThemeToggle'),
        csvExportBtn: $('csvExportBtn'),
        csvExportLabel: $('csvExportLabel'),
        userName: $('userName'),
        userBtn: $('userBtn'),
        userMenu: document.querySelector('.user-menu'),
        logoutBtn: $('logoutBtn'),
        lastUpdated: $('lastUpdated'),
        statusText: $('statusText'),
        toast: $('toast'),
        currentYear: $('currentYear'),
        tabsNav: $('tabsNav'),
        rangeSelector: $('rangeSelector'),
        alertsSummaryBadge: $('alertsSummaryBadge'),
        dbHealthPill: $('dbHealthPill'),
        dbHealthNote: $('dbHealthNote'),
        dbAlertsList: $('dbAlertsList'),
        alertDetailPanel: $('alertDetailPanel'),
        alertHistoryList: $('alertHistoryList'),
        chartExpandModal: $('chartExpandModal'),
        chartExpandDialog: $('chartExpandModal')?.querySelector('.chart-expand-dialog') || null,
        chartExpandTitle: $('chartExpandTitle'),
        chartExpandCanvas: $('chartExpandCanvas'),
        chartExpandCloseBtn: $('chartExpandCloseBtn'),
        sysHostName: $('sysHostName'),
        sysOsName: $('sysOsName'),
        sysKernel: $('sysKernel'),
        sysHostUptime: $('sysHostUptime'),
        diskTopList: $('diskTopList'),
        diskTopState: $('diskTopState'),
        diskTopScope: $('diskTopScope'),
        diskTopUpdated: $('diskTopUpdated'),
        cpuProcTopList: $('cpuProcTopList'),
        cpuProcTopState: $('cpuProcTopState'),
        cpuProcTopUpdated: $('cpuProcTopUpdated'),
        memProcTopList: $('memProcTopList'),
        memProcTopState: $('memProcTopState'),
        memProcTopUpdated: $('memProcTopUpdated'),
        netProcTopList: $('netProcTopList'),
        netProcTopState: $('netProcTopState'),
        netProcTopUpdated: $('netProcTopUpdated'),
        dbTopSchemasList: $('dbTopSchemasList'),
        dbTopTablesList: $('dbTopTablesList'),
        dbStorageTopState: $('dbStorageTopState'),
        dbStorageTopUpdated: $('dbStorageTopUpdated'),
    };

    function getSystemTheme() {
        return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }

    function initTheme() {
        const saved = localStorage.getItem(CONFIG.themeKey) || 'dark';
        setTheme(saved);
        window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function () {
            if (localStorage.getItem(CONFIG.themeKey) === 'auto') setTheme('auto');
        });
    }

    function setTheme(theme) {
        var resolved = theme === 'auto' ? getSystemTheme() : theme;
        if (resolved === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
        localStorage.setItem(CONFIG.themeKey, theme);
        document.querySelectorAll('.theme-btn').forEach(function (btn) {
            btn.setAttribute('data-theme-mode', theme);
            btn.setAttribute('title', theme === 'auto' ? 'Tema: Auto (sistema)' : theme === 'light' ? 'Tema: Claro' : 'Tema: Escuro');
        });
    }

    function toggleTheme() {
        var current = localStorage.getItem(CONFIG.themeKey) || 'dark';
        var next = current === 'dark' ? 'light' : current === 'light' ? 'auto' : 'dark';
        setTheme(next);
        if (_lastPayload) renderAll(_lastPayload);
    }

    function toggleUserMenu() {
        const open = el.userMenu.classList.toggle('open');
        el.userMenu.setAttribute('aria-expanded', String(open));
        el.userBtn.setAttribute('aria-expanded', String(open));
    }

    function closeUserMenu() {
        el.userMenu.classList.remove('open');
        el.userMenu.setAttribute('aria-expanded', 'false');
        el.userBtn.setAttribute('aria-expanded', 'false');
    }

    if (el.themeToggle) el.themeToggle.addEventListener('click', toggleTheme);
    if (el.loginThemeToggle) el.loginThemeToggle.addEventListener('click', toggleTheme);

    if (window.MaiatronAuthUI && typeof window.MaiatronAuthUI.mount === 'function') {
        window.MaiatronAuthUI.mount({
            configUrl: CONFIG.authConfigUrl,
            toast: showToast,
            onAuthLost: () => location.reload(),
            menu: { passwordSource: 'shared' },
            appPermissions: {
                enabled: true,
                appKey: 'warden',
                appLabel: 'Warden',
                allowScopes: false
            }
        });
    }

    function resolveInitialAuthGate() {
        if (window.__maiatronAuthGateFallback) {
            window.clearTimeout(window.__maiatronAuthGateFallback);
            window.__maiatronAuthGateFallback = null;
        }
        document.documentElement.classList.remove('maiatron-auth-pending');
    }

    async function checkSession() {
        try {
            if (!window.MaiatronAuth) throw new Error('Auth module indisponivel');
            let allowedSession = null;
            await window.MaiatronAuth.requireAuth({
                options: { configUrl: CONFIG.authConfigUrl, appKey: 'warden' },
                onAuthorized: (session) => { allowedSession = session; },
                onUnauthorized: () => {}
            });
            if (allowedSession) {
                showMainApp(allowedSession);
                return true;
            }
        } catch (_) {
            showLoginError('Erro de autenticacao. Verifique o deploy.');
        }
        resolveInitialAuthGate();
        return false;
    }

    if (el.loginForm) {
        el.loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = el.username.value.trim();
            const password = el.password.value;
            const rememberSession = document.getElementById('rememberSession')?.checked ?? true;
            const rememberUsername = document.getElementById('rememberUsername')?.checked ?? false;
            const btn = el.loginForm.querySelector('.login-btn');
            btn.classList.add('loading');

            try {
                await new Promise(r => setTimeout(r, 500));
                if (!window.MaiatronAuth) throw new Error('Auth module indisponivel');
                const result = await window.MaiatronAuth.login(username, password, {
                    configUrl: CONFIG.authConfigUrl,
                    rememberSession
                });
                if (result.ok) {
                    window.MaiatronAuth.saveLoginPreferences({ rememberUsername, rememberSession, username });
                    const hasAccess = await checkSession();
                    if (!hasAccess) {
                        showLoginError('Sem permissao para aceder ao Warden.');
                    }
                } else {
                    showLoginError('Utilizador ou password incorretos');
                }
            } catch (_) {
                showLoginError('Erro de autenticacao. Verifique o deploy.');
            } finally {
                btn.classList.remove('loading');
            }
        });
    }

    // Restore login preferences
    if (window.MaiatronAuth?.getLoginPreferences) {
        const prefs = window.MaiatronAuth.getLoginPreferences();
        const ru = document.getElementById('rememberUsername');
        const rs = document.getElementById('rememberSession');
        if (ru) ru.checked = prefs.rememberUsername;
        if (rs) rs.checked = prefs.rememberSession;
        if (el.username && prefs.username) el.username.value = prefs.username;
    }

    function showLoginError(message) {
        if (!el.loginError) return;
        el.loginError.textContent = message;
        el.loginError.classList.add('show');
        if (el.password) {
            el.password.value = '';
            el.password.focus();
        }
        setTimeout(() => el.loginError.classList.remove('show'), 3000);
    }

    function showMainApp(sessionOrUsername) {
        resolveInitialAuthGate();
        const session = (sessionOrUsername && typeof sessionOrUsername === 'object')
            ? sessionOrUsername
            : { username: sessionOrUsername };
        const displayName = (window.MaiatronAuth && typeof window.MaiatronAuth.getDisplayName === 'function')
            ? window.MaiatronAuth.getDisplayName(session)
            : (session.displayName || session.username || 'User');
        el.loginScreen.classList.add('hidden');
        el.mainApp.classList.remove('hidden');
        if (el.userName) el.userName.textContent = displayName;
        window.MaiatronAuthUI?.syncFromServer({ configUrl: CONFIG.authConfigUrl });
        window.MaiatronAppSwitcher?.mount({ currentAppKey: 'warden', session });
        syncRangeButtons();
        startDashboard();
    }

    if (el.userBtn) {
        el.userBtn.addEventListener('click', toggleUserMenu);
        document.addEventListener('click', (e) => {
            if (!el.userMenu?.contains(e.target)) closeUserMenu();
        });
    }

    if (el.logoutBtn) {
        el.logoutBtn.addEventListener('click', async () => {
            try {
                clearDashboardTimers();
                if (window.MaiatronAuth) {
                    await window.MaiatronAuth.logout({ configUrl: CONFIG.authConfigUrl });
                }
            } finally {
                location.reload();
            }
        });
    }

    const forgotBtn = document.getElementById('forgotPasswordBtn');
    if (forgotBtn) {
        forgotBtn.addEventListener('click', async () => {
            if (!window.MaiatronAuth || typeof window.MaiatronAuth.forgotPassword !== 'function') {
                showToast('Funcionalidade indisponível', 'error');
                return;
            }
            const cu = (document.getElementById('username')?.value || '').trim();
            const u = cu || window.prompt('Indique o utilizador para reset da password:');
            if (!u) return;
            if (!window.confirm(`Vai gerar uma nova password temporária para "${u}". Continuar?`)) return;
            const r = await window.MaiatronAuth.forgotPassword(u, { configUrl: CONFIG.authConfigUrl });
            if (!r.ok) {
                showToast(r.reason === 'invalid_user' ? 'Utilizador inexistente ou inativo.' : 'Erro ao recuperar password', 'error');
                return;
            }
            const pi = document.getElementById('password');
            if (pi) { pi.value = r.temporaryPassword || ''; pi.focus(); pi.select(); }
            showToast('Password temporária gerada. Faça login com a nova password.', 'success');
        });
    }

    if (el.tabsNav) {
        el.tabsNav.addEventListener('click', (e) => {
            const btn = e.target.closest('.tab-btn');
            if (!btn) return;
            const tab = btn.dataset.tab;
            activateTab(tab);
        });
    }

    function activateTab(tab) {
        const applyTab = () => {
            document.querySelectorAll('.tab-btn').forEach(x => x.classList.remove('active'));
            const tabBtn = document.querySelector(`.tab-btn[data-tab=\"${tab}\"]`);
            if (tabBtn) tabBtn.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(x => x.classList.remove('active'));
            const target = document.getElementById('tab-' + tab);
            if (target) target.classList.add('active');
            if (_lastPayload) renderActiveTabSections(_lastPayload, tab);
            revealWardenSurface();
        };
        if (window.MaiatronMotion && typeof window.MaiatronMotion.swap === 'function') {
            void window.MaiatronMotion.swap(applyTab, {
                root: el.mainApp || document,
                selectors: '.tab-content.active > *, .chart-card, .glass-card, .metric-card, .alerts-grid > *, .list-card'
            });
            return;
        }
        applyTab();
    }

    function baseHistoryRowsForRange(data, range) {
        const h = data.history || {};
        if (Array.isArray(h[range])) return h[range];
        if (range === '1h') return data.history_1h || (data.history_24h || []).slice(-12) || [];
        if (range === '24h') return data.history_24h || [];
        if (range === '7d') return data.history_7d || [];
        if (range === '30d') return data.history_30d || [];
        return [];
    }

    function syncRangeButtons() {
        if (!el.rangeSelector) return;
        el.rangeSelector.querySelectorAll('.range-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.range === _selectedRange);
        });
        if (el.csvExportLabel) el.csvExportLabel.textContent = `CSV · ${labelWindow()}`;
        if (el.csvExportBtn) {
            const label = `Descarregar dados em CSV (${labelWindow()})`;
            el.csvExportBtn.title = label;
            el.csvExportBtn.setAttribute('aria-label', label);
        }
    }

    if (el.rangeSelector) {
        el.rangeSelector.addEventListener('click', (e) => {
            const btn = e.target.closest('.range-btn');
            if (!btn) return;
            const range = btn.dataset.range;
            if (!RANGE_LABEL[range]) return;
            _selectedRange = range;
            localStorage.setItem(CONFIG.rangeKey, _selectedRange);
            syncRangeButtons();
            if (_lastPayload) renderActiveTabSections(_lastPayload);
        });
    }

    if (el.dbAlertsList) {
        el.dbAlertsList.addEventListener('click', (e) => {
            const card = e.target.closest('.alert-item');
            if (!card) return;
            _selectedAlertKey = card.dataset.key || null;
            if (_lastPayload) renderAlertsTab(_lastPayload);
        });
    }

    if (el.alertsSummaryBadge) {
        el.alertsSummaryBadge.style.cursor = 'pointer';
        el.alertsSummaryBadge.addEventListener('click', () => activateTab('alerts'));
    }

    if (el.csvExportBtn) {
        el.csvExportBtn.addEventListener('click', () => {
            if (!_lastPayload) {
                showToast('Ainda sem dados para exportar', 'warning');
                return;
            }
            try {
                exportCsv(_lastPayload);
            } catch (err) {
                console.error(err);
                showToast('Erro ao gerar CSV', 'error');
            }
        });
    }

    bindEmbeddedZoomControls();
    bindChartExpandModal();

    function showToast(message, type = 'info') {
        if (!el.toast) return;
        el.toast.textContent = message;
        el.toast.className = 'toast show ' + type;
        setTimeout(() => { el.toast.className = 'toast'; }, 2500);
    }

    function initMotion() {
        if (!window.MaiatronMotion || typeof window.MaiatronMotion.init !== 'function') return;
        window.MaiatronMotion.init({
            preset: 'premium',
            configUrl: CONFIG.authConfigUrl
        });
    }

    function revealWardenSurface() {
        if (!window.MaiatronMotion || typeof window.MaiatronMotion.reveal !== 'function') return;
        const root = el.mainApp && !el.mainApp.classList.contains('hidden') ? el.mainApp : document;
        window.MaiatronMotion.reveal(
            root,
            '.tab-panel.active > *, .chart-card, .glass-card, .metric-card, .alerts-grid > *, .list-card, .detail-modal-content'
        );
    }

    const chartInstances = {};
    let _chartUnavailableWarned = false;
    let _zoomPluginRegistered = false;
    let _expandedChartInstance = null;
    let _expandedChartSourceId = null;
    let _expandedChartTriggerEl = null;

    function ensureChartZoomPlugin() {
        if (_zoomPluginRegistered || typeof Chart === 'undefined') return;
        const candidate = window.ChartZoom
            || window['chartjs-plugin-zoom']
            || (window.ChartZoomPlugin || null);
        if (!candidate || typeof Chart.register !== 'function') return;
        try {
            Chart.register(candidate);
            _zoomPluginRegistered = true;
        } catch (_err) {
            _zoomPluginRegistered = false;
        }
    }

    function getVisibleTimeSeriesCharts() {
        return Object.values(chartInstances).filter((chart) => {
            const type = chart?.config?.type;
            if (type !== 'line') return false;
            const canvasId = chart?.canvas?.id || '';
            if (/^gauge/i.test(canvasId)) return false;
            const tab = chart?.canvas?.closest?.('.tab-content');
            if (!tab) return true;
            return tab.classList.contains('active');
        });
    }

    function getTimeSeriesChartById(chartId) {
        if (!chartId) return null;
        const chart = chartInstances[chartId];
        if (!chart || chart?.config?.type !== 'line') return null;
        return chart;
    }

    function applyZoomIn(chartId = null) {
        if (chartId) {
            const chart = getTimeSeriesChartById(chartId);
            if (chart) chart.zoom?.(1.2);
            return;
        }
        getVisibleTimeSeriesCharts().forEach((chart) => chart.zoom?.(1.2));
    }

    function applyZoomOut(chartId = null) {
        if (chartId) {
            const chart = getTimeSeriesChartById(chartId);
            if (chart) chart.zoom?.(0.8);
            return;
        }
        getVisibleTimeSeriesCharts().forEach((chart) => chart.zoom?.(0.8));
    }

    function resetZoomVisibleCharts(chartId = null) {
        if (chartId) {
            const chart = getTimeSeriesChartById(chartId);
            if (chart) chart.resetZoom?.();
            return;
        }
        getVisibleTimeSeriesCharts().forEach((chart) => chart.resetZoom?.());
    }

    function cloneChartValue(value, fallback) {
        if (typeof structuredClone === 'function') {
            try {
                return structuredClone(value);
            } catch (_err) {
                // fallback below
            }
        }
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (_err) {
            return fallback;
        }
    }

    function isChartExpandOpen() {
        return !!(el.chartExpandModal && el.chartExpandModal.classList.contains('open'));
    }

    function getFocusableInExpandModal() {
        if (!el.chartExpandDialog) return [];
        const selector = [
            'button:not([disabled])',
            'a[href]',
            'input:not([disabled])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            '[tabindex]:not([tabindex="-1"])'
        ].join(',');
        return Array.from(el.chartExpandDialog.querySelectorAll(selector))
            .filter((node) => node.offsetParent !== null || node === document.activeElement);
    }

    function trapExpandModalFocus(event) {
        if (!isChartExpandOpen() || event.key !== 'Tab') return;
        const focusables = getFocusableInExpandModal();
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    function closeExpandedChartModal(options = {}) {
        const restoreFocus = options.restoreFocus !== false;
        if (_expandedChartInstance) {
            try {
                _expandedChartInstance.destroy();
            } catch (_err) {
                // noop
            }
            _expandedChartInstance = null;
        }
        _expandedChartSourceId = null;
        if (el.chartExpandModal) {
            el.chartExpandModal.classList.remove('open');
            el.chartExpandModal.setAttribute('aria-hidden', 'true');
        }
        document.body.classList.remove('chart-expand-open');
        if (restoreFocus && _expandedChartTriggerEl && typeof _expandedChartTriggerEl.focus === 'function') {
            try {
                _expandedChartTriggerEl.focus();
            } catch (_err) {
                // noop
            }
        }
        _expandedChartTriggerEl = null;
    }

    function openExpandedChartModal(chartId, triggerEl = null) {
        if (!chartId || typeof Chart === 'undefined') {
            showToast('Gráfico indisponível para ampliar.', 'warning');
            return;
        }
        const sourceChart = chartInstances[chartId];
        if (!sourceChart || !el.chartExpandCanvas) {
            showToast('Gráfico ainda não está pronto.', 'warning');
            return;
        }

        closeExpandedChartModal({ restoreFocus: false });

        const chartCard = sourceChart.canvas?.closest?.('.chart-card');
        const chartTitle = chartCard?.querySelector('.chart-header h3')?.textContent?.trim() || 'Gráfico';
        if (el.chartExpandTitle) el.chartExpandTitle.textContent = chartTitle;

        const clonedData = cloneChartValue(sourceChart.data, { datasets: [] });
        const clonedOptions = cloneChartValue(sourceChart.options, {});
        clonedOptions.responsive = true;
        clonedOptions.maintainAspectRatio = false;
        clonedOptions.animation = false;

        const ctx = el.chartExpandCanvas.getContext('2d');
        if (!ctx) {
            showToast('Não foi possível abrir o gráfico ampliado.', 'error');
            return;
        }
        _expandedChartInstance = new Chart(ctx, {
            type: sourceChart.config?.type || 'line',
            data: clonedData,
            options: clonedOptions,
        });
        _expandedChartSourceId = chartId;
        _expandedChartTriggerEl = triggerEl || document.activeElement || null;

        if (el.chartExpandModal) {
            el.chartExpandModal.classList.add('open');
            el.chartExpandModal.setAttribute('aria-hidden', 'false');
        }
        document.body.classList.add('chart-expand-open');
        window.requestAnimationFrame(() => {
            _expandedChartInstance?.resize?.();
            el.chartExpandCloseBtn?.focus?.();
        });
    }

    function bindChartExpandModal() {
        if (!el.chartExpandModal) return;
        if (el.chartExpandCloseBtn) {
            el.chartExpandCloseBtn.addEventListener('click', () => closeExpandedChartModal());
        }
        el.chartExpandModal.addEventListener('click', (event) => {
            if (event.target === el.chartExpandModal) {
                closeExpandedChartModal();
            }
        });
    }

    function mountEmbeddedZoomControls() {
        const chartCanvases = Array.from(document.querySelectorAll('.chart-card canvas[id]'));
        chartCanvases.forEach((canvas) => {
            const chartId = canvas.id;
            const card = canvas.closest('.chart-card');
            const header = card?.querySelector('.chart-header');
            if (!header) return;
            if (header.querySelector(`.chart-zoom-controls[data-chart-id="${chartId}"]`)) return;

            const controls = document.createElement('div');
            controls.className = 'chart-zoom-controls';
            controls.dataset.chartId = chartId;
            const isTimeSeries = TIME_SERIES_CHART_IDS.includes(chartId);
            controls.innerHTML = [
                isTimeSeries
                    ? `<button type="button" class="theme-btn chart-zoom-btn chart-zoom-btn-icon" data-zoom-action="out" data-chart-id="${chartId}" title="Zoom out" aria-label="Zoom out">-</button>
                <button type="button" class="theme-btn chart-zoom-btn chart-zoom-btn-icon" data-zoom-action="in" data-chart-id="${chartId}" title="Zoom in" aria-label="Zoom in">+</button>
                <button type="button" class="theme-btn chart-zoom-btn" data-zoom-action="reset" data-chart-id="${chartId}" title="Reset zoom" aria-label="Reset zoom">Reset</button>`
                    : '',
                `<button type="button" class="theme-btn chart-zoom-btn chart-expand-btn" data-zoom-action="expand" data-chart-id="${chartId}" title="Ampliar gráfico" aria-label="Ampliar gráfico">Ampliar</button>`
            ].join('');
            header.appendChild(controls);
        });
    }

    function bindEmbeddedZoomControls() {
        mountEmbeddedZoomControls();
        document.addEventListener('click', (event) => {
            const btn = event.target.closest('.chart-zoom-btn[data-zoom-action][data-chart-id]');
            if (!btn) return;
            event.preventDefault();
            const chartId = btn.dataset.chartId || '';
            const action = btn.dataset.zoomAction || '';
            if (!chartId || !action) return;
            if (action === 'in') {
                applyZoomIn(chartId);
            } else if (action === 'out') {
                applyZoomOut(chartId);
            } else if (action === 'reset') {
                resetZoomVisibleCharts(chartId);
            } else if (action === 'expand') {
                openExpandedChartModal(chartId, btn);
            }
        });
    }

    function safeRenderSection(sectionName, fn) {
        try {
            fn();
            return true;
        } catch (err) {
            console.error(`[Warden] render section failed: ${sectionName}`, err);
            return false;
        }
    }

    function getChartColors() {
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        return {
            gridColor: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)',
            tickColor: isLight ? 'rgba(15,23,42,0.55)' : 'rgba(255,255,255,0.5)',
            cpu: '#00d4ff',
            mem: '#7c3aed',
            disk: '#f59e0b',
            netUp: '#00d4ff',
            netDown: '#10b981',
            dbLoad: '#f97316',
            dbConn: '#38bdf8',
            dbQps: '#10b981',
            dbTps: '#22d3ee',
            dbStorage: '#f59e0b',
            dbGrowth: '#ef4444',
            dbWrite: '#38bdf8',
        };
    }

    function getChartViewportMode() {
        const w = window.innerWidth || document.documentElement.clientWidth || 0;
        const h = window.innerHeight || document.documentElement.clientHeight || 0;
        return {
            compact: w <= 1280 || h <= 800,
            veryCompact: h <= 720 || w <= 1024,
        };
    }

    function chartDefaults() {
        const c = getChartColors();
        const viewport = getChartViewportMode();
        const compact = viewport.compact;
        const veryCompact = viewport.veryCompact;
        const legendFontSize = veryCompact ? 10 : (compact ? 11 : 12);
        const tickFontSize = veryCompact ? 10 : 11;
        return {
            responsive: true,
            maintainAspectRatio: false,
            animation: window.MaiatronMotion?.selectiveChartAnimation?.('initial') ?? false,
            interaction: { intersect: false, mode: 'index' },
            layout: { padding: compact ? { top: 2, right: 4, bottom: 2, left: 2 } : { top: 4, right: 6, bottom: 2, left: 2 } },
            elements: {
                point: {
                    radius: veryCompact ? 0 : (compact ? 1.2 : 2),
                    hoverRadius: veryCompact ? 2 : (compact ? 3 : 4),
                    hitRadius: compact ? 8 : 10,
                }
            },
            plugins: {
                legend: {
                    position: compact ? 'bottom' : 'top',
                    labels: {
                        color: c.tickColor,
                        font: { family: 'Inter', size: legendFontSize },
                        boxWidth: veryCompact ? 8 : (compact ? 10 : 12),
                        padding: veryCompact ? 8 : (compact ? 10 : 14),
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(10,10,20,0.9)',
                    titleFont: { family: 'Inter' },
                    bodyFont: { family: 'Inter' },
                    borderColor: 'rgba(0,212,255,0.2)',
                    borderWidth: 1,
                },
                decimation: {
                    enabled: true,
                    algorithm: 'lttb',
                    samples: veryCompact ? 180 : (compact ? 260 : 360),
                    threshold: 300,
                },
                zoom: {
                    pan: {
                        enabled: true,
                        mode: 'x',
                        modifierKey: null,
                    },
                    zoom: {
                        mode: 'x',
                        wheel: {
                            enabled: true,
                        },
                        pinch: {
                            enabled: true,
                        },
                        drag: {
                            enabled: false,
                        },
                    },
                    limits: {
                        x: {
                            minRange: 4,
                        },
                    },
                },
            },
            scales: {
                x: {
                    grid: { color: c.gridColor },
                    ticks: {
                        color: c.tickColor,
                        font: { family: 'Inter', size: tickFontSize },
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: veryCompact ? 6 : (compact ? 8 : 12),
                    }
                },
                y: {
                    grid: { color: c.gridColor },
                    ticks: {
                        color: c.tickColor,
                        font: { family: 'Inter', size: tickFontSize },
                        autoSkip: true,
                        maxTicksLimit: veryCompact ? 5 : (compact ? 6 : 8),
                    },
                    beginAtZero: true
                },
            },
        };
    }

    function makeOrUpdate(id, type, data, options, updateMode = 'none') {
        if (typeof Chart === 'undefined') {
            if (!_chartUnavailableWarned) {
                _chartUnavailableWarned = true;
                showToast('Charts indisponíveis no browser (Chart.js).', 'warning');
            }
            return;
        }
        ensureChartZoomPlugin();
        const existing = chartInstances[id];
        if (existing && existing.config && existing.config.type === type) {
            existing.data = data;
            existing.options = options;
            existing.update(updateMode);
            return;
        }
        if (existing) {
            existing.destroy();
        }
        const canvas = document.getElementById(id);
        if (!canvas) return;
        chartInstances[id] = new Chart(canvas.getContext('2d'), { type, data, options });
    }

    function renderGauge(canvasId, valueId, subId, percent, subText, color, formatValue = null) {
        renderGauge._last = renderGauge._last || {};
        const parsed = Number(percent);
        const hasNumber = Number.isFinite(parsed);
        const value = hasNumber
            ? clamp(parsed, 0, 100)
            : (Number.isFinite(renderGauge._last[canvasId]) ? renderGauge._last[canvasId] : 0);
        renderGauge._last[canvasId] = value;
        const valEl = document.getElementById(valueId);
        const subEl = document.getElementById(subId);
        if (valEl) {
            if (typeof formatValue === 'function') {
                valEl.textContent = String(formatValue(value));
            } else {
                valEl.textContent = value.toFixed(1) + '%';
            }
        }
        if (subEl) subEl.textContent = subText;
        const c = getChartColors();
        makeOrUpdate(canvasId, 'doughnut', {
            datasets: [{
                data: [value, Math.max(0, 100 - value)],
                backgroundColor: [color, c.gridColor],
                borderWidth: 0,
                cutout: '78%',
            }]
        }, {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            animation: window.MaiatronMotion?.selectiveChartAnimation?.('initial') ?? false,
        }, 'none');
    }

    function historyByRange(data, range) {
        const rows = baseHistoryRowsForRange(data, range);
        return Array.isArray(rows) ? rows : [];
    }

    function downsampleRows(rows, maxPoints) {
        if (!Array.isArray(rows)) return [];
        if (rows.length <= maxPoints) return rows;
        const out = [];
        const lastIdx = rows.length - 1;
        const stride = lastIdx / (maxPoints - 1);
        for (let i = 0; i < maxPoints; i++) {
            const idx = Math.min(lastIdx, Math.round(i * stride));
            out.push(rows[idx]);
        }
        return out;
    }

    function chartHistoryRows(data) {
        if (!data || typeof data !== 'object') return [];
        const range = _selectedRange;
        const fromCache = _historyRowsCache.get(data);
        if (fromCache && Array.isArray(fromCache[range])) return fromCache[range];

        const rows = rangeHistory(data);
        let sliced = rows;
        if (range === '30d') sliced = downsampleRows(rows, 1600);
        else if (range === '7d') sliced = downsampleRows(rows, 1200);
        else if (range === '24h') sliced = downsampleRows(rows, 900);

        const nextCache = fromCache || {};
        nextCache[range] = sliced;
        _historyRowsCache.set(data, nextCache);
        return sliced;
    }

    function rangeHistory(data) {
        return historyByRange(data, _selectedRange);
    }

    function dbHistoryByRange(data, range) {
        const db = data.db || {};
        const h = db.history || {};
        return Array.isArray(h[range]) ? h[range] : [];
    }

    function rangeDbHistory(data) {
        return dbHistoryByRange(data, _selectedRange);
    }

    function bucketLabel(bucket) {
        const value = String(bucket || '');
        if (!value) return '';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return value.substring(0, 16).replace('T', ' ');
        if (_selectedRange === '7d') {
            return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
        }
        return d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    }

    function labelWindow() {
        return RANGE_LABEL[_selectedRange] || '24h';
    }

    function resolveDbEngineLabel(data) {
        const db = data?.db?.current || {};
        const raw = String(db.engine || db.flavor || db.vendor || '').trim();
        return raw || 'Base de Dados';
    }

    function applyDbLabels(data) {
        const label = resolveDbEngineLabel(data);
        setText('dbTabLabel', label);
        setText('dbLoadTitle', `${label} Threads (${labelWindow()})`);
        setText('dbRatesTitle', `${label} Throughput (${labelWindow()})`);
        setText('dbStorageTrendTitle', `Consumo e Crescimento ${label} (${labelWindow()})`);
        setText('diskGrowthTitle', `Crescimento de Espaço em Disco (${labelWindow()})`);
    }

    function numericMean(values) {
        const nums = (Array.isArray(values) ? values : [])
            .map((v) => Number(v))
            .filter((v) => Number.isFinite(v));
        if (!nums.length) return null;
        return nums.reduce((acc, value) => acc + value, 0) / nums.length;
    }

    function lastFinite(values) {
        if (!Array.isArray(values)) return null;
        for (let i = values.length - 1; i >= 0; i -= 1) {
            const parsed = Number(values[i]);
            if (Number.isFinite(parsed)) return parsed;
        }
        return null;
    }

    function formatWindowGrowthHint(current, average) {
        const currentPart = Number.isFinite(Number(current))
            ? `${Number(current).toFixed(3)} GB/h`
            : '—';
        const avgPart = Number.isFinite(Number(average))
            ? `${Number(average).toFixed(3)} GB/h`
            : '—';
        return `Atual: ${currentPart} · Média janela: ${avgPart}`;
    }

    function resolveSystemDiskSeries(rows, fallbackTotalGb = null) {
        const out = [];
        let prevTs = null;
        let prevUsed = null;
        const totalFallback = Number(fallbackTotalGb);

        (Array.isArray(rows) ? rows : []).forEach((row) => {
            const totalRaw = Number(row?.disk_total_gb_avg);
            const total = Number.isFinite(totalRaw)
                ? totalRaw
                : (Number.isFinite(totalFallback) ? totalFallback : null);
            const usedRaw = Number(row?.disk_used_gb_avg);
            const pct = Number(row?.disk_avg);
            let used = Number.isFinite(usedRaw)
                ? usedRaw
                : (Number.isFinite(total) && Number.isFinite(pct) ? (total * pct) / 100 : null);
            let free = Number(row?.disk_free_gb_avg);
            if (!Number.isFinite(free) && Number.isFinite(total) && Number.isFinite(used)) {
                free = Math.max(0, total - used);
            }
            let growth = Number(row?.disk_growth_gb_h_avg);
            const ts = Date.parse(row?.bucket || row?.timestamp || '');
            if (!Number.isFinite(growth) && Number.isFinite(used) && Number.isFinite(ts) && Number.isFinite(prevTs) && ts > prevTs) {
                const elapsedH = (ts - prevTs) / 3600000;
                if (elapsedH > 0) {
                    growth = (used - prevUsed) / elapsedH;
                }
            }
            if (!Number.isFinite(growth) && Number.isFinite(used)) {
                growth = 0;
            }

            if (Number.isFinite(ts) && Number.isFinite(used)) {
                prevTs = ts;
                prevUsed = used;
            }

            out.push({
                bucket: row?.bucket || row?.timestamp || null,
                total: Number.isFinite(total) ? total : null,
                used: Number.isFinite(used) ? used : null,
                free: Number.isFinite(free) ? free : null,
                growth: Number.isFinite(growth) ? growth : null,
            });
        });

        return out;
    }

    function applyRangeAxisOptions(defs, buckets) {
        const labels = Array.isArray(buckets) ? buckets.map((b) => String(b || '')) : [];
        if (!defs.scales) defs.scales = {};
        if (!defs.scales.x) defs.scales.x = {};
        if (!defs.scales.x.ticks) defs.scales.x.ticks = {};
        defs.scales.x.ticks.callback = (_value, index) => bucketLabel(labels[index] || '');
        if (!defs.plugins) defs.plugins = {};
        if (!defs.plugins.tooltip) defs.plugins.tooltip = {};
        const prevCallbacks = defs.plugins.tooltip.callbacks || {};
        defs.plugins.tooltip.callbacks = {
            ...prevCallbacks,
            title: (items) => {
                const idx = items && items[0] ? items[0].dataIndex : -1;
                if (idx < 0 || !labels[idx]) return '';
                return formatDateTime(labels[idx]);
            },
        };
        return labels;
    }

    function csvEscape(value) {
        if (value == null) return '';
        const str = String(value);
        if (!/[",\n\r]/.test(str)) return str;
        return `"${str.replace(/"/g, '""')}"`;
    }

    function csvResolveRange() {
        return _selectedRange;
    }

    function buildCsvRows(data, range) {
        const sysRows = historyByRange(data, range);
        const dbRows = dbHistoryByRange(data, range);
        const byBucket = new Map();
        for (const row of Array.isArray(sysRows) ? sysRows : []) {
            const bucket = String(row?.bucket || '');
            if (!bucket) continue;
            byBucket.set(bucket, { bucket, ...row });
        }
        for (const row of Array.isArray(dbRows) ? dbRows : []) {
            const bucket = String(row?.bucket || '');
            if (!bucket) continue;
            const prev = byBucket.get(bucket) || { bucket };
            byBucket.set(bucket, { ...prev, ...row });
        }
        return Array.from(byBucket.values()).sort((a, b) => String(a.bucket).localeCompare(String(b.bucket)));
    }

    function exportCsv(data) {
        const range = csvResolveRange();
        const rows = buildCsvRows(data, range);
        if (!rows.length) {
            showToast(`Sem dados para exportar (${range})`, 'warning');
            return;
        }
        const columns = [
            'bucket',
            'cpu_avg',
            'mem_avg',
            'disk_avg',
            'disk_total_gb_avg',
            'disk_used_gb_avg',
            'disk_free_gb_avg',
            'disk_growth_gb_h_avg',
            'net_up_avg',
            'net_down_avg',
            'qps_avg',
            'tps_avg',
            'storage_total_gb_avg',
            'storage_growth_gb_h_avg',
            'threads_running_avg',
            'threads_running_max',
            'threads_connected_avg',
        ];
        const csv = [
            columns.join(','),
            ...rows.map((row) => columns.map((c) => csvEscape(row[c])).join(',')),
        ].join('\n');

        const stamp = new Date().toISOString().replace(/[:]/g, '-').replace(/\..+/, '');
        const filename = `warden_dados_${range}_${stamp}.csv`;
        const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showToast(`CSV exportado (${range})`, 'success');
    }

    function parseTimestampMs(value) {
        const t = Date.parse(value);
        return Number.isFinite(t) ? t : null;
    }

    function toFiniteNumber(value) {
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function formatDbGrowthHint(growthGbH, writeGbH) {
        const growth = Number(growthGbH);
        const write = Number(writeGbH);
        const growthPart = Number.isFinite(growth)
            ? `Crescimento/h: ${growth.toFixed(3)} GB/h`
            : 'Crescimento/h: —';
        const writePart = Number.isFinite(write)
            ? `Escrita/h: ${write.toFixed(3)} GB/h`
            : 'Escrita/h: —';
        return `${growthPart} · ${writePart}`;
    }

    function resolveDbGrowthFromHistory(data, range = '1h') {
        const rows = dbHistoryByRange(data, range);
        if (!Array.isArray(rows) || rows.length < 2) return null;
        let first = null;
        let last = null;
        for (let i = 0; i < rows.length; i += 1) {
            const row = rows[i];
            const ts = Date.parse(row?.bucket || row?.timestamp || '');
            if (!Number.isFinite(ts)) continue;
            const bytes = Number(row?.storage_total_bytes_avg);
            const gb = Number(row?.storage_total_gb_avg);
            const totalGb = Number.isFinite(bytes)
                ? (bytes / (1024 ** 3))
                : (Number.isFinite(gb) ? gb : null);
            if (!Number.isFinite(totalGb)) continue;
            if (!first) {
                first = { ts, totalGb };
            }
            last = { ts, totalGb };
        }
        if (!first || !last || last.ts <= first.ts) return null;
        const elapsedH = (last.ts - first.ts) / 3600000;
        if (elapsedH <= 0) return null;
        return (last.totalGb - first.totalGb) / elapsedH;
    }

    function resolveDbGrowthForHint(data, fallbackGrowthGbH) {
        const trend1h = resolveDbGrowthFromHistory(data, '1h');
        if (Number.isFinite(trend1h)) return trend1h;
        const trendSelected = resolveDbGrowthFromHistory(data, _selectedRange);
        if (Number.isFinite(trendSelected)) return trendSelected;
        const fallback = Number(fallbackGrowthGbH);
        return Number.isFinite(fallback) ? fallback : null;
    }

    function liveMetricDefaultClamp(key, value) {
        if (key === 'cpu' || key === 'ram' || key === 'disk') {
            return clamp(value, 0, 100);
        }
        if (key === 'dbGrowth') {
            return value;
        }
        return Math.max(0, value);
    }

    function liveMetricCurrentValue(state, fallback = 0) {
        if (!state) return fallback;
        if (toFiniteNumber(state.displayValue) !== null) return state.displayValue;
        if (toFiniteNumber(state.lastGood) !== null) return state.lastGood;
        const parsedFallback = toFiniteNumber(fallback);
        return parsedFallback !== null ? parsedFallback : 0;
    }

    function liveIngestMetric(key, rawValue, sampleAtMs, source) {
        const state = _liveMirror[key];
        if (!state) return;
        const parsed = toFiniteNumber(rawValue);
        if (parsed === null) {
            if (toFiniteNumber(state.displayValue) === null && toFiniteNumber(state.lastGood) !== null) {
                state.displayValue = state.lastGood;
            }
            return;
        }
        const normalized = liveMetricDefaultClamp(key, parsed);
        state.lastGood = normalized;
        state.displayValue = normalized;
        if (sampleAtMs && sampleAtMs > 0) {
            state.lastSampleAtMs = sampleAtMs;
        }
        state.lastUpdateSource = source || null;
    }

    function liveInitializeFromPayload(payload, source = 'bootstrap') {
        const sampleAtMs = parseTimestampMs(payload?.current?.timestamp || payload?.generated_at || null);
        if (sampleAtMs !== null) {
            _lastReceivedSampleAtMs = sampleAtMs;
            _lastSampleAtMs = sampleAtMs;
        } else {
            _lastReceivedSampleAtMs = 0;
            _lastSampleAtMs = 0;
        }

        const current = payload?.current || {};
        const db = payload?.db?.current || {};
        liveIngestMetric('cpu', current.cpu?.total_percent, sampleAtMs || 0, source);
        liveIngestMetric('ram', current.memory?.percent, sampleAtMs || 0, source);
        liveIngestMetric('disk', current.disk?.percent, sampleAtMs || 0, source);
        liveIngestMetric('netUp', current.network?.upload_mbps, sampleAtMs || 0, source);
        liveIngestMetric('netDown', current.network?.download_mbps, sampleAtMs || 0, source);
        liveIngestMetric('dbQps', db.qps, sampleAtMs || 0, source);
        liveIngestMetric('dbTps', db.tps, sampleAtMs || 0, source);
        liveIngestMetric('dbStorage', db.storage_total_gb, sampleAtMs || 0, source);
        liveIngestMetric('dbGrowth', db.storage_growth_gb_h, sampleAtMs || 0, source);
        liveIngestMetric('dbWrite', db.storage_write_gb_h, sampleAtMs || 0, source);
    }

    function liveIngestFromPayload(payload, options = {}) {
        const source = options?.source || 'fast';
        const sampleAtOverride = options?.sampleAt || null;
        const current = payload?.current || {};
        const db = payload?.db?.current || {};
        const sampleAtMs = parseTimestampMs(sampleAtOverride || current.timestamp || payload?.generated_at || null);
        if (sampleAtMs !== null) {
            if (sampleAtMs > _lastReceivedSampleAtMs) {
                _lastReceivedSampleAtMs = sampleAtMs;
            }
            if (sampleAtMs > _lastSampleAtMs) {
                _lastSampleAtMs = sampleAtMs;
            }
        }

        liveIngestMetric('cpu', current.cpu?.total_percent, sampleAtMs || 0, source);
        liveIngestMetric('ram', current.memory?.percent, sampleAtMs || 0, source);
        liveIngestMetric('disk', current.disk?.percent, sampleAtMs || 0, source);
        liveIngestMetric('netUp', current.network?.upload_mbps, sampleAtMs || 0, source);
        liveIngestMetric('netDown', current.network?.download_mbps, sampleAtMs || 0, source);
        liveIngestMetric('dbQps', db.qps, sampleAtMs || 0, source);
        liveIngestMetric('dbTps', db.tps, sampleAtMs || 0, source);
        liveIngestMetric('dbStorage', db.storage_total_gb, sampleAtMs || 0, source);
        liveIngestMetric('dbGrowth', db.storage_growth_gb_h, sampleAtMs || 0, source);
        liveIngestMetric('dbWrite', db.storage_write_gb_h, sampleAtMs || 0, source);
    }

    function isOutOfOrderSample(sampleAtMs) {
        if (!Number.isFinite(sampleAtMs) || sampleAtMs <= 0) return false;
        if (!Number.isFinite(_lastReceivedSampleAtMs) || _lastReceivedSampleAtMs <= 0) return false;
        return sampleAtMs + 500 < _lastReceivedSampleAtMs;
    }

    function liveMetricDisplay(key, fallback = 0) {
        const state = _liveMirror[key];
        return liveMetricCurrentValue(state, fallback);
    }

    function updateLiveSampleTimestamp(payload) {
        const parsed = parseTimestampMs(payload?.current?.timestamp || payload?.generated_at || null);
        if (parsed !== null) {
            _lastSampleAtMs = Math.max(_lastSampleAtMs, parsed);
            _lastReceivedSampleAtMs = Math.max(_lastReceivedSampleAtMs, parsed);
        } else if (_lastSampleAtMs === 0) {
            _lastSampleAtMs = Date.now();
        }
    }

    function renderLiveMirrorFrame(payload = _lastPayload) {
        if (!payload || typeof payload !== 'object') return;
        const current = payload.current || {};
        const db = payload.db?.current || {};
        const c = getChartColors();
        const pkt = computePacketWindowTotals(payload);

        renderGauge(
            'gaugeCpu',
            'gaugeCpuVal',
            'gaugeCpuSub',
            liveMetricDisplay('cpu', current.cpu?.total_percent),
            (current.cpu?.cores || '—') + ' cores',
            c.cpu,
            (value) => `${value.toFixed(1)}%`
        );
        renderGauge(
            'gaugeRam',
            'gaugeRamVal',
            'gaugeRamSub',
            liveMetricDisplay('ram', current.memory?.percent),
            `${current.memory?.used_gb ?? '—'} / ${current.memory?.total_gb ?? '—'} GB`,
            c.mem,
            (value) => `${value.toFixed(2)}%`
        );
        renderGauge(
            'gaugeDisk',
            'gaugeDiskVal',
            'gaugeDiskSub',
            liveMetricDisplay('disk', current.disk?.percent),
            `${current.disk?.used_gb ?? '—'} / ${current.disk?.total_gb ?? '—'} GB`,
            c.disk,
            (value) => `${value.toFixed(1)}%`
        );

        setText('netUp', liveMetricDisplay('netUp', current.network?.upload_mbps).toFixed(2));
        setText('netDown', liveMetricDisplay('netDown', current.network?.download_mbps).toFixed(2));
        setText('gaugeNetSub', `Pacotes (${labelWindow()}): ${(Number(pkt.sent) + Number(pkt.recv)).toLocaleString()}`);
        setText('dbThreadsRunning', String(db.threads_running ?? 0));
        setText('dbQps', liveMetricDisplay('dbQps', db.qps).toFixed(3));
        setText('dbTps', liveMetricDisplay('dbTps', db.tps).toFixed(3));
        setText('dbStorageTotal', liveMetricDisplay('dbStorage', db.storage_total_gb).toFixed(3));
        setText('dbQpsInfo', liveMetricDisplay('dbQps', db.qps).toFixed(3));
        setText('dbTpsInfo', liveMetricDisplay('dbTps', db.tps).toFixed(3));
        setText('dbStorageTotalInfo', liveMetricDisplay('dbStorage', db.storage_total_gb).toFixed(3) + ' GB');
        setText(
            'dbStorageGrowthHint',
            formatDbGrowthHint(
                resolveDbGrowthForHint(payload, liveMetricDisplay('dbGrowth', db.storage_growth_gb_h)),
                liveMetricDisplay('dbWrite', db.storage_write_gb_h)
            )
        );
        setText('cpuLiveBadge', liveMetricDisplay('cpu', current.cpu?.total_percent).toFixed(1) + '%');
        setText('memLiveBadge', liveMetricDisplay('ram', current.memory?.percent).toFixed(2) + '%');
    }

    function updateStatusTicker(data = _lastPayload) {
        const now = Date.now();
        const displayTs = new Date(now).toLocaleTimeString('pt-PT');
        const sampleTs = _lastSampleAtMs || parseTimestampMs(data?.current?.timestamp || data?.generated_at || null) || now;
        const ageSec = Math.max(0, Math.round((now - sampleTs) / 1000));

        if (el.lastUpdated) {
            el.lastUpdated.textContent = `Atualizado: ${displayTs}`;
            el.lastUpdated.title = `Última amostra há ${ageSec}s`;
        }

        const stale = ageSec * 1000 > LIVE_STALE_MS;
        if (el.statusText) {
            el.statusText.textContent = stale ? 'Degradado' : 'Online';
        }
        const dot = document.querySelector('.status-dot');
        if (dot) {
            dot.classList.toggle('offline', stale);
            dot.classList.toggle('online', !stale);
        }
    }

    function nextSecondAlignedDelayMs() {
        const now = Date.now();
        const remainder = now % 1000;
        let delay = 1000 - remainder;
        if (delay < 40) delay += 1000;
        return delay;
    }

    function scheduleStatusTick(delayMs = null) {
        if (document.hidden || el.mainApp.classList.contains('hidden')) return;
        if (_statusTickTimer) clearTimeout(_statusTickTimer);
        const parsedDelay = Number(delayMs);
        const wait = Number.isFinite(parsedDelay) && parsedDelay >= 0
            ? parsedDelay
            : nextSecondAlignedDelayMs();
        _statusTickTimer = setTimeout(() => {
            _statusTickTimer = null;
            if (_lastPayload) updateStatusTicker();
            scheduleStatusTick(null);
        }, Math.max(40, wait));
    }

    function startStatusTicker() {
        if (_statusTickTimer) return;
        if (_lastPayload) updateStatusTicker();
        scheduleStatusTick(null);
    }

    function stopStatusTicker() {
        if (_statusTickTimer) {
            clearTimeout(_statusTickTimer);
            _statusTickTimer = null;
        }
    }

    function currentRangeSeconds() {
        return RANGE_SECONDS[_selectedRange] || 86400;
    }

    function packetCountersFromRecord(record) {
        if (!record || typeof record !== 'object') return null;
        const sent = record.packets_sent ?? record.network?.packets_sent;
        const recv = record.packets_recv ?? record.network?.packets_recv;
        if (sent == null && recv == null) return null;
        return {
            sent: Number(sent) || 0,
            recv: Number(recv) || 0,
        };
    }

    function computePacketWindowTotals(data) {
        const targetSeconds = currentRangeSeconds();
        const hist = rangeHistory(data);
        const histWithPackets = hist
            .map((row) => ({ row, pkt: packetCountersFromRecord(row) }))
            .filter((x) => x.pkt);

        if (histWithPackets.length >= 2) {
            const first = histWithPackets[0].pkt;
            const last = histWithPackets[histWithPackets.length - 1].pkt;
            return {
                sent: Math.max(0, Math.round(last.sent - first.sent)),
                recv: Math.max(0, Math.round(last.recv - first.recv)),
                mode: 'exact-history',
                coverageSeconds: targetSeconds,
                targetSeconds,
            };
        }

        const realtime = Array.isArray(data.realtime) ? data.realtime : [];
        const rtWithPackets = realtime
            .map((row) => ({
                row,
                ts: parseTimestampMs(row && row.timestamp),
                pkt: packetCountersFromRecord(row),
            }))
            .filter((x) => x.pkt && x.ts != null)
            .sort((a, b) => a.ts - b.ts);

        if (rtWithPackets.length >= 2) {
            const end = rtWithPackets[rtWithPackets.length - 1];
            const windowStartMs = end.ts - (targetSeconds * 1000);
            const inRange = rtWithPackets.filter((x) => x.ts >= windowStartMs);
            const series = inRange.length >= 2 ? inRange : rtWithPackets;
            const first = series[0];
            const last = series[series.length - 1];
            const coverageSeconds = Math.max(1, (last.ts - first.ts) / 1000);
            const rawSent = Math.max(0, last.pkt.sent - first.pkt.sent);
            const rawRecv = Math.max(0, last.pkt.recv - first.pkt.recv);

            if (coverageSeconds >= (targetSeconds * 0.9)) {
                return {
                    sent: Math.round(rawSent),
                    recv: Math.round(rawRecv),
                    mode: 'exact-realtime',
                    coverageSeconds,
                    targetSeconds,
                };
            }

            const scale = targetSeconds / coverageSeconds;
            return {
                sent: Math.max(0, Math.round(rawSent * scale)),
                recv: Math.max(0, Math.round(rawRecv * scale)),
                mode: 'estimated-realtime',
                coverageSeconds,
                targetSeconds,
            };
        }

        const current = packetCountersFromRecord(data.current?.network || {});
        return {
            sent: current ? current.sent : 0,
            recv: current ? current.recv : 0,
            mode: 'cumulative-current',
            coverageSeconds: 0,
            targetSeconds,
        };
    }

    function applyMonitoringTooltips(data) {
        const genericHints = {
            'upload': 'Taxa instantânea de upload (tráfego enviado) em Mbps.',
            'download': 'Taxa instantânea de download (tráfego recebido) em Mbps.',
            'pacotes env.': 'Total de pacotes enviados na janela selecionada (ou estimativa baseada na taxa recente quando o histórico não inclui contadores).',
            'pacotes rec.': 'Total de pacotes recebidos na janela selecionada (ou estimativa baseada na taxa recente quando o histórico não inclui contadores).',
            'total': 'Valor total monitorizado para a métrica nesta secção.',
            'usada': 'Valor atualmente utilizado.',
            'usado': 'Valor atualmente utilizado.',
            'livre': 'Valor atualmente livre/disponível.',
            'swap': 'Utilização de swap do sistema.',
            'ocupação': 'Percentagem de ocupação atual.',
            'threads running': 'Queries da base de dados em execução neste instante.',
            'threads connected': 'Ligações abertas ao servidor de base de dados.',
            'qps': 'Queries por segundo.',
            'tps': 'Transações por segundo.',
            'db consumo (gb)': 'Consumo total da instância MariaDB em disco (GB).',
            'consumo db': 'Consumo total da instância MariaDB em disco (GB).',
            'uptime db': 'Tempo de serviço da base de dados sem reinício.',
        };

        document.querySelectorAll('.system-chip').forEach((card) => {
            const label = card.querySelector('.system-chip-label')?.textContent?.trim() || 'Sistema';
            const value = card.querySelector('.system-chip-value')?.textContent?.trim() || '';
            card.title = `${label}: ${value || 'informação de sistema monitorizada.'}`;
        });

        document.querySelectorAll('.gauge-card').forEach((card) => {
            const label = card.querySelector('.gauge-header span')?.textContent?.trim() || 'Métrica';
            const sub = card.querySelector('.gauge-sub')?.textContent?.trim() || '';
            card.title = `${label}: indicador em tempo real. ${sub}`.trim();
        });

        document.querySelectorAll('.db-mini-card').forEach((card) => {
            const label = card.querySelector('.db-mini-label')?.textContent?.trim() || 'Métrica DB';
            card.title = `${label}: valor resumido de monitorização da base de dados.`;
        });

        document.querySelectorAll('.info-card').forEach((card) => {
            const label = (card.querySelector('.info-label')?.textContent || '').trim();
            const hint = (card.querySelector('.info-hint')?.textContent || '').trim();
            if (hint) {
                card.title = hint;
                return;
            }
            const normalized = label.toLowerCase();
            const generic = genericHints[normalized] || `Métrica monitorizada: ${label || 'valor atual'}.`;
            card.title = generic;
        });

        document.querySelectorAll('.chart-card').forEach((card) => {
            const title = card.querySelector('.chart-header h3')?.textContent?.trim() || 'Gráfico';
            card.title = `${title}: gráfico da métrica monitorizada para a janela ${labelWindow()} (ou tempo real, quando indicado).`;
        });

        if (el.alertsSummaryBadge) {
            el.alertsSummaryBadge.title = 'Resumo de alertas ativos. Clique para abrir a tab Alertas.';
        }

        if (data && document.getElementById('netPktSent')) {
            const packetInfo = computePacketWindowTotals(data);
            const modeLabel = packetInfo.mode === 'estimated-realtime'
                ? 'Estimativa baseada na taxa média do período recente (payload histórico sem contadores de pacotes).'
                : packetInfo.mode === 'cumulative-current'
                    ? 'Valor acumulado atual (sem histórico de pacotes disponível para calcular a janela).'
                    : 'Valor calculado para a janela selecionada.';
            const sentCard = document.getElementById('netPktSent')?.closest('.info-card');
            const recvCard = document.getElementById('netPktRecv')?.closest('.info-card');
            if (sentCard) sentCard.title = `Pacotes enviados na janela ${labelWindow()}. ${modeLabel}`;
            if (recvCard) recvCard.title = `Pacotes recebidos na janela ${labelWindow()}. ${modeLabel}`;
        }
    }

    function setText(id, text) {
        const node = document.getElementById(id);
        if (node) node.textContent = text;
    }

    function dbUptime(seconds) {
        const s = Number(seconds) || 0;
        const d = Math.floor(s / 86400);
        const h = Math.floor((s % 86400) / 3600);
        const m = Math.floor((s % 3600) / 60);
        if (d > 0) return `${d}d ${h}h`;
        return `${h}h ${m}m`;
    }

    function formatDuration(seconds) {
        const s = Number(seconds) || 0;
        const d = Math.floor(s / 86400);
        const h = Math.floor((s % 86400) / 3600);
        const m = Math.floor((s % 3600) / 60);
        if (d > 0) return `${d}d ${h}h`;
        return `${h}h ${m}m`;
    }

    function formatDateTime(value) {
        if (!value) return '—';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return String(value);
        return d.toLocaleString('pt-PT');
    }

    function formatBytes(value) {
        const bytes = Number(value) || 0;
        if (bytes <= 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const exp = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
        const num = bytes / Math.pow(1024, exp);
        return `${num.toFixed(num >= 100 || exp === 0 ? 0 : num >= 10 ? 1 : 2)} ${units[exp]}`;
    }

    function formatGbPerHourSigned(value) {
        const n = Number(value);
        if (!Number.isFinite(n)) return '—';
        const sign = n > 0 ? '+' : '';
        return `${sign}${n.toFixed(3)} GB/h`;
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatProcessValue(kind, row) {
        if (kind === 'cpu') return `${(Number(row.cpu_percent) || 0).toFixed(1)}%`;
        if (kind === 'memory') return formatBytes(row.rss_bytes);
        const conns = Number(row.connections) || 0;
        const est = Number(row.established) || 0;
        return `${conns} lig. · ${est} est.`;
    }

    function renderProcessTopColumn(kind, title, items) {
        const rows = Array.isArray(items) ? items : [];
        const emptyText = kind === 'network'
            ? 'Sem atividade de rede (ligações) detetada.'
            : 'Sem dados suficientes.';
        return `
            <section class="proc-top-col proc-top-col-${kind}">
                <div class="proc-top-col-header">
                    <h4>${escapeHtml(title)}</h4>
                </div>
                <div class="proc-top-list">
                    ${rows.length ? rows.map((row, idx) => `
                        <div class="proc-top-item" title="${escapeHtml(`${row.name || 'processo'} (PID ${row.pid ?? '—'})`)}">
                            <div class="proc-top-rank">${idx + 1}</div>
                            <div class="proc-top-main">
                                <div class="proc-top-name">${escapeHtml(row.name || 'processo')}</div>
                                <div class="proc-top-meta">PID ${escapeHtml(row.pid ?? '—')}</div>
                            </div>
                            <div class="proc-top-value">${escapeHtml(formatProcessValue(kind, row))}</div>
                        </div>
                    `).join('') : `<div class="proc-top-empty">${escapeHtml(emptyText)}</div>`}
                </div>
            </section>
        `;
    }

    function renderProcessTopListOnly(kind, items) {
        const rows = Array.isArray(items) ? items : [];
        const emptyText = kind === 'network'
            ? 'Sem atividade de rede (ligações) detetada.'
            : 'Sem dados suficientes.';
        if (!rows.length) return `<div class="proc-top-empty">${escapeHtml(emptyText)}</div>`;
        return `
            <div class="proc-top-list">
                ${rows.map((row, idx) => `
                    <div class="proc-top-item" title="${escapeHtml(`${row.name || 'processo'} (PID ${row.pid ?? '—'})`)}">
                        <div class="proc-top-rank">${idx + 1}</div>
                        <div class="proc-top-main">
                            <div class="proc-top-name">${escapeHtml(row.name || 'processo')}</div>
                            <div class="proc-top-meta">PID ${escapeHtml(row.pid ?? '—')}</div>
                        </div>
                        <div class="proc-top-value">${escapeHtml(formatProcessValue(kind, row))}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function renderProcessPanel({ listEl, stateEl, updatedEl, kind, items, proc }) {
        if (!listEl) return;
        if (updatedEl) {
            updatedEl.textContent = proc?.generated_at
                ? `Atualizado: ${formatDateTime(proc.generated_at)}`
                : 'Atualizado: —';
        }
        if (stateEl) {
            const parts = [];
            if (kind === 'network' && proc?.network_metric_label) parts.push(`Rede: ${proc.network_metric_label}`);
            if (kind === 'network' && proc?.warning) parts.push(String(proc.warning));
            stateEl.textContent = parts.join(' • ');
            stateEl.classList.toggle('show', parts.length > 0);
            stateEl.classList.toggle('warning', Boolean(proc?.warning));
        }
        listEl.innerHTML = renderProcessTopListOnly(kind, items);
    }

    function renderDbStorageTopList(kind, items) {
        const rows = Array.isArray(items) ? items : [];
        if (!rows.length) return '<div class="proc-top-empty">Sem dados de consumo.</div>';
        return rows.slice(0, 12).map((row, idx) => {
            const schema = String(row?.schema || '').trim() || '—';
            const table = String(row?.table || '').trim();
            const title = kind === 'table' ? `${schema}.${table || '—'}` : schema;
            const totalBytes = Number(row?.total_bytes);
            const totalGb = Number(row?.total_gb);
            const growthGbH = Number(row?.growth_gb_h);
            const sizeLabel = Number.isFinite(totalBytes)
                ? formatBytes(totalBytes)
                : (Number.isFinite(totalGb) ? `${totalGb.toFixed(3)} GB` : '—');
            return `
                <div class="proc-top-item" title="${escapeHtml(title)}">
                    <div class="proc-top-rank">${idx + 1}</div>
                    <div class="proc-top-main">
                        <div class="proc-top-name">${escapeHtml(title)}</div>
                        <div class="proc-top-meta">Tamanho: ${escapeHtml(sizeLabel)}</div>
                    </div>
                    <div class="proc-top-value">${escapeHtml(formatGbPerHourSigned(growthGbH))}</div>
                </div>
            `;
        }).join('');
    }

    function renderDbStorageConsumers(data) {
        const db = data?.db?.current || {};
        const topSchemas = Array.isArray(db.top_schemas) ? db.top_schemas : [];
        const topTables = Array.isArray(db.top_tables) ? db.top_tables : [];
        if (el.dbTopSchemasList) {
            el.dbTopSchemasList.innerHTML = renderDbStorageTopList('schema', topSchemas);
        }
        if (el.dbTopTablesList) {
            el.dbTopTablesList.innerHTML = renderDbStorageTopList('table', topTables);
        }
        if (el.dbStorageTopUpdated) {
            const stamp = db.sampled_at || data?.generated_at || data?.current?.timestamp || null;
            el.dbStorageTopUpdated.textContent = stamp ? `Atualizado: ${formatDateTime(stamp)}` : 'Atualizado: —';
        }
        if (el.dbStorageTopState) {
            const hasAny = topSchemas.length > 0 || topTables.length > 0;
            const label = hasAny
                ? `Schemas: ${topSchemas.length} · Tabelas: ${topTables.length} · Crescimento/h por objeto`
                : 'Sem ranking DB no snapshot atual.';
            el.dbStorageTopState.textContent = label;
            el.dbStorageTopState.classList.toggle('show', true);
            el.dbStorageTopState.classList.toggle('warning', !hasAny);
        }
    }

    function renderDiskTopConsumers(data) {
        if (!el.diskTopList) return;
        const top = data.current?.disk?.top_consumers || null;
        const files = Array.isArray(top?.files) ? top.files : (Array.isArray(top?.items) ? top.items : []);
        const rawFolders = Array.isArray(top?.folders) ? top.folders : [];
        let foldersFallbackUsed = false;
        const folders = rawFolders.length ? rawFolders : (() => {
            if (!files.length) return [];
            const byDir = new Map();
            for (const row of files) {
                const dir = String(row?.dir || '/');
                const prev = byDir.get(dir) || 0;
                byDir.set(dir, prev + (Number(row?.size_bytes) || 0));
            }
            const derived = Array.from(byDir.entries())
                .map(([path, sizeBytes]) => ({
                    path,
                    dir: path === '/' ? '/' : (path.split('/').slice(0, -1).join('/') || '/'),
                    size_bytes: sizeBytes,
                }))
                .sort((a, b) => (Number(b.size_bytes) || 0) - (Number(a.size_bytes) || 0))
                .slice(0, Number(top?.max_items) || 10);
            foldersFallbackUsed = derived.length > 0;
            return derived;
        })();

        if (el.diskTopScope) {
            const root = top?.root_path || '/';
            const scopeLabel = top?.visibility_scope === 'system' ? 'Visibilidade: sistema' : 'Visibilidade: utilizador';
            el.diskTopScope.textContent = `${scopeLabel} · scan em ${root}`;
            el.diskTopScope.classList.toggle('warning', !!top?.truncated || top?.visibility_scope === 'user_limited');
            el.diskTopScope.title = top?.visibility_scope === 'user_limited'
                ? 'A lista reflete apenas ficheiros legíveis pelo utilizador do serviço Warden.'
                : '';
        }
        if (el.diskTopUpdated) {
            el.diskTopUpdated.textContent = top?.generated_at ? `Atualizado: ${formatDateTime(top.generated_at)}` : 'Atualizado: —';
        }
        if (el.diskTopState) {
            const parts = [];
            if (top?.disabled) parts.push('Scan desativado');
            if (top?.truncated) {
                const seconds = Math.max(1, Math.round((Number(top?.duration_ms) || 0) / 1000));
                parts.push(`Cobertura: parcial por timeout (${seconds}s)`);
            } else if (top?.duration_ms != null) {
                parts.push('Cobertura: completa');
            }
            if (top?.source === 'sudo_helper') parts.push('Helper root');
            if (foldersFallbackUsed) parts.push('Folders estimados a partir dos top ficheiros');
            if (top?.duration_ms != null) parts.push(`Duração: ${top.duration_ms} ms`);
            if (top?.warning) parts.push(top.warning);
            if (top?.error) parts.push(`Erro: ${top.error}`);
            el.diskTopState.textContent = parts.join(' • ');
            el.diskTopState.classList.toggle('show', Boolean(parts.length));
            el.diskTopState.classList.toggle('warning', !!top?.truncated);
            el.diskTopState.classList.toggle('error', !!top?.error);
        }

        if (!files.length && !folders.length) {
            el.diskTopList.innerHTML = '<div class="disk-top-empty">Sem dados de top consumidores de disco.</div>';
            return;
        }

        const renderDiskRows = (rows, kind) => rows.map((row) => {
            const path = String(row.path || '—');
            const dir = String(row.dir || '—');
            const size = formatBytes(row.size_bytes);
            return `
                <div class="disk-top-row" role="row" title="${escapeHtml(path)}">
                    <div role="cell" class="disk-top-path">${escapeHtml(path)}</div>
                    <div role="cell" class="disk-top-dir" title="${escapeHtml(dir)}">${escapeHtml(dir)}</div>
                    <div role="cell" class="disk-top-size is-right">${escapeHtml(size)}</div>
                </div>
            `;
        }).join('') || `<div class="disk-top-empty compact">Sem dados de ${kind}.</div>`;

        el.diskTopList.innerHTML = `
            <div class="disk-top-sections">
                <section class="disk-top-section">
                    <div class="disk-top-section-title">Top ficheiros que mais gastam</div>
                    <div class="disk-top-table" role="table" aria-label="Top ficheiros por tamanho em disco">
                        <div class="disk-top-row disk-top-head" role="row">
                            <div role="columnheader">Ficheiro</div>
                            <div role="columnheader">Diretório</div>
                            <div role="columnheader" class="is-right">Tamanho</div>
                        </div>
                        ${renderDiskRows(files, 'ficheiros')}
                    </div>
                </section>
                <section class="disk-top-section">
                    <div class="disk-top-section-title">Top folders que mais gastam</div>
                    <div class="disk-top-table" role="table" aria-label="Top folders por tamanho em disco">
                        <div class="disk-top-row disk-top-head" role="row">
                            <div role="columnheader">Folder</div>
                            <div role="columnheader">Pai</div>
                            <div role="columnheader" class="is-right">Tamanho</div>
                        </div>
                        ${renderDiskRows(folders, 'folders')}
                    </div>
                </section>
            </div>
        `;
    }

    function describeAlert(key) {
        const hints = {
            cpu_high: 'CPU acima do limite. Processos concorrentes podem degradar o servidor e atrasar o collector.',
            ram_high: 'RAM alta. Pode provocar swap e lentidão geral; verificar processos que estão a consumir memória.',
            disk_high: 'Disco perto do limite. Risco de falhas em escrita de logs/export e problemas no sistema.',
            db_threads_running_high: 'Demasiadas queries em execução na base de dados. Pode indicar contenção de recursos ou queries lentas.',
            db_storage_usage_high: 'Consumo de storage da base de dados acima do limite configurado. Rever crescimento e retenção.',
        };
        return hints[key] || 'Alerta de monitorização ativo.';
    }

    function renderDbHealth(alerts) {
        const firing = alerts.filter(a => a.status === 'firing');
        const critical = firing.filter(a => a.severity === 'critical');
        const warning = firing.filter(a => a.severity === 'warning');
        if (!el.dbHealthPill || !el.dbHealthNote) return;
        el.dbHealthPill.classList.remove('ok', 'warn', 'critical');
        if (critical.length) {
            el.dbHealthPill.classList.add('critical');
            el.dbHealthPill.textContent = 'Crítico';
            el.dbHealthNote.textContent = `${critical.length} alerta(s) crítico(s) ativo(s). Intervenção recomendada já.`;
            return;
        }
        if (warning.length) {
            el.dbHealthPill.classList.add('warn');
            el.dbHealthPill.textContent = 'Atenção';
            el.dbHealthNote.textContent = `${warning.length} alerta(s) de aviso ativo(s). Acompanhar tendência.`;
            return;
        }
        el.dbHealthPill.classList.add('ok');
        el.dbHealthPill.textContent = 'Saudável';
        el.dbHealthNote.textContent = 'Sem alertas de risco no momento.';
    }

    function renderAlertDetail(alert, history) {
        if (!el.alertDetailPanel) return;
        if (!alert) {
            el.alertDetailPanel.innerHTML = '<div class=\"alert-empty\">Selecione um alerta para ver o detalhe.</div>';
            return;
        }
        const sevClass = alert.status === 'firing' ? alert.severity : 'resolved';
        const recent = history.filter(item => item.key === alert.key).slice(0, 5);
        const recentHtml = recent.length
            ? recent.map(item => `<div class=\"alert-meta\">${formatDateTime(item.sent_at)} | ${item.notification || item.status} | valor=${item.value ?? '—'}</div>`).join('')
            : '<div class=\"alert-meta\">Sem histórico recente para este alerta.</div>';
        el.alertDetailPanel.innerHTML = `
            <div class=\"alert-detail-title\">${alert.title}</div>
            <span class=\"alert-detail-severity ${sevClass}\">${alert.status} · ${alert.severity}</span>
            <div class=\"alert-detail-grid\">
                <div class=\"alert-detail-field\"><strong>Valor:</strong> ${alert.value}</div>
                <div class=\"alert-detail-field\"><strong>Limite:</strong> ${alert.threshold}</div>
                <div class=\"alert-detail-field\"><strong>Última avaliação:</strong> ${formatDateTime(alert.evaluated_at)}</div>
                <div class=\"alert-detail-field\"><strong>Chave:</strong> ${alert.key}</div>
            </div>
            <div class=\"alert-detail-help\">${describeAlert(alert.key)}</div>
            <div class=\"alert-detail-help\"><strong>Últimos eventos deste alerta:</strong></div>
            ${recentHtml}
        `;
    }

    function renderAlertHistory(history, selectedKey) {
        if (!el.alertHistoryList) return;
        const allSeverityRows = history.filter(item => item.severity === 'warning' || item.severity === 'critical');
        const selectedRows = selectedKey
            ? allSeverityRows.filter(item => item.key === selectedKey)
            : allSeverityRows;
        const fallbackToGlobal = !!(selectedKey && selectedRows.length === 0 && allSeverityRows.length > 0);
        const rowsToShow = fallbackToGlobal ? allSeverityRows : selectedRows;
        if (!rowsToShow.length) {
            el.alertHistoryList.innerHTML = '<div class=\"alert-empty\">Sem warnings/críticos no histórico recente.</div>';
            return;
        }
        const fallbackBanner = fallbackToGlobal
            ? '<div class=\"alert-empty\">Sem eventos recentes para o alerta selecionado. A mostrar histórico global.</div>'
            : '';
        el.alertHistoryList.innerHTML = fallbackBanner + rowsToShow.slice(0, 60).map(item => `
            <div class=\"alert-history-item ${item.severity}\">
                <div class=\"alert-history-head\">
                    <span>${escapeHtml(item.title || item.key || 'alerta')}</span>
                    <span class=\"alert-history-tag ${escapeHtml(item.severity)}\">${escapeHtml(item.severity)}</span>
                </div>
                <div class=\"alert-history-meta\">
                    ${escapeHtml(formatDateTime(item.sent_at))} | ${escapeHtml(item.notification || item.status)} | valor=${escapeHtml(item.value ?? '—')} | limite=${escapeHtml(item.threshold ?? '—')}
                </div>
            </div>
        `).join('');
    }

    let _lastPayload = null;

    function renderOverview(data) {
        const cur = data.current || {};
        const c = getChartColors();
        const host = cur.host || {};

        setText('sysHostName', host.hostname || host.fqdn || '—');
        const osText = [host.os, host.platform].filter(Boolean).join(' · ');
        setText('sysOsName', osText || '—');
        setText('sysKernel', host.os_release || '—');
        setText('sysHostUptime', formatDuration(host.system_uptime_seconds));

        setText('overviewHostTitle', `CPU & Memória (${labelWindow()})`);
        setText('overviewNetTitle', `Rede (${labelWindow()})`);

        const hist = chartHistoryRows(data);
        if (hist.length) {
            const rawBuckets = hist.map((row) => row.bucket || row.timestamp || null);
            const defs = chartDefaults();
            defs.scales.y.max = 100;
            defs.scales.y.ticks.callback = (v) => v + '%';
            const labels = applyRangeAxisOptions(defs, rawBuckets);
            makeOrUpdate('chartOverview24h', 'line', {
                labels,
                datasets: [
                    { label: 'CPU %', data: hist.map(r => Number(r.cpu_avg) || 0), borderColor: c.cpu, backgroundColor: c.cpu + '20', fill: true, tension: 0.35, pointRadius: 0 },
                    { label: 'RAM %', data: hist.map(r => Number(r.mem_avg) || 0), borderColor: c.mem, backgroundColor: c.mem + '20', fill: true, tension: 0.35, pointRadius: 0 },
                ]
            }, defs);

            const netDefs = chartDefaults();
            netDefs.scales.y.ticks.callback = (v) => Number(v).toFixed(1) + ' Mbps';
            const netLabels = applyRangeAxisOptions(netDefs, rawBuckets);
            makeOrUpdate('chartNet24h', 'line', {
                labels: netLabels,
                datasets: [
                    { label: 'Upload', data: hist.map(r => Number(r.net_up_avg) || 0), borderColor: c.netUp, backgroundColor: c.netUp + '20', fill: true, tension: 0.35, pointRadius: 0 },
                    { label: 'Download', data: hist.map(r => Number(r.net_down_avg) || 0), borderColor: c.netDown, backgroundColor: c.netDown + '20', fill: true, tension: 0.35, pointRadius: 0 },
                ]
            }, netDefs);
        }

    }

    function renderCpuTab(data) {
        const c = getChartColors();
        const rt = data.realtime || [];

        if (rt.length) {
            const cpuData = rt.map(r => Number(r.cpu?.total_percent) || 0);
            const defs = chartDefaults();
            defs.scales.y.max = 100;
            defs.scales.y.ticks.callback = (v) => v + '%';
            defs.scales.x.display = false;
            defs.plugins.legend.display = false;
            makeOrUpdate('chartCpuLive', 'line', {
                labels: rt.map(() => ''),
                datasets: [{ data: cpuData, borderColor: c.cpu, backgroundColor: c.cpu + '15', fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2 }]
            }, defs);
        }

        const perCore = data.current?.cpu?.per_core || [];
        const grid = document.getElementById('coresGrid');
        if (grid) {
            grid.innerHTML = perCore.map((pct, i) => `
                <div class="core-bar">
                    <div class="core-bar-header">
                        <span class="core-bar-label">Core ${i}</span>
                        <span class="core-bar-value">${(Number(pct) || 0).toFixed(1)}%</span>
                    </div>
                    <div class="core-bar-track">
                        <div class="core-bar-fill" style="width:${Math.max(0, Math.min(100, Number(pct) || 0))}%"></div>
                    </div>
                </div>
            `).join('');
        }

        const hist = chartHistoryRows(data);
        if (hist.length) {
            setText('cpuHistoryTitle', `CPU — Histórico (${labelWindow()})`);
            const defs = chartDefaults();
            defs.scales.y.max = 100;
            defs.scales.y.ticks.callback = (v) => v + '%';
            const labels = applyRangeAxisOptions(defs, hist.map((r) => r.bucket || r.timestamp || null));
            makeOrUpdate('chartCpu7d', 'line', {
                labels,
                datasets: [{ label: 'CPU %', data: hist.map(r => Number(r.cpu_avg) || 0), borderColor: c.cpu, backgroundColor: c.cpu + '15', fill: true, tension: 0.35, pointRadius: 0 }]
            }, defs);
        }

        renderProcessPanel({
            listEl: el.cpuProcTopList,
            stateEl: el.cpuProcTopState,
            updatedEl: el.cpuProcTopUpdated,
            kind: 'cpu',
            items: Array.isArray(data.current?.processes?.top_cpu) ? data.current.processes.top_cpu : [],
            proc: data.current?.processes || {},
        });
    }

    function renderMemoryTab(data) {
        const c = getChartColors();
        const rt = data.realtime || [];
        const m = data.current?.memory || {};

        setText('memTotal', `${m.total_gb ?? '—'} GB`);
        setText('memUsed', `${m.used_gb ?? '—'} GB`);
        setText('memFree', `${m.free_gb ?? '—'} GB`);
        setText('memSwap', `${m.swap_used_gb ?? '—'} / ${m.swap_total_gb ?? '—'} GB`);

        if (rt.length) {
            const memData = rt.map(r => Number(r.memory?.percent) || 0);
            const defs = chartDefaults();
            defs.scales.y.max = 100;
            defs.scales.y.ticks.callback = (v) => v + '%';
            defs.scales.x.display = false;
            defs.plugins.legend.display = false;
            makeOrUpdate('chartMemLive', 'line', {
                labels: rt.map(() => ''),
                datasets: [{ data: memData, borderColor: c.mem, backgroundColor: c.mem + '15', fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2 }]
            }, defs);
        }

        const hist = chartHistoryRows(data);
        if (hist.length) {
            setText('memHistoryTitle', `Memória — Histórico (${labelWindow()})`);
            const defs = chartDefaults();
            defs.scales.y.max = 100;
            defs.scales.y.ticks.callback = (v) => v + '%';
            const labels = applyRangeAxisOptions(defs, hist.map((r) => r.bucket || r.timestamp || null));
            makeOrUpdate('chartMem7d', 'line', {
                labels,
                datasets: [{ label: 'RAM %', data: hist.map(r => Number(r.mem_avg) || 0), borderColor: c.mem, backgroundColor: c.mem + '15', fill: true, tension: 0.35, pointRadius: 0 }]
            }, defs);
        }

        renderProcessPanel({
            listEl: el.memProcTopList,
            stateEl: el.memProcTopState,
            updatedEl: el.memProcTopUpdated,
            kind: 'memory',
            items: Array.isArray(data.current?.processes?.top_memory) ? data.current.processes.top_memory : [],
            proc: data.current?.processes || {},
        });
    }

    function renderDiskTab(data) {
        const c = getChartColors();
        const rt = data.realtime || [];
        const d = data.current?.disk || {};

        setText('diskTotal', `${d.total_gb ?? '—'} GB`);
        setText('diskUsed', `${d.used_gb ?? '—'} GB`);
        setText('diskFree', `${d.free_gb ?? '—'} GB`);
        setText('diskPercent', `${d.percent ?? '—'}%`);
        setText('diskGrowthTitle', `Crescimento de Espaço em Disco (${labelWindow()})`);

        makeOrUpdate('chartDiskSpace', 'doughnut', {
            labels: ['Usado', 'Livre'],
            datasets: [{
                data: [Number(d.used_gb) || 0, Number(d.free_gb) || 0],
                backgroundColor: [c.disk, c.gridColor],
                borderWidth: 0,
                cutout: '65%',
            }]
        }, {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: c.tickColor, font: { family: 'Inter', size: 13 } } },
                tooltip: { backgroundColor: 'rgba(10,10,20,0.9)' }
            },
            layout: { padding: 8 },
        });

        if (rt.length) {
            const defs = chartDefaults();
            defs.scales.x.display = false;
            defs.scales.y.ticks.callback = (v) => Number(v).toFixed(1) + ' MB/s';
            makeOrUpdate('chartDiskIo', 'line', {
                labels: rt.map(() => ''),
                datasets: [
                    { label: 'Read MB/s', data: rt.map(r => Number(r.disk?.read_mb_s) || 0), borderColor: c.netDown, backgroundColor: c.netDown + '15', fill: true, tension: 0.3, pointRadius: 0 },
                    { label: 'Write MB/s', data: rt.map(r => Number(r.disk?.write_mb_s) || 0), borderColor: c.disk, backgroundColor: c.disk + '15', fill: true, tension: 0.3, pointRadius: 0 },
                ]
            }, defs);
        }

        const hist = chartHistoryRows(data);
        if (hist.length) {
            const diskSeries = resolveSystemDiskSeries(hist, Number(d.total_gb));
            const bucketValues = diskSeries.map((row) => row.bucket || null);
            const growthValues = diskSeries.map((row) => row.growth);
            const usedValues = diskSeries.map((row) => row.used);
            const defsGrowth = chartDefaults();
            defsGrowth.scales.y.ticks.callback = (v) => `${Number(v).toFixed(2)} GB`;
            defsGrowth.scales.y1 = {
                position: 'right',
                grid: { drawOnChartArea: false, color: getChartColors().gridColor },
                ticks: {
                    color: getChartColors().tickColor,
                    callback: (v) => `${Number(v).toFixed(3)} GB/h`,
                },
            };
            const labelsGrowth = applyRangeAxisOptions(defsGrowth, bucketValues);
            makeOrUpdate('chartDiskGrowth', 'line', {
                labels: labelsGrowth,
                datasets: [
                    {
                        label: 'Disco Usado (GB)',
                        data: usedValues.map((v) => (Number.isFinite(Number(v)) ? Number(v) : null)),
                        borderColor: c.disk,
                        backgroundColor: c.disk + '20',
                        fill: true,
                        tension: 0.3,
                        pointRadius: 0,
                        yAxisID: 'y',
                    },
                    {
                        label: 'Crescimento/h (GB/h)',
                        data: growthValues.map((v) => (Number.isFinite(Number(v)) ? Number(v) : null)),
                        borderColor: c.dbGrowth,
                        backgroundColor: c.dbGrowth + '20',
                        fill: false,
                        tension: 0.3,
                        pointRadius: 0,
                        yAxisID: 'y1',
                    },
                ],
            }, defsGrowth);

            const currentGrowth = lastFinite(growthValues);
            const avgGrowth = numericMean(growthValues);
            setText('diskGrowthWindowHint', formatWindowGrowthHint(currentGrowth, avgGrowth));
        } else {
            setText('diskGrowthWindowHint', 'Atual: — · Média janela: —');
        }

        renderDiskTopConsumers(data);
    }

    function renderNetworkTab(data) {
        const c = getChartColors();
        const rt = data.realtime || [];
        const n = data.current?.network || {};
        const packetTotals = computePacketWindowTotals(data);

        setText('netUpInfo', (Number(n.upload_mbps) || 0).toFixed(3) + ' Mbps');
        setText('netDownInfo', (Number(n.download_mbps) || 0).toFixed(3) + ' Mbps');
        setText('netPktSent', (Number(packetTotals.sent) || 0).toLocaleString());
        setText('netPktRecv', (Number(packetTotals.recv) || 0).toLocaleString());

        if (rt.length) {
            const defs = chartDefaults();
            defs.scales.x.display = false;
            defs.scales.y.ticks.callback = (v) => Number(v).toFixed(1) + ' Mbps';
            makeOrUpdate('chartNetLive', 'line', {
                labels: rt.map(() => ''),
                datasets: [
                    { label: 'Upload', data: rt.map(r => Number(r.network?.upload_mbps) || 0), borderColor: c.netUp, backgroundColor: c.netUp + '15', fill: true, tension: 0.3, pointRadius: 0 },
                    { label: 'Download', data: rt.map(r => Number(r.network?.download_mbps) || 0), borderColor: c.netDown, backgroundColor: c.netDown + '15', fill: true, tension: 0.3, pointRadius: 0 },
                ]
            }, defs);
        }

        const hist = chartHistoryRows(data);
        if (hist.length) {
            setText('netHistoryTitle', `Rede — Histórico (${labelWindow()})`);
            const defs = chartDefaults();
            defs.scales.y.ticks.callback = (v) => Number(v).toFixed(1) + ' Mbps';
            const labels = applyRangeAxisOptions(defs, hist.map((r) => r.bucket || r.timestamp || null));
            makeOrUpdate('chartNet7d', 'line', {
                labels,
                datasets: [
                    { label: 'Upload', data: hist.map(r => Number(r.net_up_avg) || 0), borderColor: c.netUp, backgroundColor: c.netUp + '15', fill: true, tension: 0.35, pointRadius: 0 },
                    { label: 'Download', data: hist.map(r => Number(r.net_down_avg) || 0), borderColor: c.netDown, backgroundColor: c.netDown + '15', fill: true, tension: 0.35, pointRadius: 0 },
                ]
            }, defs);
        }

        renderProcessPanel({
            listEl: el.netProcTopList,
            stateEl: el.netProcTopState,
            updatedEl: el.netProcTopUpdated,
            kind: 'network',
            items: Array.isArray(data.current?.processes?.top_network) ? data.current.processes.top_network : [],
            proc: data.current?.processes || {},
        });
    }

    function renderDbTab(data) {
        const c = getChartColors();
        const db = data.db?.current || {};
        const dbHistRaw = rangeDbHistory(data);
        const dbHist = _selectedRange === '30d'
            ? downsampleRows(dbHistRaw, 1600)
            : (_selectedRange === '7d'
            ? downsampleRows(dbHistRaw, 1200)
            : (_selectedRange === '24h' ? downsampleRows(dbHistRaw, 900) : dbHistRaw));

        setText('dbThreadsRunningInfo', String(db.threads_running ?? 0));
        setText('dbThreadsConnectedInfo', String(db.threads_connected ?? 0));
        setText('dbQpsInfo', (Number(db.qps) || 0).toFixed(3));
        setText('dbTpsInfo', (Number(db.tps) || 0).toFixed(3));
        setText('dbStorageTotalInfo', `${(Number(db.storage_total_gb) || 0).toFixed(3)} GB`);
        setText(
            'dbStorageGrowthHint',
            formatDbGrowthHint(resolveDbGrowthForHint(data, db.storage_growth_gb_h), db.storage_write_gb_h)
        );
        setText('dbUptimeInfo', dbUptime(db.uptime_seconds));
        setText('dbStorageTrendTitle', `Consumo e Crescimento ${resolveDbEngineLabel(data)} (${labelWindow()})`);

        applyDbLabels(data);
        renderDbStorageConsumers(data);

        const growthValues = dbHist.map((row) => Number(row?.storage_growth_gb_h_avg));
        const currentGrowth = Number.isFinite(Number(db.storage_growth_gb_h))
            ? Number(db.storage_growth_gb_h)
            : lastFinite(growthValues);
        const avgGrowth = numericMean(growthValues);
        setText('dbStorageWindowHint', formatWindowGrowthHint(currentGrowth, avgGrowth));

        if (dbHist.length) {
            const bucketValues = dbHist.map((r) => r.bucket || r.timestamp || null);
            const defsLoad = chartDefaults();
            const labels = applyRangeAxisOptions(defsLoad, bucketValues);
            makeOrUpdate('chartDbLoad', 'line', {
                labels,
                datasets: [
                    { label: 'Threads Running', data: dbHist.map(r => Number(r.threads_running_avg) || 0), borderColor: c.dbLoad, backgroundColor: c.dbLoad + '20', fill: true, tension: 0.3, pointRadius: 0 },
                    { label: 'Threads Connected', data: dbHist.map(r => Number(r.threads_connected_avg) || 0), borderColor: c.dbConn, backgroundColor: c.dbConn + '20', fill: true, tension: 0.3, pointRadius: 0 },
                ],
            }, defsLoad);

            const defsRates = chartDefaults();
            defsRates.scales.y.ticks.callback = (v) => Number(v).toFixed(2);
            const labelsRates = applyRangeAxisOptions(defsRates, bucketValues);
            makeOrUpdate('chartDbRates', 'line', {
                labels: labelsRates,
                datasets: [
                    { label: 'QPS', data: dbHist.map(r => Number(r.qps_avg) || 0), borderColor: c.dbQps, backgroundColor: c.dbQps + '20', fill: true, tension: 0.3, pointRadius: 0 },
                    { label: 'TPS', data: dbHist.map(r => Number(r.tps_avg) || 0), borderColor: c.dbTps, backgroundColor: c.dbTps + '20', fill: true, tension: 0.3, pointRadius: 0 },
                ],
            }, defsRates);

            const defsStorage = chartDefaults();
            defsStorage.scales.y.ticks.callback = (v) => `${Number(v).toFixed(2)} GB`;
            defsStorage.scales.y1 = {
                position: 'right',
                grid: { drawOnChartArea: false, color: getChartColors().gridColor },
                ticks: {
                    color: getChartColors().tickColor,
                    callback: (v) => `${Number(v).toFixed(3)} GB/h`,
                },
            };
            const labelsStorage = applyRangeAxisOptions(defsStorage, bucketValues);
            makeOrUpdate('chartDbStorage', 'line', {
                labels: labelsStorage,
                datasets: [
                    {
                        label: 'Consumo DB (GB)',
                        data: dbHist.map((r) => {
                            const gb = Number(r?.storage_total_gb_avg);
                            if (Number.isFinite(gb)) return gb;
                            const bytes = Number(r?.storage_total_bytes_avg);
                            return Number.isFinite(bytes) ? (bytes / (1024 ** 3)) : null;
                        }),
                        borderColor: c.dbStorage,
                        backgroundColor: c.dbStorage + '20',
                        fill: true,
                        tension: 0.3,
                        pointRadius: 0,
                        yAxisID: 'y',
                    },
                    {
                        label: 'Crescimento/h (GB/h)',
                        data: dbHist.map((r) => {
                            const v = Number(r?.storage_growth_gb_h_avg);
                            return Number.isFinite(v) ? v : null;
                        }),
                        borderColor: c.dbGrowth,
                        backgroundColor: c.dbGrowth + '20',
                        fill: false,
                        tension: 0.3,
                        pointRadius: 0,
                        yAxisID: 'y1',
                    },
                ],
            }, defsStorage);
        }
    }

    function renderAlertsTab(data) {
        const alertsCurrent = (data.alerts?.current || []).filter(a => a && (a.severity === 'warning' || a.severity === 'critical'));
        const alertsFiring = alertsCurrent.filter(a => a.status === 'firing');
        const alertsHistory = Array.isArray(data.alerts?.history_recent) ? data.alerts.history_recent : [];

        renderDbHealth(alertsCurrent);

        if (el.dbAlertsList) {
            if (!alertsCurrent.length) {
                el.dbAlertsList.innerHTML = '<div class="alert-empty">Sem alertas monitorizados no momento.</div>';
                _selectedAlertKey = null;
            } else {
                if (!_selectedAlertKey || !alertsCurrent.some(a => a.key === _selectedAlertKey)) {
                    const fallback = alertsFiring[0] || alertsCurrent[0];
                    _selectedAlertKey = fallback ? fallback.key : null;
                }
                el.dbAlertsList.innerHTML = alertsCurrent.map(a => `
                    <div class="alert-item ${a.status} ${a.severity} ${a.key === _selectedAlertKey ? 'active' : ''}" data-key="${a.key}">
                        <div class="alert-title">${a.title}</div>
                        <div class="alert-meta">estado=${a.status} | valor=${a.value} | limite=${a.threshold} | severidade=${a.severity}</div>
                    </div>
                `).join('');
            }
        }

        const selectedAlert = alertsCurrent.find(a => a.key === _selectedAlertKey) || alertsCurrent[0] || null;
        renderAlertDetail(selectedAlert, alertsHistory);
        renderAlertHistory(alertsHistory, _selectedAlertKey);
    }

    function renderAlertSummary(data) {
        const summary = data.alerts?.summary || {};
        const total = Number(summary.firing_total) || 0;
        const critical = Number(summary.critical) || 0;
        const warning = Number(summary.warning) || 0;
        if (!el.alertsSummaryBadge) return;
        el.alertsSummaryBadge.classList.remove('warning', 'critical');
        if (critical > 0) el.alertsSummaryBadge.classList.add('critical');
        else if (warning > 0) el.alertsSummaryBadge.classList.add('warning');
        el.alertsSummaryBadge.textContent = `Alertas: ${total} (crit:${critical} warn:${warning})`;
    }

    function setOnlineStatusFromData(data) {
        updateLiveSampleTimestamp(data);
        updateStatusTicker(data);
    }

    function setOfflineStatus() {
        if (el.statusText) el.statusText.textContent = 'Offline';
        if (el.lastUpdated) {
            const uiLabel = new Date(Date.now()).toLocaleTimeString('pt-PT');
            el.lastUpdated.textContent = `Atualizado: ${uiLabel} · sem dados`;
        }
        const dot = document.querySelector('.status-dot');
        if (dot) {
            dot.classList.remove('online');
            dot.classList.add('offline');
        }
    }

    function ensureMergedPayload() {
        if (!_mergedPayload || typeof _mergedPayload !== 'object') {
            _mergedPayload = {};
        }
        return _mergedPayload;
    }

    function applyFullBaseline(fullPayload) {
        _fullSnapshot = fullPayload;
        _mergedPayload = fullPayload;
        _lastPayload = fullPayload;
        liveInitializeFromPayload(fullPayload, 'bootstrap');
        return _mergedPayload;
    }

    function applyHeavySnapshotToMerged(heavyPayload) {
        if (!heavyPayload || typeof heavyPayload !== 'object') return _mergedPayload;
        _heavySnapshot = heavyPayload;
        _lastHeavyAt = Date.now();

        const merged = ensureMergedPayload();
        if (!_fastSnapshot && heavyPayload.generated_at) {
            merged.generated_at = heavyPayload.generated_at;
        }

        ['history', 'history_1h', 'history_24h', 'history_7d', 'history_30d'].forEach((key) => {
            if (heavyPayload[key] !== undefined) merged[key] = heavyPayload[key];
        });

        if (!merged.current || typeof merged.current !== 'object') merged.current = {};
        const hc = heavyPayload.current || {};
        if (hc.host !== undefined) merged.current.host = hc.host;
        if (hc.processes !== undefined) merged.current.processes = hc.processes;
        if (hc.disk && typeof hc.disk === 'object' && hc.disk.top_consumers !== undefined) {
            if (!merged.current.disk || typeof merged.current.disk !== 'object') merged.current.disk = {};
            merged.current.disk.top_consumers = hc.disk.top_consumers;
        }

        if (!merged.db || typeof merged.db !== 'object') merged.db = {};
        if (heavyPayload.db && typeof heavyPayload.db === 'object' && heavyPayload.db.history !== undefined) {
            merged.db.history = heavyPayload.db.history;
        }

        if (!merged.alerts || typeof merged.alerts !== 'object') merged.alerts = {};
        if (heavyPayload.alerts && typeof heavyPayload.alerts === 'object') {
            if (heavyPayload.alerts.history_recent !== undefined) merged.alerts.history_recent = heavyPayload.alerts.history_recent;
            if (heavyPayload.alerts.current !== undefined) merged.alerts.current = heavyPayload.alerts.current;
            if (heavyPayload.alerts.summary !== undefined) merged.alerts.summary = heavyPayload.alerts.summary;
        }

        _lastPayload = merged;
        if (_lastSampleAtMs === 0) {
            updateLiveSampleTimestamp(heavyPayload);
        }
        return merged;
    }

    function applyFastSnapshotToMerged(fastPayload, sampleAtOverride = null) {
        if (!fastPayload || typeof fastPayload !== 'object') return _mergedPayload;
        _fastSnapshot = fastPayload;
        _lastFastAt = Date.now();
        const fastSampleAt = sampleAtOverride || fastPayload.current?.timestamp || fastPayload.generated_at || null;
        const fastSampleAtMs = parseTimestampMs(fastSampleAt);
        if (isOutOfOrderSample(fastSampleAtMs)) {
            return _mergedPayload;
        }

        const merged = ensureMergedPayload();
        if (fastPayload.generated_at) merged.generated_at = fastPayload.generated_at;

        if (!merged.current || typeof merged.current !== 'object') merged.current = {};
        const fc = fastPayload.current || {};
        if (fc.cpu !== undefined) merged.current.cpu = fc.cpu;
        if (fc.memory !== undefined) merged.current.memory = fc.memory;
        if (fc.network !== undefined) merged.current.network = fc.network;
        if (fc.host !== undefined) merged.current.host = fc.host;
        if (fc.timestamp !== undefined) merged.current.timestamp = fc.timestamp;
        if (fc.processes !== undefined) {
            const prevProcesses = (merged.current.processes && typeof merged.current.processes === 'object')
                ? merged.current.processes
                : {};
            merged.current.processes = { ...prevProcesses, ...(fc.processes || {}) };
        }
        if (fc.disk !== undefined) {
            const prevDisk = (merged.current.disk && typeof merged.current.disk === 'object') ? merged.current.disk : {};
            merged.current.disk = { ...prevDisk, ...(fc.disk || {}) };
        }

        if (!merged.db || typeof merged.db !== 'object') merged.db = {};
        if (fastPayload.db && typeof fastPayload.db === 'object' && fastPayload.db.current !== undefined) {
            merged.db.current = fastPayload.db.current;
        }

        if (fastPayload.realtime !== undefined) merged.realtime = fastPayload.realtime;

        if (!merged.alerts || typeof merged.alerts !== 'object') merged.alerts = {};
        if (fastPayload.alerts && typeof fastPayload.alerts === 'object') {
            if (fastPayload.alerts.current !== undefined) merged.alerts.current = fastPayload.alerts.current;
            if (fastPayload.alerts.summary !== undefined) merged.alerts.summary = fastPayload.alerts.summary;
        }

        _lastPayload = merged;
        liveIngestFromPayload(merged, {
            source: 'fast',
            sampleAt: fastSampleAt,
        });
        return merged;
    }

    function renderOverviewFast(data) {
        const cur = data.current || {};
        const host = cur.host || {};

        setText('sysHostName', host.hostname || host.fqdn || '—');
        const osText = [host.os, host.platform].filter(Boolean).join(' · ');
        setText('sysOsName', osText || '—');
        setText('sysKernel', host.os_release || '—');
        setText('sysHostUptime', formatDuration(host.system_uptime_seconds));

        setText('overviewHostTitle', `CPU & Memória (${labelWindow()})`);
        setText('overviewNetTitle', `Rede (${labelWindow()})`);
    }

    function renderCpuFast(data) {
        const c = getChartColors();
        const rt = Array.isArray(data.realtime) ? data.realtime : [];
        if (rt.length) {
            const cpuData = rt.map(r => Number(r.cpu?.total_percent) || 0);
            const defs = chartDefaults();
            defs.scales.y.max = 100;
            defs.scales.y.ticks.callback = (v) => v + '%';
            defs.scales.x.display = false;
            defs.plugins.legend.display = false;
            makeOrUpdate('chartCpuLive', 'line', {
                labels: rt.map(() => ''),
                datasets: [{ data: cpuData, borderColor: c.cpu, backgroundColor: c.cpu + '15', fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2 }]
            }, defs);
        }

        const perCore = data.current?.cpu?.per_core || [];
        const grid = document.getElementById('coresGrid');
        if (grid && Array.isArray(perCore) && perCore.length) {
            grid.innerHTML = perCore.map((pct, i) => `
                <div class="core-bar">
                    <div class="core-bar-header">
                        <span class="core-bar-label">Core ${i}</span>
                        <span class="core-bar-value">${(Number(pct) || 0).toFixed(1)}%</span>
                    </div>
                    <div class="core-bar-track">
                        <div class="core-bar-fill" style="width:${Math.max(0, Math.min(100, Number(pct) || 0))}%"></div>
                    </div>
                </div>
            `).join('');
        }

        renderProcessPanel({
            listEl: el.cpuProcTopList,
            stateEl: el.cpuProcTopState,
            updatedEl: el.cpuProcTopUpdated,
            kind: 'cpu',
            items: Array.isArray(data.current?.processes?.top_cpu) ? data.current.processes.top_cpu : [],
            proc: data.current?.processes || {},
        });
    }

    function renderMemoryFast(data) {
        const c = getChartColors();
        const rt = Array.isArray(data.realtime) ? data.realtime : [];
        const m = data.current?.memory || {};

        setText('memTotal', `${m.total_gb ?? '—'} GB`);
        setText('memUsed', `${m.used_gb ?? '—'} GB`);
        setText('memFree', `${m.free_gb ?? '—'} GB`);
        setText('memSwap', `${m.swap_used_gb ?? '—'} / ${m.swap_total_gb ?? '—'} GB`);

        if (rt.length) {
            const memData = rt.map(r => Number(r.memory?.percent) || 0);
            const defs = chartDefaults();
            defs.scales.y.max = 100;
            defs.scales.y.ticks.callback = (v) => v + '%';
            defs.scales.x.display = false;
            defs.plugins.legend.display = false;
            makeOrUpdate('chartMemLive', 'line', {
                labels: rt.map(() => ''),
                datasets: [{ data: memData, borderColor: c.mem, backgroundColor: c.mem + '15', fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2 }]
            }, defs);
        }

        renderProcessPanel({
            listEl: el.memProcTopList,
            stateEl: el.memProcTopState,
            updatedEl: el.memProcTopUpdated,
            kind: 'memory',
            items: Array.isArray(data.current?.processes?.top_memory) ? data.current.processes.top_memory : [],
            proc: data.current?.processes || {},
        });
    }

    function renderDiskFast(data) {
        const c = getChartColors();
        const rt = Array.isArray(data.realtime) ? data.realtime : [];
        const d = data.current?.disk || {};

        setText('diskTotal', `${d.total_gb ?? '—'} GB`);
        setText('diskUsed', `${d.used_gb ?? '—'} GB`);
        setText('diskFree', `${d.free_gb ?? '—'} GB`);
        setText('diskPercent', `${d.percent ?? '—'}%`);
        setText('diskGrowthTitle', `Crescimento de Espaço em Disco (${labelWindow()})`);

        makeOrUpdate('chartDiskSpace', 'doughnut', {
            labels: ['Usado', 'Livre'],
            datasets: [{
                data: [Number(d.used_gb) || 0, Number(d.free_gb) || 0],
                backgroundColor: [c.disk, c.gridColor],
                borderWidth: 0,
                cutout: '65%',
            }]
        }, {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: c.tickColor, font: { family: 'Inter', size: getChartViewportMode().compact ? 11 : 13 } } },
                tooltip: { backgroundColor: 'rgba(10,10,20,0.9)' }
            },
            layout: { padding: getChartViewportMode().compact ? 4 : 8 },
        });

        if (rt.length) {
            const defs = chartDefaults();
            defs.scales.x.display = false;
            defs.scales.y.ticks.callback = (v) => Number(v).toFixed(1) + ' MB/s';
            makeOrUpdate('chartDiskIo', 'line', {
                labels: rt.map(() => ''),
                datasets: [
                    { label: 'Read MB/s', data: rt.map(r => Number(r.disk?.read_mb_s) || 0), borderColor: c.netDown, backgroundColor: c.netDown + '15', fill: true, tension: 0.3, pointRadius: 0 },
                    { label: 'Write MB/s', data: rt.map(r => Number(r.disk?.write_mb_s) || 0), borderColor: c.disk, backgroundColor: c.disk + '15', fill: true, tension: 0.3, pointRadius: 0 },
                ]
            }, defs);
        }

        const hist = chartHistoryRows(data);
        const diskSeries = resolveSystemDiskSeries(hist, Number(d.total_gb));
        const growthValues = diskSeries.map((row) => row.growth);
        const currentGrowth = lastFinite(growthValues);
        const avgGrowth = numericMean(growthValues);
        setText('diskGrowthWindowHint', formatWindowGrowthHint(currentGrowth, avgGrowth));

        renderDiskTopConsumers(data);
    }

    function renderNetworkFast(data) {
        const c = getChartColors();
        const rt = Array.isArray(data.realtime) ? data.realtime : [];
        const n = data.current?.network || {};
        const packetTotals = computePacketWindowTotals(data);

        setText('netUpInfo', (Number(n.upload_mbps) || 0).toFixed(3) + ' Mbps');
        setText('netDownInfo', (Number(n.download_mbps) || 0).toFixed(3) + ' Mbps');
        setText('netPktSent', (Number(packetTotals.sent) || 0).toLocaleString());
        setText('netPktRecv', (Number(packetTotals.recv) || 0).toLocaleString());

        if (rt.length) {
            const defs = chartDefaults();
            defs.scales.x.display = false;
            defs.scales.y.ticks.callback = (v) => Number(v).toFixed(1) + ' Mbps';
            makeOrUpdate('chartNetLive', 'line', {
                labels: rt.map(() => ''),
                datasets: [
                    { label: 'Upload', data: rt.map(r => Number(r.network?.upload_mbps) || 0), borderColor: c.netUp, backgroundColor: c.netUp + '15', fill: true, tension: 0.3, pointRadius: 0 },
                    { label: 'Download', data: rt.map(r => Number(r.network?.download_mbps) || 0), borderColor: c.netDown, backgroundColor: c.netDown + '15', fill: true, tension: 0.3, pointRadius: 0 },
                ]
            }, defs);
        }

        renderProcessPanel({
            listEl: el.netProcTopList,
            stateEl: el.netProcTopState,
            updatedEl: el.netProcTopUpdated,
            kind: 'network',
            items: Array.isArray(data.current?.processes?.top_network) ? data.current.processes.top_network : [],
            proc: data.current?.processes || {},
        });
    }

    function renderDbCurrentFast(data) {
        const db = data.db?.current || {};
        applyDbLabels(data);
        setText('dbThreadsRunning', String(db.threads_running ?? 0));

        setText('dbThreadsRunningInfo', String(db.threads_running ?? 0));
        setText('dbThreadsConnectedInfo', String(db.threads_connected ?? 0));
        setText('dbUptimeInfo', dbUptime(db.uptime_seconds));
        setText('dbStorageTotal', `${(Number(db.storage_total_gb) || 0).toFixed(3)}`);
        setText('dbStorageTotalInfo', `${(Number(db.storage_total_gb) || 0).toFixed(3)} GB`);
        setText(
            'dbStorageGrowthHint',
            formatDbGrowthHint(resolveDbGrowthForHint(data, db.storage_growth_gb_h), db.storage_write_gb_h)
        );
        const growthValues = rangeDbHistory(data).map((row) => Number(row?.storage_growth_gb_h_avg));
        const currentGrowth = Number.isFinite(Number(db.storage_growth_gb_h))
            ? Number(db.storage_growth_gb_h)
            : lastFinite(growthValues);
        const avgGrowth = numericMean(growthValues);
        setText('dbStorageWindowHint', formatWindowGrowthHint(currentGrowth, avgGrowth));
        renderDbStorageConsumers(data);

    }

    function renderAlertsFast(data) {
        const alertsCurrent = (data.alerts?.current || []).filter(a => a && (a.severity === 'warning' || a.severity === 'critical'));
        if (alertsCurrent.length || data.alerts?.current) {
            renderDbHealth(alertsCurrent);
        }
        if (data.alerts?.summary) {
            renderAlertSummary(data);
        }
    }

    function renderFastLane(data) {
        if (!data || typeof data !== 'object') return;
        _lastUiRefreshAt = Date.now();
        _lastPayload = data;
        const activeTab = getActiveTabKey();
        const tabChanged = activeTab !== _lastFastRenderedTab;
        if (tabChanged) _lastFastRenderedTab = activeTab;
        const chartHeavyTab = activeTab === 'cpu' || activeTab === 'memory' || activeTab === 'disk' || activeTab === 'network';
        const allowHeavyTabFrame = tabChanged || !chartHeavyTab || (Date.now() - _lastFastChartTabRenderAt >= FAST_TAB_CHART_MIN_MS);
        if (allowHeavyTabFrame && chartHeavyTab) {
            _lastFastChartTabRenderAt = Date.now();
        }
        if (activeTab === 'overview') {
            safeRenderSection('overview_fast', () => renderOverviewFast(data));
        } else if (activeTab === 'cpu') {
            if (allowHeavyTabFrame) safeRenderSection('cpu_fast', () => renderCpuFast(data));
        } else if (activeTab === 'memory') {
            if (allowHeavyTabFrame) safeRenderSection('memory_fast', () => renderMemoryFast(data));
        } else if (activeTab === 'disk') {
            if (allowHeavyTabFrame) safeRenderSection('disk_fast', () => renderDiskFast(data));
        } else if (activeTab === 'network') {
            if (allowHeavyTabFrame) safeRenderSection('network_fast', () => renderNetworkFast(data));
        } else if (activeTab === 'db') {
            safeRenderSection('db_fast', () => renderDbCurrentFast(data));
        }
        safeRenderSection('alerts_fast', () => renderAlertsFast(data));
        safeRenderSection('live_frame_fast', () => renderLiveMirrorFrame(data));
        safeRenderSection('status_fast', () => setOnlineStatusFromData(data));
    }

    function getActiveTabKey() {
        const active = document.querySelector('.tab-content.active');
        const id = active?.id || '';
        if (!id.startsWith('tab-')) return 'overview';
        return id.replace(/^tab-/, '');
    }

    function renderActiveTabSections(data, tab = null) {
        const key = tab || getActiveTabKey();
        _lastUiRefreshAt = Date.now();
        _lastPayload = data;
        if (key === 'overview') {
            safeRenderSection('overview', () => renderOverview(data));
        } else if (key === 'cpu') {
            safeRenderSection('cpu', () => renderCpuTab(data));
        } else if (key === 'memory') {
            safeRenderSection('memory', () => renderMemoryTab(data));
        } else if (key === 'disk') {
            safeRenderSection('disk', () => renderDiskTab(data));
        } else if (key === 'network') {
            safeRenderSection('network', () => renderNetworkTab(data));
        } else if (key === 'db') {
            safeRenderSection('db', () => renderDbTab(data));
        } else if (key === 'alerts') {
            safeRenderSection('alerts_tab', () => renderAlertsTab(data));
        }
        safeRenderSection('alerts_summary', () => renderAlertSummary(data));
        safeRenderSection('live_frame', () => renderLiveMirrorFrame(data));
        safeRenderSection('tooltips', () => applyMonitoringTooltips(data));
        safeRenderSection('status', () => setOnlineStatusFromData(data));
    }

    function renderAll(data) {
        _lastUiRefreshAt = Date.now();
        _lastPayload = data;
        safeRenderSection('overview', () => renderOverview(data));
        safeRenderSection('cpu', () => renderCpuTab(data));
        safeRenderSection('memory', () => renderMemoryTab(data));
        safeRenderSection('disk', () => renderDiskTab(data));
        safeRenderSection('network', () => renderNetworkTab(data));
        safeRenderSection('db', () => renderDbTab(data));
        safeRenderSection('alerts_tab', () => renderAlertsTab(data));
        safeRenderSection('alerts_summary', () => renderAlertSummary(data));
        safeRenderSection('live_frame', () => renderLiveMirrorFrame(data));
        safeRenderSection('tooltips', () => applyMonitoringTooltips(data));
        safeRenderSection('status', () => setOnlineStatusFromData(data));
        revealWardenSurface();
    }

    let resizeRerenderTimer = null;

    function clearDashboardTimers() {
        if (_fastPollTimer) {
            clearTimeout(_fastPollTimer);
            _fastPollTimer = null;
        }
        if (_heavyPollTimer) {
            clearTimeout(_heavyPollTimer);
            _heavyPollTimer = null;
        }
        stopStatusTicker();
    }

    function scheduleFastPoll(delayMs = CONFIG.fastIntervalMs) {
        if (document.hidden || el.mainApp.classList.contains('hidden')) return;
        if (_fastPollTimer) clearTimeout(_fastPollTimer);
        _fastPollTimer = setTimeout(() => {
            _fastPollTimer = null;
            void pollFast();
        }, Math.max(CONFIG.fastMinIntervalMs, Number(delayMs) || CONFIG.fastIntervalMs));
    }

    function scheduleHeavyPoll(delayMs = CONFIG.heavyIntervalMs) {
        if (document.hidden || el.mainApp.classList.contains('hidden')) return;
        if (_heavyPollTimer) clearTimeout(_heavyPollTimer);
        _heavyPollTimer = setTimeout(() => {
            _heavyPollTimer = null;
            void pollHeavy();
        }, Math.max(1000, Number(delayMs) || CONFIG.heavyIntervalMs));
    }

    function markStreamMeta(kind, envelope, etag) {
        _streamMeta[kind] = {
            generated_at: envelope?.generated_at || null,
            age_ms: Number(envelope?.age_ms) || 0,
            stale: !!envelope?.stale,
            etag: etag || envelope?.etag || null,
            snapshot_id: envelope?.snapshot_id || null,
            updated_at: Date.now(),
        };
    }

    function pickRequestTimeoutMs(action, options = {}) {
        const fromOptions = Number(options.timeoutMs);
        if (Number.isFinite(fromOptions) && fromOptions > 0) return fromOptions;
        return action === 'fast' ? CONFIG.fastRequestTimeoutMs : CONFIG.heavyRequestTimeoutMs;
    }

    function getSampleAgeMs(result = null) {
        const ageFromEnvelope = Number(result?.envelope?.age_ms);
        if (Number.isFinite(ageFromEnvelope) && ageFromEnvelope >= 0) return ageFromEnvelope;
        const sampleMs = parseTimestampMs(
            result?.sampleAt
            || result?.payload?.current?.timestamp
            || result?.payload?.generated_at
            || null
        );
        const baseMs = sampleMs ?? (_lastSampleAtMs > 0 ? _lastSampleAtMs : null);
        if (baseMs === null) return Infinity;
        return Math.max(0, Date.now() - baseMs);
    }

    function computeFastNextDelayMs(result = null) {
        const ageMs = getSampleAgeMs(result);
        if (!Number.isFinite(ageMs)) return CONFIG.fastIntervalMs;
        if (ageMs >= LIVE_STALE_MS) return CONFIG.fastCatchupIntervalMs;
        if (ageMs >= 15000) return Math.max(CONFIG.fastMinIntervalMs, 700);
        if (ageMs >= 8000) return Math.max(CONFIG.fastMinIntervalMs, 900);
        if (ageMs >= 5000) return Math.max(CONFIG.fastMinIntervalMs, 1000);
        if (ageMs >= 2500) return Math.max(CONFIG.fastMinIntervalMs, 1100);
        return CONFIG.fastIntervalMs;
    }

    async function fetchWardenApiEnvelope(action, options = {}) {
        const headers = {};
        if (options.etag) headers['If-None-Match'] = options.etag;
        const url = `${CONFIG.apiUrl}?action=${encodeURIComponent(action)}${options.force ? `&t=${Date.now()}` : ''}`;
        let resp;
        const timeoutMs = pickRequestTimeoutMs(action, options);
        const abortController = (typeof AbortController === 'function') ? new AbortController() : null;
        const timeoutId = abortController
            ? setTimeout(() => abortController.abort(), Math.max(800, timeoutMs))
            : null;
        try {
            resp = await fetch(url, {
                method: 'GET',
                credentials: 'same-origin',
                cache: 'no-store',
                headers,
                signal: abortController?.signal,
            });
        } catch (err) {
            return {
                ok: false,
                error: err,
                reason: err?.name === 'AbortError' ? 'timeout' : 'network',
            };
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
        }

        if (resp.status === 304) {
            return {
                ok: true,
                notModified: true,
                etag: resp.headers.get('ETag') || options.etag || null,
                sampleAt: resp.headers.get('X-Warden-Sample-At') || null,
            };
        }

        let body = null;
        try {
            body = await resp.json();
        } catch (_err) {
            body = null;
        }

        if (resp.status === 401 || resp.status === 403) {
            return {
                ok: false,
                unauthorized: true,
                status: resp.status,
                reason: body?.reason || (resp.status === 401 ? 'not_authenticated' : 'forbidden'),
                body,
            };
        }

        if (!resp.ok) {
            return {
                ok: false,
                status: resp.status,
                reason: body?.reason || 'http_error',
                body,
            };
        }

        if (!body || body.ok !== true || typeof body.payload !== 'object') {
            return {
                ok: false,
                status: resp.status,
                reason: body?.reason || 'invalid_payload',
                body,
            };
        }

        return {
            ok: true,
            etag: resp.headers.get('ETag') || body.etag || null,
            sampleAt: resp.headers.get('X-Warden-Sample-At') || null,
            envelope: body,
            payload: body.payload,
        };
    }

    function handleApiAuthLoss(result) {
        if (!result?.unauthorized) return false;
        showToast(result.status === 403 ? 'Permissão negada no Warden.' : 'Sessão expirada no Warden.', 'error');
        clearDashboardTimers();
        setTimeout(() => location.reload(), 500);
        return true;
    }

    function describeBootstrapFailure(result) {
        if (!result || typeof result !== 'object') {
            return 'Erro ao carregar dados do Warden.';
        }
        if (result.reason === 'timeout') {
            return 'Timeout no bootstrap do Warden.';
        }
        if (result.reason === 'network') {
            return 'Falha de rede no bootstrap do Warden.';
        }
        if (result.reason === 'invalid_payload') {
            return 'Payload inválido no bootstrap do Warden.';
        }
        if (Number.isFinite(result.status) && result.status > 0) {
            return `Bootstrap do Warden falhou (HTTP ${result.status}).`;
        }
        if (typeof result.reason === 'string' && result.reason.trim() !== '') {
            return `Bootstrap do Warden falhou (${result.reason}).`;
        }
        return 'Erro ao carregar dados do Warden.';
    }

    function applyFastEnvelope(result) {
        if (!result?.payload) return;
        if (result.sampleAt && !result.payload.current?.timestamp) {
            result.payload.current = { ...(result.payload.current || {}), timestamp: result.sampleAt };
        }
        if (result.etag) _streamEtags.fast = result.etag;
        markStreamMeta('fast', result.envelope, result.etag);
        const merged = applyFastSnapshotToMerged(result.payload, result.sampleAt || null);
        if (merged) renderFastLane(merged);
    }

    function applyHeavyEnvelope(result) {
        if (!result?.payload) return;
        if (result.sampleAt && !result.payload.current?.timestamp) {
            result.payload.current = { ...(result.payload.current || {}), timestamp: result.sampleAt };
        }
        if (result.etag) _streamEtags.heavy = result.etag;
        markStreamMeta('heavy', result.envelope, result.etag);
        const merged = applyHeavySnapshotToMerged(result.payload);
        if (merged) renderActiveTabSections(merged);
    }

    function applyFullEnvelope(result) {
        if (!result?.payload) return;
        if (result.etag) _streamEtags.full = result.etag;
        markStreamMeta('full', result.envelope, result.etag);
        const baseline = applyFullBaseline(result.payload);
        _dataMode = 'bootstrap';
        renderAll(baseline);
    }

    async function pollFast(options = {}) {
        const force = !!options.force;
        if (_fastInFlight) return;
        if (document.hidden && !force) return;
        _fastInFlight = true;
        try {
            const result = await fetchWardenApiEnvelope('fast', {
                etag: force ? null : _streamEtags.fast,
                force,
                timeoutMs: CONFIG.fastRequestTimeoutMs,
            });
            if (handleApiAuthLoss(result)) return;

            if (!result.ok) {
                _fastFailureStreak += 1;
                _fastBackoffMs = Math.min(CONFIG.fastMaxBackoffMs, Math.max(CONFIG.fastIntervalMs, _fastBackoffMs) * 2);
                if (_fastFailureStreak >= 3) {
                    setOfflineStatus();
                } else if (_lastPayload) {
                    setOnlineStatusFromData(_lastPayload);
                }
                scheduleFastPoll(Math.max(CONFIG.fastMinIntervalMs, _fastBackoffMs));
                return;
            }

            _fastFailureStreak = 0;
            if (!result.notModified) {
                applyFastEnvelope(result);
            } else if (_lastPayload) {
                _lastUiRefreshAt = Date.now();
                setOnlineStatusFromData(_lastPayload);
            }
            _lastFastAt = Date.now();
            _lastUiRefreshAt = _lastFastAt;
            _fastBackoffMs = CONFIG.fastIntervalMs;
            scheduleFastPoll(computeFastNextDelayMs(result));
        } finally {
            _fastInFlight = false;
        }
    }

    async function pollHeavy(options = {}) {
        const force = !!options.force;
        if (_heavyInFlight) return;
        if (document.hidden && !force) return;
        _heavyInFlight = true;
        try {
            const result = await fetchWardenApiEnvelope('heavy', {
                etag: force ? null : _streamEtags.heavy,
                force,
                timeoutMs: CONFIG.heavyRequestTimeoutMs,
            });
            if (handleApiAuthLoss(result)) return;

            if (!result.ok) {
                _heavyFailureStreak += 1;
                _heavyBackoffMs = Math.min(CONFIG.heavyMaxBackoffMs, Math.max(CONFIG.heavyIntervalMs, _heavyBackoffMs) * 2);
                scheduleHeavyPoll(_heavyBackoffMs);
                return;
            }

            _heavyFailureStreak = 0;
            if (!result.notModified) {
                applyHeavyEnvelope(result);
            }
            _lastHeavyAt = Date.now();
            _heavyBackoffMs = CONFIG.heavyIntervalMs;
            scheduleHeavyPoll(CONFIG.heavyIntervalMs);
        } finally {
            _heavyInFlight = false;
        }
    }

    async function bootstrapDashboard() {
        const fullResult = await fetchWardenApiEnvelope('full', { force: true });
        if (fullResult.ok && !fullResult.notModified) {
            applyFullEnvelope(fullResult);
            return { ok: true, mode: 'api_full' };
        }
        if (handleApiAuthLoss(fullResult)) return { ok: false, mode: 'auth_lost' };
        const error = new Error(describeBootstrapFailure(fullResult));
        error.bootstrapResult = fullResult;
        throw error;
    }

    function startDualPolling() {
        clearDashboardTimers();
        startStatusTicker();
        _fastBackoffMs = CONFIG.fastIntervalMs;
        _heavyBackoffMs = CONFIG.heavyIntervalMs;
        _fastFailureStreak = 0;
        _heavyFailureStreak = 0;
        _lastFastChartTabRenderAt = 0;
        _lastFastRenderedTab = null;
        scheduleFastPoll(0);
        scheduleHeavyPoll(0);
    }

    async function startDashboard() {
        try {
            const boot = await bootstrapDashboard();
            if (!boot || boot.ok !== true) {
                return;
            }
            startDualPolling();
        } catch (err) {
            console.error('Warden bootstrap error:', err);
            clearDashboardTimers();
            setOfflineStatus();
            showToast(err?.message || 'Erro ao carregar dados do Warden.', 'error');
        }
    }

    document.addEventListener('keydown', (e) => {
        if (isChartExpandOpen()) {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeExpandedChartModal();
                return;
            }
            trapExpandModalFocus(e);
            return;
        }
        if (e.key === 'Escape') {
            closeUserMenu();
        }
    });

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            clearDashboardTimers();
            return;
        }
        if (el.mainApp.classList.contains('hidden')) return;
        startStatusTicker();
        scheduleFastPoll(0);
        const heavyAge = _lastHeavyAt ? (Date.now() - _lastHeavyAt) : Infinity;
        if (heavyAge > Math.max(CONFIG.heavyIntervalMs, 15000)) {
            scheduleHeavyPoll(0);
        } else {
            scheduleHeavyPoll(CONFIG.heavyIntervalMs);
        }
    });

    window.addEventListener('focus', () => {
        if (document.hidden || el.mainApp.classList.contains('hidden')) return;
        startStatusTicker();
        scheduleFastPoll(0);
    });

    window.addEventListener('resize', () => {
        if (resizeRerenderTimer) clearTimeout(resizeRerenderTimer);
        resizeRerenderTimer = setTimeout(() => {
            resizeRerenderTimer = null;
            if (_lastPayload) renderAll(_lastPayload);
            if (_expandedChartInstance && isChartExpandOpen()) {
                _expandedChartInstance.resize();
            }
        }, 180);
    });

    initMotion();
    initTheme();
    if (el.currentYear) el.currentYear.textContent = new Date().getFullYear();
    checkSession();
})();
