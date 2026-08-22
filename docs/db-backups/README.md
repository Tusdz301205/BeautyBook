# Local database backups

This directory is for local, temporary PostgreSQL backups only. Backup files
may contain personal, authentication, booking, health, and financial data and
must never be committed, attached to tickets, or copied into deployment images.

Production backups must use encrypted object storage, restricted service
accounts, retention policies, access logging, and a regularly tested restore
procedure. Do not use this repository as backup storage.
