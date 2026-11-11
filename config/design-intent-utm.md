# Design intent — UTM profiles and shaping bindings

The written report and the GUI screenshots describe three security profiles and a traffic-shaping
binding. They are **not present in the exported configuration**. This file records the intended
design so the gap can be closed deliberately.

> This is a design specification, not a verbatim export. Category IDs vary with the FortiGuard
> database version, so the numeric filter entries are set in the GUI rather than hard-coded here.

## 1. Web-filter profiles

### 1.1 `WF_KAISA_WorkHours`

```text
config webfilter profile
    edit "WF_KAISA_WorkHours"
        set feature-set flow
        set comment "Kaisa work-hours filtering"
        config ftgd-wf
            unset options
            config filters
                # category entries set in the GUI:
                #   Social Networking                     -> block
                #   Games                                 -> block
                #   Gambling                              -> block
                #   Adult / Mature Content                -> block
                #   Malicious Websites, Phishing, Spam    -> block
                #   Newly Registered Domains              -> block
                #   Streaming Media, P2P File Sharing     -> block
                #   Hacking, Proxy Avoidance              -> block
                #   Illegal or Unethical                  -> block
                #   Finance and Banking                   -> allow
                #   Education, IT, Business, Technology   -> allow
                #   Government, Health, News and Media    -> allow
            end
        end
        # SafeSearch enforcement for Google, Bing, YouTube, Yahoo, Yandex
    next
end
```

### 1.2 `WF_KAISA_Break`

Clone of the work-hours profile with **Social Networking** changed to allow. No other category is
relaxed.

## 2. Application control

```text
config application list
    edit "AC_KAISA"
        set comment "Kaisa application control"
        set other-application-action block
        config entries
            # block: P2P/BitTorrent, proxy/anonymiser, remote access
            #        (TeamViewer, AnyDesk, LogMeIn), games, botnet/high risk
            # allow: Office 365, Google Workspace, Teams, Zoom, Webex,
            #        business, update
        end
    next
end
```

## 3. Policy bindings

Each internet policy should carry the profiles and enable UTM:

```text
config firewall policy
    edit 16
        set utm-status enable
        set webfilter-profile "WF_KAISA_WorkHours"
        set application-list "AC_KAISA"
        set traffic-shaper "SHAPER_BUSINESS"
        set traffic-shaper-reverse "SHAPER_BUSINESS"
    next
    edit 17
        set dstintf "port2"          # correction: was port1 in the export
        set utm-status enable
        set webfilter-profile "WF_KAISA_WorkHours"
        set application-list "AC_KAISA"
        set traffic-shaper "SHAPER_BUSINESS"
        set traffic-shaper-reverse "SHAPER_BUSINESS"
    next
    edit 18
        set utm-status enable
        set webfilter-profile "WF_KAISA_Break"
        set application-list "AC_KAISA"
        set traffic-shaper "SHAPER_BUSINESS"
        set traffic-shaper-reverse "SHAPER_BUSINESS"
    next
end
```

The exact shaper field names depend on whether a shared shaper is applied directly to the policy
or through a traffic-shaping policy. Verify with `show firewall policy` on the target firmware
before committing.

## 4. Non-work shaping policy

The report describes a traffic-shaping policy `TSP_NonWork` that matches social media and
streaming and applies `SHAPER_NONWORK`. The export contains the shaper but not the binding.
Intended behaviour:

| Field | Value |
| --- | --- |
| Name | `TSP_NonWork` |
| Match | Social Networking, Streaming Media, P2P |
| Shaper | `SHAPER_NONWORK` |
| Guarantee | 1 Kbps |
| Maximum | 5 Mbps |
| Priority | Low |

Because the non-work policy sits after the main internet policy in evaluation order, use a
traffic-shaping policy (not a second accept rule) so the session is still permitted but shaped.

## 5. Why this file exists

The verification notes record the absence of these objects. This file records the intent, so a
future rebuild can compare three states:

1. the written design;
2. the exported device state;
3. the republished, corrected state.

Keeping them separate prevents the repository from claiming that a control was deployed when the
evidence only shows that it was designed.
