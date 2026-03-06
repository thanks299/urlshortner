/**
 * src/templates/templateEngine.js
 * Lightweight template loader and renderer.
 *
 * Reads .html files from the templates directory and replaces
 * {{variable}} placeholders with the supplied data.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** In-memory cache: template name → raw HTML string */
const cache = new Map();

/**
 * Load & cache a template file.
 * @param {string} category - Subfolder inside templates/ (e.g. "email")
 * @param {string} name     - File name without extension  (e.g. "welcome")
 * @returns {string} Raw HTML with {{placeholders}}
 */
function loadTemplate(category, name) {
  const key = `${category}/${name}`;
  if (cache.has(key)) return cache.get(key);

  const filePath = join(__dirname, category, `${name}.html`);
  const html = readFileSync(filePath, 'utf-8');
  cache.set(key, html);
  return html;
}

/**
 * Render a template by replacing every {{key}} with the corresponding value.
 * @param {string} category - Subfolder (e.g. "email")
 * @param {string} name     - Template name (e.g. "linkExpiry")
 * @param {Record<string, string|number>} data - Key/value pairs for substitution
 * @returns {string} Rendered HTML
 */
export function renderTemplate(category, name, data = {}) {
  let html = loadTemplate(category, name);

  for (const [key, value] of Object.entries(data)) {
    // Replace all occurrences of {{key}}
    html = html.replaceAll(`{{${key}}}`, String(value ?? ''));
  }

  return html;
}

/**
 * Clear the template cache (useful in tests or after hot-reload).
 */
export function clearTemplateCache() {
  cache.clear();
}
