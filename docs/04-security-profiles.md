# Security profiles and QoS

The internet policies are the only rules that carry unified threat management (UTM) profiles.
Internal segmentation rules are intentionally profile-free: their job is to permit or deny a path,
not to inspect content.

## 1. Web filter

### 1.1 `WF_KAISA_WorkHours`

| Category / control | Action | Rationale |
| --- | --- | --- |
| Social Networking | Block | Non-business use during work hours; relaxed only at break |
| Games / Gambling | Block | Productivity and financial-risk categories |
| Adult / Mature Content | Block | Inappropriate content and employment-risk exposure |
| Malicious Websites, Phishing, Spam, Newly Registered Domains | Block | Primary web-borne threat vectors |
| Streaming Media, Peer-to-peer File Sharing | Block | Bandwidth abuse and malware delivery |
| Hacking, Proxy Avoidance, Illegal or Unethical | Block | Prevents filter bypass and policy circumvention |
| Finance and Banking | Allow | Required for online business banking |
| Education, Information Technology, Business, Technology | Allow | Legitimate research and professional development |
| Government, Health, News and Media | Allow | Business information |
| SafeSearch (Google, Bing, YouTube, Yahoo, Yandex) | Enforce | Locks the safe-search setting in the browser |

The profile is applied to `ALLOW_INTERNET_WORKHOURS_AM` and `ALLOW_INTERNET_WORKHOURS_PM`.

### 1.2 `WF_KAISA_Break`

A clone of the work-hours profile with **Social Networking** changed to Allow. Every other category
keeps the work-hours behaviour. It is applied only to `ALLOW_INTERNET_BREAK`, which uses the
`BREAK` schedule (Mon–Fri 12:00–13:00).

Separating the profiles matters: editing the work-hours profile later cannot accidentally open
social media during work hours.

## 2. Application control — `AC_KAISA`

| Application / category | Action | Rationale |
| --- | --- | --- |
| P2P / BitTorrent | Block | Malware delivery, data exfiltration and bandwidth abuse |
| Proxy / VPN and Anonymiser | Block | Prevents users bypassing the web filter |
| Remote Access (TeamViewer, AnyDesk, LogMeIn) | Block | Unapproved unattended access to corporate endpoints |
| Games | Block | Non-business use |
| Botnet, High risk, Unknown risk | Block | Known-bad and unclassified traffic |
| Office 365, Google Workspace, Microsoft Teams, Zoom, Webex | Allow | Approved collaboration |
| Business, Update | Allow | Business applications and patching |

`AC_KAISA` is applied to all three internet policies, including the break policy. The break
exception relaxes only social networking; peer-to-peer, anonymisers and remote-access tools remain
blocked at lunch.

## 3. SafeSearch

SafeSearch is enforced at the profile level for Google, Bing, YouTube, Yahoo and Yandex. The
FortiGate rewrites the search preference so a user cannot disable it locally. This is the control
behind test 9 in the test plan.

## 4. Traffic shaping

| Shaper | Type | Guaranteed | Maximum | Priority | Intended use |
| --- | --- | ---: | ---: | --- | --- |
| `SHAPER_BUSINESS` | Shared | 20,000 Kbps | 100,000 Kbps | High (default) | Internet policies, business traffic |
| `SHAPER_NONWORK` | Shared | 1 Kbps | 5,000 Kbps | Low | Social media and streaming via `TSP_NonWork` |

The business shaper protects the working baseline. The non-work shaper deliberately provides almost
no guarantee and a hard cap, so background media cannot starve business applications.

### 4.1 Intended binding

```text
ALLOW_INTERNET_*  →  SHAPER_BUSINESS (shared shaper on the policy)
TSP_NonWork       →  SHAPER_NONWORK (traffic-shaping policy for social/streaming)
```

The export contains both shaper objects but not the `TSP_NonWork` binding or the policy-level UTM
bindings. This is recorded in [07-verification-notes.md](07-verification-notes.md) rather than
silently added.

## 5. Profile-to-policy binding

| Policy | Web filter | Application control | Shaper |
| --- | --- | --- | --- |
| `ALLOW_INTERNET_WORKHOURS_AM` | `WF_KAISA_WorkHours` | `AC_KAISA` | `SHAPER_BUSINESS` |
| `ALLOW_INTERNET_WORKHOURS_PM` | `WF_KAISA_WorkHours` | `AC_KAISA` | `SHAPER_BUSINESS` |
| `ALLOW_INTERNET_BREAK` | `WF_KAISA_Break` | `AC_KAISA` | `SHAPER_BUSINESS` |
| Internal allow rules | — | — | — |
| `ALLOW_INBOUND_WEBSERVER` | — | — | — |

## 6. Why these profiles, in security terms

- **Least functionality.** Blocking categories rather than allowing a short list avoids the
  maintenance burden and false negatives of an allow-list while still removing the highest-risk
  content.
- **Defence in depth.** Web filtering handles URLs and categories; application control handles
  protocols and clients; SafeSearch handles search results. A bypass of one layer does not remove
  the others.
- **Availability.** Shaping is a security control for availability: it prevents non-business
  traffic from exhausting the link.
- **Auditability.** Separate profiles per time window make it obvious which control applies when,
  which is exactly what the test plan checks.
