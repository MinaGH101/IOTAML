# Reliable training and data imports

## New nodes

| Node | Palette category | Purpose |
| --- | --- | --- |
| Training Preprocessor (MP-005) | ML Data Processing | Training-only imputation and scaling, independently fitted in each fold. |
| Persian Numbers / Dates (CL-011) | Data Cleaning | Convert selected Persian/Arabic numeric columns or Jalali dates. |
| Remove Duplicate Rows (CL-012) | Data Cleaning | Keep the first, last, or no occurrence of duplicate rows. |
| Group Summary (TR-022) | Transformation | Group by batch/category and compute mean, sum, min, max, median or count. |

Refresh the application after updating the backend to reload its node catalog.

## Training

Use **Upload CSV/Excel → Select Features & Target → Train/Test Split or K-Fold Split → Training Preprocessor → Model**.

The model fits its imputer, scaler and category encoding using training rows only. Each fold receives its own fitted pipeline; predictions reuse that pipeline. Missing numeric columns can use mean, median, most-frequent or constant imputation. Scaling supports standard, min-max, robust, max-absolute or none.

The ordinary Scaler and Imputation nodes remain available for exploratory analysis. Their output is marked as fitted preprocessing. Splitting that output now raises `PREPROCESSING_LEAKAGE`; reconnect the original data to the split and use Training Preprocessor afterward. Existing cached results are invalidated through updated node versions.

Selecting Run on a node executes that node and its upstream dependencies. Other branches and downstream nodes do not execute. Valid cached upstream results may be reused. Column choices use the actual connected output port, including derived columns. Removed source columns cannot be selected as new IDs; retain the desired ID in an earlier selection node. Old results are not used for column choices while the workflow has changed since its last run.

## Files and Persian values

Project uploads accept UTF-8 CSV, TSV, XLSX and XLS. Excel imports the first sheet, using its first row as column names. Upload, preview, execution and source lineage share the same reader.

Files are limited to 2,000 columns, 1,000,000 rows and 5,000,000 cells. XLSX expanded content is capped at 256 MiB. Existing storage quotas and upload byte limits still apply.

Use **Persian Numbers / Dates** to explicitly select columns for conversion. For example, `۱٬۲۳۴٫۵` becomes `1234.5`, and Jalali `۱۴۰۳/۰۱/۰۱` becomes Gregorian `2024-03-20`. Both Persian and Arabic digits are supported. Dates accept `YYYY/MM/DD` or `YYYY-MM-DD`. Choose whether invalid values stop the node or become missing. Unselected values remain unchanged; numeric-looking identifiers should be stored as text in the source file because ordinary CSV/Excel type inference still applies.

## SQL connections

The initial connector supports **PostgreSQL**, using installer-approved tables or views. Imports create a fixed dataset snapshot; they are not continuous synchronization. Database credentials never enter browser forms, workflow graphs or the source-list response.

Set `SQL_IMPORT_SOURCES` in the installation's environment, as a single JSON value:

```dotenv
SQL_IMPORT_SOURCES={"laboratory":{"url":"postgresql+psycopg2://reader:REPLACE_PASSWORD@db.example:5432/lab","tables":["public.measurements"],"users":["analyst@example.com"]}}
```

Use a dedicated database account with SELECT permission only. URL-encode special characters in credentials. List each permitted table/view and username explicitly. Administrators can access all configured sources; other users can see only sources listing their username and must also have edit permission on the destination project.

Open the project's data panel → **ورود داده از SQL**, select a connection and table, then import. The UI limits imports to 100,000 rows. The API accepts an explicit limit up to `SQL_IMPORT_MAX_ROWS` (default 100,000). Tables larger than the limit are rejected rather than silently truncated. Use a database view to filter large tables. Each connection has a 5-second connect timeout, a 30-second statement timeout, read-only transactions, streamed batches, and a 50 MiB snapshot limit. Primary-key order is used when available.

## Custom-code policy and deployment

Custom Python remains disabled. `ALLOW_CUSTOM_CODE=true` is rejected until an OS-isolated runner is implemented. Code deny-lists and Python socket patches are not treated as an isolation boundary. Row filters support comparisons, membership lists and boolean operators through a restricted evaluator; calls, attributes and external Python variables are rejected.

Rebuild and recreate API and worker containers when deploying these changes so the new dependencies and the warm worker's cached registry are updated. Preserve database and artifact volumes:

```bash
docker compose up -d --build api worker frontend
```

For production, include `-f docker-compose.yml -f docker-compose.prod.yml`. See [frontend testing](../frontend/TESTING.md) for the actual browser regression.
