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

    setupThumbnailHandlers() {
            return safeExec(async () => {
                const active = this._activeDisplay;
                let videoKeyListener = null; // for Spacebar pause/play

                const computeTargetRect = (naturalW, naturalH) => {
                    const vw = window.innerWidth, vh = window.innerHeight;
                    let w = Math.min(naturalW / 3, vw * 0.75);
                    let h = w * (naturalH / naturalW);
                    if (h > vh * 0.75) { h = vh * 0.75; w = h * (naturalW / naturalH); }
                    return { left: (vw - w) / 2, top: (vh - h) / 2, width: w, height: h };
                };

                document.querySelectorAll(".thumb").forEach((thumb, i) => {
                    const link = thumb.querySelector("a");
                    const img = thumb.querySelector("img");
                    if (!link || !img) return;
                    if (img.classList.contains("webm-thumb")) {
                        let ring = thumb.querySelector(".video-pulse-ring");
                        if (!ring) {
                            ring = document.createElement("div");
                            ring.className = "video-pulse-ring";
                            thumb.insertBefore(ring, thumb.firstChild);
                        }
                        thumb.classList.add("r34-video-thumb");
                    }
                    const thumbId = link.href || `thumb-${i}`;

                    let preventToggle = false;
                    let originalFetched = false;
                    let cachedUrl = null;
                    let cachedIsVideo = false;
                    let holdTimeout = null;
                    let countdownBadge = null;
                    let countdownInterval = null;
                    const HOLD_DELAY = Config.get("holdDelay");

                    const createBadge = () => {
                        if (countdownBadge) return;
                        const b = document.createElement("div");
                        Object.assign(b.style, {
                            position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)",
                            zIndex: "9995", pointerEvents: "none", background: "rgba(0,0,0,0.7)",
                            color: "#fff", padding: "4px 8px", borderRadius: "8px",
                            fontSize: "12px", fontWeight: "700", opacity: "0", transition: "opacity ${Config.get(\"animSpeed\")}s cubic-bezier(0.34, 1.56, 0.64, 1)"
                        });
                        thumb.style.position = "relative";
                        thumb.appendChild(b);
                        requestAnimationFrame(() => b.style.opacity = "1");
                        countdownBadge = b;
                    };

                    const removeBadge = () => {
                        if (!countdownBadge) return;
                        countdownBadge.style.opacity = "0";
                        clearInterval(countdownInterval);
                        setTimeout(() => countdownBadge?.remove(), 150);
                        countdownBadge = null;
                    };

                    const createOverlay = () => {
                        if (active.overlay) return active.overlay;
                        const ov = document.createElement("div");
                        ov.className = "r34-original-overlay";
                        document.body.appendChild(ov);
                        requestAnimationFrame(() => ov.style.opacity = "1");
                        ov.addEventListener("click", () => closePreview());
                        active.overlay = ov;
                        if (this._closeButton) {
                            this._closeButton.classList.add("active");
                            this._closeButton.onclick = () => closePreview();
                        }
                        return ov;
                    };

                    /* FIX 1: Properly remove video element so it no longer blocks clicks */
                    const closePreview = () => {
                        active.holdActivated = false;

                        // Capture local refs before clearing active state
                        const elToRemove = active.el;
                        const overlayToRemove = active.overlay;

                        // Clear active refs immediately so nothing else can touch them
                        active.el = null;
                        active.overlay = null;
                        active.thumb = null;
                        active.naturalW = active.naturalH = 0;

                        if (elToRemove) {
                            // For video: stop playback and detach src before removing from DOM
                            if (elToRemove.tagName === "VIDEO") {
                                elToRemove.pause();
                                elToRemove.removeAttribute("src");
                                elToRemove.load(); // abort any pending network requests
                            }
                            // Kill pointer events immediately so it can't block clicks even during fade
                            elToRemove.style.pointerEvents = "none";
                            elToRemove.style.opacity = "0";
                            setTimeout(() => elToRemove.remove(), 350);
                        }

                        if (overlayToRemove) {
                            overlayToRemove.classList.add("closing");
                            overlayToRemove.style.opacity = "0";
                            setTimeout(() => overlayToRemove.remove(), 300);
                        }

                        if (this._closeButton) this._closeButton.classList.remove("active");

                        // Cleanup Spacebar listener
                        if (videoKeyListener) {
                            document.removeEventListener("keydown", videoKeyListener);
                            videoKeyListener = null;
                        }
                    };

                    const showMedia = (url, isVideo) => {
                        const thumbRect = img.getBoundingClientRect();
                        createOverlay();

                        if (!isVideo) {
                            // === IMAGE PATH (unchanged, bouncy preview) ===
                            const preload = new Image();
                            preload.onload = () => {
                                const target = computeTargetRect(preload.naturalWidth, preload.naturalHeight);
                                createDisplay(preload.src, thumbRect, target, preload.naturalWidth, preload.naturalHeight, false);
                            };
                            preload.src = url;
                        } else {
                            // === VIDEO PATH ===
                            const videoEl = document.createElement("video");
                            videoEl.className = "r34-original-display-img video";
                            videoEl.src = url;
                            videoEl.controls = true;
                            videoEl.autoplay = true;
                            videoEl.loop = true;
                            videoEl.playsInline = true;
                            videoEl.muted = true;
                            videoEl.style.left = `${thumbRect.left}px`;
                            videoEl.style.top = `${thumbRect.top}px`;
                            videoEl.style.width = `${thumbRect.width}px`;
                            videoEl.style.height = `${thumbRect.height}px`;

                            document.body.appendChild(videoEl);
                            active.el = videoEl;
                            active.thumb = img;

                            videoEl.onloadedmetadata = () => {
                                const target = computeTargetRect(videoEl.videoWidth, videoEl.videoHeight);
                                requestAnimationFrame(() => {
                                    videoEl.style.opacity = "1";
                                    videoEl.style.left = `${target.left}px`;
                                    videoEl.style.top = `${target.top}px`;
                                    videoEl.style.width = `${target.width}px`;
                                    videoEl.style.height = `${target.height}px`;
                                });
                            };
                            requestAnimationFrame(() => videoEl.style.opacity = "1");
                            removeBadge();

                            // Spacebar pause/play
                            videoKeyListener = (e) => {
                                if (e.key === " " && active.el && active.el.tagName === "VIDEO") {
                                    e.preventDefault();
                                    if (active.el.paused) active.el.play();
                                    else active.el.pause();
                                }
                            };
                            document.addEventListener("keydown", videoKeyListener);
                        }
                    };

                    const createDisplay = (src, thumbRect, targetRect, w, h) => {
                        if (active.el) active.el.remove();
                        const el = document.createElement("img");
                        el.className = "r34-original-display-img";
                        el.src = src;
                        el.style.left = `${thumbRect.left}px`;
                        el.style.top = `${thumbRect.top}px`;
                        el.style.width = `${thumbRect.width}px`;
                        el.style.height = `${thumbRect.height}px`;
                        document.body.appendChild(el);
                        active.el = el;
                        active.thumb = img;
                        active.naturalW = w;
                        active.naturalH = h;

                        requestAnimationFrame(() => {
                            el.style.opacity = "1";
                            el.style.left = `${targetRect.left}px`;
                            el.style.top = `${targetRect.top}px`;
                            el.style.width = `${targetRect.width}px`;
                            el.style.height = `${targetRect.height}px`;
                        });
                        removeBadge();
                    };

                    const handleFetchError = () => {
                        if (active.holdActivated) {
                            const openPost = confirm(
                                "⚠️ Could not fetch original media (rate limit / site traffic).\n\nOpen full post page in new tab?"
                            );
                            if (openPost) window.open(link.href, "_blank");
                        }
                    };

                    // FIX 4: Hold-to-view — skip entirely if this thumb is hidden
                    thumb.addEventListener("mousedown", (e) => {
                        if (e.button !== 0 || e.ctrlKey || e.metaKey) return;

                        // FIX 4: Don't allow origin-fetch on hidden uploads
                        if (this.filterManager.isHidden(thumbId)) return;

                        if (active.el && active.thumb !== img) closePreview();

                        active.holdActivated = false;
                        preventToggle = false;

                        createBadge();
                        const start = Date.now();
                        const update = () => {
                            const elapsed = Date.now() - start;
                            if (elapsed >= HOLD_DELAY) {
                                countdownBadge.textContent = originalFetched ? "" : "Loading...";
                                return;
                            }
                            countdownBadge.textContent = (Math.max(0, HOLD_DELAY - elapsed) / 1000).toFixed(2);
                        };
                        update();
                        countdownInterval = setInterval(update, 50);

                        holdTimeout = setTimeout(() => {
                            // Set preventToggle BEFORE any async work so the click handler
                            // that fires on mouseup always sees it as true after a full hold
                            preventToggle = true;
                            active.holdActivated = true;

                            if (originalFetched && cachedUrl) {
                                removeBadge();
                                showMedia(cachedUrl, cachedIsVideo);
                                return;
                            }

                            countdownBadge.textContent = "Loading...";

                            GM_xmlhttpRequest({
                                method: "GET", url: link.href, responseType: "text",
                                onload: (resp) => {
                                    removeBadge();
                                    if (resp.status < 200 || resp.status >= 400) {
                                        handleFetchError();
                                        return;
                                    }

                                    const doc = new DOMParser().parseFromString(resp.responseText, "text/html");
                                    const origLink = Array.from(doc.querySelectorAll("a")).find(a =>
                                                                                                (a.textContent || "").trim().toLowerCase() === "original image"
                                                                                               );

                                    let url = null;
                                    let isVideo = false;

                                    if (origLink && origLink.href) {
                                        url = origLink.href;
                                        const cleanUrl = url.split('?')[0];
                                        const ext = cleanUrl.split('.').pop().toLowerCase();
                                        const videoExts = new Set(["webm", "mp4", "mov", "m4v", "avi"]);
                                        isVideo = videoExts.has(ext);
                                    }

                                    if (url) {
                                        cachedUrl = url;
                                        cachedIsVideo = isVideo;
                                        originalFetched = true;
                                        showMedia(url, isVideo);
                                    } else {
                                        handleFetchError();
                                    }
                                },
                                onerror: () => {
                                    removeBadge();
                                    handleFetchError();
                                }
                            });
                        }, HOLD_DELAY);
                    });

                    const cancelHold = () => {
                        clearTimeout(holdTimeout);
                        clearInterval(countdownInterval);
                        removeBadge();
                        if (!active.holdActivated) preventToggle = false;
                    };
                    thumb.addEventListener("mouseup", cancelHold);
                    thumb.addEventListener("mouseleave", cancelHold);

                    // Click handler — only toggles hidden; hold is fully separate
                    link.addEventListener("click", (e) => {
                        if (preventToggle) { preventToggle = false; e.preventDefault(); return; }
                        if (active.holdActivated) { e.preventDefault(); return; }
                        e.preventDefault();
                        if (e.ctrlKey || e.metaKey) {
                            window.open(link.href, "_blank");
                        } else {
                            this.filterManager.toggleHidden(thumbId);
                            this.applyHiddenState(thumb, thumbId);
                        }
                    });
                });
            }, "UIManager.setupThumbnailHandlers");
        }

    window.R34SetupThumbnailHandlers = setupThumbnailHandlers;
})();
