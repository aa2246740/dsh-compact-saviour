import { contextPanel } from './context-elements.js';
function tokens(value) {
    const unit = value >= 1_000_000 ? 1_000_000 : value >= 1_000 ? 1_000 : 1;
    const scaled = value / unit;
    return `${scaled >= 100 || unit === 1 ? Math.round(scaled) : Math.round(scaled * 10) / 10}${unit === 1_000_000 ? 'M' : unit === 1_000 ? 'K' : ''}`;
}
/** Narrow compatibility bridge until DSH exposes a context-meter reading slot.
 * Preserve the original React nodes, styles, handlers and any later owner update. */
export class MeterBridge {
    edits = new Map();
    write(node, key, value, read, write) {
        let fields = this.edits.get(node);
        if (!fields) {
            fields = new Map();
            this.edits.set(node, fields);
        }
        let field = fields.get(key);
        if (!field) {
            field = { read, write, before: read(), last: null };
            fields.set(key, field);
        }
        else if (read() !== field.last)
            field.before = read();
        if (read() !== value && !(field.desired === value && read() === field.last))
            write(value);
        field.last = read();
        field.desired = value;
    }
    text(element, value) {
        const node = element?.firstChild;
        if (element?.childNodes.length !== 1 || node?.nodeType !== Node.TEXT_NODE)
            return;
        this.write(node, 'text', value, () => node.nodeValue, v => { node.nodeValue = v; });
    }
    attr(element, key, value) {
        this.write(element, key, value, () => element.getAttribute(key), v => { if (v === null)
            element.removeAttribute(key);
        else
            element.setAttribute(key, v); });
    }
    restore() {
        for (const fields of this.edits.values())
            for (const edit of fields.values())
                if (edit.read() === edit.last)
                    edit.write(edit.before);
        this.edits.clear();
    }
    apply(ring, context) {
        if (!ring || !context?.corrected) {
            this.restore();
            return;
        }
        for (const node of this.edits.keys())
            if (!node.isConnected)
                this.edits.delete(node);
        const percent = Math.max(0, Math.min(100, Math.round(context.usedTokens / context.contextWindow * 100)));
        const reading = `${percent}%`, circumference = 2 * Math.PI * 5.5;
        // RC2 displays a percentage alongside the SVG in the dock.
        const label = [...ring.children].find(child => child.tagName === 'SPAN' && /^\d+%$/.test(child.textContent ?? ''));
        this.text(label, reading);
        const circles = ring.querySelectorAll('svg[viewBox="0 0 14 14"] circle');
        if (circles.length !== 2) {
            this.restore();
            return;
        }
        this.attr(circles[1], 'stroke-dasharray', `${circumference * percent / 100} ${circumference}`);
        const aria = ring.getAttribute('aria-label');
        if (aria && /\d+%/.test(aria))
            this.attr(ring, 'aria-label', aria.replace(/\d+%/, reading));
        const tooltipId = ring.getAttribute('aria-describedby');
        const tooltip = tooltipId ? document.getElementById(tooltipId) : null;
        if (tooltip?.getAttribute('role') === 'tooltip')
            this.text(tooltip, (tooltip.textContent ?? '').replace(/\d+%/, reading));
        const panel = contextPanel(ring);
        const header = panel?.firstElementChild, bar = header?.nextElementSibling;
        if (!header || header.children.length !== 4 || !bar || !/^\d+%$/.test(header.children[1]?.textContent ?? ''))
            return;
        this.text(header.children[1], reading);
        this.text(header.children[3], `~${tokens(context.usedTokens)} / ${tokens(context.contextWindow)}`);
        const parts = context.parts?.filter(value => value > 0), total = parts?.reduce((a, b) => a + b, 0);
        if (parts && total && parts.length === bar.children.length) {
            [...bar.children].forEach((segment, index) => {
                const el = segment;
                this.write(el, 'width', `${percent * parts[index] / total}%`, () => el.style.width, value => { el.style.width = value ?? ''; });
            });
        }
    }
}
//# sourceMappingURL=meter-bridge.js.map