(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.TutorialTypewriterModule = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    function createTypewriter(options) {
        const opts = options && typeof options === 'object' ? options : {};
        const charDelayMs = Number.isFinite(Number(opts.charDelayMs)) ? Math.max(4, Number(opts.charDelayMs)) : 18;
        const punctuationDelayMs = Number.isFinite(Number(opts.punctuationDelayMs)) ? Math.max(0, Number(opts.punctuationDelayMs)) : 90;
        const onUpdate = typeof opts.onUpdate === 'function' ? opts.onUpdate : function () {};
        const onComplete = typeof opts.onComplete === 'function' ? opts.onComplete : function () {};

        let fullText = '';
        let index = 0;
        let timerId = null;
        let typing = false;

        function clearTimer() {
            if (timerId !== null) {
                clearTimeout(timerId);
                timerId = null;
            }
        }

        function getDelayForChar(char) {
            if (!char) return charDelayMs;
            if (/[。！？!?…]/.test(char)) return charDelayMs + punctuationDelayMs;
            if (/[,，、]/.test(char)) return charDelayMs + Math.floor(punctuationDelayMs * 0.45);
            return charDelayMs;
        }

        function pushNextChar() {
            if (!typing) return;
            if (index >= fullText.length) {
                typing = false;
                clearTimer();
                onUpdate(fullText, { typing: false, complete: true });
                onComplete(fullText);
                return;
            }
            index += 1;
            const visibleText = fullText.slice(0, index);
            onUpdate(visibleText, { typing: index < fullText.length, complete: index >= fullText.length });
            if (index >= fullText.length) {
                typing = false;
                onComplete(fullText);
                return;
            }
            const nextDelay = getDelayForChar(fullText.charAt(index - 1));
            timerId = setTimeout(pushNextChar, nextDelay);
        }

        function start(text) {
            clearTimer();
            fullText = String(text || '');
            index = 0;
            typing = fullText.length > 0;
            onUpdate('', { typing: typing, complete: fullText.length === 0 });
            if (!typing) {
                onComplete(fullText);
                return;
            }
            timerId = setTimeout(pushNextChar, charDelayMs);
        }

        function reveal() {
            clearTimer();
            index = fullText.length;
            typing = false;
            onUpdate(fullText, { typing: false, complete: true });
            onComplete(fullText);
        }

        function cancel() {
            clearTimer();
            typing = false;
        }

        return {
            start,
            reveal,
            cancel,
            isTyping: function () { return typing; },
            getFullText: function () { return fullText; }
        };
    }

    return {
        createTypewriter
    };
}));
