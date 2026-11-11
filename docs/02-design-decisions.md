# Design decisions

This document records the decisions behind the policy set: why the rules are shaped the way they
are, and which alternatives were rejected.

## 1. Deny-first, then allow

The eight deny rules occupy the lowest sequence IDs. FortiOS evaluates top-down and stops at the
first match, so putting denies first guarantees that a later allow cannot reopen a path the design
intends to block.

The alternative — allows first, then denies — works only if the allow rules are perfectly narrow.
It is fragile: adding a broad allow later silently weakens segmentation.

Deny rules are also **directional**. `DENY_ED_TO_BLOCKED` and `DENY_BLOCKED_TO_ED` are separate
rules because a single bidirectional object would not express "initiated by" semantics, and
FortiOS policies are unidirectional by nature.

## 2. One address object per department

Each department is a /32 address object even where no physical host exists. This makes the policy
matrix complete and reviewable, and it means the production cut-over only changes an object value
or adds hosts to a group — not the rule structure.

Department names follow the exported configuration:

| Report wording | Exported object |
| --- | --- |
| Maintenance & Support | `Maintenance_Strategy` |
| KAISA Web Server | `Kaisa_Webserver` |
| All departments | `GRP_ALL_DEPARTMENT` |

Renaming objects to match prose would break CLI snippets and make the evidence harder to verify,
so the repository follows the export and explains the mapping.

## 3. Split work hours around lunch

`WORK_HOUR_AM` (08:00–12:00), `WORK_HOUR_PM` (13:00–17:00) and `BREAK` (12:00–13:00) are separate
recurring schedules. They cannot overlap.

If a single 08:00–17:00 schedule had been used with a break exception inside the same policy, the
result would depend on profile evaluation order and would be difficult to test. Separate schedules
make the time boundary explicit and make each policy's intent obvious in the GUI.

The cost is one extra internet policy line and one extra web-filter profile. That cost is small
compared with the auditability gain.

## 4. A separate break profile

`WF_KAISA_Break` relaxes exactly one category: Social Networking. All other categories follow the
work-hours behaviour. Cloning the work-hours profile rather than editing it means the break
exception cannot leak into the work-hours policy when the profile is later tuned.

## 5. SNAT through a pool, not the interface address

`IPPOOL_KAISA_SNAT` (10.200.2.100–10.200.2.120) is an overload pool. Using a pool instead of the
port2 interface address:

- avoids tying outbound identity to the firewall's own management address;
- provides a larger translation space than a single address;
- makes the translated range easy to find in forward-traffic logs and in the test plan.

The pool range and interface address are on the same /24, so return routing in the lab does not
need an extra static route. In production the pool would be a routed range.

## 6. VIP with port forwarding

`VIP_KAISA_WEBSERVER` maps 10.200.2.1:8080 to 10.0.1.20:80. Port forwarding keeps the internal
service on its native port while publishing a non-standard external port, which reduces blind
scanning traffic. The inbound policy permits only HTTP and HTTPS, and the destination is the VIP
object rather than the server's real address.

## 7. Business and non-work shapers

Two shared shapers separate the bandwidth guarantee from the cap:

- `SHAPER_BUSINESS`: 20 Mbps guaranteed, 100 Mbps maximum.
- `SHAPER_NONWORK`: 1 Kbps guaranteed, 5 Mbps maximum, low priority.

The guarantee protects business traffic when the link is congested; the maximum stops non-work
traffic from consuming the whole link. The intended binding is a traffic-shaping policy targeting
social media and streaming applications, applied after the security profiles.

## 8. Logging

Deny rules in the export have `set logtraffic disable`. That is acceptable in a lab where the
denies are demonstrated by ping failures, but production should log denies (and ideally allows) to
a central collector. This is listed as a recommendation rather than changed silently.

## 9. What was deliberately not built

- **No intra-department rules.** A department is one endpoint; its traffic never crosses the
  firewall.
- **No any-any allow.** The implicit deny is the default for unlisted paths.
- **No ISFW or Remote-FortiGate configuration.** These are Part A scope.
- **No production VLAN changes.** The pod topology is fixed. The VLAN-per-department design is a
  recommendation, not a claim that it was implemented.

## 10. Honesty about enforcement

A policy set can be correct on paper and unenforceable in the pod. Three departments share
10.200.1.0/24, so their mutual traffic is switched. The site marks those pairs **L2 · not
inspected** instead of pretending the deny rules apply. Similarly, internet policies accept
`port3` ingress only, so port1 departments have no working internet path in this pod.

These are documented in [07-verification-notes.md](07-verification-notes.md).
