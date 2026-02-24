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

    class BlacklistManager {
        constructor() {
            this.blacklistedTags = new Set();
            this.loaded = false;
        }

        async fetchBlacklist() {
            return safeExec(async () => {
                return new Promise((resolve) => {
                    GM_xmlhttpRequest({
                        method: "GET",
                        url: "https://rule34.xxx/index.php?page=account&s=options",
                        onload: (response) => {
                            try {
                                const parser = new DOMParser();
                                const doc = parser.parseFromString(
                                    response.responseText,
                                    "text/html",
                                );
                                const textarea = doc.querySelector("textarea#tags");
                                if (textarea) {
                                    textarea.value
                                        .split(/\s+/)
                                        .map((t) => t.trim().toLowerCase())
                                        .filter((t) => t)
                                        .forEach((t) => this.blacklistedTags.add(t));
                                }
                            } catch (e) {
                                console.error("Blacklist parse error:", e);
                            } finally {
                                this.loaded = true;
                                resolve(this.blacklistedTags);
                            }
                        },
                        onerror: () => {
                            this.loaded = true;
                            resolve(this.blacklistedTags);
                        },
                    });
                });
            }, "BlacklistManager.fetchBlacklist");
        }

        isBlacklisted(tag) {
            return this.blacklistedTags.has(tag.toLowerCase());
        }
    }
    class FilterManager {
        constructor() {
            this.activeTags = Storage.get("activeTags", []);
            this.hiddenThumbs = Storage.get("hiddenThumbs", []);
        }

        addTag(tag) {
            tag = tag.toLowerCase().trim();
            if (!tag || this.activeTags.includes(tag)) return false;
            this.activeTags.push(tag);
            this.save();
            return true;
        }

        removeTag(tag) {
            const i = this.activeTags.indexOf(tag);
            if (i === -1) return false;
            this.activeTags.splice(i, 1);
            this.save();
            return true;
        }

        toggleHidden(thumbId) {
            const i = this.hiddenThumbs.indexOf(thumbId);
            if (i === -1) this.hiddenThumbs.push(thumbId);
            else this.hiddenThumbs.splice(i, 1);
            this.save();
        }

        isHidden(thumbId) {
            return this.hiddenThumbs.includes(thumbId);
        }

        save() {
            Storage.set("activeTags", this.activeTags);
            Storage.set("hiddenThumbs", this.hiddenThumbs);
        }

        matchesTags(altText) {
            return safeExec(() => {  // ← sync, no async
                if (!this.activeTags.length) return true;
                const thumbTags = (altText || "").toLowerCase().split(" ").filter(Boolean);

                return this.activeTags.every(filterTag => {
                    if (filterTag.startsWith("/")) {
                        try {
                            const regex = new RegExp(filterTag.slice(1, -1), "i");
                            return thumbTags.some(t => regex.test(t));
                        } catch (e) { return false; }
                    }
                    if (filterTag.includes("|")) {
                        const orTags = filterTag.split("|").map(t => t.trim());
                        return orTags.some(ot => thumbTags.some(t => t.includes(ot)));
                    }
                    return thumbTags.some(t => t.includes(filterTag));
                });
            }, "FilterManager.matchesTags");
        }
    }
    class AutoComplete {
        constructor(input, container, blacklistManager) {
            this.input = input;
            this.container = container;
            this.blacklistManager = blacklistManager;
            this.suggestions = [];
            this.selectedIndex = -1;
        }

        search(query) {
            if (!query) return [];
            const lower = query.toLowerCase();
            return Array.from(tagDatabase)
                .filter((tag) => tag.includes(lower))
                .sort((a, b) => {
                const aStarts = a.startsWith(lower);
                const bStarts = b.startsWith(lower);
                if (aStarts !== bStarts) return aStarts ? -1 : 1;
                return a.localeCompare(b);
            })
                .slice(0, 10);
        }

        show(suggestions) {
            this.suggestions = suggestions;
            this.selectedIndex = -1;
            this.container.innerHTML = "";
            if (!suggestions.length) {
                this.container.style.display = "none";
                return;
            }

            suggestions.forEach((tag, i) => {
                const item = document.createElement("div");
                item.className = "autocomplete-item";
                if (this.blacklistManager.isBlacklisted(tag)) {
                    item.classList.add("blacklisted");
                }
                item.textContent = tag;
                item.addEventListener("click", () => this.select(tag));
                item.addEventListener("mouseenter", () => {
                    this.selectedIndex = i;
                    this.updateSelection();
                });
                this.container.appendChild(item);
            });

            this.container.style.display = "block";
            this.updateSelection();
        }

        hide() {
            this.container.style.display = "none";
            this.suggestions = [];
            this.selectedIndex = -1;
        }

        updateSelection() {
            this.container.querySelectorAll(".autocomplete-item").forEach((el, i) => {
                el.classList.toggle("selected", i === this.selectedIndex);
            });
        }

        navigate(dir) {
            if (!this.suggestions.length) return;
            if (dir === "down") {
                this.selectedIndex = (this.selectedIndex + 1) % this.suggestions.length;
            } else {
                this.selectedIndex =
                    this.selectedIndex <= 0
                    ? this.suggestions.length - 1
                : this.selectedIndex - 1;
            }
            this.updateSelection();
        }

        select(tag) {
            if (tag === undefined && this.selectedIndex >= 0) {
                tag = this.suggestions[this.selectedIndex];
            }
            if (!tag) return null;
            if (this.blacklistManager.isBlacklisted(tag)) return "blacklisted";
            this.input.value = tag;
            this.hide();
            return tag;
        }
    }
        const tagDatabase = new Set();

    function buildTagDatabase() {
        return safeExec(async () => {
            document.querySelectorAll(".thumb img").forEach((img) => {
                const alt = img.getAttribute("alt") || "";
                alt
                    .split(" ")
                    .map((t) => t.trim().toLowerCase())
                    .filter((t) => t)
                    .forEach((t) => tagDatabase.add(t));
            });
        }, "buildTagDatabase");
    }
    
    // Expose
    window.R34BlacklistManager = BlacklistManager;
    window.R34FilterManager = FilterManager;
    window.R34AutoComplete = AutoComplete;
    window.R34BuildTagDatabase = buildTagDatabase;
})();
