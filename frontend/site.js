(function () {
    const storageKey = "bb-theme";
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hasCoarsePointer = window.matchMedia("(pointer: coarse)").matches || window.navigator.maxTouchPoints > 0;
    const motionCurve = cubicBezier(0.2, 0.8, 0.2, 1);

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function cubicBezier(x1, y1, x2, y2) {
        const sampleSize = 11;
        const sampleStep = 1 / (sampleSize - 1);
        const sampleValues = new Float32Array(sampleSize);

        function A(a1, a2) {
            return 1 - 3 * a2 + 3 * a1;
        }

        function B(a1, a2) {
            return 3 * a2 - 6 * a1;
        }

        function C(a1) {
            return 3 * a1;
        }

        function calcBezier(t, a1, a2) {
            return ((A(a1, a2) * t + B(a1, a2)) * t + C(a1)) * t;
        }

        function getSlope(t, a1, a2) {
            return 3 * A(a1, a2) * t * t + 2 * B(a1, a2) * t + C(a1);
        }

        function binarySubdivide(x, a, b) {
            let currentX;
            let currentT;
            let i = 0;

            do {
                currentT = a + (b - a) / 2;
                currentX = calcBezier(currentT, x1, x2) - x;

                if (currentX > 0) {
                    b = currentT;
                } else {
                    a = currentT;
                }
            } while (Math.abs(currentX) > 1e-7 && ++i < 10);

            return currentT;
        }

        function newtonRaphsonIterate(x, guessT) {
            let i;

            for (i = 0; i < 4; i += 1) {
                const currentSlope = getSlope(guessT, x1, x2);

                if (currentSlope === 0) {
                    return guessT;
                }

                const currentX = calcBezier(guessT, x1, x2) - x;
                guessT -= currentX / currentSlope;
            }

            return guessT;
        }

        function getTForX(x) {
            let intervalStart = 0;
            let currentSample = 1;
            const lastSample = sampleSize - 1;

            for (; currentSample !== lastSample && sampleValues[currentSample] <= x; currentSample += 1) {
                intervalStart += sampleStep;
            }

            currentSample -= 1;

            const dist = (x - sampleValues[currentSample]) / (sampleValues[currentSample + 1] - sampleValues[currentSample]);
            const guessForT = intervalStart + dist * sampleStep;
            const initialSlope = getSlope(guessForT, x1, x2);

            if (initialSlope >= 0.001) {
                return newtonRaphsonIterate(x, guessForT);
            }

            if (initialSlope === 0) {
                return guessForT;
            }

            return binarySubdivide(x, intervalStart, intervalStart + sampleStep);
        }

        if (x1 === y1 && x2 === y2) {
            return function (x) {
                return x;
            };
        }

        for (let i = 0; i < sampleSize; i += 1) {
            sampleValues[i] = calcBezier(i * sampleStep, x1, x2);
        }

        return function (x) {
            if (x <= 0) {
                return 0;
            }

            if (x >= 1) {
                return 1;
            }

            return calcBezier(getTForX(x), y1, y2);
        };
    }

    function readStoredTheme() {
        try {
            return window.localStorage.getItem(storageKey);
        } catch (error) {
            return null;
        }
    }

    function writeStoredTheme(theme) {
        try {
            window.localStorage.setItem(storageKey, theme);
        } catch (error) {
            return;
        }
    }

    function getPreferredTheme() {
        const storedTheme = readStoredTheme();
        if (storedTheme === "light" || storedTheme === "dark") {
            return storedTheme;
        }

        return prefersDark.matches ? "dark" : "light";
    }

    function applyTheme(theme) {
        document.documentElement.dataset.theme = theme;

        document.querySelectorAll("[data-theme-toggle]").forEach(function (button) {
            const isDark = theme === "dark";
            button.setAttribute("aria-pressed", String(isDark));
            button.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");

            const label = button.querySelector("[data-theme-label]");
            if (label) {
                label.textContent = isDark ? "Switch to light mode" : "Switch to dark mode";
            }
        });
    }

    function toggleTheme(button) {
        const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
        writeStoredTheme(nextTheme);
        applyTheme(nextTheme);

        if (button) {
            button.classList.remove("is-spinning");
            // Restart the animation so repeated clicks remain crisp.
            button.offsetWidth;
            button.classList.add("is-spinning");

            window.setTimeout(function () {
                button.classList.remove("is-spinning");
            }, 620);
        }
    }

    function setupThemeControls() {
        applyTheme(getPreferredTheme());

        document.querySelectorAll("[data-theme-toggle]").forEach(function (button) {
            button.addEventListener("click", function () {
                toggleTheme(button);
            });
        });

        const handleSchemeChange = function () {
            if (!readStoredTheme()) {
                applyTheme(getPreferredTheme());
            }
        };

        if (typeof prefersDark.addEventListener === "function") {
            prefersDark.addEventListener("change", handleSchemeChange);
        } else if (typeof prefersDark.addListener === "function") {
            prefersDark.addListener(handleSchemeChange);
        }
    }

    function setupFeaturedModal() {
        if (document.body.dataset.page !== "home") {
            return {
                show: function () {}
            };
        }

        const modal = document.querySelector("[data-featured-modal]");
        const closeButtons = modal ? Array.from(modal.querySelectorAll("[data-modal-close]")) : [];

        if (!modal) {
            return {
                show: function () {}
            };
        }

        function hideModal() {
            modal.classList.remove("is-visible");
            document.body.classList.remove("modal-open");

            if (reduceMotion) {
                modal.hidden = true;
                return;
            }

            window.setTimeout(function () {
                if (!modal.classList.contains("is-visible")) {
                    modal.hidden = true;
                }
            }, 320);
        }

        function showModal() {
            let hasSeenPopup = null;

            try {
                hasSeenPopup = window.sessionStorage.getItem("zanzibarPopup");
            } catch (error) {
                hasSeenPopup = null;
            }

            if (hasSeenPopup) {
                return;
            }

            try {
                window.sessionStorage.setItem("zanzibarPopup", "true");
            } catch (error) {
                // Ignore storage failures and still show the modal once.
            }

            modal.hidden = false;
            document.body.classList.add("modal-open");

            if (reduceMotion) {
                modal.classList.add("is-visible");
                return;
            }

            window.requestAnimationFrame(function () {
                modal.classList.add("is-visible");
            });
        }

        closeButtons.forEach(function (button) {
            button.addEventListener("click", hideModal);
        });

        modal.addEventListener("click", function (event) {
            if (event.target === modal) {
                hideModal();
            }
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape" && !modal.hidden) {
                hideModal();
            }
        });

        return {
            show: showModal,
            hide: hideModal
        };
    }

    function setupLiquidNav(root) {
        const blob = root.querySelector(".nav-blob");
        const links = Array.from(root.querySelectorAll(".nav-link"));

        if (!blob || links.length === 0) {
            return { sync: function () {} };
        }

        const current = { x: 0, y: 0, width: 0, height: 0, opacity: 0, scaleX: 1, scaleY: 1, tilt: 0 };
        const target = { x: 0, y: 0, width: 0, height: 0, opacity: 0, scaleX: 1, scaleY: 1, tilt: 0 };
        let restingLink = links.find(function (link) {
            return link.getAttribute("aria-current") === "page";
        }) || null;
        let pointerX = 0;
        let pointerY = 0;
        let pointerTime = performance.now();
        let pulseTimeout = 0;

        function apply(state) {
            blob.style.setProperty("--blob-x", state.x.toFixed(2) + "px");
            blob.style.setProperty("--blob-y", state.y.toFixed(2) + "px");
            blob.style.setProperty("--blob-w", Math.max(state.width, 0).toFixed(2) + "px");
            blob.style.setProperty("--blob-h", Math.max(state.height, 0).toFixed(2) + "px");
            blob.style.setProperty("--blob-opacity", state.opacity.toFixed(3));
            blob.style.setProperty("--blob-scale-x", state.scaleX.toFixed(3));
            blob.style.setProperty("--blob-scale-y", state.scaleY.toFixed(3));
            blob.style.setProperty("--blob-tilt", state.tilt.toFixed(3) + "deg");
        }

        function setTarget(link, persist) {
            if (!link) {
                target.opacity = 0;
                return;
            }

            const rootRect = root.getBoundingClientRect();
            const linkRect = link.getBoundingClientRect();

            if (persist) {
                restingLink = link;
            }

            target.x = linkRect.left - rootRect.left;
            target.y = linkRect.top - rootRect.top;
            target.width = linkRect.width;
            target.height = linkRect.height;
            target.opacity = 1;
        }

        function snap() {
            Object.assign(current, target);
            apply(current);
        }

        function resetMotion() {
            target.scaleX = 1;
            target.scaleY = 1;
            target.tilt = 0;
        }

        function settle() {
            if (restingLink) {
                setTarget(restingLink);
            } else {
                target.opacity = 0;
            }

            resetMotion();

            if (reduceMotion) {
                snap();
            }
        }

        function pulse() {
            window.clearTimeout(pulseTimeout);
            target.scaleX = hasCoarsePointer ? 1.12 : 1.08;
            target.scaleY = hasCoarsePointer ? 1.12 : 1.08;
            target.tilt = 0;

            if (reduceMotion) {
                snap();
            }

            pulseTimeout = window.setTimeout(function () {
                resetMotion();

                if (reduceMotion) {
                    snap();
                }
            }, reduceMotion ? 0 : 180);
        }

        links.forEach(function (link) {
            if (!hasCoarsePointer) {
                link.addEventListener("pointerenter", function () {
                    setTarget(link);
                    if (reduceMotion) {
                        snap();
                    }
                });
            }

            link.addEventListener("focus", function () {
                setTarget(link);
                if (reduceMotion) {
                    snap();
                }
            });

            link.addEventListener("pointerdown", function (event) {
                if (event.pointerType === "mouse" && !hasCoarsePointer) {
                    return;
                }

                setTarget(link, true);
                pulse();
            });

            link.addEventListener("click", function (event) {
                if (event.detail === 0) {
                    setTarget(link, true);
                    pulse();
                }
            });
        });

        if (!hasCoarsePointer) {
            root.addEventListener("pointermove", function (event) {
                const now = performance.now();
                const deltaTime = Math.max(now - pointerTime, 16);
                const velocityX = (event.clientX - pointerX) / deltaTime;
                const velocityY = (event.clientY - pointerY) / deltaTime;

                target.scaleX = 1 + clamp(Math.abs(velocityX) * 0.36, 0, 0.28);
                target.scaleY = 1 + clamp(Math.abs(velocityY) * 0.28, 0, 0.16);
                target.tilt = clamp(velocityX * 9, -7, 7);

                pointerX = event.clientX;
                pointerY = event.clientY;
                pointerTime = now;

                if (reduceMotion) {
                    snap();
                }
            });

            root.addEventListener("pointerleave", settle);
        }

        root.addEventListener("focusout", function (event) {
            if (!root.contains(event.relatedTarget)) {
                settle();
            }
        });

        settle();

        if (reduceMotion) {
            snap();
            return {
                sync: function () {
                    settle();
                    snap();
                }
            };
        }

        function animate() {
            const positionLerp = hasCoarsePointer ? 0.24 : 0.18;
            const shapeLerp = hasCoarsePointer ? 0.18 : 0.14;

            current.x += (target.x - current.x) * positionLerp;
            current.y += (target.y - current.y) * positionLerp;
            current.width += (target.width - current.width) * positionLerp;
            current.height += (target.height - current.height) * positionLerp;
            current.opacity += (target.opacity - current.opacity) * 0.16;
            current.scaleX += (target.scaleX - current.scaleX) * shapeLerp;
            current.scaleY += (target.scaleY - current.scaleY) * shapeLerp;
            current.tilt += (target.tilt - current.tilt) * shapeLerp;

            target.scaleX += (1 - target.scaleX) * 0.08;
            target.scaleY += (1 - target.scaleY) * 0.08;
            target.tilt += (0 - target.tilt) * 0.1;

            apply(current);
            window.requestAnimationFrame(animate);
        }

        window.requestAnimationFrame(animate);

        return {
            sync: function () {
                settle();
            }
        };
    }

    function setupWeightedScroll() {
        const settings = {
            lerp: 0.1,
            duration: 1200
        };
        const state = {
            current: window.scrollY,
            target: window.scrollY,
            frame: 0,
            tweenFrame: 0,
            internal: false
        };

        document.documentElement.style.setProperty("--scroll-lerp", String(settings.lerp));
        document.documentElement.style.setProperty("--scroll-duration", settings.duration + "ms");

        function maxScroll() {
            return Math.max(document.documentElement.scrollHeight - window.innerHeight, 0);
        }

        function writeScroll(next) {
            state.internal = true;
            window.scrollTo(0, next);
            state.internal = false;
        }

        function sync(next) {
            const resolved = typeof next === "number" ? next : window.scrollY;
            const clamped = clamp(resolved, 0, maxScroll());

            state.current = clamped;
            state.target = clamped;
        }

        function stopLerp() {
            if (state.frame) {
                window.cancelAnimationFrame(state.frame);
                state.frame = 0;
            }
        }

        function stopTween() {
            if (state.tweenFrame) {
                window.cancelAnimationFrame(state.tweenFrame);
                state.tweenFrame = 0;
            }
        }

        function stepLerp() {
            const difference = state.target - state.current;

            state.current += difference * settings.lerp;

            if (Math.abs(difference) <= 0.5) {
                sync(state.target);
                writeScroll(state.current);
                state.frame = 0;
                return;
            }

            writeScroll(state.current);
            state.frame = window.requestAnimationFrame(stepLerp);
        }

        function setTarget(next) {
            stopTween();
            state.target = clamp(next, 0, maxScroll());

            if (!state.frame) {
                state.frame = window.requestAnimationFrame(stepLerp);
            }
        }

        function tweenTo(next) {
            const destination = clamp(next, 0, maxScroll());
            const start = window.scrollY;
            const distance = destination - start;
            const startedAt = performance.now();

            stopLerp();
            stopTween();

            function frame(now) {
                const progress = clamp((now - startedAt) / settings.duration, 0, 1);
                const eased = motionCurve(progress);
                const nextPosition = start + distance * eased;

                writeScroll(nextPosition);
                state.current = nextPosition;
                state.target = nextPosition;

                if (progress < 1) {
                    state.tweenFrame = window.requestAnimationFrame(frame);
                    return;
                }

                sync(destination);
                state.tweenFrame = 0;
            }

            state.tweenFrame = window.requestAnimationFrame(frame);
        }

        function resolveAnchorTarget(link) {
            const href = link.getAttribute("href");

            if (!href || href === "#" || href.indexOf("#") === -1) {
                return null;
            }

            try {
                const url = new URL(href, window.location.href);

                if (url.origin !== window.location.origin || url.pathname !== window.location.pathname || !url.hash) {
                    return null;
                }

                return url;
            } catch (error) {
                return null;
            }
        }

        function getHeaderOffset() {
            const header = document.querySelector(".site-header");
            return header ? header.getBoundingClientRect().height + 20 : 24;
        }

        function shouldBypassKeyboard() {
            const active = document.activeElement;

            if (!active) {
                return false;
            }

            return Boolean(active.closest("input, textarea, select, [contenteditable='true']"));
        }

        if (!reduceMotion) {
            document.querySelectorAll("a[href*='#']").forEach(function (link) {
                const url = resolveAnchorTarget(link);

                if (!url) {
                    return;
                }

                link.addEventListener("click", function (event) {
                    const target = document.querySelector(url.hash);

                    if (!target) {
                        return;
                    }

                    event.preventDefault();

                    if (window.history && typeof window.history.pushState === "function") {
                        window.history.pushState(null, "", url.hash);
                    }

                    tweenTo(target.getBoundingClientRect().top + window.scrollY - getHeaderOffset());
                });
            });
        }

        if (!reduceMotion && !hasCoarsePointer) {
            window.addEventListener("wheel", function (event) {
                if (document.body.classList.contains("modal-open")) {
                    return;
                }

                if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey) {
                    return;
                }

                if (event.target.closest("input, textarea, select, [contenteditable='true']")) {
                    return;
                }

                event.preventDefault();
                setTarget((state.frame ? state.target : window.scrollY) + event.deltaY);
            }, { passive: false });

            document.addEventListener("keydown", function (event) {
                let delta = 0;

                if (document.body.classList.contains("modal-open") || shouldBypassKeyboard()) {
                    return;
                }

                switch (event.key) {
                    case "ArrowDown":
                        delta = 80;
                        break;
                    case "ArrowUp":
                        delta = -80;
                        break;
                    case "PageDown":
                        delta = window.innerHeight * 0.88;
                        break;
                    case "PageUp":
                        delta = -window.innerHeight * 0.88;
                        break;
                    case " ":
                        delta = event.shiftKey ? -window.innerHeight * 0.88 : window.innerHeight * 0.88;
                        break;
                    case "Home":
                        event.preventDefault();
                        setTarget(0);
                        return;
                    case "End":
                        event.preventDefault();
                        setTarget(maxScroll());
                        return;
                    default:
                        return;
                }

                event.preventDefault();
                setTarget((state.frame ? state.target : window.scrollY) + delta);
            });
        }

        window.addEventListener("scroll", function () {
            if (!state.internal && !state.frame && !state.tweenFrame) {
                sync(window.scrollY);
            }
        }, { passive: true });

        window.addEventListener("resize", function () {
            sync(clamp(window.scrollY, 0, maxScroll()));
        });

        return {
            sync: function () {
                sync(window.scrollY);
            },
            scrollTo: tweenTo
        };
    }

    function setupPageLoadSequence(featuredModal) {
        if (reduceMotion) {
            document.body.classList.add("is-loaded", "is-hero-ready");
            return;
        }

        document.body.classList.add("is-motion-sequenced");

        function run() {
            document.body.classList.add("is-loaded");

            if (document.body.dataset.page === "home") {
                window.setTimeout(function () {
                    document.body.classList.add("is-hero-ready");
                }, 160);

                window.setTimeout(function () {
                    if (featuredModal && typeof featuredModal.show === "function") {
                        featuredModal.show();
                    }
                }, 500);
            }
        }

        if (document.readyState === "complete") {
            run();
            return;
        }

        window.addEventListener("load", run, { once: true });
    }

    function setupFooterMeshActivation() {
        const footers = Array.from(document.querySelectorAll(".site-footer"));

        if (footers.length === 0) {
            return;
        }

        if (reduceMotion || typeof IntersectionObserver !== "function") {
            footers.forEach(function (footer) {
                footer.classList.add("is-active");
            });
            return;
        }

        const observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                entry.target.classList.toggle("is-active", entry.isIntersecting);
            });
        }, { threshold: 0.18 });

        footers.forEach(function (footer) {
            observer.observe(footer);
        });
    }

    function setupReveals() {
        const revealNodes = Array.from(document.querySelectorAll("[data-reveal]"));
        const galleryCards = Array.from(document.querySelectorAll(".gallery-masonry .gallery-card[data-reveal]"));

        if (revealNodes.length === 0) {
            return;
        }

        document.documentElement.classList.add("motion-ready");

        galleryCards.forEach(function (card, index) {
            card.style.setProperty("--delay", (index * 0.1).toFixed(2) + "s");
        });

        if (reduceMotion || typeof IntersectionObserver !== "function") {
            revealNodes.forEach(function (node) {
                node.classList.add("is-visible");
            });
            return;
        }

        const observer = new IntersectionObserver(function (entries, currentObserver) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) {
                    return;
                }

                entry.target.classList.add("is-visible");
                currentObserver.unobserve(entry.target);
            });
        }, { threshold: 0.18, rootMargin: "0px 0px -10% 0px" });

        revealNodes.forEach(function (node) {
            observer.observe(node);
        });
    }

    function setupContactForms() {
        const forms = Array.from(document.querySelectorAll("[data-contact-form]"));

        if (forms.length === 0) {
            return;
        }

        function isConfigured(value) {
            return Boolean(value) && !/(your-|change-me|example|replace-me)/i.test(value);
        }

        function normaliseValue(field) {
            return (field.value || "").trim();
        }

        function validateField(field) {
            const value = normaliseValue(field);
            const type = field.dataset.validate || field.name || "";
            const required = field.hasAttribute("required");

            if (!value) {
                if (required) {
                    return {
                        state: "invalid",
                        message: "This field is required."
                    };
                }

                return {
                    state: "empty",
                    message: ""
                };
            }

            switch (type) {
                case "name":
                    if (value.length < 2) {
                        return { state: "invalid", message: "Use at least two characters." };
                    }
                    break;
                case "email":
                    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                        return { state: "invalid", message: "Enter a valid email address." };
                    }
                    break;
                case "phone":
                    if (value.replace(/\D/g, "").length < 9) {
                        return { state: "invalid", message: "Use a valid phone number." };
                    }
                    break;
                case "interest":
                    if (!value) {
                        return { state: "invalid", message: "Select a preferred destination." };
                    }
                    break;
                case "window":
                    if (value.length < 4) {
                        return { state: "invalid", message: "Add a month or date range." };
                    }
                    break;
                case "groupSize":
                    if (!value) {
                        return { state: "invalid", message: "Select the expected group size." };
                    }
                    break;
                case "message":
                    if (value.length < 24) {
                        return { state: "invalid", message: "Share a few more details about the journey." };
                    }
                    break;
                default:
                    break;
            }

            return {
                state: "valid",
                message: ""
            };
        }

        function updateFieldUI(field, force) {
            const wrapper = field.closest("[data-field]");
            const messageNode = wrapper ? wrapper.querySelector(".field-message") : null;
            const result = validateField(field);
            const touched = field.dataset.touched === "true" || force;

            if (!wrapper) {
                return result.state !== "invalid";
            }

            wrapper.classList.remove("is-valid", "is-invalid");

            if (!touched && result.state !== "valid") {
                if (messageNode) {
                    messageNode.textContent = "";
                }

                return result.state !== "invalid";
            }

            if (result.state === "valid") {
                wrapper.classList.add("is-valid");
            } else if (result.state === "invalid") {
                wrapper.classList.add("is-invalid");
            }

            if (messageNode) {
                messageNode.textContent = touched ? result.message : "";
            }

            return result.state !== "invalid";
        }

        function resetFieldUI(field) {
            const wrapper = field.closest("[data-field]");
            const messageNode = wrapper ? wrapper.querySelector(".field-message") : null;

            delete field.dataset.touched;

            if (wrapper) {
                wrapper.classList.remove("is-valid", "is-invalid");
            }

            if (messageNode) {
                messageNode.textContent = "";
            }
        }

        async function submitWithFetch(form, payload) {
            const endpoint = (form.dataset.formEndpoint || "").trim();

            if (!isConfigured(endpoint)) {
                throw new Error("Add your Formspree or API endpoint in contact.html before sending live email.");
            }

            const response = await window.fetch(endpoint, {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                let message = "Unable to send your message right now.";

                try {
                    const data = await response.json();
                    if (data && typeof data.error === "string") {
                        message = data.error;
                    } else if (data && Array.isArray(data.errors) && data.errors[0] && data.errors[0].message) {
                        message = data.errors[0].message;
                    }
                } catch (error) {
                    message = "Unable to send your message right now.";
                }

                throw new Error(message);
            }
        }

        async function submitWithEmailJs(form, payload) {
            const serviceId = (form.dataset.emailjsServiceId || "").trim();
            const templateId = (form.dataset.emailjsTemplateId || "").trim();
            const publicKey = (form.dataset.emailjsPublicKey || "").trim();

            if (!window.emailjs || typeof window.emailjs.send !== "function") {
                throw new Error("Load the EmailJS browser SDK before using EmailJS submission.");
            }

            if (!isConfigured(serviceId) || !isConfigured(templateId) || !isConfigured(publicKey)) {
                throw new Error("Add your EmailJS service, template, and public key in contact.html.");
            }

            if (typeof window.emailjs.init === "function" && !window.emailjs.__bbInitialised) {
                window.emailjs.init(publicKey);
                window.emailjs.__bbInitialised = true;
            }

            await window.emailjs.send(serviceId, templateId, payload, publicKey);
        }

        forms.forEach(function (form) {
            const fields = Array.from(form.querySelectorAll("[data-validate]"));
            const shell = form.closest(".contact-form-shell");
            const successPanel = shell ? shell.querySelector("[data-form-success]") : null;
            const statusNode = form.querySelector("[data-form-status]");
            const submitButton = form.querySelector("[data-submit-button]");

            function setStatus(message, state) {
                if (!statusNode) {
                    return;
                }

                statusNode.textContent = message;
                statusNode.dataset.state = state || "";
            }

            function setSubmitting(submitting) {
                if (!submitButton) {
                    return;
                }

                submitButton.disabled = submitting;
                submitButton.setAttribute("aria-busy", String(submitting));
            }

            fields.forEach(function (field) {
                field.addEventListener("blur", function () {
                    field.dataset.touched = "true";
                    updateFieldUI(field, true);
                });

                field.addEventListener("input", function () {
                    if (normaliseValue(field)) {
                        field.dataset.touched = "true";
                    }

                    if (field.dataset.touched === "true") {
                        updateFieldUI(field, false);
                    }
                });

                if (field.tagName === "SELECT") {
                    field.addEventListener("change", function () {
                        field.dataset.touched = "true";
                        updateFieldUI(field, true);
                    });
                }
            });

            form.addEventListener("submit", async function (event) {
                const provider = (form.dataset.formProvider || "formspree").trim().toLowerCase();
                const payload = {};
                let isValid = true;

                event.preventDefault();

                fields.forEach(function (field) {
                    field.dataset.touched = "true";
                    if (!updateFieldUI(field, true)) {
                        isValid = false;
                    }
                });

                if (!isValid) {
                    setStatus("Please correct the highlighted fields before sending.", "error");
                    return;
                }

                new window.FormData(form).forEach(function (value, key) {
                    payload[key] = typeof value === "string" ? value.trim() : value;
                });

                payload.page = document.body.dataset.page || "contact";
                payload.submitted_at = new Date().toISOString();

                setSubmitting(true);
                setStatus("Sending your message...", "pending");

                try {
                    if (provider === "emailjs") {
                        await submitWithEmailJs(form, payload);
                    } else {
                        await submitWithFetch(form, payload);
                    }

                    form.reset();
                    fields.forEach(resetFieldUI);
                    setStatus("", "");

                    if (shell && successPanel) {
                        successPanel.hidden = false;

                        if (reduceMotion) {
                            shell.classList.add("is-sent");
                        } else {
                            window.requestAnimationFrame(function () {
                                shell.classList.add("is-sent");
                            });
                        }

                        window.setTimeout(function () {
                            successPanel.focus();
                        }, reduceMotion ? 0 : 220);
                    }
                } catch (error) {
                    setStatus(error && error.message ? error.message : "Unable to send your message right now.", "error");
                } finally {
                    setSubmitting(false);
                }
            });
        });
    }

    function init() {
        const smoothScroll = setupWeightedScroll();
        const featuredModal = setupFeaturedModal();

        setupThemeControls();
        setupPageLoadSequence(featuredModal);
        setupReveals();
        setupFooterMeshActivation();
        setupContactForms();

        const liquidNavs = Array.from(document.querySelectorAll("[data-liquid-nav]")).map(setupLiquidNav);

        window.addEventListener("resize", function () {
            liquidNavs.forEach(function (instance) {
                instance.sync();
            });

            smoothScroll.sync();
        });

        function syncOnLoad() {
            liquidNavs.forEach(function (instance) {
                instance.sync();
            });

            smoothScroll.sync();
        }

        if (document.readyState === "complete") {
            syncOnLoad();
            return;
        }

        window.addEventListener("load", syncOnLoad, { once: true });
    }

    document.addEventListener("DOMContentLoaded", init);
})();
