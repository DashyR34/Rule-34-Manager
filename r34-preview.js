// ==UserScript==
// @name         R34 - Preview System
// @namespace    http://tampermonkey.net/
// @version      2.14
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function () {
    "use strict";
    const Config = window.R34Config;
    const safeExec = window.R34SafeExec;

    // Paste your full setupThumbnailHandlers() and all related inner functions (showMedia, createDisplay, etc.) here — already wrapped in safeExec

    window.R34SetupThumbnailHandlers = setupThumbnailHandlers;
})();
