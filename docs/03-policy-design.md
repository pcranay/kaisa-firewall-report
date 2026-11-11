# Policy design reference

The deployed rule set contains **18 policies** with sequence IDs 2–19. FortiOS evaluates them in
sequence order and stops at the first match.

## 1. Rule table

| Seq | Policy | Ingress → egress | Source | Destination | Schedule | Service | Action | NAT / profiles |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| 2 | `DENY_BLOCKED_TO_TI` | port1 → port3 | `GRP_TI_BLOCKED` | `Tech_Innovation` | always | ALL | Deny | — |
| 3 | `DENY_TI_TO_P1` | port3 → port1 | `Tech_Innovation` | `GRP_TI_BLOCKED` | always | ALL | Deny | — |
| 4 | `DENY_CS_TO_BLOCKED` | port1 → port3 | `Corporate_Services` | `GRP_CS_BLOCKED` | always | ALL | Deny | — |
| 5 | `DENY_BLOCKED_TO_CS` | port3 → port1 | `GRP_CS_BLOCKED` | `Corporate_Services` | always | ALL | Deny | — |
| 6 | `DENY_ED_TO_BLOCKED` | port1 → port3 | `Engineering_Design` | `GRP_ED_BLOCKED` | always | ALL | Deny | — |
| 7 | `DENY_BLOCKED_TO_ED` | port3 → port1 | `GRP_ED_BLOCKED` | `Engineering_Design` | always | ALL | Deny | — |
| 8 | `DENY_EX_TO_MS` | port3 → port1 | `Executive_Strategy` | `Maintenance_Strategy` | always | ALL | Deny | — |
| 9 | `DENY_MS_TO_EX` | port1 → port3 | `Maintenance_Strategy` | `Executive_Strategy` | always | ALL | Deny | — |
| 10 | `ALLOW_EX_TO_CS` | port3 → port1 | `Executive_Strategy` | `Corporate_Services` | always | ALL | Accept | NAT on |
| 11 | `ALLOW_CS_TO_EX` | port1 → port3 | `Corporate_Services` | `Executive_Strategy` | always | ALL | Accept | NAT on |
| 12 | `ALLOW_PD_TO_ED` | port3 → port1 | `Project_Delivery` | `Engineering_Design` | always | ALL | Accept | NAT on |
| 13 | `ALLOW_ED_TO_PD` | port1 → port3 | `Engineering_Design` | `Project_Delivery` | always | ALL | Accept | NAT on |
| 14 | `ALLOW_PD_TO_MS` | port3 → port1 | `Project_Delivery` | `Maintenance_Strategy` | always | ALL | Accept | NAT on |
| 15 | `ALLOW_MS_TO_PD` | port1 → port3 | `Maintenance_Strategy` | `Project_Delivery` | always | ALL | Accept | NAT on |
| 16 | `ALLOW_INTERNET_WORKHOURS_AM` | port3 → port2 | `GRP_ALL_DEPARTMENT` | all | `WORK_HOUR_AM` | ALL | Accept | SNAT `IPPOOL_KAISA_SNAT` · WF/AC/shaper |
| 17 | `ALLOW_INTERNET_WORKHOURS_PM` | port3 → port1 ⚠ | `GRP_ALL_DEPARTMENT` | all | `WORK_HOUR_PM` | ALL | Accept | SNAT `IPPOOL_KAISA_SNAT` · WF/AC/shaper |
| 18 | `ALLOW_INTERNET_BREAK` | port3 → port2 | `GRP_ALL_DEPARTMENT` | all | `BREAK` | ALL | Accept | SNAT `IPPOOL_KAISA_SNAT` · WF/AC/shaper |
| 19 | `ALLOW_INBOUND_WEBSERVER` | port2 → port1 ⚠ | all | `VIP_KAISA_WEBSERVER` | always | HTTP, HTTPS | Accept | DNAT |

⚠ = the exported egress interface differs from the design intent. See
[07-verification-notes.md](07-verification-notes.md).

## 2. Justifications

### 2.1 Innovation zone (policies 2–3)

Requirements 3 and 5 make Technology & Innovation a restricted zone while allowing it to exchange
information with the authorised innovation teams. In this pod, Corporate Services, Engineering &
Design and Maintenance & Support are the excluded peers, so both directions are denied.

### 2.2 Corporate Services boundary (policies 4–5)

Corporate Services holds administrative and financial functions. Project Delivery, Engineering &
Design and Maintenance & Support are denied in both directions, while the approved Executive
relationship is handled by policies 10–11.

### 2.3 Engineering & Design protection (policies 6–7)

Engineering data and intellectual property are isolated from Executive & Strategic Planning and
Maintenance & Support. Project Delivery is the approved collaborator and is handled by policies
12–13.

### 2.4 Executive / Maintenance separation (policies 8–9)

Executive systems and maintenance systems cannot initiate sessions to each other. This is a
separation-of-duties control: maintenance accounts are powerful and must not be reachable from
executive endpoints, and executive endpoints must not be reachable from maintenance tooling.

### 2.5 Approved collaboration (policies 10–15)

Six directional allow rules cover the approved pairs:

```text
Executive & Strategic Planning  ↔  Corporate Services
Project Delivery & Operations   ↔  Engineering & Design
Project Delivery & Operations   ↔  Maintenance & Support
```

Each direction has its own rule so the session origin is explicit and logging identifies the
initiating department.

### 2.6 Internet access (policies 16–18)

Work-hours access is split into AM and PM. The break policy uses a separate schedule and a separate
web-filter profile that permits social networking only between 12:00 and 13:00. All three policies
apply SNAT through `IPPOOL_KAISA_SNAT`, the intended web-filter and application-control profiles,
and the business shaper.

In the pod, these policies use `port3` as the ingress interface because the test client and the
reserved department addresses are on 10.0.1.0/24. The three port1 departments do not have an
internet path unless a matching ingress policy or a routed/VLAN redesign is added.

### 2.7 Inbound publication (policy 19)

`VIP_KAISA_WEBSERVER` maps external 10.200.2.1:8080 to the internal web server 10.0.1.20:80.
Only HTTP and HTTPS are permitted. The VIP is the destination object, so the internal address is
never exposed as a policy destination.

## 3. Group membership

| Group | Members |
| --- | --- |
| `GRP_TI_BLOCKED` | Corporate Services, Engineering & Design, Maintenance & Support |
| `GRP_CS_BLOCKED` | Project Delivery, Engineering & Design, Maintenance & Support |
| `GRP_ED_BLOCKED` | Executive & Strategic Planning, Maintenance & Support |
| `GRP_ALL_DEPARTMENT` | All six departments |

## 4. Evaluation examples

### 4.1 Technology & Innovation → Corporate Services, work hours

1. Policies 2–9 are checked. Policy 3 (`DENY_TI_TO_P1`) matches source `Tech_Innovation`,
   destination `GRP_TI_BLOCKED` (which contains Corporate Services) and schedule `always`.
2. The packet is denied before any allow or internet rule is reached.

### 4.2 Project Delivery → Engineering & Design, work hours

1. Policy 2 requires source `GRP_TI_BLOCKED` — no match.
2. Policy 6 requires source `Engineering_Design` — no match.
3. Policies 10–11 require Executive or Corporate Services — no match.
4. Policy 12 matches and accepts.
5. Because both departments share 10.0.1.0/24 in this pod, the real frame would be switched and
   never reach the firewall. The site reports **L2 · not inspected** for this pair. The rule exists
   for the production VLAN design.

### 4.3 Corporate Services → Internet, 10:00

1. The deny rules do not match a destination of `all`.
2. Policies 16 and 18 have the right source but the wrong schedule or ingress.
3. Policy 16 has `WORK_HOUR_AM` and matches the time, but its ingress is `port3`; Corporate
   Services is on `port1`. No policy matches.
4. Result: implicit deny. This is the documented pod limitation, not a design intent.

### 4.4 Technology & Innovation → Internet, 12:30

1. Policies 16 and 17 are outside their schedules.
2. Policy 18 (`ALLOW_INTERNET_BREAK`) matches `GRP_ALL_DEPARTMENT`, `BREAK` and ingress `port3`.
3. The break web-filter profile permits Social Networking; application control and the business
   shaper still apply.
4. Source NAT translates the session to the `IPPOOL_KAISA_SNAT` range.

## 5. Machine-readable exports

- [`config/firewall-policies.csv`](../config/firewall-policies.csv) — one row per policy, with
  networks, objects, NAT and verification flags.
- [`config/firewall-policies.json`](../config/firewall-policies.json) — the same data plus
  departments, groups, schedules and profiles.
- [`config/interaction-matrix.csv`](../config/interaction-matrix.csv) — all 64 source/destination
  verdicts.
