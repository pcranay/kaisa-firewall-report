# Security policy

## Scope

This repository is a static, client-side report. It has no backend, no database, no authentication
and no analytics. It makes no network requests at runtime and stores only the test-checklist state
in the browser's `localStorage`.

## No secrets are published

The original lab artefacts include a full FortiGate backup and report screenshots containing lab
identifiers. Neither is published.

Removed before publication:

- administrator accounts, password hashes and `ENC` values;
- SSH private keys and certificates;
- device serial numbers and UUIDs;
- student identifiers, email addresses and the university lab header;
- browser chrome around screenshots.

Only the firewall, address, NAT, schedule, shaper and policy objects required to understand the
design are included. See [`config/README.md`](config/README.md).

If you believe a secret or personal identifier is still present, please report it privately rather
than opening a public issue.

## Reporting a problem

For a sensitive disclosure, contact the repository owner through the GitHub profile listed on the
repository page. For non-sensitive corrections — a wrong object name, a broken link, an inaccurate
test step — open a normal GitHub issue.

Please include:

1. the file and line or screenshot;
2. what is wrong;
3. the corrected value or source.

## Configuration caveat

`config/kaisa-fortigate-sanitised.conf` is a **partial** configuration extract. Do not restore it
onto a production FortiGate. It omits management, routing, licensing and logging state and is
provided for review and lab reconstruction only.

## Supported versions

The report documents FortiOS 7.4.4 build 2662. FortiOS behaviour, category IDs and CLI field names
can change between releases. Verify commands against the target firmware before applying them.
