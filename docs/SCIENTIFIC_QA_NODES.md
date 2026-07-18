# Scientific QA and visualization nodes

## Duplicate Sample Error (`IN-008`)

- Accepts a connected dataframe and a compact CSV/TSV/XLSX raw-to-duplicate mapping.
- The mapping columns default to the first two uploaded columns, or can be named explicitly.
- The dataframe sample-ID column is selected independently from the dataset input node.
- Supports multiple analyte columns and multiple aggregate metrics: pair count, MAE, RMSE, bias, absolute error, RPD, relative bias, Pearson correlation, Spearman correlation, and pair RSD.
- Produces typed `errors`, `pairs`, and `report` outputs. The `errors` dataframe connects directly to Bar Plot.
- Mapping uploads are capped at 2 MB and validated before execution.

## Bar Plot (`VZ-005`)

- Select a category column and one or more value columns.
- Supports vertical/horizontal layout, optional aggregation, sorting, and multiple guideline values with labels.

## P-P Plot (`VZ-006`)

- Produces normal probability-probability plots for multiple numeric columns.
- Supports Hazen, Weibull, and Blom plotting positions and always displays the `x = y` reference line.

## Sorted Gap Outlier (`AD-005`)

- Uses a robust tail-gap rule on sorted numeric values.
- Detects upper, lower, or both tails within a configured maximum tail fraction.
- Supports keep, nearest-boundary coercion, median replacement, or missing-value replacement.
- Returns a corrected dataframe, a detailed report, flag columns, and sorted stair plots.

## Correlation Matrix (`IN-006`)

- The primary output is now a rendered heatmap. The full correlation table remains available as a separate output.
