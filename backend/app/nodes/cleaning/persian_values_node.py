"""Explicit locale conversion; never guess whether an identifier is a number."""
import re
import pandas as pd

from app.nodes.base import BaseNode, port, setting
from app.nodes.io import dataframe_payload, dataframe_result, ensure_df, selected_columns

DIGITS = str.maketrans('۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩٫٬−', '01234567890123456789.,-')


def normalize_text(value):
    return str(value).translate(DIGITS).strip().replace('\u200e', '').replace('\u200f', '')


def parse_persian_date(value, calendar='jalali'):
    if pd.isna(value) or str(value).strip() == '':
        return pd.NaT
    text = normalize_text(value)
    if calendar == 'gregorian':
        return pd.to_datetime(text.replace('-', '/'), format='%Y/%m/%d', errors='raise')
    import jdatetime
    match = re.fullmatch(r'(\d{4})[/-](\d{1,2})[/-](\d{1,2})', text)
    if not match:
        raise ValueError('Dates must use YYYY/MM/DD or YYYY-MM-DD.')
    return pd.Timestamp(jdatetime.date(*map(int, match.groups())).togregorian())


class PersianValuesNode(BaseNode):
    id = 'CL-011'
    name = 'Persian Numbers / Dates'
    category = 'Data Cleaning'
    description = 'Convert explicitly selected Persian/Arabic numbers or Jalali dates; leaves other columns unchanged.'
    inputs = [port('data', 'DataFrame', 'dataframe')]
    outputs = [port('dataframe', 'Converted DataFrame', 'dataframe')]
    settings_schema = [
        setting('columns', 'Columns', 'columns', [], required=True),
        setting('kind', 'Conversion', 'select', 'number', options=['number', 'jalali', 'gregorian']),
        setting('errors', 'Invalid Values', 'select', 'raise', options=['raise', 'coerce']),
    ]

    def run(self, node, inputs, settings, context):
        payload = dataframe_payload(inputs, 'data')
        frame = ensure_df(payload.df if payload else None, str(node['id']))
        columns = selected_columns(settings, frame)
        if not columns:
            raise ValueError('Select columns from the connected input.')
        kind = settings.get('kind', 'number')
        errors = settings.get('errors', 'raise')
        if kind not in {'number', 'jalali', 'gregorian'} or errors not in {'raise', 'coerce'}:
            raise ValueError('Unsupported conversion setting.')
        for column in columns:
            if kind == 'number':
                text = frame[column].astype('string').str.translate(DIGITS).str.replace(',', '', regex=False).str.strip()
                frame[column] = pd.to_numeric(text, errors=errors)
            else:
                def convert(value):
                    try:
                        return parse_persian_date(value, kind)
                    except (ValueError, OverflowError):
                        if errors == 'coerce':
                            return pd.NaT
                        raise ValueError(f'Invalid {kind} date in column {column}.') from None
                frame[column] = frame[column].map(convert)
        return dataframe_result(frame, id_column=payload.id_column, meta=dict(payload.meta))
