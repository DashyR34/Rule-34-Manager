// ==UserScript==
// @name         R34 - UI Manager
// @namespace    http://tampermonkey.net/
// @version      2.14
// ==/UserScript==

(function () {
    "use strict";
    const Storage = window.R34Storage;
    const Config = window.R34Config;
    const safeExec = window.R34SafeExec;
    const FilterManager = window.R34FilterManager;
    const BlacklistManager = window.R34BlacklistManager;
    const AutoComplete = window.R34AutoComplete;

    /* Missing top-level helpers */
    function getDirectText(el) { /* your original function */ }
    function applyAriaLabels(root = document.body) { /* your original function */ }
    function injectPreloadStyles() { /* your original with getConfig("animSpeed") */ }
    function removePreloadStyles() { /* your original */ }

    class UIManager {
        constructor(filterManager, blacklistManager) {
            this.filterManager = filterManager;
            this.blacklistManager = blacklistManager;
            this.autoComplete = null;
            this._activeDisplay = { /* your original */ };
            this._closeButton = null;
            this.init();
        }

        async init() { /* your full init with safeExec – unchanged */ }

        /* All your other methods: hidePostViewPaginator, injectStyles, createModal, renderActiveTags, customizePaginator (updated below), createImportExportSection, etc. */

        customizePaginator() {
            return safeExec(() => {
                /* your original code */
                // NEW: smart last page using preloaded PID
                const maxPid = Storage.get("maxLoadedPid", 0);
                let lastPage = Math.floor(maxPid / 42) + 1;
                /* rest of your paginator build */
            }, "UIManager.customizePaginator");
        }

        setupInfiniteScroll() {
            if (!Config.get("infiniteScroll")) return;
            const preloadN = Config.get("preloadPages");
            const grid = document.getElementById("r34-custom-grid");
            if (!grid) return;

            let currentPid = parseInt(new URL(location.href).searchParams.get("pid") || "0");
            let loading = false;

            const loadNext = (pid) => {
                if (loading) return;
                loading = true;
                const url = new URL(location.href);
                url.searchParams.set("pid", pid);
                GM_xmlhttpRequest({
                    method: "GET",
                    url: url.toString(),
                    onload: (res) => {
                        if (res.status === 200) {
                            const temp = document.createElement("div");
                            temp.innerHTML = res.responseText;
                            const newThumbs = temp.querySelectorAll(".thumb");
                            newThumbs.forEach(t => grid.appendChild(t));
                            Storage.set("maxLoadedPid", pid + 42 * preloadN); // track for paginator
                            this.applyFilters();
                            this.applyHiddenStates();
                            this.setupThumbnailHandlers();
                        }
                        loading = false;
                    }
                });
            };

            // Preload N pages
            for (let i = 1; i <= preloadN; i++) {
                loadNext(currentPid + 42 * i);
            }

            // Observer for more
            /* your original IntersectionObserver – unchanged */
        }

        /* setupThumbnailHandlers moved here as method (full original code with this. references) */
        setupThumbnailHandlers() { /* your full long function from preview – now inside class so 'this' works */ }

        /* rest of your methods: createCloseButton, etc. */
    }

    window.R34UIManager = UIManager;
})();
