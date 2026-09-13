# Feedback21 trial release

- Application checkpoint `9e603fdba57b2ed01b112e174728d35c533b1932` was pushed to `origin/main` from the exclusive clean warm slot `general-5` with reused dependencies and no install.
- Trial `0.1.0-p10.20260913.123` uploaded successfully with production profile and description `访客缓存双二维码与CSV导出优化 9e603fd`.
- Frozen upload manifest: `03986dd58120567e31ba9d4d28b157acfd6cbbcbde80485f5b44c20618f5495c`. The immutable allocation, receipt, and remote tag bind the same version and application SHA.
- Add-only allowlist did not run. Two independent DoH providers agreed, but the resolved public endpoint's ED25519 host key did not match the formal-domain entry in the strict local `known_hosts` route. The workflow stopped before SSH and before `schedule-client-version-allowlist ensure`; no production state changed.
- Public probe after upload: previously allowed `.122` returned HTTP 200; new `.123` returned HTTP 426. API/Web were not deployed and no database, backup, migration, review submission, formal publication, or old-version retirement occurred.
- Xiaomi 14 acceptance is pending. Trial `.123` cannot call the production API until the strict host-key route is independently reconciled and add-only allowlist succeeds. Dual QR and immediate server export processing additionally require a separately authorized API deployment.
