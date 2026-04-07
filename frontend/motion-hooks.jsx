import { useEffect, useRef } from "react";

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
            const slope = getSlope(guessT, x1, x2);

            if (slope === 0) {
                return guessT;
            }

            guessT -= (calcBezier(guessT, x1, x2) - x) / slope;
        }

        return guessT;
    }

    function getTForX(x) {
        let intervalStart = 0;
        let sampleIndex = 1;
        const lastSample = sampleSize - 1;

        for (; sampleIndex !== lastSample && sampleValues[sampleIndex] <= x; sampleIndex += 1) {
            intervalStart += sampleStep;
        }

        sampleIndex -= 1;

        const dist = (x - sampleValues[sampleIndex]) / (sampleValues[sampleIndex + 1] - sampleValues[sampleIndex]);
        const guess = intervalStart + dist * sampleStep;
        const slope = getSlope(guess, x1, x2);

        if (slope >= 0.001) {
            return newtonRaphsonIterate(x, guess);
        }

        if (slope === 0) {
            return guess;
        }

        return binarySubdivide(x, intervalStart, intervalStart + sampleStep);
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

export function useWeightedSmoothScroll(options = {}) {
    const {
        lerp = 0.1,
        duration = 1200,
        disabled = false
    } = options;
    const frameRef = useRef(0);
    const tweenRef = useRef(0);
    const stateRef = useRef({
        current: 0,
        target: 0,
        internal: false
    });
    const easing = useRef(cubicBezier(0.2, 0.8, 0.2, 1));

    useEffect(function () {
        const isTouch = window.matchMedia("(pointer: coarse)").matches || window.navigator.maxTouchPoints > 0;

        if (disabled) {
            return undefined;
        }

        stateRef.current.current = window.scrollY;
        stateRef.current.target = window.scrollY;

        function maxScroll() {
            return Math.max(document.documentElement.scrollHeight - window.innerHeight, 0);
        }

        function writeScroll(next) {
            stateRef.current.internal = true;
            window.scrollTo(0, next);
            stateRef.current.internal = false;
        }

        function stop() {
            window.cancelAnimationFrame(frameRef.current);
            window.cancelAnimationFrame(tweenRef.current);
            frameRef.current = 0;
            tweenRef.current = 0;
        }

        function step() {
            const difference = stateRef.current.target - stateRef.current.current;

            stateRef.current.current += difference * lerp;

            if (Math.abs(difference) <= 0.5) {
                stateRef.current.current = stateRef.current.target;
                writeScroll(stateRef.current.current);
                frameRef.current = 0;
                return;
            }

            writeScroll(stateRef.current.current);
            frameRef.current = window.requestAnimationFrame(step);
        }

        function setTarget(next) {
            window.cancelAnimationFrame(tweenRef.current);
            tweenRef.current = 0;
            stateRef.current.target = Math.min(Math.max(next, 0), maxScroll());

            if (!frameRef.current) {
                frameRef.current = window.requestAnimationFrame(step);
            }
        }

        function onWheel(event) {
            if (isTouch) {
                return;
            }

            event.preventDefault();
            setTarget((frameRef.current ? stateRef.current.target : window.scrollY) + event.deltaY);
        }

        window.addEventListener("wheel", onWheel, { passive: false });

        return function () {
            stop();
            window.removeEventListener("wheel", onWheel);
        };
    }, [disabled, duration, lerp]);

    return function scrollToPosition(next) {
        const start = window.scrollY;
        const distance = next - start;
        const startedAt = performance.now();

        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = 0;

        function frame(now) {
            const progress = Math.min(Math.max((now - startedAt) / duration, 0), 1);
            const eased = easing.current(progress);
            const nextPosition = start + distance * eased;

            window.scrollTo(0, nextPosition);

            if (progress < 1) {
                tweenRef.current = window.requestAnimationFrame(frame);
            }
        }

        tweenRef.current = window.requestAnimationFrame(frame);
    };
}

export function useViewportActivation(selector, className = "is-active", options = {}) {
    useEffect(function () {
        const nodes = Array.from(document.querySelectorAll(selector));

        if (nodes.length === 0) {
            return undefined;
        }

        if (typeof IntersectionObserver !== "function") {
            nodes.forEach(function (node) {
                node.classList.add(className);
            });
            return undefined;
        }

        const observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                entry.target.classList.toggle(className, entry.isIntersecting);
            });
        }, options);

        nodes.forEach(function (node) {
            observer.observe(node);
        });

        return function () {
            observer.disconnect();
        };
    }, [className, options, selector]);
}
