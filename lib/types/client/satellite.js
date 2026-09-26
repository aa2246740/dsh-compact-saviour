import motion from './vendor/open-bot-motion.cjs';
const NS = 'http://www.w3.org/2000/svg';
let nextClip = 0;
const clipPrefix = Math.random().toString(36).slice(2);
const element = (tag) => document.createElementNS(NS, tag);
// The authored orbit has a 3.6 s period. Loop just that span, not the complete
// demo (whose final satellite frame does not match its initial resting pose).
export const orbitTime = (seconds) => seconds < .8 ? 2 + seconds : 2.8 + ((seconds - .8) % 3.6);
export function settleFrame(from, amount) {
    const idle = motion.getBot7State(0), bot = { ...idle.bot };
    const t = 1 - (1 - amount) ** 3;
    for (const key of Object.keys(bot))
        if (typeof bot[key] === 'number' && typeof from.bot[key] === 'number') {
            bot[key] = from.bot[key] * (1 - t) + bot[key] * t;
        }
    return { bot, dots: from.dots.map(dot => ({ ...dot, x: dot.x * (1 - t), y: dot.y * (1 - t), r: dot.r * (1 - t) })) };
}
/** Owns one SVG and one clock. Hidden/reduced-motion pages consume no frames. */
export class Satellite {
    svg = element('svg');
    projector = new motion.SvgProjector({ viewportSize: 280 });
    body = element('path');
    clipBody = element('path');
    eyes = element('g');
    dots = Array.from({ length: 8 }, () => element('circle'));
    frame;
    elapsed = 0;
    lastTime = 0;
    settling = 0;
    mode = 'rest';
    current = motion.getBot7State(0);
    exitFrom = this.current;
    reduced = matchMedia('(prefers-reduced-motion: reduce)');
    disposed = false;
    done;
    constructor(host) {
        this.svg.setAttribute('viewBox', '-76 -76 152 152');
        this.svg.setAttribute('aria-hidden', 'true');
        this.svg.classList.add('dsh-cs-robot');
        const defs = element('defs'), clip = element('clipPath');
        // SVG clip identity is not a credential; also work on non-secure HTTP pages.
        const id = `dsh-cs-bot-${clipPrefix}-${nextClip++}`;
        clip.id = id;
        clip.append(this.clipBody);
        defs.append(clip);
        this.eyes.setAttribute('clip-path', `url(#${id})`);
        this.body.classList.add('dsh-cs-body');
        this.eyes.classList.add('dsh-cs-eyes');
        this.dots.forEach(dot => dot.classList.add('dsh-cs-dot'));
        this.svg.append(defs, this.body, this.eyes, ...this.dots);
        host.append(this.svg);
        this.render(this.current);
        document.addEventListener('visibilitychange', this.wake);
        this.reduced.addEventListener('change', this.wake);
    }
    setRunning(running, done) {
        if (running) {
            if (this.mode === 'run')
                return;
            this.mode = 'run';
            this.elapsed = 0;
            this.done = undefined;
        }
        else if (this.mode === 'run') {
            this.exitFrom = this.current;
            this.mode = 'settle';
            this.settling = 0;
            this.done = done;
        }
        else if (this.mode === 'settle') {
            this.done = done;
            return;
        }
        else {
            done?.();
        }
        this.wake();
    }
    wake = () => {
        if (this.frame !== undefined)
            cancelAnimationFrame(this.frame);
        this.frame = undefined;
        this.lastTime = 0;
        if (this.disposed)
            return;
        if (this.reduced.matches || document.hidden) {
            if (this.mode === 'settle')
                this.finish();
            else if (this.reduced.matches)
                this.render(motion.getBot7State(0));
            return;
        }
        if (this.mode !== 'rest')
            this.frame = requestAnimationFrame(this.tick);
    };
    finish() {
        this.mode = 'rest';
        this.render(motion.getBot7State(0));
        const done = this.done;
        this.done = undefined;
        done?.();
    }
    tick = (now) => {
        this.frame = undefined;
        if (this.disposed)
            return;
        // Cap work at 30 fps; retain elapsed time across visibility pauses.
        if (!this.lastTime)
            this.lastTime = now;
        const delta = (now - this.lastTime) / 1000;
        if (delta >= 1 / 30) {
            this.lastTime = now;
            if (this.mode === 'run') {
                this.elapsed += delta;
                this.render(motion.getBot7State(orbitTime(this.elapsed)));
            }
            if (this.mode === 'settle') {
                this.settling += delta;
                if (this.settling >= .32)
                    this.finish();
                else
                    this.render(settleFrame(this.exitFrom, this.settling / .32));
            }
        }
        if (this.mode !== 'rest')
            this.frame = requestAnimationFrame(this.tick);
    };
    render(state) {
        this.current = state;
        const projected = this.projector.projectRoundedCube(state.bot);
        this.body.setAttribute('d', projected.bodyPath);
        this.clipBody.setAttribute('d', projected.bodyPath);
        const eyes = state.bot.showEyes === false ? [] : projected.eyes;
        while (this.eyes.children.length > eyes.length)
            this.eyes.lastChild.remove();
        while (this.eyes.children.length < eyes.length)
            this.eyes.append(element('rect'));
        eyes.forEach((eye, index) => {
            const node = this.eyes.children[index];
            for (const [key, value] of Object.entries({ x: -eye.w / 2, y: -eye.h / 2, width: eye.w, height: eye.h, rx: eye.rx, ry: eye.ry, opacity: eye.opacity ?? 1 }))
                node.setAttribute(key, value.toFixed(2));
            node.setAttribute('transform', `translate(${eye.cx.toFixed(2)} ${eye.cy.toFixed(2)}) rotate(${eye.angle.toFixed(2)})`);
        });
        this.dots.forEach((node, index) => {
            const dot = state.dots[index];
            node.setAttribute('r', dot?.visible ? dot.r.toFixed(2) : '0');
            if (dot) {
                node.setAttribute('cx', dot.x.toFixed(2));
                node.setAttribute('cy', dot.y.toFixed(2));
            }
        });
    }
    destroy() {
        this.disposed = true;
        if (this.frame !== undefined)
            cancelAnimationFrame(this.frame);
        document.removeEventListener('visibilitychange', this.wake);
        this.reduced.removeEventListener('change', this.wake);
        this.svg.remove();
        this.done = undefined;
    }
}
//# sourceMappingURL=satellite.js.map