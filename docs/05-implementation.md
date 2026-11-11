# Implementation guide

The build follows dependency order: objects that policies reference must exist first. Commands are
shown for FortiOS 7.4 in CLI form; the original implementation used the GUI, and the equivalent
GUI path is included for each step.

> The CLI shown here is a reproduction aid, not a byte-for-byte copy of the lab export.
> The sanitised export is in [`config/kaisa-fortigate-sanitised.conf`](../config/kaisa-fortigate-sanitised.conf).

## Step 1 — Address objects and groups

**GUI:** Policy & Objects → Addresses → Create New → Address / Address Group.

```text
config firewall address
    edit "Tech_Innovation"
        set subnet 10.0.1.10 255.255.255.255
    next
    edit "Executive_Strategy"
        set subnet 10.0.1.30 255.255.255.255
    next
    edit "Project_Delivery"
        set subnet 10.0.1.40 255.255.255.255
    next
    edit "Corporate_Services"
        set subnet 10.200.1.150 255.255.255.255
    next
    edit "Engineering_Design"
        set subnet 10.200.1.241 255.255.255.255
    next
    edit "Maintenance_Strategy"
        set subnet 10.200.1.210 255.255.255.255
    next
    edit "Kaisa_Webserver"
        set subnet 10.0.1.20 255.255.255.255
    next
end

config firewall addrgrp
    edit "GRP_TI_BLOCKED"
        set member "Corporate_Services" "Engineering_Design" "Maintenance_Strategy"
    next
    edit "GRP_CS_BLOCKED"
        set member "Project_Delivery" "Engineering_Design" "Maintenance_Strategy"
    next
    edit "GRP_ED_BLOCKED"
        set member "Executive_Strategy" "Maintenance_Strategy"
    next
    edit "GRP_ALL_DEPARTMENT"
        set member "Corporate_Services" "Engineering_Design" "Maintenance_Strategy" "Executive_Strategy" "Tech_Innovation" "Project_Delivery"
    next
end
```

**Check:** all seven addresses are /32; each group contains exactly the intended members.

## Step 2 — Recurring schedules

**GUI:** Policy & Objects → Schedules → Create New → Recurring.

```text
config firewall schedule recurring
    edit "WORK_HOUR_AM"
        set start 08:00
        set end 12:00
        set day monday tuesday wednesday thursday friday
    next
    edit "WORK_HOUR_PM"
        set start 13:00
        set end 17:00
        set day monday tuesday wednesday thursday friday
    next
    edit "BREAK"
        set start 12:00
        set end 13:00
        set day monday tuesday wednesday thursday friday
    next
end
```

**Check:** the three windows are contiguous and non-overlapping (08–12, 12–13, 13–17).

## Step 3 — Web-filter profiles

**GUI:** Security Profiles → Web Filter → Create New.

Create `WF_KAISA_WorkHours` and set the FortiGuard categories listed in
[04-security-profiles.md](04-security-profiles.md). Enable SafeSearch enforcement for Google, Bing,
YouTube, Yahoo and Yandex. Clone the profile as `WF_KAISA_Break` and change only Social Networking
to Allow.

```text
config webfilter profile
    edit "WF_KAISA_WorkHours"
        set feature-set flow
        # FortiGuard category overrides: block/allow as per section 04
        # SafeSearch: enable for the five supported engines
    next
    edit "WF_KAISA_Break"
        set feature-set flow
        # clone of WorkHours with Social Networking allowed
    next
end
```

The numeric FortiGuard category IDs depend on the FortiGuard database version, so they are set in
the GUI rather than hard-coded here.

**Check:** browse to a blocked category and confirm the replacement message; verify SafeSearch is
locked.

## Step 4 — Application control

**GUI:** Security Profiles → Application Control → Create New.

```text
config application list
    edit "AC_KAISA"
        set other-application-action block
        config entries
            # P2P, proxy/anonymiser, remote access, games, botnet/high-risk: block
            # Office 365, Google Workspace, Teams, Zoom, Webex, business, update: allow
        end
    next
end
```

**Check:** a BitTorrent client is blocked; Teams/Zoom traffic is permitted.

## Step 5 — Traffic shapers

**GUI:** Policy & Objects → Traffic Shapers → Create New → Shared.

```text
config firewall shaper traffic-shaper
    edit "SHAPER_BUSINESS"
        set guaranteed-bandwidth 20000
        set maximum-bandwidth 100000
    next
    edit "SHAPER_NONWORK"
        set guaranteed-bandwidth 1
        set maximum-bandwidth 5000
        set priority low
    next
end
```

Then create the non-work traffic-shaping policy (`TSP_NonWork`) that matches social-media and
streaming applications and applies `SHAPER_NONWORK`. Attach `SHAPER_BUSINESS` to the internet
policies.

**Check:** generate non-work traffic and confirm it is capped and de-prioritised while business
traffic keeps its guarantee.

## Step 6 — Source NAT pool

**GUI:** Policy & Objects → IP Pools → Create New.

```text
config firewall ippool
    edit "IPPOOL_KAISA_SNAT"
        set startip 10.200.2.100
        set endip 10.200.2.120
    next
end
```

Use overload (PAT) mode. If return traffic does not route back automatically in your topology,
enable ARP reply on the pool.

**Check:** forward-traffic logs show the source translated into 10.200.2.100–120.

## Step 7 — Destination NAT VIP

**GUI:** Policy & Objects → Virtual IPs → Create New.

```text
config firewall vip
    edit "VIP_KAISA_WEBSERVER"
        set extip 10.200.2.1
        set mappedip "10.0.1.20"
        set extintf "port2"
        set portforward enable
        set extport 8080
        set mappedport 80
    next
end
```

**Check:** `curl http://10.200.2.1:8080` from the external client returns the internal web server
page.

## Step 8 — Firewall policies

**GUI:** Policy & Objects → Firewall Policy → Create New.

Build the 18 rules in sequence order:

1. eight denies (sequence 2–9), schedule `always`, service `ALL`;
2. six internal allows (10–15), NAT off in the design intent;
3. three internet allows (16–18), schedule per window, SNAT pool, UTM profiles and shaper;
4. the inbound VIP rule (19), service HTTP/HTTPS.

The full table is in [03-policy-design.md](03-policy-design.md). The sanitised policy stanzas are
in [`config/kaisa-fortigate-sanitised.conf`](../config/kaisa-fortigate-sanitised.conf).

**Check:** `diagnose firewall iprope list` (or the GUI policy list) shows the expected order. Denies
must be above the allows.

## Step 9 — Verification

Test from the **Local-Client**, not the FortiGate console. Traffic originated by the firewall does
not traverse forward policies, so a ping from the FortiGate proves nothing about the rule set.

```text
ping 10.200.1.150      # expect timeout (denied)
ping 10.200.1.241      # expect timeout (denied)
ping 10.200.1.210      # expect timeout (denied)
ping 8.8.8.8           # expect replies (internet + SNAT)
curl http://10.200.2.1:8080
```

Then run the twelve tests in [06-testing.md](06-testing.md).

## Step 10 — Final backup

**GUI:** System → Configuration → Backup.

Encrypt the backup, store it outside the repository and record the date. The backup is the
evidence that the configuration was committed. Do not commit the backup itself: it contains
password hashes, keys and certificates.

## Build-order summary

| Order | Object type | Depends on |
| ---: | --- | --- |
| 1 | Addresses and groups | — |
| 2 | Schedules | — |
| 3 | Web-filter profiles | — |
| 4 | Application control | — |
| 5 | Traffic shapers | — |
| 6 | IP pool | — |
| 7 | VIP | Interfaces |
| 8 | Policies | All of the above |
| 9 | Verification | Policies and routing |
| 10 | Backup | Verified configuration |
