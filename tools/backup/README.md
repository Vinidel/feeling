# Backup workflow

This operator-only Deno tool packages the three PostgreSQL 17 logical exports
(`roles.sql`, `schema.sql`, and `data.sql`) with a strictly allowlisted,
content-free manifest and encrypts the archive with AES-256-GCM. It never writes
the plaintext archive to disk.

The `pack` operation writes a new ciphertext file and refuses to overwrite an
existing path. The `verify` operation authenticates the ciphertext, verifies
every component checksum, and writes the SQL plus manifest into a new mode-0700
directory for an empty-target restore. Its JSON output contains only versions,
regions, aggregate counts, sizes, and SHA-256 values.

Run it using the pinned Deno 2.9.4 container and the environment contract in
`docs/runbooks/backup.md`. Only `BACKUP_ENCRYPTION_KEY` is secret. Do not supply
database or Storage credentials to this tool.
