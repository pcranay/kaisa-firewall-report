# Test plan and verification

## 1. Method

All tests are executed from the **Local-Client (10.0.1.10)**, which represents Technology &
Innovation. Testing from the FortiGate console is invalid for forward policies: traffic originated
by the firewall itself is not evaluated against `config firewall policy`.

Record each result as pass, fail or not run. The interactive site keeps this checklist in
`localStorage`; nothing is uploaded.

## 2. Tests

| # | Area | Action | Expected result | Why it matters |
| ---: | --- | --- | --- | --- |
| 1 | Deny — Corporate Services | `ping 10.200.1.150` | Request timed out | Confirms `DENY_TI_TO_P1` blocks the segment |
| 2 | Deny — Engineering & Design | `ping 10.200.1.241` | Request timed out | Confirms the same deny rule covers engineering |
| 3 | Deny — Maintenance & Support | `ping 10.200.1.210` | Request timed out | Confirms the group membership is correct |
| 4 | Internet reachability | `ping 8.8.8.8` | Replies received | Confirms the internet policy and SNAT |
| 5 | Web category filtering | Browse a known gambling or adult site during work hours | FortiGuard replacement message | Confirms category blocking |
| 6 | Social media in work hours | Browse a social-networking site during work hours | Blocked by `WF_KAISA_WorkHours` | Confirms the work-hours profile |
| 7 | Social media at break | Repeat between 12:00 and 13:00 | Permitted by `WF_KAISA_Break` | Confirms the schedules do not overlap |
| 8 | Banking access | Browse an online banking site | Permitted | Confirms Finance and Banking is allowed explicitly |
| 9 | SafeSearch | Search on Google and inspect settings | SafeSearch locked / enforced | Confirms the profile-level control |
| 10 | Destination NAT | `curl http://10.200.2.1:8080` from the external client | HTTP response from the internal server | Confirms the VIP and inbound policy |
| 11 | Source NAT and logging | Log & Report → Forward Traffic, filter the internet policy | Session source translated to 10.200.2.100–120 | Confirms the pool is used |
| 12 | QoS behaviour | Generate non-work traffic and watch the bandwidth widget | Non-work traffic capped and de-prioritised | Confirms the shapers |

## 3. Result log

| # | Date | Tester | Result | Notes |
| ---: | --- | --- | --- | --- |
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |
| 6 | | | | |
| 7 | | | | |
| 8 | | | | |
| 9 | | | | |
| 10 | | | | |
| 11 | | | | |
| 12 | | | | |

The repository does not claim that all tests passed. The written report describes the expected
behaviour; screenshots document the build. Fill this log from your own run.

## 4. Interpretation notes

### 4.1 A timeout is the expected deny signal

The deny rules drop traffic silently. `ping` reports request timeouts, not "destination
unreachable". Do not treat the absence of an ICMP error as a failure of the rule.

### 4.2 Scheduling tests need a clock check

Test 6 and test 7 only make sense inside the relevant window. Check the FortiGate's time zone
(the lab used US/Pacific) and the schedule definitions before concluding that a policy is broken.
The schedules are Mon–Fri; weekend testing will always hit the implicit deny.

### 4.3 Tests 1–3 only prove the routed path

Corporate Services, Engineering & Design and Maintenance & Support are routed through the
FortiGate, so the deny rules are exercised. Traffic between two port1 departments would be
switched and would not be filtered, which is why the design calls for one VLAN per department.

### 4.4 Test 4 depends on the internet policy ingress

`ALLOW_INTERNET_WORKHOURS_AM/PM/BREAK` use `port3` as the ingress interface. The Local-Client is
on `port3`, so the test works from there. A client on `port1` would not match those policies and
would be denied. That is a pod limitation, documented in
[07-verification-notes.md](07-verification-notes.md).

### 4.5 Test 10 needs the right interface

The VIP is bound to `extintf port2`. Run the curl from the external side of the lab, or from a
host routed to 10.200.2.1. Running it from the Local-Client on `port3` tests a different path.

### 4.6 Test 12 is qualitative

The dashboard bandwidth widget shows the effect but is not a precise measurement. For a defensible
QoS result, capture interface throughput or shaper statistics before and after generating
non-work traffic.

## 5. Evidence to capture

For each test, capture:

1. the command or browser action;
2. the result;
3. a timestamp;
4. the relevant log entry (forward traffic) where applicable.

Crop screenshots to the FortiGate content area and remove any student, lab or personal identifiers
before attaching them to a report.
