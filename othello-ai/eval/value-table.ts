function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function isValueTableModel(model: unknown): boolean {
  return isRecord(model) && model.schemaVersion === 'value_table.v1';
}

export = {
  isValueTableModel
};
