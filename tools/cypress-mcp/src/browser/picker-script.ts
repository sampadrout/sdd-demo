/**
 * JavaScript injected into the live page for cypress_live_pick_locator.
 * Highlights the hovered element, captures the user's next click, and
 * stores the element's attributes on `window.__mcpLastPick` for the
 * MCP server to read via waitForFunction.
 */
export const PICKER_SCRIPT = `(() => {
  if (window.__mcpPickerActive) return;
  window.__mcpPickerActive = true;
  window.__mcpLastPick = null;
  const overlay = document.createElement('div');
  overlay.style.cssText = [
    'position:fixed','pointer-events:none','z-index:2147483647',
    'border:2px solid #ff5a5f','background:rgba(255,90,95,0.08)',
    'transition:all 0.04s linear','box-sizing:border-box'
  ].join(';');
  document.documentElement.appendChild(overlay);
  const label = document.createElement('div');
  label.style.cssText = [
    'position:fixed','pointer-events:none','z-index:2147483647',
    'background:#ff5a5f','color:#fff','font:12px/1.4 system-ui,sans-serif',
    'padding:2px 6px','border-radius:3px'
  ].join(';');
  document.documentElement.appendChild(label);

  function describe(el){
    const a = el.tagName.toLowerCase();
    const id = el.id ? '#' + el.id : '';
    const cy = el.getAttribute('data-cy'); const tid = el.getAttribute('data-testid');
    if (cy) return a + '[data-cy=' + cy + ']';
    if (tid) return a + '[data-testid=' + tid + ']';
    return a + id + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').filter(Boolean).slice(0,2).join('.') : '');
  }

  function onMove(e){
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el === overlay || el === label) return;
    window.__mcpHoverEl = el;
    const r = el.getBoundingClientRect();
    overlay.style.top = r.top + 'px';
    overlay.style.left = r.left + 'px';
    overlay.style.width = r.width + 'px';
    overlay.style.height = r.height + 'px';
    label.textContent = describe(el);
    label.style.top = Math.max(0, r.top - 20) + 'px';
    label.style.left = r.left + 'px';
  }

  function onClick(e){
    const el = window.__mcpHoverEl;
    if (!el) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    const attrs = {
      tag: el.tagName.toLowerCase(),
      dataCy: el.getAttribute('data-cy'),
      dataTestid: el.getAttribute('data-testid'),
      dataTest: el.getAttribute('data-test'),
      id: el.id || null,
      name: el.getAttribute('name'),
      ariaLabel: el.getAttribute('aria-label'),
      role: el.getAttribute('role'),
      type: el.getAttribute('type'),
      text: (el.textContent || '').trim().slice(0, 80) || null,
    };
    window.__mcpLastPick = {
      attrs,
      outerHTML: el.outerHTML.slice(0, 800),
      boundingBox: el.getBoundingClientRect().toJSON()
    };
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('click', onClick, true);
    overlay.remove(); label.remove();
    window.__mcpPickerActive = false;
  }

  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('click', onClick, true);
})();`;

export const HIGHLIGHT_SCRIPT = `([selector, style]) => {
  const existing = document.querySelectorAll('[data-mcp-highlight]');
  existing.forEach(e => e.remove());
  const targets = Array.from(document.querySelectorAll(selector));
  targets.forEach((el, i) => {
    const r = el.getBoundingClientRect();
    const ov = document.createElement('div');
    ov.setAttribute('data-mcp-highlight', String(i));
    ov.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483646;box-sizing:border-box;' +
      'top:' + r.top + 'px;left:' + r.left + 'px;width:' + r.width + 'px;height:' + r.height + 'px;' +
      (style || 'outline:2px solid #00bcd4;background:rgba(0,188,212,0.08);');
    document.documentElement.appendChild(ov);
  });
  return targets.length;
}`;

export const HIDE_HIGHLIGHT_SCRIPT = `() => {
  const existing = document.querySelectorAll('[data-mcp-highlight]');
  existing.forEach(e => e.remove());
  return existing.length;
}`;
