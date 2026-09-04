# Network and VPN/TUN routing

Read this reference for GitHub fetch/push, Mini Program upload, ECS SSH, or HTTPS verification. Keep the
target-specific route in ignored `runtime/codex/network-profile.local.json`; never commit real IPs, private
keys, cookies, tokens, or authorization headers.

Do not change system hosts, system VPN/DNS, certificate verification, or SSH host-key verification. Keep
HTTPS hostname/SNI/Host and TLS certificate checks intact while controlling only process-level resolution.

## Target-specific policy

- GitHub: inspect proxy environment and the configured remote once. Use the normal transport once, diagnose
  a TLS failure once, retry once, and switch once to a previously verified process-level fallback if one is
  recorded. A network failure never triggers a new build or test.
- WeChat upload: check whether `servicewechat.com` resolves to a `198.18.0.0/15` Fake-IP, an IPv6-only
  answer, or another known TUN address. Use the previously verified process-level lookup/DNS override to
  bind the real IPv4 while preserving the hostname and certificate validation. Do not assume that the
  GitHub route or an ECS route is valid for WeChat.
- ECS SSH: run one bounded preflight against the canonical hostname/SSH alias from the local profile. A
  direct-IP fallback is valid only with `HostKeyAlias` (or an equivalent verified identity) and
  `StrictHostKeyChecking` still enabled. A banner timeout permits the recorded fallback once; it does not
  permit repeated blind retries. ECS operations remain L4 and are not implied by a Mini-only task.

Record the selected route, preflight result, fallback reason, and timestamp in the ignored task state. Once
a route succeeds for the task, reuse it and do not repeat network diagnosis for every subsequent command.
