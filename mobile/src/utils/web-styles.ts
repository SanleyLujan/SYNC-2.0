// Only call with rules authored in the app. No user-supplied CSS.
// CSP authorizes an empty sheet by hash; trusted code populates it via CSSOM.
export function setWebStyleRules(id: string, rules: string[]): void {
  if (typeof document === 'undefined') return;
  let style = document.getElementById(id) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = id;
    document.head.appendChild(style);
  }
  const sheet = style.sheet;
  if (!sheet) throw new Error(`Stylesheet blocked by CSP: ${id}`);
  while (sheet.cssRules.length) sheet.deleteRule(0);
  for (const rule of rules) sheet.insertRule(rule, sheet.cssRules.length);
}
