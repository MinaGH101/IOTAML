"""Vectorized row filters without pandas' Python-evaluating query engine."""
import ast
import operator
import re

import pandas as pd


def filter_query(frame, expression):
    if len(expression) > 4000:
        raise ValueError('Row filter is too long.')
    names = {}
    def column(match):
        key = f'_column_{len(names)}'
        names[key] = match.group(1)
        return key
    expression = re.sub(r'`([^`]+)`', column, expression)
    tree = ast.parse(expression, mode='eval')
    if sum(1 for _ in ast.walk(tree)) > 256:
        raise ValueError('Row filter is too complex.')
    comparisons = {ast.Eq: operator.eq, ast.NotEq: operator.ne, ast.Lt: operator.lt, ast.LtE: operator.le, ast.Gt: operator.gt, ast.GtE: operator.ge}

    def evaluate(item):
        if isinstance(item, ast.Name):
            name = names.get(item.id, item.id)
            if name not in frame.columns:
                raise ValueError(f'Filter column not in connected input: {name}')
            return frame[name]
        if isinstance(item, ast.Constant) and isinstance(item.value, (str, int, float, bool, type(None))):
            return item.value
        if isinstance(item, (ast.List, ast.Tuple)):
            if not all(isinstance(v, ast.Constant) for v in item.elts):
                raise ValueError('Membership filters require literal values.')
            return [evaluate(v) for v in item.elts]
        if isinstance(item, ast.UnaryOp) and isinstance(item.op, ast.USub):
            value = evaluate(item.operand)
            if isinstance(value, (int, float)):
                return -value
        if isinstance(item, ast.Compare):
            left = evaluate(item.left)
            result = pd.Series(True, index=frame.index)
            for op, right_node in zip(item.ops, item.comparators):
                right = evaluate(right_node)
                if type(op) in comparisons:
                    mask = comparisons[type(op)](left, right)
                elif isinstance(op, (ast.In, ast.NotIn)) and isinstance(left, pd.Series) and isinstance(right, list):
                    mask = left.isin(right)
                    if isinstance(op, ast.NotIn):
                        mask = ~mask
                else:
                    raise ValueError('Unsupported filter comparison.')
                result &= mask
                left = right
            return result
        if isinstance(item, ast.BoolOp):
            result = evaluate(item.values[0])
            for value in item.values[1:]:
                result = (result & evaluate(value)) if isinstance(item.op, ast.And) else (result | evaluate(value))
            return result
        if isinstance(item, ast.BinOp) and isinstance(item.op, (ast.BitAnd, ast.BitOr)):
            left, right = evaluate(item.left), evaluate(item.right)
            return left & right if isinstance(item.op, ast.BitAnd) else left | right
        if isinstance(item, ast.UnaryOp) and isinstance(item.op, (ast.Not, ast.Invert)):
            return ~evaluate(item.operand)
        raise ValueError('Use column comparisons, and/or, or membership lists. Python calls and attributes are disabled.')

    mask = evaluate(tree.body)
    if not isinstance(mask, pd.Series) or not pd.api.types.is_bool_dtype(mask):
        raise ValueError('Row filter must produce a boolean condition for every row.')
    return frame.loc[mask.fillna(False)]
