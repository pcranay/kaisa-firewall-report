# Kaisa Incorporated — Firewall Policy Report

**Part B · Local-FortiGate · FortiOS 7.4.4**

## 1. Introduction and scope

Kaisa Incorporated has an existing network that needs stronger security to protect its systems,
data and employees. Part B of the assessment creates and configures security policies for the
organisation's six departments. The policies control communication between departments, manage
internet access, block unsafe websites and reduce exposure to web-borne threats.

The implementation is carried out on the **Local-FortiGate** (FortiGate-VM64, FortiOS 7.4.4)
using the graphical interface in the Netlab+ lab. The report explains the intent of each rule and
how web filtering, application control, source NAT (SNAT), destination NAT (DNAT) and traffic
shaping support the design.

The scope is limited to the Local-FortiGate. The Internal Segmentation Firewall (ISFW), the Server
host's 10.0.3.0/24 interface and the Remote-FortiGate belong to the wider Part A design and are not
configured here.

The work maps to four course learning outcomes:

| CLO | Focus | Evidence in this build |
| --- | --- | --- |
| CLO2 | Secure network design | Deny-first segmentation matrix; per-department address objects |
| CLO3 | Security tools against threats | Web filtering, application control, SafeSearch, least privilege |
| CLO4 | Secure communication | Directional allow rules, SNAT, VIP publication |
| CLO5 | Recommend and document solutions | Verification notes, production recommendations, test plan |

## 2. Assumptions

The pod does not contain a physical host for every department. The following assumptions make the
policy set complete and are stated rather than hidden.

| # | Assumption | Justification |
| ---: | --- | --- |
| 1 | Each department is represented by one IP address object. | The lab topology is fixed; address objects allow policies for all six departments even where no host exists. |
| 2 | The Local-Client (10.0.1.10) represents Technology & Innovation and is the test endpoint. | It is the only client on the LAN segment and is reachable from the pod console. |
| 3 | Corporate Services (10.200.1.150), Engineering & Design (10.200.1.241) and Maintenance & Support (10.200.1.210) are the routed appliances on 10.200.1.0/24. | These are the only other routed endpoints, giving real cross-segment traffic to test. |
| 4 | Executive & Strategic Planning (10.0.1.30) and Project Delivery & Operations (10.0.1.40) use reserved addresses on 10.0.1.0/24. | No host exists; the addresses complete the matrix and become real hosts in production. |
| 5 | Production would place each department in its own VLAN/subnet. | Only then is every policy enforceable. In the pod, same-segment traffic is switched and never reaches the firewall. |
| 6 | Internet traffic leaves through `port2` towards the Linux router 10.200.2.254. | This is the only routed path out of the pod and the correct egress for NAT. |
| 7 | The published web server is the Server host at 10.0.1.20. | It is the only server in the pod and the natural DNAT destination. |
| 8 | "Authorised innovation teams" means Project Delivery & Operations and Executive & Strategic Planning. | Requirement 5 names the same trio plus Technology & Innovation, so requirement 3 is read consistently with it. |
| 9 | Work hours are Mon–Fri 08:00–12:00 and 13:00–17:00; break is Mon–Fri 12:00–13:00. | Social media is permitted during the break; splitting work hours around lunch means the schedules never conflict. |
| 10 | Departments are single endpoints, so intra-department traffic needs no policy. | That traffic never crosses the FortiGate; adding rules for it would be inaccurate. |

## 3. Pod topology and interface facts

| Interface | IP address / mask | Access allowed | Role in Part B |
| --- | --- | --- | --- |
| `port1` | 10.200.1.1 / 24 | ping, https, ssh, http, fgfm | Trusted management/backup segment and routed department appliances |
| `port2` | 10.200.2.1 / 24 | ping, https, ssh, http | Internet-facing segment towards the Linux router 10.200.2.254 |
| `port3` | 10.0.1.254 / 24 | https, ssh, http | Internal LAN: Local-Client, Server host, ISFW |
| `port8` | 172.16.100.3 / 24 | ping, https, ssh, http, fgfm | Out-of-band management, not part of the assignment topology |

`port4–7` and `port9–10` are unassigned.

### 3.1 Design observations from the review

- The pod has only **two routed internal segments**: 10.0.1.0/24 on `port3` and 10.200.1.0/24 on
  `port1`. Departments placed on the same segment cannot be filtered against one another by the
  FortiGate, because their traffic is switched, not routed.
- The policy set is therefore written to be correct and enforceable, and the production
  recommendation is **one VLAN per department**.
- `port8` is not shown in the case-study diagram. It is left untouched so management access is
  preserved.
- The ISFW, the 10.0.3.0/24 server interface and the Remote-FortiGate are outside Part B scope;
  the pod design cannot be changed and a complete functioning network is not required.

## 4. Address objects and groups

### 4.1 Address objects

| # | Object name | Type | Value | Represents |
| ---: | --- | --- | --- | --- |
| 1 | `Tech_Innovation` | IP/Netmask | 10.0.1.10 / 32 | Technology & Innovation |
| 2 | `Executive_Strategy` | IP/Netmask | 10.0.1.30 / 32 | Executive & Strategic Planning |
| 3 | `Project_Delivery` | IP/Netmask | 10.0.1.40 / 32 | Project Delivery & Operations |
| 4 | `Corporate_Services` | IP/Netmask | 10.200.1.150 / 32 | Corporate Services |
| 5 | `Engineering_Design` | IP/Netmask | 10.200.1.241 / 32 | Engineering & Design |
| 6 | `Maintenance_Strategy` | IP/Netmask | 10.200.1.210 / 32 | Maintenance & Support |
| 7 | `Kaisa_Webserver` | IP/Netmask | 10.0.1.20 / 32 | Internal web server |

The exported configuration uses `Maintenance_Strategy` and `Kaisa_Webserver`; the written narrative
calls them "Maintenance & Support" and "KAISA_WebServer". This repository follows the exported
object names wherever it quotes configuration.

### 4.2 Address groups

| Group | Members | Purpose |
| --- | --- | --- |
| `GRP_TI_BLOCKED` | Corporate Services, Engineering & Design, Maintenance & Support | Departments denied access to/from Technology & Innovation |
| `GRP_CS_BLOCKED` | Project Delivery, Engineering & Design, Maintenance & Support | Departments denied access to/from Corporate Services |
| `GRP_ED_BLOCKED` | Executive & Strategic Planning, Maintenance & Support | Departments denied access to/from Engineering & Design |
| `GRP_ALL_DEPARTMENT` | All six departments | Internet-access source group |

Groups keep the policy set small and make membership changes auditable in one place. Note that
group membership is not symmetric by design: each deny rule protects a specific department from a
specific set of peers.

## 5. Schedules

| Object | Days | Time | Used by |
| --- | --- | --- | --- |
| `always` | Mon–Sun | 00:00–24:00 | All segmentation, collaboration and inbound rules |
| `WORK_HOUR_AM` | Mon–Fri | 08:00–12:00 | `ALLOW_INTERNET_WORKHOURS_AM` |
| `WORK_HOUR_PM` | Mon–Fri | 13:00–17:00 | `ALLOW_INTERNET_WORKHOURS_PM` |
| `BREAK` | Mon–Fri | 12:00–13:00 | `ALLOW_INTERNET_BREAK` |

Splitting the day around lunch is deliberate. The work-hours and break policies can never overlap,
so social media is permitted during the break without weakening the work-hours profile.

## 6. Policy design

Policies are evaluated top-down. The eight deny rules occupy sequence IDs 2–9, the six internal
allow rules 10–15, the three internet rules 16–18 and the inbound publication rule 19. Deny-first
ordering means an exception cannot accidentally bypass a segmentation control.

| # | Policy | Source | Destination | Schedule | Service | Action |
| ---: | --- | --- | --- | --- | --- | --- |
| 2 | `DENY_BLOCKED_TO_TI` | `GRP_TI_BLOCKED` | `Tech_Innovation` | always | ALL | Deny |
| 3 | `DENY_TI_TO_P1` | `Tech_Innovation` | `GRP_TI_BLOCKED` | always | ALL | Deny |
| 4 | `DENY_CS_TO_BLOCKED` | `Corporate_Services` | `GRP_CS_BLOCKED` | always | ALL | Deny |
| 5 | `DENY_BLOCKED_TO_CS` | `GRP_CS_BLOCKED` | `Corporate_Services` | always | ALL | Deny |
| 6 | `DENY_ED_TO_BLOCKED` | `Engineering_Design` | `GRP_ED_BLOCKED` | always | ALL | Deny |
| 7 | `DENY_BLOCKED_TO_ED` | `GRP_ED_BLOCKED` | `Engineering_Design` | always | ALL | Deny |
| 8 | `DENY_EX_TO_MS` | `Executive_Strategy` | `Maintenance_Strategy` | always | ALL | Deny |
| 9 | `DENY_MS_TO_EX` | `Maintenance_Strategy` | `Executive_Strategy` | always | ALL | Deny |
| 10 | `ALLOW_EX_TO_CS` | `Executive_Strategy` | `Corporate_Services` | always | ALL | Accept |
| 11 | `ALLOW_CS_TO_EX` | `Corporate_Services` | `Executive_Strategy` | always | ALL | Accept |
| 12 | `ALLOW_PD_TO_ED` | `Project_Delivery` | `Engineering_Design` | always | ALL | Accept |
| 13 | `ALLOW_ED_TO_PD` | `Engineering_Design` | `Project_Delivery` | always | ALL | Accept |
| 14 | `ALLOW_PD_TO_MS` | `Project_Delivery` | `Maintenance_Strategy` | always | ALL | Accept |
| 15 | `ALLOW_MS_TO_PD` | `Maintenance_Strategy` | `Project_Delivery` | always | ALL | Accept |
| 16 | `ALLOW_INTERNET_WORKHOURS_AM` | `GRP_ALL_DEPARTMENT` | all | WORK_HOUR_AM | ALL | Accept + SNAT |
| 17 | `ALLOW_INTERNET_WORKHOURS_PM` | `GRP_ALL_DEPARTMENT` | all | WORK_HOUR_PM | ALL | Accept + SNAT |
| 18 | `ALLOW_INTERNET_BREAK` | `GRP_ALL_DEPARTMENT` | all | BREAK | ALL | Accept + SNAT |
| 19 | `ALLOW_INBOUND_WEBSERVER` | all | `VIP_KAISA_WEBSERVER` | always | HTTP, HTTPS | Accept + DNAT |

The full justification for each rule is available in the interactive policy explorer and in
[`config/firewall-policies.csv`](../config/firewall-policies.csv).

### 6.1 Reading the matrix

The allow rules are intentionally directional. Executive ↔ Corporate Services, Project Delivery ↔
Engineering & Design and Project Delivery ↔ Maintenance & Support each have an explicit rule in
both directions. Every other department pair falls through to the implicit deny unless a deny rule
already covers it. The interaction matrix in the site shows the resulting state for all 64 pairs.

### 6.2 NAT

- **SNAT** — `IPPOOL_KAISA_SNAT` overloads outbound sessions across 10.200.2.100–10.200.2.120.
  The pool exists because the internet-facing path uses addresses on the port2 segment that are not
  the departments' own.
- **DNAT** — `VIP_KAISA_WEBSERVER` maps external 10.200.2.1:8080 to the internal Server host
  10.0.1.20:80. `ALLOW_INBOUND_WEBSERVER` permits only HTTP and HTTPS.

Internal allow rules use `set nat enable` in the export. The design intent is NAT off for
department-to-department traffic so source addresses are preserved for logging and troubleshooting;
this difference is recorded in the verification notes.

## 7. Security profiles and QoS

Internet policies are intended to carry three profiles:

| Profile | Scope | Key behaviour |
| --- | --- | --- |
| `WF_KAISA_WorkHours` | Work-hours internet | Blocks social networking, gambling, adult content, malicious sites, streaming, P2P, hacking and proxy avoidance; allows finance, education, IT, business, government, health and news; enforces SafeSearch |
| `WF_KAISA_Break` | Break internet | Allows social networking; all other categories behave as the work-hours profile |
| `AC_KAISA` | All internet policies | Blocks P2P/BitTorrent, anonymisers, remote-access tools, games and high-risk applications; allows Office 365, Google Workspace, Teams, Zoom, Webex, business and update traffic |
| `SHAPER_BUSINESS` | Work-hours internet | Shared shaper, 20 Mbps guaranteed, 100 Mbps maximum |
| `SHAPER_NONWORK` | Non-work traffic | Shared shaper, 1 Kbps guaranteed, 5 Mbps maximum, low priority |

`SHAPER_NONWORK` is designed for a traffic-shaping policy (`TSP_NonWork`) that targets social media
and streaming. The export contains the shaper but not the binding; see
[verification notes](07-verification-notes.md).

SafeSearch enforcement is a profile-level control for Google, Bing, YouTube, Yahoo and Yandex. It
prevents a user from disabling SafeSearch in browser settings.

## 8. Implementation

The build order is: address objects and groups → schedules → web-filter profiles → application
control → shapers → SNAT pool → VIP → policies → verification → backup. Each policy references
objects that must already exist.

The detailed steps, including CLI equivalents, are in [05-implementation.md](05-implementation.md).

## 9. Testing

Twelve tests cover the deny rules, internet reachability, category filtering, social media in work
hours and at break, banking, SafeSearch, DNAT, SNAT logging and QoS. Tests run from the
Local-Client, not the FortiGate, because traffic originated by the firewall itself is never
evaluated against forward policies.

The checklist is in [06-testing.md](06-testing.md) and in the interactive site.

## 10. Conclusion

The Local-FortiGate now expresses the Kaisa policy requirement as a deny-first, direction-aware
rule set with controlled internet access and a published internal service. The design separates
department trust zones, limits outbound content and applications, applies NAT at the correct
boundary and reserves bandwidth for business traffic.

The implementation also demonstrates the difference between a correct policy design and a
fully enforceable one. Same-segment departments and single-interface internet ingress are pod
limitations, not policy mistakes. Recording them, with a VLAN-per-department recommendation, is
part of delivering a defensible security solution.
