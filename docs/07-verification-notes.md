# Verification notes

These notes compare the sanitised FortiOS 7.4.4 export with the written design intent. They are
part of the deliverable: a configuration review that hides its discrepancies is less useful than
one that records them.

Nothing in this document changes the lab result. It records what a production hand-over should
check before the rule set is trusted.

## 1. Method

The review used the exported configuration dated **2026-10-16** and the written report. For each
policy, the following were compared:

1. sequence order and action;
2. source and destination objects;
3. ingress and egress interfaces;
4. schedule and service;
5. NAT mode and pool/VIP reference;
6. UTM profile and shaper binding.

Useful CLI checks:

```text
show firewall policy
show firewall ippool
show firewall vip
show firewall shaper traffic-shaper
show firewall schedule recurring
show webfilter profile
show application list
```

## 2. Summary

| ID | Finding | Severity | Status in export |
| --- | --- | --- | --- |
| V1 | PM internet policy egresses `port1` instead of `port2` | High | Confirmed |
| V2 | Inbound web-server policy egresses `port1` instead of `port3` | High | Confirmed |
| V3 | No web-filter or application-control profiles in the export | High | Confirmed |
| V4 | Internal allow rules have source NAT enabled | Medium | Confirmed |
| V5 | Internet policies accept ingress from `port3` only | Medium | Design limitation |
| V6 | Same-segment departments bypass the firewall | Medium | Design limitation |
| V7 | Deny rules do not log traffic | Low | Confirmed |

## 3. Findings

### V1 — PM internet policy egress interface

**Object:** `ALLOW_INTERNET_WORKHOURS_PM` (sequence 17)

The exported policy stores:

```text
set srcintf "port3"
set dstintf "port1"
set srcaddr "GRP_ALL_DEPARTMENT"
set dstaddr "all"
set schedule "WORK_HOUR_PM"
set nat enable
set poolname "IPPOOL_KAISA_SNAT"
```

The design intent is `dstintf "port2"`, the only routed internet path via the Linux router
10.200.2.254. As exported, afternoon sessions would be routed towards the port1 management
segment with a source address from the 10.200.2.100–120 pool. That is both functionally wrong and
a potential leak into a trusted segment.

AM and BREAK use `port2` correctly, which makes this look like a data-entry error rather than an
intentional design.

**Recommended correction:**

```text
config firewall policy
    edit 17
        set dstintf "port2"
    next
end
```

**Retest:** repeat test 4 and test 6 during the 13:00–17:00 window, not only in the morning.

### V2 — Inbound web-server egress interface

**Objects:** `ALLOW_INBOUND_WEBSERVER` (sequence 19), `VIP_KAISA_WEBSERVER`

The VIP maps external 10.200.2.1:8080 to 10.0.1.20:80. The server sits on `port3`
(10.0.1.0/24). The policy stores `srcintf "port2"` but `dstintf "port1"`.

```text
edit 19
    set name "ALLOW_INBOUND_WEBSERVER"
    set srcintf "port2"
    set dstintf "port1"
    set srcaddr "all"
    set dstaddr "VIP_KAISA_WEBSERVER"
    set service "HTTP" "HTTPS"
next
```

A DNAT session needs to be forwarded towards the mapped server's segment. With `port1` as the
egress, the translated packet is directed at the wrong interface. The curl test (test 10) should
therefore be run before the policy is described as working.

**Recommended correction:** set `dstintf "port3"` and retest from the external side of the pod.

### V3 — Security profiles missing from the export

**Objects:** `WF_KAISA_WorkHours`, `WF_KAISA_Break`, `AC_KAISA`

The written report and the GUI screenshots describe the profiles as created, but the exported
configuration contains no `config webfilter profile` stanza for either KAISA profile and no
`config application list` stanza for `AC_KAISA`. The internet policies also have no:

```text
set utm-status enable
set webfilter-profile ...
set application-list ...
```

This means the export alone cannot demonstrate web filtering, SafeSearch enforcement, application
control or profile-based shaping. The controls may exist in the running configuration at the time
the screenshots were taken and have been lost or omitted from this export; that cannot be resolved
from the file.

**Recommended correction:** recreate or restore the profiles, bind them to the three internet
policies, enable UTM on those policies, take a fresh backup and attach the relevant
`show` output as evidence.

**Retest:** tests 5–9 and 12.

### V4 — Source NAT on internal allow rules

**Objects:** `ALLOW_EX_TO_CS`, `ALLOW_CS_TO_EX`, `ALLOW_PD_TO_ED`, `ALLOW_ED_TO_PD`,
`ALLOW_PD_TO_MS`, `ALLOW_MS_TO_PD`

All six internal allow rules contain `set nat enable`. The design expects NAT off for
department-to-department traffic so the original source address is preserved for logging,
troubleshooting and any downstream policy that keys on the source.

In the pod, NAT on an internal rule may also hide which department initiated a session, which
weakens the audit trail the directional rules are meant to provide.

**Options:**

- remove `set nat enable` from the six rules (preferred, matches the design); or
- keep it and document a deliberate reason.

Either way, the discrepancy should not remain implicit.

### V5 — Internet ingress is port3 only

**Objects:** `ALLOW_INTERNET_WORKHOURS_AM`, `ALLOW_INTERNET_WORKHOURS_PM`,
`ALLOW_INTERNET_BREAK`

All three internet policies use `srcintf "port3"`. The Local-Client and the reserved department
addresses are on port3, so the lab tests work. Corporate Services, Engineering & Design and
Maintenance & Support are on port1 and have no matching internet policy.

This is a pod limitation, not an export error: the lab has only one client segment. In production,
each department VLAN would have its own ingress policy, or the internet rules would accept both
internal interfaces explicitly.

**Production recommendation:** one internet policy per internal zone (or a zone-based interface
group), so that NAT, filtering and shaping apply consistently to every department.

### V6 — Same-segment departments are not filtered

Corporate Services (10.200.1.150), Engineering & Design (10.200.1.241) and Maintenance & Support
(10.200.1.210) share 10.200.1.0/24 on port1. Traffic between them is switched by the segment and
never reaches the FortiGate. The deny rules for these pairs cannot be enforced in the pod.

This is stated in the report and modelled explicitly in the site: the matrix marks those pairs
**L2 · not inspected**, not "allow" or "deny".

**Production recommendation:** one VLAN/subnet per department and a routed transit through the
firewall. That is the only way the pair-wise deny rules become real.

### V7 — Deny rules do not log

The eight deny policies carry `set logtraffic disable`. In the lab this keeps the logs quiet, but
production denies are exactly the events a security team needs: blocked lateral movement, policy
violations and scanning.

**Recommendation:** enable logging on denies and forward to FortiAnalyzer or a SIEM. Review the
log volume before enabling logging on every allow rule.

## 4. Non-findings

These were checked and are **not** defects.

### 4.1 17 versus 18 policies

The written policy table groups AM and PM into a single requirement line, giving 17 rows. The
export contains 18 stanzas (sequence 2–19) because AM and PM are separate scheduled policies. The
deployed count is 18. This is a presentation difference, not a missing rule.

### 4.2 Object naming

The narrative says "Maintenance & Support" and "KAISA_WebServer"; the export uses
`Maintenance_Strategy` and `Kaisa_Webserver`. The repository follows the export so CLI output and
evidence match. Renaming is cosmetic and not required.

### 4.3 No intra-department rules

A department is one endpoint; its traffic never crosses the firewall. The absence of rules for
traffic within a department is correct.

### 4.4 `ALLOW_INBOUND_WEBSERVER` has no explicit `set nat enable`

VIP destination NAT is applied by the VIP object itself. The absence of a `set nat enable` line is
not automatically a defect; the egress-interface issue (V2) is the finding to fix.

## 5. Hand-over checklist

- [ ] Correct `ALLOW_INTERNET_WORKHOURS_PM` egress to `port2`.
- [ ] Correct `ALLOW_INBOUND_WEBSERVER` egress to `port3`.
- [ ] Recreate `WF_KAISA_WorkHours`, `WF_KAISA_Break` and `AC_KAISA`; bind them and enable UTM.
- [ ] Decide and document the internal NAT policy.
- [ ] Enable deny logging and forward logs.
- [ ] Add internet ingress for port1 departments, or document that they are out of scope.
- [ ] Schedule the VLAN-per-department redesign.
- [ ] Take a fresh encrypted backup and store it outside the repository.
- [ ] Repeat tests 1–12 from the Local-Client and record the results.
