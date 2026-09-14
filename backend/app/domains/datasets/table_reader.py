"""One file-reading contract for upload, preview, execution and lineage."""
from pathlib import Path
from zipfile import ZipFile, BadZipFile

import pandas as pd


def read_table(path, *, max_rows=None):
    path = Path(path)
    suffix = path.suffix.lower()
    if suffix == '.xlsx':
        # Bound expanded workbook size before the XML reader allocates memory.
        try:
            with ZipFile(path) as archive:
                if sum(item.file_size for item in archive.infolist()) > 256 * 1024 * 1024:
                    raise ValueError('Expanded Excel workbook exceeds 256 MiB.')
        except BadZipFile as exc:
            raise ValueError('Invalid XLSX workbook.') from exc
    def read(nrows):
        try:
            if suffix in {'.xlsx', '.xls'}:
                return pd.read_excel(path, nrows=nrows, engine='openpyxl' if suffix == '.xlsx' else 'xlrd')
            if suffix in {'.csv', '.tsv', '.txt'}:
                return pd.read_csv(path, nrows=nrows, sep='\t' if suffix == '.tsv' else ',', encoding='utf-8-sig')
            if suffix == '.json':
                frame = pd.read_json(path)
                return frame.head(nrows) if nrows is not None else frame
            raise ValueError('Supported formats: CSV, TSV, TXT, JSON, XLSX and XLS.')
        except Exception as exc:
            raise ValueError('Could not parse the table. Use a valid UTF-8 delimited file, JSON, or Excel workbook.') from exc
    width = len(read(0).columns)
    if not 1 <= width <= 2000:
        raise ValueError('Datasets must contain between 1 and 2000 columns.')
    row_limit = min(1000000, 5000000 // width)
    requested = min(max_rows, row_limit) if max_rows is not None else row_limit
    frame = read(requested + 1)
    if max_rows is None and len(frame) > row_limit:
        raise ValueError('Dataset exceeds 1,000,000 rows or 5,000,000 cells. Split the file into smaller datasets.')
    if max_rows is not None:
        frame = frame.head(requested)
    names = [str(column).strip() for column in frame.columns]
    if len(set(names)) != len(names) or any(not name for name in names):
        raise ValueError('Column names must be non-empty and unique.')
    frame.columns = names
    return frame
