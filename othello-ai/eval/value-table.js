"use strict";

function isValueTableModel(model) {
  return !!model && typeof model === "object" && model.schemaVersion === "value_table.v1";
}

module.exports = {
  isValueTableModel
};
