import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
const COPY = {
    compress: ['正在压缩', '给下一轮对话腾点空间', '把长对话收拾轻一点', '还在压缩，稍等一会儿'],
    merge: ['正在合并摘要', '把几段摘要整理到一起', '合并还在继续', '给下一轮对话腾点空间'],
};
/** Waiting copy is decorative, not a claim that a new processing stage finished. */
export function WaitingCopy({ stage }) {
    const [index, setIndex] = useState(0);
    const phrases = COPY[stage];
    useEffect(() => {
        const motion = matchMedia('(prefers-reduced-motion: reduce)');
        let timer;
        const sync = () => {
            clearInterval(timer);
            timer = undefined;
            if (motion.matches)
                setIndex(0);
            else if (document.visibilityState === 'visible')
                timer = setInterval(() => setIndex(i => (i + 1) % phrases.length), 6000);
        };
        sync();
        document.addEventListener('visibilitychange', sync);
        motion.addEventListener('change', sync);
        return () => { clearInterval(timer); document.removeEventListener('visibilitychange', sync); motion.removeEventListener('change', sync); };
    }, [phrases]);
    // All phrases share one grid cell, reserving the longest width so neither
    // progress digits nor popup geometry jump when the visible sentence changes.
    return _jsx("span", { className: "dsh-cs-waiting-copy", "aria-hidden": "true", children: phrases.map((phrase, i) => _jsxs("span", { "data-active": index === i ? 'true' : 'false', children: [phrase, "\u2026"] }, phrase)) });
}
//# sourceMappingURL=waiting-copy.js.map