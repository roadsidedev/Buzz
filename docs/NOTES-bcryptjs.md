Purpose: Explain why `bcryptjs` was moved to runtime dependencies and how to rollback.

Summary
-------
`bcryptjs` was previously declared in `devDependencies` but is required at runtime by the auth service. The production Dockerfile runs `npm ci --omit=dev` which omits devDependencies and caused a runtime `ERR_MODULE_NOT_FOUND` for `bcryptjs` during container startup and healthchecks.

Change
------
- Moved `bcryptjs` from `devDependencies` to `dependencies` in `backend/package.json` so production installs include it.

Notes & Rollback
----------------
- If you prefer not to include `bcryptjs` in production deps, refactor the auth service to use a production dependency (e.g. `bcrypt` native) or change the Dockerfile to install specific dev deps — but this is less ideal for production image size and security.
- To rollback: move `bcryptjs` back to `devDependencies`, update lockfile, and adjust Dockerfile to `npm ci` (without `--omit=dev`) — not recommended.

Next steps
----------
1. Update lockfile(s) by running `npm install` or `npm ci` from the repository root so the lockfile reflects the dependency change.
2. Rebuild the Docker image used by Railway and redeploy.
3. (Optional) Add an integration smoke test that builds the production image and verifies `/health`.
