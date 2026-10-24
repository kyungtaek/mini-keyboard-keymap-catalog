import { getModel } from './models.js';

// Fixed product choices; readable device colors outside this palette are preserved.
export const LED_PALETTE = Object.freeze([
  '#ff0000', '#ff8030', '#ffff30', '#00ff00', '#00ffff', '#0000ff', '#800080', '#8b0000',
  '#ffa500', '#ffff96', '#7dff00', '#008b8b', '#00008b', '#ff00ff', '#ff6666', '#ffc864',
]);
const palette = new Set(LED_PALETTE);

function lightingObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new Error('LED 설정 형식이 올바르지 않습니다.');
  const keys = Reflect.ownKeys(value);
  if (keys.length !== 2 || !keys.includes('mode') || !keys.includes('colors')) throw new Error('LED 설정에는 모드와 색상만 지정해 주세요.');
  for (const key of keys) {
    if (!('value' in Object.getOwnPropertyDescriptor(value, key))) throw new Error('LED 설정에는 일반 데이터만 사용할 수 있습니다.');
  }
}

function colorArray(value, count, allowPreserve, paletteOnly) {
  if (!Array.isArray(value) || value.length !== count || Reflect.ownKeys(value).length !== count + 1) throw new Error(`LED 색상은 키 개수에 맞게 ${count}개 지정해 주세요.`);
  const result = [];
  for (let index = 0; index < count; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !('value' in descriptor)) throw new Error('LED 색상에 비어 있는 항목을 사용할 수 없습니다.');
    const color = descriptor.value;
    if (color === null && allowPreserve) { result.push(null); continue; }
    if (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) throw new Error('LED 색상은 #rrggbb 형식이어야 합니다.');
    const normalized = color.toLowerCase();
    if (paletteOnly && !palette.has(normalized)) throw new Error('LED 색상은 고정 팔레트 16개 중에서 선택해 주세요.');
    result.push(normalized);
  }
  return result;
}

/** null preserves a layer; null fields preserve the corresponding device values. */
export function normalizeLighting(value, modelId = 'mini-16x3') {
  const model = getModel(modelId);
  if (value === null || value === undefined) return null;
  if (model.id !== 'mini-16x3') throw new Error('이 키보드 모델은 프로필 LED 설정을 아직 지원하지 않습니다.');
  lightingObject(value);
  if (value.mode !== null && (!Number.isInteger(value.mode) || value.mode < 0 || value.mode > 5)) throw new Error('LED 모드는 원래 설정 유지 또는 0~5 중에서 선택해 주세요.');
  return { mode: value.mode, colors: colorArray(value.colors, model.keys, true, true) };
}

/** Resolve a profile patch against a complete current-device read, without mutating it. */
export function resolveLighting(value, current, modelId = 'mini-16x3') {
  const model = getModel(modelId);
  const patch = normalizeLighting(value, model.id);
  lightingObject(current);
  if (!Number.isInteger(current.mode) || current.mode < 0 || current.mode > 255) throw new Error('현재 장치 LED 모드가 올바르지 않습니다.');
  const colors = colorArray(current.colors, model.keys, false, false);
  return {
    mode: patch?.mode ?? current.mode,
    colors: colors.map((color, index) => patch?.colors[index] ?? color),
  };
}
