/** Keep the compatibility bridge local to its composer. RC2 places the meter
 * in the dock outside the card and portals its popup directly to body. */
export function contextRoot(anchor) {
    return anchor.closest('[data-composer-card]')?.parentElement
        ?? anchor.closest('[data-slot="conversation.input.right"]')?.parentElement
        ?? undefined;
}
export function contextRing(root) {
    const matches = [...root.querySelectorAll('button[aria-haspopup="dialog"]')]
        .filter(button => button.querySelector('svg[viewBox="0 0 14 14"]')?.querySelectorAll('circle').length === 2);
    return matches.length === 1 ? matches[0] : undefined;
}
function isContextPanel(panel) {
    const header = panel.firstElementChild;
    return panel.getAttribute('role') === 'dialog' && header?.children.length === 4
        && /^\d+%$/.test(header.children[1]?.textContent ?? '')
        && (header.children[3]?.textContent ?? '').includes('/')
        && Boolean(header.nextElementSibling);
}
export function contextPanel(ring) {
    if (!ring || ring.getAttribute('aria-expanded') !== 'true')
        return;
    const controlled = ring.getAttribute('aria-controls');
    const linked = controlled ? ring.ownerDocument.getElementById(controlled) : null;
    if (linked && isContextPanel(linked))
        return linked;
    const local = ring.parentElement?.querySelector('[role="dialog"]');
    if (local && isContextPanel(local))
        return local;
    // Upstream provides no aria-controls on the portalled popup. Only attach
    // when both the open meter and matching body portal are unambiguous; never
    // steal another conversation's popup or a model/settings dialog.
    const doc = ring.ownerDocument;
    const openRings = [...doc.querySelectorAll('button[aria-haspopup="dialog"][aria-expanded="true"]')]
        .filter(button => button.querySelector('svg[viewBox="0 0 14 14"]')?.querySelectorAll('circle').length === 2);
    if (openRings.length !== 1 || openRings[0] !== ring)
        return;
    const panels = [...doc.body.children].filter((element) => element instanceof HTMLElement && isContextPanel(element));
    return panels.length === 1 ? panels[0] : undefined;
}
//# sourceMappingURL=context-elements.js.map