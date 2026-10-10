import interfaceZh from './locales/zh-CN.js';
import operationsZh from './locales/operations-zh-CN.js';

const zh = {...interfaceZh, ...operationsZh};
export const LANGUAGE_KEY = 'artisan.language';
export const supportedLanguages = ['en', 'zh-CN'];
let language = 'en';
try { const saved = globalThis.localStorage?.getItem(LANGUAGE_KEY); if (supportedLanguages.includes(saved)) language = saved; } catch {}
export const getLanguage = () => language;

const patterns = [
  [/^(Lower bounds|Upper bounds|Section normal) ([XYZ])$/, (_, label, axis) => `${translate(label)} ${axis}`],
  [/^(Resolution|Rotation|Rot|Trans|size|Size) ([123])$/, (_, label, axis) => `${translate(label)} ${axis}`],
  [/^Add (.+) to favorites$/, (_, label) => `将“${translate(label)}”加入收藏`],
  [/^Remove (.+) from favorites$/, (_, label) => `取消收藏“${translate(label)}”`],
  [/^Plane offset (.+)$/, (_, value) => `平面偏移 ${value}`],
  [/^(\d+) steps?$/, (_, n) => `${n} 个步骤`],
  [/^(\d+) operations?$/, (_, n) => `${n} 个操作`],
  [/^Search results · (\d+) operations?$/, (_, n) => `搜索结果 · ${n} 个操作`],
  [/^After Step (\d+) — (.*)$/, (_, n, label) => `步骤 ${n} 之后 — ${translate(label)}`],
  [/^Workflow step (\d+) · (.*)$/, (_, n, keys) => `工作流步骤 ${n} · ${keys}`],
  [/^(\d+) parameters$/, (_, n) => `${n} 个参数`],
  [/^(\d+) process(?:es)?$/, (_, n) => `${n} 个进程`],
  [/^(.+ (?:GiB|MiB)) available$/, (_, value) => `${value} 可用`],
  [/^Artisan Workbench · Version (.+)$/, (_, version) => `Artisan 工作台 · 版本 ${version}`],
  [/^Import \.(mld|txt)…$/, (_, ext) => `导入 .${ext}…`],
  [/^Block (\d+)$/, (_, n) => `分区块 ${n}`],
  [/^Subdomain (\d+)(?: of (\d+))?$/, (_, n, total) => `子域 ${n}${total ? ` / ${total}` : ''}`],
  [/^Failed \(exit (.*)\)$/, (_, code) => `失败（退出码 ${code}）`],
  [/^Generation progress: (.*)$/, (_, percent) => `生成进度：${percent}`],
  [/^(PERSPECTIVE|ORTHOGRAPHIC) · (.*)$/, (_, mode, units) => `${mode === 'PERSPECTIVE' ? '透视' : '正交'} · ${units}`],
  [/^(.+) added to workflow$/, (_, label) => `已将“${translate(label)}”添加到工作流`],
  [/^This STL is (.+)\. Full detail may use several times that amount of working memory\. Continue\?$/, (_, size) => `此 STL 为 ${size}。完整细节可能占用数倍于该大小的内存。是否继续？`],
];

// Exact catalog keys and anchored message patterns; no changes to data values.
export function translate(value, locale = language) {
  const original = String(value), text = original.trim();
  if (locale !== 'zh-CN' || !text) return original;
  let result = zh[text];
  if (result === undefined) for (const [pattern, render] of patterns) {
    const match = text.match(pattern); if (match) { result = render(...match); break; }
  }
  if (result === undefined) return original;
  return original.slice(0, original.indexOf(text)) + result + original.slice(original.indexOf(text) + text.length);
}

// The UI updates frequently through innerHTML/textContent. Remember each node's
// English source, translating only presentation text without rebuilding controls.
// This retains focus, drafts, selected values, open panels, camera and run state.
const records = new WeakMap();
const excluded = 'script,style,textarea,pre,code,[translate="no"],[contenteditable],.step-card p,.project-path,#run-log-path,#saved-view-list option,#inspect-field option,[data-lattice-select] optgroup option';
const attributes = ['title','aria-label','placeholder','alt','label'];
function applyValue(node, key, current, write) {
  let values = records.get(node); if (!values) records.set(node, values = new Map());
  let record = values.get(key);
  if (!record || current !== record.output) record = {source:current, output:current};
  const next = translate(record.source);
  record.output = next; values.set(key, record);
  if (current !== next) write(next);
}
export function localize(root = document.body) {
  if (!root) return;
  function visit(node) {
    if (node.nodeType === 3) {
      if (node.parentElement?.closest(excluded)) return;
      applyValue(node, 'text', node.data, value => { node.data = value; });
      return;
    }
    if (node.nodeType !== 1 || node.matches(excluded)) return;
    for (const name of attributes) if (node.hasAttribute(name)) {
      applyValue(node, name, node.getAttribute(name), value => node.setAttribute(name, value));
    }
    // HTML options without a value use their label as their value. Freeze the
    // original value before changing the label (camera directions, domains, etc.).
    if (node.tagName === 'OPTION' && !node.hasAttribute('value')) node.setAttribute('value', node.value);
    if (node.tagName === 'INPUT') return;
    for (const child of node.childNodes) visit(child);
  }
  if (!root.parentElement?.closest(excluded)) visit(root);
}

let observer = null;
function observe() {
  observer?.observe(document.body, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:attributes});
}
export function setLanguage(next) {
  if (!supportedLanguages.includes(next)) throw Error(`Unsupported language: ${next}`);
  language = next;
  try { globalThis.localStorage?.setItem(LANGUAGE_KEY, next); } catch {}
  if (typeof document !== 'undefined') {
    observer?.disconnect();
    document.documentElement.lang = next;
    document.title = translate('ArtGUI — Artisan Workbench');
    localize();
    const button = document.getElementById('language-toggle');
    if (button) {
      button.textContent = next === 'en' ? '中文' : 'English';
      button.lang = next === 'en' ? 'zh-CN' : 'en';
      button.title = button.ariaLabel = next === 'en' ? 'Switch to Simplified Chinese' : '切换为英语';
    }
    observe();
    document.dispatchEvent(new CustomEvent('artgui:languagechange', {detail:{language:next}}));
  }
}
export function initLanguage() {
  if (observer) return;
  observer = new MutationObserver(mutations => {
    observer.disconnect();
    const roots = new Set();
    for (const mutation of mutations) {
      if (mutation.type === 'childList') for (const node of mutation.addedNodes) roots.add(node);
      else roots.add(mutation.target);
    }
    for (const node of roots) if (node.isConnected) localize(node);
    observe();
  });
  document.getElementById('language-toggle').addEventListener('click', () => setLanguage(language === 'en' ? 'zh-CN' : 'en'));
  setLanguage(language);
}
