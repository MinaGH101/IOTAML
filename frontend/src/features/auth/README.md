# Auth feature boundary

Authentication UI remains under the compatibility `src/auth` route tree. Token persistence and unauthorized handling are isolated in `shared/auth` and `app/providers/AuthProvider`; new auth work belongs in this feature boundary.
