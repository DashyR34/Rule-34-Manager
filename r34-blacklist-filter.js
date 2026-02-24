// ==UserScript==
// @name         R34 - Blacklist & Filter
// @namespace    http://tampermonkey.net/
// @version      2.14
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function () {
    "use strict";
    const Storage = window.R34Storage;
    const safeExec = window.R34SafeExec;

    // BlacklistManager, FilterManager, AutoComplete, tagDatabase, buildTagDatabase — paste your full classes unchanged (with safeExec already in your latest code)

    // Expose
    window.R34BlacklistManager = BlacklistManager;
    window.R34FilterManager = FilterManager;
    window.R34AutoComplete = AutoComplete;
    window.R34BuildTagDatabase = buildTagDatabase;
})();
