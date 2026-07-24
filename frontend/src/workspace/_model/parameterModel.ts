export type ParameterColumnModelInput = {
  isCsvNode: boolean;
  csvColumns: string[];
  availableColumns: string[];
  availableIdColumns: string[];
  inheritedIdColumn: string | null;
  params: Record<string, unknown>;
};

const unique = (values: string[]) => [...new Set(values.map(String).filter(Boolean))];

export function isIdColumnParameter(name: string) {
  return name === 'id_column' || name === 'dataframe_id_column';
}

export function resolveParameterColumns(input: ParameterColumnModelInput) {
  const allColumns = unique(input.isCsvNode ? input.csvColumns : input.availableColumns);
  const idColumns = unique(
    input.isCsvNode
      ? input.csvColumns
      : input.availableIdColumns.length
        ? input.availableIdColumns
        : allColumns,
  );
  const configuredIdColumn = String(
    input.params.id_column
    || input.params.dataframe_id_column
    || input.inheritedIdColumn
    || '',
  ).trim();
  return {
    allColumns,
    idColumns,
    configuredIdColumn,
    calculationColumns: allColumns.filter((column) => column !== configuredIdColumn),
  };
}
