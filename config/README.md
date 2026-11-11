# Sanitised configuration extract

This directory contains the firewall-relevant portion of the Local-FortiGate 7.4.4 export, plus
spreadsheet- and machine-friendly views of the policy set.

## Files

| File | Purpose |
| --- | --- |
| `kaisa-fortigate-sanitised.conf` | FortiOS objects and 18 policies; importable as a reference, not a full backup |
| `firewall-policies.csv` | One row per policy with objects, networks, NAT and verification flags |
| `firewall-policies.json` | Policies plus departments, interfaces, groups, schedules and profiles |
| `interaction-matrix.csv` | All 64 source/destination verdicts, including the server and internet |
| `design-intent-utm.md` | Intended web-filter, application-control and shaping bindings that are absent from the export |

## What was removed

The source export is a full device backup. Publishing it unchanged would expose material that has no
place in a portfolio repository. The extract excludes:

- administrator accounts and access profiles;
- password hashes and `ENC` values;
- SSH private keys, certificates and local keys;
- device serial numbers, UUIDs and build metadata;
- VPN, PKI, logging, DHCP and unused default objects;
- the full `system global` and administrative configuration.

The remaining objects are the ones needed to understand and reproduce the Part B policy design:
interfaces, addresses, address groups, schedules, IP pool, VIP, shapers and firewall policies.

## Fidelity

The extract preserves the exported values, including the discrepancies documented in
[`docs/07-verification-notes.md`](../docs/07-verification-notes.md):

- `ALLOW_INTERNET_WORKHOURS_PM` uses `dstintf "port1"`;
- `ALLOW_INBOUND_WEBSERVER` uses `dstintf "port1"`;
- internal allow policies have `set nat enable`;
- the internet policies have no UTM profile bindings.

It does **not** "fix" them silently. A configuration extract that quietly corrects the device is
not evidence.

The file also omits the KAISA web-filter and application-control objects because they do not appear
in the source export. The intended definitions are described in
[`design-intent-utm.md`](design-intent-utm.md).

## Importing

Do not restore this file onto a production device. It is a partial configuration and would not
include the management, routing or licensing state required for a working firewall.

For a lab rebuild, create the objects in the order used by
[`docs/05-implementation.md`](../docs/05-implementation.md), or paste individual stanzas into the
CLI after reviewing them. FortiOS accepts `config`/`edit`/`next`/`end` blocks in CLI console mode.

## Regenerating

The CSV, JSON and configuration extract were generated from `assets/data.js`, which is the single
source of truth for the site. If the policy data changes, regenerate all three together so the site
and the exports do not drift.

## Verification

Before reuse, check:

1. interface addresses and allowed access;
2. group membership (especially `GRP_ALL_DEPARTMENT`);
3. schedule windows and time zone;
4. pool range and return routing;
5. VIP external address, port and mapped address;
6. policy order — denies must precede allows;
7. that no secret material was reintroduced.
