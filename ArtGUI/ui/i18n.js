import geometryFieldZh from './locales/geometry-field-zh-CN.js';
import sizeFieldMesherZh from './locales/size-field-mesher-zh-CN.js';
import primitiveMeshZh from './locales/primitive-mesh-zh-CN.js';
import latticeDefinitionZh from './locales/lattice-definition-zh-CN.js';
import quadZh from './locales/quad-mesher-zh-CN.js';
import interfaceZh from './locales/zh-CN.js';
import operationsZh from './locales/operations-zh-CN.js';
import regionsZh from './locales/regions-zh-CN.js';
import morphZh from './locales/morph-zh-CN.js';
import spatialZh from './locales/spatial-zh-CN.js';
import strutCellZh from './locales/strut-cell-zh-CN.js';
import tpmsCellZh from './locales/tpms-cell-zh-CN.js';
import meshCellZh from './locales/mesh-cell-zh-CN.js';

const zh = {...geometryFieldZh, ...primitiveMeshZh, ...interfaceZh, ...operationsZh, ...regionsZh, ...morphZh, ...spatialZh, ...quadZh, ...strutCellZh, ...tpmsCellZh, ...meshCellZh, ...latticeDefinitionZh, ...sizeFieldMesherZh};
export const LANGUAGE_KEY = 'artisan.language';
export const supportedLanguages = ['en', 'zh-CN'];
let language = 'en';
try { const saved = globalThis.localStorage?.getItem(LANGUAGE_KEY); if (supportedLanguages.includes(saved)) language = saved; } catch {}
export const getLanguage = () => language;

const patterns = [
  [/^(\d+) slices? · preview up to date$/, (_, n) => `${n} 个切片 · 预览已更新`],
  [/^Region (\d+): (.+)$/, (_, n, message) => `区域 ${n}：${translate(message,'zh-CN')}`],
  [/^(Position|Full dimensions|Plane normal|Cylinder axis) ([XYZ])$/, (_, label, axis) => `${translate(label,'zh-CN')} ${axis}`],
  [/^Select (.+)$/, (_, name) => `选择 ${name}`],
  [/^([XYZ]) ([+−]) face$/, (_, axis, sign) => `${axis} ${sign} 面`],
  [/^Choose rotation axis ([XYZ])$/, (_, axis) => `选择旋转操作轴 ${axis}`],
  [/^Move in ([XYZ]{2}) plane$/, (_, axes) => `在 ${axes} 平面内移动`],
  [/^(Translation|Rotation center|Drag snap) \(([^()]+)\)(?: ([XYZ]))?$/, (_, label, units, axis) => `${({'Translation':'平移','Rotation center':'旋转中心','Drag snap':'拖动吸附'})[label]}（${translate(units,'zh-CN')}）${axis?' '+axis:''}`],
  [/^Use lattice for the active field and surface export\. Coordinates and translations use (.+)\.$/, (_, units) => `使用 lattice 表示当前场并导出表面。坐标和平移的单位为 ${translate(units,'zh-CN')}。`],
  [/^(Rotation axis|Move|Rotate) ([+-]?[XYZ])$/, (_, label, axis) => `${translate(label,'zh-CN')} ${axis}`],
  [/^Movement (\d+)$/, (_, n) => `移动区域 ${n}`],
  [/^Step (\d+)$/, (_, n) => `步骤 ${n}`],
  [/^Moving region (\d+): (.+)$/, (_, n, message) => `移动区域 ${n}：${translate(message,'zh-CN')}`],
  [/^Step (\d+): (.+)$/, (_, n, message) => `步骤 ${n}：${translate(message,'zh-CN')}`],
  [/^(.+): no earlier geometry-mask definition found\. Artisan must load or compute it before this step\.$/, (_, id) => `${id}：未找到前面步骤中的几何掩码定义。Artisan 必须在此步骤之前加载或计算该掩码。`],
  [/^(.+): morph masks must contain values between 0 and 1\.$/, (_, id) => `${id}：变形掩码的值必须在 0 至 1 之间。`],
  [/^(.+): target bounds may extend beyond the sampling box\. Increase the sampling bounds or reduce movement\.$/, (_, id) => `${id}：目标边界可能超出采样长方体。请扩大采样范围或减小移动量。`],
  [/^(mask_threshold|max_control_points|support_radius|max_gradient|inverse_tolerance|inverse_iterations|stages|max_grid_points) must be (an integer|a number) (greater than|at least) ([\d.e+-]+)(?: and at most ([\d.e+-]+))?\.$/, (_, key, type, lower, min, max) => `${key} 必须为${lower==='greater than'?'大于':'不小于'} ${min}${max?' 且不大于 '+max:''} 的${type==='an integer'?'整数':'数值'}。`],
  [/^Preview computed, but the quality report could not be read: (.+)$/, (_, message) => `预览已计算，但无法读取质量报告：${message}`],
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
