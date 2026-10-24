import { getModel, actionCount } from './models.js';
import { normalizeLighting } from './lighting-profile.js';

const FORMAT = 'mini-keyboard-studio';
const LIBRARY_KEY = 'mini-keyboard-studio.library.v1';
const MAX_SHARE_LENGTH = 24000;
const MODIFIERS = ['CTRL', 'SHIFT', 'ALT', 'META', 'RCTRL', 'RSHIFT', 'RALT', 'RMETA'];
const KEY_NAMES = new Set([
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  ...Array.from({ length: 24 }, (_, index) => `F${index + 1}`),
  ...MODIFIERS,
  ...'ENTER ESC BACKSPACE TAB SPACE MINUS EQUAL LEFT_BRACKET RIGHT_BRACKET BACKSLASH SEMICOLON QUOTE GRAVE COMMA PERIOD SLASH CAPS_LOCK PRINT_SCREEN SCROLL_LOCK PAUSE INSERT HOME PAGE_UP DELETE END PAGE_DOWN RIGHT LEFT DOWN UP'.split(' '),
]);
const MEDIA_LABELS = {
  PLAY_PAUSE: '재생 / 일시 정지', STOP: '재생 중지', NEXT_TRACK: '다음 곡',
  PREVIOUS_TRACK: '이전 곡', MUTE: '음소거', VOLUME_UP: '볼륨 높이기', VOLUME_DOWN: '볼륨 낮추기',
};
const MOUSE_LABELS = {
  LEFT_CLICK: '왼쪽 클릭', RIGHT_CLICK: '오른쪽 클릭', MIDDLE_CLICK: '가운데 클릭',
  SCROLL_UP: '위로 스크롤', SCROLL_DOWN: '아래로 스크롤',
};
const KEY_LABELS = { CTRL: 'Ctrl', SHIFT: 'Shift', ALT: 'Alt', META: 'Meta', RCTRL: '오른쪽 Ctrl', RSHIFT: '오른쪽 Shift', RALT: '오른쪽 Alt', RMETA: '오른쪽 Meta', SPACE: 'Space', ENTER: 'Enter', ESC: 'Esc' };

function fail(message) { throw new Error(message); }

function object(value, fields, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail(`${label} 형식이 올바르지 않습니다.`);
  const keys = Reflect.ownKeys(value);
  if (keys.length !== fields.length || keys.some(key => !fields.includes(key))) fail(`${label}에 지원하지 않거나 누락된 항목이 있습니다.`);
  for (const key of fields) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) fail(`${label}에는 일반 데이터만 사용할 수 있습니다.`);
  }
}

function array(value, min, max, label) {
  if (!Array.isArray(value) || value.length < min || value.length > max
    || Reflect.ownKeys(value).length !== value.length + 1) fail(`${label} 개수가 올바르지 않습니다 (${min}–${max}).`);
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !('value' in descriptor)) fail(`${label}에 비어 있는 항목이 있습니다.`);
  }
}

function string(value, max, label, nonempty = true) {
  if (typeof value !== 'string' || value.length > max || (nonempty && !value.trim())) fail(`${label}은 ${max}자 이내의 ${nonempty ? '비어 있지 않은 ' : ''}문자열이어야 합니다.`);
  return nonempty ? value.trim() : value;
}

function chord(value) {
  array(value, 1, MODIFIERS.length + 1, '조합키');
  const keys = value.map(key => {
    if (typeof key !== 'string' || !KEY_NAMES.has(key.toUpperCase())) fail('지원하지 않는 키 이름입니다.');
    return key.toUpperCase();
  });
  if (new Set(keys).size !== keys.length) fail('조합키에 같은 키를 중복할 수 없습니다.');
  const normal = keys.filter(key => !MODIFIERS.includes(key));
  if (normal.length > 1) fail('조합키에는 일반 키를 하나만 사용할 수 있습니다.');
  return [...MODIFIERS.filter(key => keys.includes(key)), ...normal];
}

function timestamp(value) {
  const match = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) fail('키맵 수정 날짜가 올바르지 않습니다.');
  const [, year, month, day, hour, minute, second] = match.map(Number);
  const calendar = new Date(0);
  calendar.setUTCFullYear(year, month - 1, day);
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day
    || hour > 23 || minute > 59 || second > 59) fail('키맵 수정 날짜가 올바르지 않습니다.');
  return new Date(value).toISOString();
}

function validateAction(value) {
  if(value && typeof value==='object' && Object.hasOwn(value,'label')){
    if(Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))fail('동작 형식이 올바르지 않습니다.');
    const base={};let label;
    for(const key of Reflect.ownKeys(value)){
      const descriptor=Object.getOwnPropertyDescriptor(value,key);
      if(!descriptor || !('value' in descriptor))fail('동작에는 일반 데이터만 사용할 수 있습니다.');
      if(key==='label')label=string(descriptor.value,80,'기능 이름');
      else Object.defineProperty(base,key,descriptor);
    }
    const action=validateActionCore(base);
    if(action.type==='preserve')fail('원래 동작 유지에는 기능 이름을 지정할 수 없습니다.');
    return {...action,label};
  }
  return validateActionCore(value);
}
function validateActionCore(value) {
  if (!value || typeof value !== 'object') fail('동작 형식이 올바르지 않습니다.');
  const descriptor = Object.getOwnPropertyDescriptor(value, 'type');
  const type = descriptor && 'value' in descriptor ? descriptor.value : undefined;
  switch (type) {
    case 'preserve': case 'disabled':
      object(value, ['type'], '동작');
      return { type };
    case 'key':
      object(value, ['type', 'keys'], '키 동작');
      return { type, keys: chord(value.keys) };
    case 'macro': {
      object(value, ['type', 'steps'], '매크로');
      array(value.steps, 1, 14, '매크로 단계');
      const steps = value.steps.map(chord);
      // Modifier-only macro steps also occupy an entry for the chord boundary.
      const encodedEntries = steps.reduce((count, keys) => count + keys.length + Number(keys.every(key => MODIFIERS.includes(key))), 0);
      if (encodedEntries > 14) fail('매크로는 보조키와 단계 구분을 포함해 최대 14개 입력 항목을 지원합니다.');
      return { type, steps };
    }
    case 'media': case 'mouse': {
      object(value, ['type', 'key'], '동작');
      const labels = type === 'media' ? MEDIA_LABELS : MOUSE_LABELS;
      if (typeof value.key !== 'string' || !Object.hasOwn(labels, value.key)) fail('지원하지 않는 미디어 또는 마우스 동작입니다.');
      return { type, key: value.key };
    }
    default: fail('지원하지 않는 동작 유형입니다.');
  }
}

export function createProfile(name = '새 키맵', modelId = 'mini-16x3') {
  const model = getModel(modelId);
  return validateProfile({
    format: FORMAT, version: 4, modelId: model.id, rotation: 0,
    id: globalThis.crypto?.randomUUID?.() ?? `keymap-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name, description: '', updatedAt: new Date().toISOString(),
    layers: Array.from({ length: 3 }, (_, index) => ({
      name: `레이어 ${index + 1}`, actions: Array.from({ length: actionCount(model) }, () => ({ type: 'preserve' })), lighting: null,
    })),
  });
}

export function validateProfile(value) {
  const versionDescriptor = value && typeof value === 'object' && Object.getOwnPropertyDescriptor(value, 'version');
  const version = versionDescriptor && 'value' in versionDescriptor ? versionDescriptor.value : undefined;
  if (![1, 2, 3, 4].includes(version)) fail('지원하지 않는 키맵 형식 또는 버전입니다.');
  const fields = ['format', 'version', 'id', 'name', 'description', 'updatedAt', 'layers'];
  object(value, version === 1 ? fields : [...fields, 'modelId', 'rotation', ...(version===3?['applicationId']:[])], '키맵');
  if (version === 3 && value.applicationId !== null
    && (typeof value.applicationId !== 'string' || value.applicationId.length > 100 || !/^[a-z0-9][a-z0-9-]*$/.test(value.applicationId))) fail('연결 앱 ID가 올바르지 않습니다.');
  if (value.format !== FORMAT) fail('지원하지 않는 키맵 형식 또는 버전입니다.');
  const model = getModel(version === 1 ? 'mini-16x3' : value.modelId);
  const rotation = version === 1 ? 0 : value.rotation;
  if (![0, 90, 180, 270].includes(rotation)) fail('회전은 0, 90, 180, 270도 중에서 선택해 주세요.');
  const id = string(value.id, 100, '키맵 ID');
  const name = string(value.name, 80, '키맵 이름');
  const description = string(value.description, 1000, '설명', false);
  const updatedAt = timestamp(value.updatedAt);
  array(value.layers, 3, 3, '레이어');
  const layers = value.layers.map(layer => {
    object(layer, version === 4 ? ['name', 'actions', 'lighting'] : ['name', 'actions'], '레이어');
    const layerName = string(layer.name, 80, '레이어 이름');
    array(layer.actions, actionCount(model), actionCount(model), '레이어 동작');
    if (version === 4 && layer.lighting === undefined) fail('레이어 LED 설정은 원래 설정 유지 또는 모드와 색상으로 지정해 주세요.');
    const lighting = normalizeLighting(version === 4 ? layer.lighting : undefined, model.id);
    return { name: layerName, actions: layer.actions.map(validateAction), lighting };
  });
  return { format: FORMAT, version: 4, id, name, description, updatedAt, modelId: model.id, rotation, layers };
}

export function actionLabel(action) {
  const value = validateAction(action);
  const labelChord = keys => keys.map(key => KEY_LABELS[key] ?? key.replaceAll('_', ' ')).join(' + ');
  switch (value.type) {
    case 'preserve': return '원래 설정 유지';
    case 'disabled': return '동작 없음';
    case 'key': return labelChord(value.keys);
    case 'macro': return value.steps.map(labelChord).join(' → ');
    case 'media': return MEDIA_LABELS[value.key];
    case 'mouse': return MOUSE_LABELS[value.key];
  }
}

export function encodeShare(profile) {
  const bytes = new TextEncoder().encode(JSON.stringify(validateProfile(profile)));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const fragment = '#keymap=' + btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  if (fragment.length > MAX_SHARE_LENGTH) fail('공유 링크가 너무 깁니다. JSON 파일로 내보내 주세요.');
  return fragment;
}

export function decodeShare(hash) {
  if (typeof hash !== 'string' || hash.length > MAX_SHARE_LENGTH || !/^#keymap=[A-Za-z0-9_-]+$/.test(hash)) fail('공유 링크 형식이나 길이가 올바르지 않습니다.');
  const encoded = hash.slice(8);
  try {
    const binary = atob(encoded.replaceAll('-', '+').replaceAll('_', '/'));
    if (btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '') !== encoded) fail('잘못된 인코딩입니다.');
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    return validateProfile(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  } catch (error) {
    throw new Error(`공유 키맵을 읽을 수 없습니다: ${error.message}`, { cause: error });
  }
}

function getStorage(storage) {
  try {
    const result = storage ?? globalThis.localStorage;
    if (!result || typeof result.getItem !== 'function' || typeof result.setItem !== 'function') fail('저장소를 사용할 수 없습니다.');
    return result;
  } catch (error) {
    throw new Error('브라우저 저장소에 접근할 수 없습니다. 저장 권한을 확인하거나 JSON 파일로 내보내 주세요.', { cause: error });
  }
}

export function loadLibrary(storage) {
  const target = getStorage(storage);
  try {
    const raw = target.getItem(LIBRARY_KEY);
    if (raw === null) return [];
    if (typeof raw !== 'string' || raw.length > 2_000_000) fail('보관함 크기가 올바르지 않습니다.');
    const parsed = JSON.parse(raw);
    array(parsed, 0, 50, '보관함 키맵');
    const profiles = parsed.map(validateProfile);
    if (new Set(profiles.map(profile => profile.id)).size !== profiles.length) fail('중복된 키맵 ID가 있습니다.');
    return profiles;
  } catch (error) {
    throw new Error('보관함을 읽을 수 없습니다. 브라우저 저장 권한과 기존 데이터를 확인해 주세요. 원본 보관함은 변경하지 않았습니다.', { cause: error });
  }
}

function writeLibrary(profiles, storage) {
  try {
    storage.setItem(LIBRARY_KEY, JSON.stringify(profiles));
  } catch (error) {
    throw new Error(error.name === 'QuotaExceededError'
      ? '브라우저 저장 공간이 부족합니다. 키맵을 파일로 내보내고 보관함의 불필요한 키맵을 삭제해 주세요.'
      : '보관함을 저장할 수 없습니다. 브라우저 저장 권한을 확인하고 JSON 파일로 내보내 주세요.', { cause: error });
  }
}

export function saveToLibrary(profile, storage) {
  const normalized = validateProfile(profile);
  const target = getStorage(storage);
  const profiles = loadLibrary(target);
  const index = profiles.findIndex(value => value.id === normalized.id);
  if (index >= 0) profiles[index] = normalized;
  else {
    if (profiles.length >= 50) fail('보관함에는 최대 50개 키맵을 저장할 수 있습니다. 불필요한 키맵을 삭제해 주세요.');
    profiles.unshift(normalized);
  }
  writeLibrary(profiles, target);
  return normalized;
}

export function deleteFromLibrary(id, storage) {
  const profileId = string(id, 100, '키맵 ID');
  const target = getStorage(storage);
  const profiles = loadLibrary(target).filter(profile => profile.id !== profileId);
  writeLibrary(profiles, target);
  return profiles;
}
