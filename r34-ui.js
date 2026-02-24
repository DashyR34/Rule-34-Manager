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

    class UIManager {
        constructor(filterManager, blacklistManager) {
            this.filterManager = filterManager;
            this.blacklistManager = blacklistManager;
            this.autoComplete = null;
            this._autoAdvanceTriggered = false;   // ← add this line
            this._activeDisplay = {
                el: null,
                thumb: null,
                naturalW: 0,
                naturalH: 0,
                overlay: null,
                transitioning: false,
                overlayActive: false,
                holdActivated: false,
            };
            this._closeButton = null;
            this.init();
        }

        async init() {
            return safeExec(async () => {
                applyAriaLabels();
                new MutationObserver(() => applyAriaLabels()).observe(document.body, {
                    childList: true,
                    subtree: true,
                });

                this.injectStyles();
                this.hidePostViewPaginator(); // FIX 3: hide paginator on post view pages
                this.createCustomGrid();
                this.createModal();
                this.createImportExportSection();
                this.createCloseButton();
                this.createHiddenCounter();
                this.movePaginator();
                this.customizePaginator();
                this.setupThumbnailHandlers();
                this.applyFilters();
                this.applyHiddenStates();
                this.updateHiddenCounter();

                console.info("Manager script v2.13 loaded");
                await this.blacklistManager.fetchBlacklist();
                setTimeout(() => this.detectCopyrightTags(), 500);
                setTimeout(() => this.setupInfiniteScroll?.(), 800); // give DOM time to settle
            }, "UIManager.init");
        }

        /* FIX 3: Hide the paginator when on a post view page (s=view) */
        hidePostViewPaginator() {
            const params = new URLSearchParams(window.location.search);
            if (params.get("s") === "view") {
                const style = document.createElement("style");
                style.textContent = `div#paginator { display: none !important; }`;
                (document.head || document.documentElement).appendChild(style);
            }
        }

        injectStyles() {
            const style = document.createElement("style");
            style.textContent = `
                :root { --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1); --c-link: #66b3ff; }

                /* ==================== YOUR ORIGINAL STYLUS CSS (unchanged) ==================== */
                #navbar > li:nth-child(14), #navbar > li:nth-child(13), #navbar > li:nth-child(12),
                #navbar > li:nth-child(11), #navbar > li:nth-child(10), #navbar > li:nth-child(8),
                #navbar > li:nth-child(7), #navbar > li:nth-child(6), #navbar > li:nth-child(5),
                #navbar > li:nth-child(4), #navbar > li:nth-child(3), #navbar > li:nth-child(2) { display: none; }

                #header { display: flex; justify-content: center; height: 50px; position: relative; left: -475px; }
                                #header, #header > * { background: transparent; }

                                #site-title { justify-content: center; }
                                #site-title::after { content: "//"; font-weight: normal; position: relative; left: 15px; }

                                div#header ul#navbar { position: relative; top: 3px; }
                                div#header ul#navbar li { position: relative; top: 9px; }

                                div#header ul#subnavbar { background: transparent; position: relative; left: -25px; top: 3px; }
                                div#header ul#subnavbar li { position: relative; top: 9px; font-size: 120%; }

                                #subnavbar { display: flex; justify-content: center; }
                                #subnavbar > li:nth-child(12), #subnavbar > li:nth-child(11), #subnavbar > li:nth-child(10),
                                #subnavbar > li:nth-child(9), #subnavbar > li:nth-child(8), #subnavbar > li:nth-child(7),
                                #subnavbar > li:nth-child(6), #subnavbar > li:nth-child(5), #subnavbar > li:nth-child(4),
                                #subnavbar > li:nth-child(1) { display: none; }

                                [aria-label="Meta"], #tag-sidebar > li.tag-type-metadata { display: none; }
                                [aria-label="Filter AI posts"] { color: transparent; }
                                #displayOptions > li > label > span { transform: translateX(-104px); }
                                [aria-label="Tags"] { display: none; }
                                img[src="/images/r34chibi.png"] { display: none; }
                                [aria-label="?"] , [aria-label="+"] , [aria-label="-"] { display: none; }
                                h6 { margin-top: 4px; margin-bottom: 4px; }
                                [aria-label="Reset cookie / GDPR consent"] { display: none; }
                                div#right-col { position: relative; left: 125px; }

                                #post-view > div.sidebar { border-radius: 5px; position: absolute; left: 10px; top: 50px; }
                                #post-list > div.sidebar { border-radius: 5px; position: relative; left: -10px; }

                                #tag-sidebar { padding: 4px; }
                                input[type=submit], div.tag-search input[type="submit"] { display: none; }

                                form { padding: 4px; }
                                input[type=text] { padding: 2px; }
                                [aria-label="Search"] { display: none; }
                                input[name="tags"] { border-radius: 5px; }

                                span[class="tag-count"] { font-size: 10px; }
                                span[class="tag-count"]::before { content: "("; }
                                span[class="tag-count"]::after { content: ")"; }
                                li[class="tag-type-general"] { font-size: 12px; }

                                #displayOptions:has(input:checked) { display: none; }
                                .tlabel { outline: none; }
                                a:link > img[src="https://rule34.xxx/images/headerru.png?v2"] { display: none; }
                                [aria-label="Rule 34 : If it exists there is porn of it. If not, start uploading."] { font-size: 150%; }
                                [aria-label="Serving 13,880,893 posts - Running Beta 0.2"] { color: transparent; }
                                [aria-label="Gelbooru"] { position: relative; left: -72px; top: 6px; }

                                #static-index > div:nth-child(5) > small { display: none; }
                                #static-index > div:nth-child(4) > form > input[type=submit] { display: none; }
                                #static-index > div:nth-child(4) { margin-top: 6px; }
                                #links > a:nth-child(1), #links > a:nth-child(2) { display: none; }
                                #header #navbar li.current-page { border-radius: 5px; }

                                #user-index > h1 { display: none; }
                                #user-index > h4:nth-child(1),
                                [aria-label="Make like a tree and get out of here! Click here to logout of your account."],
                                #user-index > h4:nth-child(5),
                                [aria-label="Check your messages and reply to them."],
                                #user-index > h4:nth-child(7),
                                [aria-label="View all of your favorites and remove them if you wish."],
                                [aria-label="Manage account options."],
                                [aria-label="It's your profile. Do you need me to explain more?"],
                                [aria-label="Change your password"],
                                #user-index > p:nth-child(12) { display: none; }

                                #user-index > h4:nth-child(3),
                                #user-index > h4:nth-child(9),
                                #user-index > h4:nth-child(11) { margin-bottom: 10px; }

                                h4 { text-align: center; }
                                h4::after { content: " «"; color: var(--c-link); font-weight: bold; }
                                h4:hover::after { text-shadow: 1px 1px 1px black, -1px -1px 1px black, 1px -1px 1px black, -1px 1px 1px black; }

                                div#content { display: flex; justify-content: center; }

                                #user-edit > form > table > tbody > tr:nth-child(2),
                                #user-edit > form > table > tbody > tr:nth-child(3),
                                #user-edit > form > table > tbody > tr:nth-child(5),
                                #user-edit > form > table > tbody > tr:nth-child(8),
                                #user-edit > form > table > tbody > tr:nth-child(12),
                                #user-edit > form > table > tbody > tr:nth-child(10) { display: none; }

                                #paginator > div > div > a {
                                    border-radius: 16px;
                                    width: 24px;
                                    height: 26px;
                                    scale: 84%;
                                }
                                #paginator > div > div > a[aria-label="<"] { transition: all ${Config.get("animSpeed")}s cubic-bezier(0.34, 1.56, 0.64, 1); transform: translateX(32px); }
                                #paginator > div > div > a[aria-label=">"] { transition: all ${Config.get("animSpeed")}s cubic-bezier(0.34, 1.56, 0.64, 1); transform: translateX(-32px); }
                                #paginator > div > div > a[aria-label="<"]:hover { transform: scale(115%) translateX(28px); text-shadow: none; background: transparent; border-color: white; color: white; }
                                #paginator > div > div > a[aria-label=">"]:hover { transform: scale(115%) translateX(-28px); text-shadow: none; background: transparent; border-color: white; color: white; }

                                [aria-label="1"] { display: none; }
                                #resized_notice { display: none; }

                                #navlinksContainer { border: none; background: transparent; }
                                #navlinksContainer > div:nth-child(1),
                                #navlinksContainer > div:nth-child(3) {
                                    transition: all ${Config.get("animSpeed")}s cubic-bezier(0.34, 1.56, 0.64, 1);
                                    border: 1px var(--c-link) solid;
                                    padding: 4px;
                                    border-radius: 10px;
                                    width: 14px;
                                    height: 19px;
                                    cursor: pointer;
                                }
                                #navlinksContainer > div:nth-child(1) { position: relative; left: 75px; }
                                #navlinksContainer > div:nth-child(3) { position: relative; left: -75px; }
                                #navlinksContainer > div:nth-child(1):hover,
                                #navlinksContainer > div:nth-child(3):hover { scale: 116%; opacity: .5; }

                                #prev_search_link, #next_search_link {
                                    transition: all ${Config.get("animSpeed")}s cubic-bezier(0.34, 1.56, 0.64, 1);
                                    visibility: hidden;
                                    width: 14px;
                                    height: 19px;
                                    display: block;
                                }
                                #prev_search_link::before { visibility: visible; content: "<"; }
                                #next_search_link::before { visibility: visible; content: ">"; position: relative; left: 1px; }

                                #navlinksContainer > div:nth-child(2) { position: relative; top: 5px; }

                                [aria-label="Cum on this"], [aria-label="You can cum every 24 hours. Explanation and"] { display: none; }

                                #stats > h5, #stats > ul > li:nth-child(1), [aria-label="Score: (vote )"] { display: none; }

                                #post-view > div.sidebar > div:nth-child(6) > h5,
                                #post-view > div.sidebar > div:nth-child(6) > ul > li:nth-child(2),
                                #post-view > div.sidebar > div:nth-child(6) > ul > li:nth-child(5),
                                #post-view > div.sidebar > div:nth-child(6) > ul > li:nth-child(6),
                                #post-view > div.sidebar > div:nth-child(7) > h5,
                                #post-view > div.sidebar > div:nth-child(7) > ul > li:nth-child(2),
                                #post-view > div.sidebar > div:nth-child(8) { display: none; }

                                #stats, #post-view > div.sidebar > div:nth-child(6) { padding: 4px; }
                                #post-view > div.sidebar > div:nth-child(6) > ul > li:nth-child(1) { display: none; }

                                ul { margin: 0; }

                                #fit-to-screen > div.flexi > div:nth-child(1) > h4 { color: transparent; cursor: default; }
                                h4::after { display: none; }

                                div.horizontalFlexWithMargins { display: none; }

                                #paginator > div > div > form {
                                    position: relative;
                                    left: -40px;
                                    top: 1px;
                                }
                                #paginator input[type="text"] {
                                    width: 48px;
                                    border-radius: 15px;
                                }

                                #body > div:nth-child(12) > p { display: none; }
                                	#content > div:nth-child(2) > table > tbody > tr:nth-child(4),
	#content > div:nth-child(2) > table > tbody > tr:nth-child(1),
	#content > div:nth-child(2) > table > tbody > tr:nth-child(10),
	#content > div:nth-child(2) > table > tbody > tr:nth-child(11),
	#content > div:nth-child(2) > table > tbody > tr:nth-child(12) {
		display: none;
	}
	#content > div:nth-child(5) {
		display: none
	}
	#content > h2,
	#content > div:nth-child(5),
	#content > div:nth-child(6) {
		margin-left: 15px;
		margin-right: 15px;
	}
    input[value="Save"] {
        display: inline-block;
    }
	#user-edit > p {
		text-align: center;
	}
	tr.tableheader,
	thead tr {
		background: transparent !important;
		font-size: 20px;
		position: relative;
		left: -10px;
	}
	#search {
		display: flex;
		justify-content: center;
	}
	#search > form > input[type=text]:nth-child(1) {
		width: 384px !important;
	}
	#paginator .pagination {
		position: relative;
		left: 24px;
	}
	table.highlightable td {
		border: none !important;
		padding: 5px;
	}
                    [aria-label="Copyright"] {
                        display: none;
                    }
                    li[class="tag-type-copyright"] {
                        display: none;
                    }

                /* ==================== UPDATED / NEW STYLES ==================== */
                #r34-custom-grid .thumb {
                    width: 100%;
                    height: 90px;
                    background: #111;
                    border-radius: 4px;
                    overflow: hidden;
                    position: relative;
                    transition: transform 0.3s var(--ease-out-expo), z-index 0.05s linear;
                }
                video {
                    overflow: visible !important;
                    position: relative;
                }
                #r34-custom-grid .thumb:hover {
                    transform: scale(1.15);
                    z-index: 20;
                }
                #r34-custom-grid .thumb img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    border-radius: 4px;
                }
                .r34-original-display-img {
                    position: fixed;
                    z-index: 9999;
                    object-fit: contain;
                    box-shadow: 0 12px 48px rgba(0,0,0,0.8);
                    transition: left 0.75s cubic-bezier(0.34, 1.56, 0.64, 1),
                                top 0.75s cubic-bezier(0.34, 1.56, 0.64, 1),
                                width 0.75s cubic-bezier(0.34, 1.56, 0.64, 1),
                                height 0.75s cubic-bezier(0.34, 1.56, 0.64, 1),
                                opacity 0.4s ease-out;
                    opacity: 0;
                    pointer-events: auto;
                }
                .r34-original-display-img.video {
                    background: linear-gradient(135deg, #1e1e1e 0%, #2a2a2a 100%);
                    border: 2px solid rgba(102, 179, 255, 0.35);
                    box-shadow: 0 20px 80px rgba(0,0,0,0.95),
                                0 0 40px rgba(102, 179, 255, 0.25) inset;
                }
                .webm-thumb {
                    position: relative;
                    border: none;
                    border-radius: 4px;
                }
                .r34-video-thumb {
                    position: relative;
                    overflow: visible !important; /* ring sits outside bounds */
                }
                .r34-video-thumb .video-pulse-ring {
                    position: absolute;
                    inset: -8px;
                    border: 2px solid rgba(102, 179, 255, 0.35); /* more transparent */
                    border-radius: 12px;
                    pointer-events: none;
                    z-index: 15; /* high enough to be visible, but far below modals (9998+) */
                    animation: videoOutlinePulse 4.8s ease-in-out infinite;
                    box-shadow: 0 0 18px rgba(102, 179, 255, 0.22); /* softer glow */
                }
                .r34-video-thumb:hover {
                    box-shadow: 0 0 25px rgba(102, 179, 255, 0.25);
                }
                .r34-video-thumb img {
                    filter: brightness(1.08) saturate(1.15);
                }
                @keyframes videoOutlinePulse {
                    0%, 100% {
                        transform: scale(1.025);
                        opacity: 0.25;
                    }
                    50% {
                        transform: scale(1.1);
                        opacity: 0.5;
                    }
                }
                #paginator input[type="text"] {
                    width: 70px;
                    padding: 5px 8px;
                    background: rgba(0,0,0,0.5);
                    border: 1px solid rgba(255,255,255,0.2);
                    border-radius: 9999px;
                    color: #fff;
                    text-align: center;
                    font-size: 12px;
                    transform: scale(0.875);
                    transform-origin: center;
                }

                #r34-filter-modal {
                                    position: fixed;
                                    top: 10px;
                                    left: 10px;
                                    background: linear-gradient(135deg, #1e1e1e 0%, #2a2a2a 100%);
                                    border: 1px solid rgba(255,255,255,0.1);
                                    border-radius: 12px;
                                    padding: 0;
                                    z-index: 10000;
                                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                                    color: #e8e8e8;
                                    width: 280px;
                                    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
                                    backdrop-filter: blur(10px);
                                    transition: top 0.32s var(--ease-out-expo), left 0.16s var(--ease-out-expo);
                                }

                                #r34-filter-header {
                                    display: flex;
                                    justify-content: space-between;
                                    align-items: center;
                                    padding: 14px 16px;
                                    cursor: move;
                                    user-select: none;
                                    background: rgba(255,255,255,0.02);
                                    border-radius: 12px 12px 0 0;
                                }

                                #r34-filter-title { font-weight: 600; font-size: 14px; color: #fff; letter-spacing: 0.3px; }
                                #r34-filter-toggle { font-size: 12px; cursor: pointer; transition: all ${Config.get("animSpeed")}s cubic-bezier(0.34, 1.56, 0.64, 1); color: #888; padding: 4px; border-radius: 4px; }
                                #r34-filter-toggle:hover { color: #fff; background: rgba(255,255,255,0.1); }
                                #r34-filter-toggle.collapsed { transform: rotate(-90deg); }

                                #r34-filter-content {
                                    max-height: 600px;
                                    overflow: hidden;
                                    transition: max-height 0.4s var(--ease-out-expo);
                                    padding: 16px;
                                }
                                #r34-filter-content.collapsed { max-height: 0; padding: 0 16px; }

                                .r34-section { margin: 16px 0; }

                                .r34-section-header {
                                    display: flex;
                                    justify-content: space-between;
                                    align-items: center;
                                    cursor: pointer;
                                    user-select: none;
                                    padding: 6px 8px;
                                    border-radius: 6px;
                                    transition: all ${Config.get("animSpeed")}s cubic-bezier(0.34, 1.56, 0.64, 1);
                                }
                                .r34-section-header:hover { background: rgba(255,255,255,0.05); }

                                .r34-section-title { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
                                .r34-section-title.blue { color: #66b3ff; }
                                .r34-section-title.pink { color: #ff88bb; }
                                .r34-section-title.orange { color: #ffb266; }

                                .r34-section-toggle { font-size: 10px; color: #666; transition: all ${Config.get("animSpeed")}s cubic-bezier(0.34, 1.56, 0.64, 1); }
                                .r34-section-toggle.collapsed { transform: rotate(-90deg); }

                                .r34-section-content {
                                    margin-top: 12px;
                                    max-height: 400px;
                                    overflow: hidden;
                                    transition: max-height ${Config.get("animSpeed")}s cubic-bezier(0.34, 1.56, 0.64, 1);
                                }
                                .r34-section-content.collapsed { max-height: 0; margin-top: 0; }

                                #r34-section-border, #r34-section-border-tags {
                                    padding: 12px;
                                    border-radius: 10px;
                                    display: flex;
                                    flex-direction: column;
                                    align-items: center;
                                    gap: 8px;
                                }
                                #r34-section-border { background: rgba(255,178,102,0.08); border: 1px solid rgba(255,178,102,0.2); }
                                #r34-section-border-tags { background: rgba(102,179,255,0.08); border: 1px solid rgba(102,179,255,0.2); }

                                #r34-primary-actions {
                                    display: flex;
                                    justify-content: center;
                                    margin-bottom: 8px;
                                }

                                .r34-input-group { position: relative; margin-bottom: 4px; }
                                #r34-tag-input {
                                    width: 100%;
                                    padding: 10px 12px;
                                    background: rgba(0,0,0,0.3);
                                    border: 2px solid rgba(102,179,255,0.2);
                                    border-radius: 8px;
                                    color: #fff;
                                    font-size: 13px;
                                    box-sizing: border-box;
                                    transition: all ${Config.get("animSpeed")}s cubic-bezier(0.34, 1.56, 0.64, 1);
                                }
                                #r34-tag-input:focus {
                                    outline: none;
                                    border-color: rgba(102,179,255,0.5);
                                    background: rgba(0,0,0,0.4);
                                    transform: translateY(-1px);
                                    box-shadow: 0 4px 12px rgba(102,179,255,0.2);
                                }

                                #r34-autocomplete {
                                    position: absolute;
                                    top: 100%;
                                    left: 0; right: 0;
                                    background: #1e1e1e;
                                    border: 1px solid rgba(255,255,255,0.1);
                                    border-radius: 8px;
                                    max-height: 200px;
                                    overflow-y: auto;
                                    display: none;
                                    z-index: 10001;
                                    margin-top: 4px;
                                    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
                                }
                                .autocomplete-item {
                                    padding: 10px 12px;
                                    cursor: pointer;
                                    font-size: 12px;
                                    color: #ccc;
                                    border-bottom: 1px solid rgba(255,255,255,0.05);
                                    transition: all ${Config.get("animSpeed")}s cubic-bezier(0.34, 1.56, 0.64, 1);
                                }
                                .autocomplete-item:last-child { border-bottom: none; }
                                .autocomplete-item:hover, .autocomplete-item.selected {
                                    background: rgba(102,179,255,0.15);
                                    color: #fff;
                                    transform: translateX(4px);
                                }
                                .autocomplete-item.blacklisted { color: #ff88bb; text-decoration: line-through; }

                                .r34-btn {
                                    width: 100%;
                                    max-width: 220px;
                                    padding: 9px 12px;
                                    background: rgba(255,255,255,0.05);
                                    border: 1px solid rgba(255,255,255,0.1);
                                    border-radius: 8px;
                                    color: #ccc;
                                    cursor: pointer;
                                    font-size: 12px;
                                    font-weight: 500;
                                    transition: all ${Config.get("animSpeed")}s cubic-bezier(0.34, 1.56, 0.64, 1);
                                    margin: 0 auto;
                                    display: block;
                                }
                                .r34-btn:hover {
                                    background: rgba(255,255,255,0.1);
                                    color: #fff;
                                    border-color: rgba(255,255,255,0.2);
                                    transform: translateY(-2px);
                                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                                }

                                #r34-active-tags {
                                    display: flex;
                                    flex-wrap: wrap;
                                    justify-content: center;
                                    gap: 6px;
                                    min-height: 28px;
                                }

                                .r34-tag-chip {
                                    display: inline-flex;
                                    align-items: center;
                                    background: linear-gradient(135deg, rgba(102,179,255,0.2), rgba(102,179,255,0.1));
                                    border: 1px solid rgba(102,179,255,0.3);
                                    color: #66b3ff;
                                    padding: 6px 10px;
                                    border-radius: 12px;
                                    font-size: 11px;
                                    font-weight: 500;
                                    transition: all ${Config.get("animSpeed")}s cubic-bezier(0.34, 1.56, 0.64, 1);
                                }
                                .r34-tag-chip:hover {
                                    background: linear-gradient(135deg, rgba(102,179,255,0.3), rgba(102,179,255,0.2));
                                    border-color: rgba(102,179,255,0.5);
                                    transform: scale(0.975);
                                }
                                .r34-tag-remove {
                                    margin-left: 6px;
                                    cursor: pointer;
                                    color: #66b3ff;
                                    font-weight: bold;
                                    opacity: 0.7;
                                    transition: all ${Config.get("animSpeed")}s cubic-bezier(0.34, 1.56, 0.64, 1);
                                }
                                .r34-tag-remove:hover { opacity: 1; transform: scale(1.2); }

                                .r34-import-export-content { max-height: 0; overflow: hidden; transition: max-height ${Config.get("animSpeed")}s cubic-bezier(0.34, 1.56, 0.64, 1); padding: 0 12px; }
                                .r34-import-export-content.open { max-height: 240px; padding: 8px 12px 12px; }
                                .r34-btn-orange {
                                    width: 100%;
                                    max-width: 220px;
                                    padding: 9px 12px;
                                    background: linear-gradient(135deg, rgba(255,160,64,0.12), rgba(255,140,40,0.08));
                                    border: 1px solid rgba(255,140,40,0.28);
                                    border-radius: 8px;
                                    color: #ffb266;
                                    cursor: pointer;
                                    font-size: 13px;
                                    font-weight: 600;
                                    transition: all ${Config.get("animSpeed")}s cubic-bezier(0.34, 1.56, 0.64, 1);
                                    text-align: center;
                                }
                                .r34-btn-orange:hover {
                                    transform: translateY(-2px);
                                    background: linear-gradient(135deg, rgba(255,160,64,0.18), rgba(255,140,40,0.14));
                                    color: #fff;
                                    box-shadow: 0 8px 20px rgba(255,140,40,0.08);
                                }

                                #r34-hidden-counter {
                                    position: fixed;
                                    top: 10px;
                                    right: 10px;
                                    font-size: 12px;
                                    color: #fff;
                                    z-index: 9999;
                                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                                    text-align: right;
                                    line-height: 1.6;
                                    font-weight: 500;
                                    text-shadow: 0 2px 8px rgba(0,0,0,0.5);
                                }

                                .thumb.r34-filtered { display: none !important; }
                                #r34-custom-grid {
                                    display: grid;
                                    grid-template-columns: repeat(8, 1fr);
                                    gap: 6px;
                                    padding: 6px;
                                    width: 100%;
                                    box-sizing: border-box;
                                }
                                #r34-custom-grid .thumb {
                                    width: 100%;
                                    height: 90px;
                                    background: #111;
                                    border-radius: 4px;
                                    overflow: hidden;
                                    position: relative;
                                }
                                #r34-custom-grid .thumb img {
                                    width: 100%;
                                    height: 100%;
                                    object-fit: cover;
                                    transition: transform ${Config.get("animSpeed")}s cubic-bezier(0.34, 1.56, 0.64, 1);
                                    border-radius: 4px;
                                }

                                .r34-original-overlay {
                                    position: fixed;
                                    inset: 0;
                                    background: rgba(0,0,0,0.85);
                                    z-index: 9998;
                                    opacity: 0;
                                    transition: opacity ${Config.get("animSpeed")}s cubic-bezier(0.34, 1.56, 0.64, 1);
                                    pointer-events: auto;
                                }
                                .r34-original-overlay.closing {
                                    pointer-events: none;
                                }

                                .thumb.r34-hidden-thumb img { opacity: 0; }
                                .r34-hidden-label {
                                    position: absolute;
                                    top: 50%;
                                    left: 50%;
                                    transform: translate(-50%, -50%);
                                    color: #fff;
                                    font-weight: 600;
                                    font-size: 11px;
                                    text-shadow: 0 2px 8px rgba(0,0,0,0.8);
                                    pointer-events: none;
                                    z-index: 10;
                                }

                                #r34-copyright-notice {
                                    padding: 12px;
                                    background: rgba(255, 136, 187, 0.08);
                                    border: 1px solid rgba(255, 136, 187, 0.2);
                                    border-radius: 10px;
                                }
                                .r34-copyright-tags {
                                    display: flex;
                                    flex-wrap: wrap;
                                    justify-content: center;
                                    gap: 6px;
                                }
                                .r34-copyright-tag-chip {
                                    background: rgba(255, 136, 187, 0.15);
                                    border: 1px solid rgba(255, 136, 187, 0.3);
                                    color: #ff88bb;
                                    padding: 5px 9px;
                                    border-radius: 12px;
                                    font-size: 10px;
                                    font-weight: 500;
                                }

                                /* Custom paginator */
                                #paginator {
                                    margin: 20px 0;
                                }
                                #paginator .pagination {
                                    display: flex;
                                    justify-content: center;
                                    align-items: center;
                                    gap: 20px;
                                    font-size: 16px;
                                    font-weight: bold;
                                    color: #fff;
                                }
                                #paginator a {
                                    color: #66b3ff;
                                    text-decoration: none;
                                    font-size: 20px;
                                    padding: 8px 12px;
                                    border-radius: 6px;
                                    transition: background ${Config.get("animSpeed")}s cubic-bezier(0.34, 1.56, 0.64, 1);
                                }
                                #paginator a:hover {
                                    background: rgba(102, 179, 255, 0.2);
                                }
                                #paginator span {
                                    min-width: 120px;
                                    text-align: center;
                                }
                                #paginator input[type="text"] {
                                    width: 80px;
                                    padding: 6px 10px;
                                    background: rgba(0,0,0,0.5);
                                    border: 1px solid rgba(255,255,255,0.2);
                                    border-radius: 6px;
                                    color: #fff;
                                    text-align: center;
                                    font-size: 14px;
                                }
                                #paginator input[type="text"]::placeholder {
                                    color: #aaa;
                                }

                                /* Close button (from v2.5) */
                                #r34-close {
                                    position: fixed;
                                    top: 10px;
                                    right: 10px;
                                    z-index: 10001;
                                    background: rgba(0,0,0,0.6);
                                    color: #fff;
                                    border: none;
                                    padding: 8px 10px;
                                    border-radius: 8px;
                                    cursor: pointer;
                                    font-size: 15px;
                                    box-shadow: 0 6px 20px rgba(0,0,0,0.6);
                                    opacity: 0;
                                    display: none;
                                    transition: all ${Config.get("animSpeed")}s cubic-bezier(0.34, 1.56, 0.64, 1);
                                    user-select: none;
                                }
                                #r34-close.active {
                                    display: block;
                                    opacity: 1;
                                }
                                #r34-close:hover {
                                    transform: scale(1.06);
                                }
                                /* Page input: ~0.75x scale (about 0.25x smaller), fully rounded pill */
                #paginator input[type="text"] {
                    width: 64px;
                    padding: 4px 6px;
                    background: rgba(0,0,0,0.5);
                    border: 1px solid rgba(255,255,255,0.2);
                    border-radius: 9999px;
                    color: #fff;
                    text-align: center;
                    font-size: 13px;
                    transform: scale(0.75);
                    transform-origin: center;
                }

                /* FIX 2: Disable ALL thumbnail hover effects (including video thumbs) while dragging modal */
                body.dragging #r34-custom-grid .thumb {
                    transform: scale(1) !important;
                    z-index: 1 !important;
                    transition: none !important;
                    pointer-events: none !important;
                }
                body.dragging #r34-custom-grid .thumb.r34-video-thumb {
                    box-shadow: none !important;
                }
                body.dragging #r34-custom-grid .thumb .video-pulse-ring {
                    animation-play-state: paused !important;
                    opacity: 0 !important;
                }
            `;
            document.head.appendChild(style);
        }

        /* ==================== MODAL WITH DRAG OVERLAY ==================== */
        createModal() {
            return safeExec(async () => {
                const modal = document.createElement("div");
                modal.id = "r34-filter-modal";
                modal.innerHTML = `
                <div id="r34-filter-header">
                    <div id="r34-filter-title">Manager</div>
                    <div id="r34-filter-toggle">▼</div>
                </div>
                <div id="r34-filter-content">
                    <div class="r34-section">
                        <div class="r34-input-group">
                            <input type="text" id="r34-tag-input" placeholder="Add filter tag...">
                            <div id="r34-autocomplete"></div>
                        </div>
                    </div>
                    <div class="r34-section">
                        <button class="r34-btn" id="r34-clear-filters">Clear Filters</button>
                    </div>
                    <div class="r34-section" id="r34-primary-actions"></div>
                    <div class="r34-section" id="r34-filters-section" style="display: none;">
                        <div class="r34-section-header" id="r34-filters-header">
                            <div class="r34-section-title blue">Filters</div>
                            <div class="r34-section-toggle">▼</div>
                        </div>
                        <div class="r34-section-content" id="r34-filters-content">
                            <div id="r34-active-tags"></div>
                        </div>
                    </div>
                    <div id="r34-copyright-container"></div>
                </div>
            `;
                document.body.appendChild(modal);

                const header = modal.querySelector("#r34-filter-header");
                const content = modal.querySelector("#r34-filter-content");
                const toggle = modal.querySelector("#r34-filter-toggle");

                // Position & optimized dragging (RAF + body.dragging class)
                const savedPos = Storage.get("modalPosition", { top: 10, left: 10 });
                modal.style.top = savedPos.top + "px";
                modal.style.left = savedPos.left + "px";

                let isDragging = false;
                let dragStartX, dragStartY, modalStartX, modalStartY;
                let rafId = null;
                let dragOverlay = null;

                const createDragOverlay = () => {
                    if (dragOverlay) return;
                    dragOverlay = document.createElement("div");
                    dragOverlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9997;opacity:0;transition:opacity ${Config.get("animSpeed")}s cubic-bezier(0.34, 1.56, 0.64, 1);pointer-events:none;`;
                    document.body.appendChild(dragOverlay);
                    requestAnimationFrame(() => dragOverlay.style.opacity = "1");
                };

                const removeDragOverlay = () => {
                    if (!dragOverlay) return;
                    dragOverlay.style.opacity = "0";
                    setTimeout(() => { dragOverlay.remove(); dragOverlay = null; }, 200);
                };

                header.addEventListener("mousedown", (e) => {
                    if (e.target === toggle) return;
                    isDragging = true;
                    document.body.classList.add("dragging");   // ← disables thumb hovers
                    dragStartX = e.clientX; dragStartY = e.clientY;
                    const rect = modal.getBoundingClientRect();
                    modalStartX = rect.left; modalStartY = rect.top;
                    createDragOverlay();
                    e.preventDefault();
                });

                document.addEventListener("mousemove", (e) => {
                    if (!isDragging) return;
                    if (rafId) cancelAnimationFrame(rafId);
                    rafId = requestAnimationFrame(() => {
                        const deltaX = e.clientX - dragStartX;
                        const deltaY = e.clientY - dragStartY;
                        let newLeft = Math.max(0, Math.min(modalStartX + deltaX, window.innerWidth - modal.offsetWidth));
                        let newTop  = Math.max(0, Math.min(modalStartY + deltaY, window.innerHeight - modal.offsetHeight));
                        modal.style.left = newLeft + "px";
                        modal.style.top  = newTop + "px";
                    });
                });

                document.addEventListener("mouseup", () => {
                    if (isDragging) {
                        isDragging = false;
                        document.body.classList.remove("dragging");
                        if (rafId) cancelAnimationFrame(rafId);
                        Storage.set("modalPosition", {
                            top: parseInt(modal.style.top),
                            left: parseInt(modal.style.left),
                        });
                        removeDragOverlay();
                    }
                });

                // Collapse logic (unchanged)
                toggle.addEventListener("click", (e) => {
                    e.stopPropagation();
                    content.classList.toggle("collapsed");
                    toggle.classList.toggle("collapsed");
                    Storage.set("modalCollapsed", content.classList.contains("collapsed"));
                    setTimeout(() => this.adjustModalPosition(modal), 300);
                });

                const isCollapsed = Storage.get("modalCollapsed", false);
                if (isCollapsed) {
                    content.classList.add("collapsed");
                    toggle.classList.add("collapsed");
                }

                // Filters collapse
                const filtersHeader = modal.querySelector("#r34-filters-header");
                const filtersContent = modal.querySelector("#r34-filters-content");
                const filtersToggle = filtersHeader.querySelector(".r34-section-toggle");
                const filtersCollapsed = Storage.get("filtersCollapsed", false);
                if (filtersCollapsed) {
                    filtersContent.classList.add("collapsed");
                    filtersToggle.classList.add("collapsed");
                }
                filtersHeader.addEventListener("click", () => {
                    filtersContent.classList.toggle("collapsed");
                    filtersToggle.classList.toggle("collapsed");
                    Storage.set(
                        "filtersCollapsed",
                        filtersContent.classList.contains("collapsed"),
                    );
                    setTimeout(() => this.adjustModalPosition(modal), 300);
                });

                // Autocomplete with auto-apply on click or Enter
                const input = modal.querySelector("#r34-tag-input");
                const autocompleteContainer = modal.querySelector("#r34-autocomplete");
                this.autoComplete = new AutoComplete(input, autocompleteContainer, this.blacklistManager);

                const applyTag = (tag) => {
                    if (tag && !this.blacklistManager.isBlacklisted(tag)) {
                        this.addTag(tag);
                    }
                };

                input.addEventListener("input", (e) => {
                    const suggestions = this.autoComplete.search(e.target.value.trim());
                    this.autoComplete.show(suggestions);
                });

                input.addEventListener("keydown", (e) => {
                    if (e.key === "ArrowDown") {
                        e.preventDefault(); this.autoComplete.navigate("down");
                    } else if (e.key === "ArrowUp") {
                        e.preventDefault(); this.autoComplete.navigate("up");
                    } else if (e.key === "Enter") {
                        e.preventDefault();
                        const result = this.autoComplete.select();
                        if (result === "blacklisted") {
                            alert("⚠️ This tag is in your blacklist and cannot be added.");
                        } else if (result) {
                            applyTag(result);
                        } else if (input.value.trim()) {
                            applyTag(input.value.trim());
                        }
                    } else if (e.key === "Escape") {
                        this.autoComplete.hide();
                    }
                });

                // Click on suggestion → auto-apply
                const originalShow = this.autoComplete.show.bind(this.autoComplete);
                this.autoComplete.show = function(suggestions) {
                    originalShow(suggestions);
                    this.container.querySelectorAll(".autocomplete-item").forEach(item => {
                        item.addEventListener("click", () => {
                            const tag = item.textContent;
                            applyTag(tag);
                        });
                    });
                };

                input.addEventListener("blur", () => setTimeout(() => this.autoComplete.hide(), 200));

                // Clear button
                modal
                    .querySelector("#r34-clear-filters")
                    .addEventListener("click", () => {
                    this.filterManager.activeTags = [];
                    this.filterManager.save();
                    this.renderActiveTags();
                    this.applyFilters();
                });

                this.renderActiveTags();
                this.adjustModalPosition(modal);
            }, "UIManager.createModal");
        }

        renderActiveTags() {
            const container = document.querySelector("#r34-active-tags");
            if (!container) return;
            container.innerHTML = "";

            const tags = this.filterManager.activeTags;
            const filtersSection = document.getElementById("r34-filters-section");

            if (filtersSection) {
                filtersSection.style.display = tags.length ? "block" : "none";
            }
            if (!tags.length) return;

            const wrapper = document.createElement("div");
            wrapper.id = "r34-section-border-tags";
            tags.forEach((tag) => {
                const chip = document.createElement("div");
                chip.className = "r34-tag-chip";
                chip.innerHTML = `<span>${tag}</span><span class="r34-tag-remove" data-tag="${tag}">✖</span>`;
                chip.querySelector(".r34-tag-remove").addEventListener("click", (e) => {
                    e.stopPropagation();
                    this.filterManager.removeTag(tag);
                    this.renderActiveTags();
                    this.applyFilters();
                });
                wrapper.appendChild(chip);
            });

            container.appendChild(wrapper);
        }

        /* ==================== CUSTOM PAGINATOR WITH NUMBER-ONLY INPUT ==================== */
        customizePaginator() {
            return safeExec(async () => {
                const paginator = document.querySelector("#paginator");
                if (!paginator) return;

                const pagination = paginator.querySelector(".pagination");
                if (!pagination) return;

                // Find navigation links
                const links = Array.from(pagination.querySelectorAll("a"));
                let prevLink = null;
                let nextLink = null;
                let lastLink = null;

                links.forEach((a) => {
                    const text = a.textContent.trim();
                    const alt = (a.getAttribute("alt") || "").toLowerCase();
                    if (text === "<" || alt === "back") prevLink = a;
                    if (text === ">" || alt === "next") nextLink = a;
                    if (text === ">>" || alt === "last page") lastLink = a;
                });

                // Remove everything except prev/next/last
                pagination.querySelectorAll("*").forEach((el) => {
                    if (el !== prevLink && el !== nextLink && el !== lastLink) el.remove();
                });

                // Hide last link (but keep for calculation)
                if (lastLink) lastLink.style.display = "none";

                // Calculate current and last page
                const params = new URLSearchParams(location.search);
                const currentPid = parseInt(params.get("pid") || "0", 10);
                const postsPerPage = 42;
                const currentPage = Math.floor(currentPid / postsPerPage) + 1;

                let lastPage = null;
                if (lastLink && lastLink.href) {
                    const lastParams = new URLSearchParams(new URL(lastLink.href).search);
                    const lastPid = parseInt(lastParams.get("pid") || "0", 10);
                    lastPage = Math.floor(lastPid / postsPerPage) + 1;
                }

                // Build new paginator
                const container = document.createElement("div");
                container.style.display = "flex";
                container.style.alignItems = "center";
                container.style.gap = "20px";

                // Prev
                if (prevLink) {
                    container.appendChild(prevLink);
                }

                // Page display
                const pageText = document.createElement("span");
                pageText.textContent = `Page ${currentPage}${lastPage !== null ? ` / ${lastPage}` : ""}`;
                container.appendChild(pageText);

                // Next
                if (nextLink) {
                    container.appendChild(nextLink);
                }

                const jumpInput = document.createElement("input");
                jumpInput.type = "text";
                jumpInput.placeholder = "page";
                jumpInput.addEventListener("input", (e) => {
                    e.target.value = e.target.value.replace(/[^0-9]/g, "");
                });

                // Manual page jump
                const jumpForm = document.createElement("form");
                jumpForm.style.display = "inline";
                jumpForm.addEventListener("submit", (e) => {
                    e.preventDefault();
                    const input = jumpForm.querySelector("input");
                    let targetPage = parseInt(input.value, 10);
                    if (isNaN(targetPage) || targetPage < 1) return;

                    if (lastPage !== null && targetPage > lastPage) {
                        targetPage = lastPage;
                    }

                    const targetPid = postsPerPage * (targetPage - 1);
                    const newUrl = new URL(location.href);
                    newUrl.searchParams.set("pid", targetPid);
                    location.href = newUrl.toString();
                });

                jumpForm.appendChild(jumpInput);

                container.appendChild(jumpForm);

                pagination.innerHTML = "";
                pagination.appendChild(container);
            }, "UIManager.customizePaginator");
        }

        createImportExportSection() {
            const container = document.querySelector("#r34-filter-content");
            if (!container) return;

            const section = document.createElement("div");
            section.className = "r34-section";

            const header = document.createElement("div");
            header.className = "r34-section-header";

            const title = document.createElement("div");
            title.className = "r34-section-title orange";
            title.textContent = "Data";

            const toggle = document.createElement("div");
            toggle.className = "r34-section-toggle collapsed";
            toggle.textContent = "▼";

            const content = document.createElement("div");
            content.className = "r34-import-export-content";

            const border = document.createElement("div");
            border.id = "r34-section-border";

            const exportBtn = document.createElement("button");
            exportBtn.className = "r34-btn-orange";
            exportBtn.textContent = "Export Hidden Uploads";
            exportBtn.addEventListener("click", () => {
                const data = { hiddenThumbs: this.filterManager.hiddenThumbs };
                const blob = new Blob([JSON.stringify(data, null, 2)], {
                    type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "hidden_thumbs.json";
                a.click();
                setTimeout(() => {
                    a.remove();
                    URL.revokeObjectURL(url);
                }, 300);
            });

            const importBtn = document.createElement("button");
            importBtn.className = "r34-btn-orange";
            importBtn.textContent = "Import Hidden Uploads";
            importBtn.addEventListener("click", () => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "application/json";
                input.addEventListener("change", (ev) => {
                    const file = ev.target.files[0];
                    if (!file) return;

                    const reader = new FileReader();
                    reader.onload = () => {
                        try {
                            const parsed = JSON.parse(reader.result);

                            if (!parsed || !Array.isArray(parsed.hiddenThumbs)) {
                                throw new Error("Invalid file structure");
                            }

                            this.filterManager.hiddenThumbs = parsed.hiddenThumbs;
                            this.filterManager.save();
                            this.applyHiddenStates();
                            this.updateHiddenCounter();
                            alert("✅ Import successful — hidden uploads updated.");

                        } catch (err) {
                            console.error("Import error:", err);
                            alert("❌ Failed to import file.\n\n" +
                                  "Make sure you're importing a valid 'hidden_thumbs.json' file\n" +
                                  "that was exported from this exact script.");
                        }
                    };
                    reader.readAsText(file);
                });
                input.click();
            });

            border.append(exportBtn, importBtn);
            content.appendChild(border);

            header.append(title, toggle);
            section.append(header, content);

            container.appendChild(section);

            header.addEventListener("click", () => {
                const opened = content.classList.toggle("open");
                toggle.classList.toggle("collapsed", !opened);
                setTimeout(
                    () =>
                    this.adjustModalPosition(
                        document.getElementById("r34-filter-modal"),
                    ),
                    300,
                );
            });
        }

        createHiddenCounter() {
            const counter = document.createElement("div");
            counter.id = "r34-hidden-counter";
            counter.innerHTML = `
    <div class="r34-counter-line">Total: <span id="r34-counter-total">0</span></div>
    <div class="r34-counter-line">Page: <span id="r34-counter-current">0</span></div>
        `;
            document.body.appendChild(counter);
        }

        updateHiddenCounter() {
            const total = this.filterManager.hiddenThumbs.length;
            let pageHidden = 0;
            document.querySelectorAll(".thumb").forEach((thumb, i) => {
                const link = thumb.querySelector("a");
                const id = link?.href || `thumb-${i}`;
                if (this.filterManager.isHidden(id)) pageHidden++;
            });
            document.getElementById("r34-counter-total").textContent = total;
            document.getElementById("r34-counter-current").textContent = pageHidden;
        }

        createCustomGrid() {
            const thumbs = document.querySelectorAll(".thumb");
            if (!thumbs.length) return;
            const grid = document.createElement("div");
            grid.id = "r34-custom-grid";
            const parent = thumbs[0].parentElement;
            thumbs.forEach((t) => grid.appendChild(t));
            if (parent) {
                parent.innerHTML = "";
                parent.appendChild(grid);
            }
        }

        movePaginator() {
    const paginator = document.querySelector("#paginator");
    const content = document.querySelector("#content");
    if (paginator && content && content.parentNode) {
        content.parentNode.insertBefore(paginator, content);
        const submit = paginator.querySelector('input[type="submit"]');
        if (submit) submit.remove();
    } else {
        console.warn("[R34 Manager] Paginator or content not found - skipping move");
    }
}

        adjustModalPosition(modal) {
            if (!modal) return;
            const rect = modal.getBoundingClientRect();
            if (rect.bottom > window.innerHeight) {
                const overflow = rect.bottom - window.innerHeight;
                const newTop = Math.max(
                    10,
                    parseInt(modal.style.top || 10) - overflow - 12,
                );
                modal.style.top = newTop + "px";
                setTimeout(
                    () =>
                    Storage.set("modalPosition", {
                        top: parseInt(modal.style.top),
                        left: parseInt(modal.style.left || 10),
                    }),
                    340,
                );
            }
        }

        addTag(tag) {
            if (this.filterManager.addTag(tag)) {
                document.querySelector("#r34-tag-input").value = "";
                this.renderActiveTags();
                this.applyFilters();
            }
        }

        detectCopyrightTags() {
            return safeExec(async () => {
                const copyrightContainer = document.querySelector(
                    "#r34-copyright-container",
                );
                if (copyrightContainer) copyrightContainer.innerHTML = "";

                const primaryActions = document.getElementById("r34-primary-actions");
                if (primaryActions) primaryActions.style.display = "none";

                const copyrightTags = [];
                document.querySelectorAll('a[href*="page=post"]').forEach((link) => {
                    const color = window.getComputedStyle(link).color;
                    if (color === "rgb(240, 160, 240)" || color === "#f0a0f0") {
                        const tag = link.textContent.trim();
                        if (tag && !copyrightTags.includes(tag)) copyrightTags.push(tag);
                    }
                });

                if (copyrightTags.length === 0) return;

                const current = this.getCurrentUrlTags();
                const missing = copyrightTags.filter(
                    (t) => !current.includes(t.toLowerCase().replace(/ /g, "_")),
                );
                if (missing.length === 0) return;

                primaryActions.style.display = "flex";
                primaryActions.innerHTML = "";
                const applyBtn = document.createElement("button");
                applyBtn.className = "r34-btn";
                applyBtn.textContent = "Apply Primary Filters";
                applyBtn.addEventListener("click", () =>
                                          this.applyCopyrightTags(copyrightTags),
                                         );
                primaryActions.appendChild(applyBtn);

                const section = document.createElement("div");
                section.className = "r34-section";

                const header = document.createElement("div");
                header.className = "r34-section-header";

                const title = document.createElement("div");
                title.className = "r34-section-title pink";
                title.textContent = "Primary";

                const toggle = document.createElement("div");
                toggle.className = "r34-section-toggle";
                toggle.textContent = "▼";

                const content = document.createElement("div");
                content.className = "r34-section-content";

                const notice = document.createElement("div");
                notice.id = "r34-copyright-notice";

                const tagsDiv = document.createElement("div");
                tagsDiv.className = "r34-copyright-tags";
                copyrightTags.forEach((tag) => {
                    const chip = document.createElement("span");
                    chip.className = "r34-copyright-tag-chip";
                    chip.textContent = tag;
                    tagsDiv.appendChild(chip);
                });
                notice.appendChild(tagsDiv);
                content.appendChild(notice);

                header.append(title, toggle);
                section.append(header, content);
                copyrightContainer.appendChild(section);

                const collapsed = Storage.get("copyrightCollapsed", false);
                if (collapsed) {
                    content.classList.add("collapsed");
                    toggle.classList.add("collapsed");
                }

                header.addEventListener("click", () => {
                    content.classList.toggle("collapsed");
                    toggle.classList.toggle("collapsed");
                    Storage.set(
                        "copyrightCollapsed",
                        content.classList.contains("collapsed"),
                    );
                    setTimeout(
                        () =>
                        this.adjustModalPosition(
                            document.getElementById("r34-filter-modal"),
                        ),
                        300,
                    );
                });
            }, "UIManager.detectCopyrightTags");
        }

        getCurrentUrlTags() {
            const match = window.location.search.match(/[?&]tags=([^&]*)/);
            if (!match) return [];
            return match[1]
                .split("+")
                .map((t) => decodeURIComponent(t).toLowerCase().trim())
                .filter(Boolean);
        }

        applyCopyrightTags(tags) {
            const current = this.getCurrentUrlTags();
            const normalized = tags.map((t) => t.toLowerCase().replace(/ /g, "_"));
            const all = [...new Set([...current, ...normalized])];
            const newUrl = `${window.location.origin}${window.location.pathname}?page=post&s=list&tags=${all.map(encodeURIComponent).join("+")}&pid=0`;
            window.location.href = newUrl;
        }

        applyHiddenState(thumb, thumbId) {
            const hidden = this.filterManager.isHidden(thumbId);
            thumb.classList.toggle("r34-hidden-thumb", hidden);
            let label = thumb.querySelector(".r34-hidden-label");
            if (hidden && !label) {
                label = document.createElement("div");
                label.className = "r34-hidden-label";
                label.textContent = "Hidden";
                thumb.appendChild(label);
            } else if (!hidden && label) {
                label.remove();
            }
            this.updateHiddenCounter();
        }

        applyHiddenStates() {
            document.querySelectorAll(".thumb").forEach((thumb, i) => {
                const link = thumb.querySelector("a");
                const id = link?.href || `thumb-${i}`;
                this.applyHiddenState(thumb, id);
            });
        }

        applyFilters() {
            return safeExec(async () => {
                document.querySelectorAll(".thumb").forEach((thumb) => {
                    const img = thumb.querySelector("img");
                    if (!img) return;
                    const matches = this.filterManager.matchesTags(img.getAttribute("alt"));
                    thumb.classList.toggle("r34-filtered", !matches);
                });

                // NEW: auto-skip empty filtered pages
                this.autoAdvanceIfNoMatches();
            }, "UIManager.applyFilters");
        }

        autoAdvanceIfNoMatches() {
            return safeExec(async () => {
                if (this.filterManager.activeTags.length === 0) return;

                const grid = document.getElementById("r34-custom-grid");
                if (!grid) return;

                const hasAnyMatches = grid.querySelectorAll('.thumb:not(.r34-filtered)').length > 0;

                if (!hasAnyMatches) {
                    try {
                        const url = new URL(window.location.href);
                        const currentPid = parseInt(url.searchParams.get("pid") || "0", 10);
                        const nextPid = currentPid + 42;

                        url.searchParams.set("pid", nextPid.toString());

                        console.info(`[R34 Manager] No matches for active filters (pid=${currentPid}). Auto-advancing to pid=${nextPid}...`);

                        // Brief pause so you see the empty page flash (great UX feedback)
                        setTimeout(() => {
                            window.location.href = url.toString();
                        }, 720);
                    } catch (e) {
                        console.error("[R34 Manager] Auto-advance error:", e);
                    }
                }
            }, "autoAdvanceIfNoMatches");
        }

        setupInfiniteScroll() {
            if (!Config.get("infiniteScroll")) return;

            const grid = document.getElementById("r34-custom-grid");
            if (!grid) return;

            let loading = false;
            const observer = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting && !loading) {
                    loading = true;
                    const url = new URL(window.location.href);
                    let pid = parseInt(url.searchParams.get("pid") || "0", 10) + 42;
                    url.searchParams.set("pid", pid);

                    GM_xmlhttpRequest({
                        method: "GET",
                        url: url.toString(),
                        onload: (res) => {
                            if (res.status !== 200) return;
                            const tempDiv = document.createElement("div");
                            tempDiv.innerHTML = res.responseText;
                            const newThumbs = tempDiv.querySelectorAll(".thumb");
                            if (newThumbs.length) {
                                newThumbs.forEach(t => grid.appendChild(t));
                                this.applyFilters();
                                this.applyHiddenStates();
                                this.setupThumbnailHandlers(); // crucial: re-attach hold/preview listeners
                            }
                            loading = false;
                        },
                        onerror: () => loading = false
                    });
                }
            }, { threshold: 0.8, rootMargin: "300px" }); // more tolerant for fast scroll

            const sentinel = document.createElement("div");
            sentinel.style.height = "40px";
            grid.appendChild(sentinel);
            observer.observe(sentinel);
        }

        createCloseButton() {
            const btn = document.createElement("button");
            btn.id = "r34-close";
            btn.textContent = "✕";
            btn.title = "Close preview (Esc)";
            document.body.appendChild(btn);
            this._closeButton = btn;
        }
    }
    
    window.R34UIManager = UIManager;
})();
