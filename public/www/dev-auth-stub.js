/**
 * Stubs MAIATRON auth modules for local generic dev (no HUB shared assets).
 */
(function () {
    'use strict';

    const devSession = { username: 'local-dev', displayName: 'Local dev', appKey: 'warden' };

    window.MaiatronAuth = {
        getDisplayName(session) {
            return (session && (session.displayName || session.username)) || 'Local dev';
        },
        saveLoginPreferences() {},
        async requireAuth({ onAuthorized }) {
            if (typeof onAuthorized === 'function') onAuthorized(devSession);
        },
        async login() {
            return { ok: true };
        },
        async logout() {
            return { ok: true };
        },
        async forgotPassword() {
            return { ok: false, reason: 'dev_mode' };
        },
    };

    window.MaiatronAuthUI = {
        mount() {},
        syncFromServer() {},
    };

    window.MaiatronAppSwitcher = {
        mount() {},
    };

    window.MaiatronMotion = {
        init() {},
        swap(fn) {
            if (typeof fn === 'function') fn();
        },
        reveal() {},
    };
})();
