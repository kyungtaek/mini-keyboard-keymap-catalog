export const MODELS = Object.freeze([
  { id: 'mini-16x3', name: '16키 · 3다이얼', keys: 16, encoders: 3, rows: 4, columns: 4, protocol: 'fd65', verified: true },
  { id: 'mini-3x1', name: '3키 · 1다이얼', keys: 3, encoders: 1, rows: 1, columns: 3, protocol: 'ch57x', verified: false },
  { id: 'mini-6x1', name: '6키 · 1다이얼', keys: 6, encoders: 1, rows: 2, columns: 3, protocol: 'ch57x', verified: false },
  { id: 'mini-6x2', name: '6키 · 2다이얼', keys: 6, encoders: 2, rows: 2, columns: 3, protocol: 'ch57x', verified: false },
  { id: 'mini-12x2', name: '12키 · 2다이얼', keys: 12, encoders: 2, rows: 3, columns: 4, protocol: 'ch57x', verified: false },
  { id: 'mini-12x3', name: '12키 · 3다이얼', keys: 12, encoders: 3, rows: 3, columns: 4, protocol: 'ch57x', verified: false },
  { id: 'mini-12x4', name: '12키 · 4다이얼', keys: 12, encoders: 4, rows: 3, columns: 4, protocol: 'ch57x', verified: false },
  { id: 'mini-9x2', name: '9키 · 2다이얼', keys: 9, encoders: 2, rows: 3, columns: 3, protocol: 'ch57x', verified: false },
].map(model => Object.freeze(model)));

export function getModel(id) {
  const model = MODELS.find(candidate => candidate.id === id);
  if (!model) throw new Error('지원하지 않는 키보드 모델입니다.');
  return model;
}

function descriptor(modelOrId) {
  const model = typeof modelOrId === 'string' ? getModel(modelOrId) : modelOrId;
  if (!model || !Number.isSafeInteger(model.keys) || model.keys < 1
    || !Number.isSafeInteger(model.encoders) || model.encoders < 0) throw new Error('키보드 모델 구성이 올바르지 않습니다.');
  return model;
}

export function actionCount(modelOrId) {
  const model = descriptor(modelOrId);
  return model.keys + model.encoders * 3;
}

export function gridActionIds(modelOrId, rotation = 0) {
  const model = descriptor(modelOrId);
  if (![0, 90, 180, 270].includes(rotation)) throw new Error('회전은 0, 90, 180, 270도 중에서 선택해 주세요.');
  if (!Number.isSafeInteger(model.rows) || model.rows < 1 || !Number.isSafeInteger(model.columns) || model.columns < 1) throw new Error('키보드 모델의 행과 열 구성이 올바르지 않습니다.');
  if (model.rows * model.columns !== model.keys) return null;
  let grid = Array.from({ length: model.rows }, (_, row) => Array.from({ length: model.columns }, (_, column) => (
    model.id === 'mini-16x3' ? (column + 1) * model.rows - row : row * model.columns + column + 1
  )));
  for (let turn = 0; turn < rotation / 90; turn += 1) {
    grid = Array.from({ length: grid[0].length }, (_, row) => Array.from({ length: grid.length }, (_, column) => grid[grid.length - column - 1][row]));
  }
  return grid;
}
