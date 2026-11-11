/* Kaisa Incorporated — firewall policy data
 * Source of truth for the interactive report.
 * Object names follow the sanitised FortiGate 7.4.4 export where it differs
 * from the wording used in the written report (for example
 * Maintenance_Strategy vs Maintenance & Support).
 */
window.KAISA = {
  meta: {
    organisation: 'Kaisa Incorporated',
    title: 'Enterprise Firewall Policy Implementation',
    subtitle: 'Part B · Local-FortiGate · FortiOS 7.4.4',
    hostname: 'Local-FortiGate',
    model: 'FortiGate-VM64',
    firmware: 'v7.4.4 build2662',
    exportDate: '2026-10-16',
    scope: 'Department segmentation, internet filtering, NAT and QoS on the Local-FortiGate only.',
    repo: 'kaisa-firewall-report',
  },

  departments: [
    { id: 'TI', name: 'Technology & Innovation', short: 'Tech & Innovation', ip: '10.0.1.10', segment: 'port3', subnet: '10.0.1.0/24', colour: '#36d6c3' },
    { id: 'EX', name: 'Executive & Strategic Planning', short: 'Executive', ip: '10.0.1.30', segment: 'port3', subnet: '10.0.1.0/24', colour: '#a78bfa' },
    { id: 'PD', name: 'Project Delivery & Operations', short: 'Project Delivery', ip: '10.0.1.40', segment: 'port3', subnet: '10.0.1.0/24', colour: '#5aa6ff' },
    { id: 'CS', name: 'Corporate Services', short: 'Corporate Services', ip: '10.200.1.150', segment: 'port1', subnet: '10.200.1.0/24', colour: '#f6b73c' },
    { id: 'ED', name: 'Engineering & Design', short: 'Engineering', ip: '10.200.1.241', segment: 'port1', subnet: '10.200.1.0/24', colour: '#ff8fab' },
    { id: 'MS', name: 'Maintenance & Support', short: 'Maintenance', ip: '10.200.1.210', segment: 'port1', subnet: '10.200.1.0/24', colour: '#ff5d73' },
  ],

  server: { id: 'SRV', name: 'Internal web server', ip: '10.0.1.20', segment: 'port3', subnet: '10.0.1.0/24' },

  interfaces: [
    { name: 'port1', ip: '10.200.1.1/24', role: 'Trusted management / backup segment', access: 'ping, https, ssh, http, fgfm' },
    { name: 'port2', ip: '10.200.2.1/24', role: 'Internet-facing segment to the Linux router 10.200.2.254', access: 'ping, https, ssh, http' },
    { name: 'port3', ip: '10.0.1.254/24', role: 'Internal LAN: Local-Client, web server, ISFW', access: 'https, ssh, http' },
    { name: 'port8', ip: '172.16.100.3/24', role: 'Out-of-band management (unchanged)', access: 'ping, https, ssh, http, fgfm' },
  ],

  groups: {
    GRP_TI_BLOCKED: ['CS', 'ED', 'MS'],
    GRP_CS_BLOCKED: ['PD', 'ED', 'MS'],
    GRP_ED_BLOCKED: ['EX', 'MS'],
    GRP_ALL_DEPARTMENT: ['TI', 'EX', 'PD', 'CS', 'ED', 'MS'],
  },

  schedules: {
    always: { label: 'Always', days: 'Mon–Sun', time: '00:00–24:00' },
    WORK_HOUR_AM: { label: 'Work hours · AM', days: 'Mon–Fri', time: '08:00–12:00' },
    WORK_HOUR_PM: { label: 'Work hours · PM', days: 'Mon–Fri', time: '13:00–17:00' },
    BREAK: { label: 'Lunch break', days: 'Mon–Fri', time: '12:00–13:00' },
  },

  /* FortiOS evaluates policies in sequence-ID order. The export lists them in a
     different insertion order, so the UI always sorts by `id`. */
  policies: [
    {
      id: 2, name: 'DENY_BLOCKED_TO_TI', action: 'deny', control: 'C1',
      src: ['CS', 'ED', 'MS'], dst: ['TI'], srcLabel: 'GRP_TI_BLOCKED', dstLabel: 'Tech_Innovation',
      srcintf: 'port1', dstintf: 'port3', schedule: 'always', service: 'ALL', nat: false,
      profiles: [], category: 'Department isolation',
      justification: 'Blocks reverse-direction access to the innovation zone from the three unauthorised departments.',
    },
    {
      id: 3, name: 'DENY_TI_TO_P1', action: 'deny', control: 'C1',
      src: ['TI'], dst: ['CS', 'ED', 'MS'], srcLabel: 'Tech_Innovation', dstLabel: 'GRP_TI_BLOCKED',
      srcintf: 'port3', dstintf: 'port1', schedule: 'always', service: 'ALL', nat: false,
      profiles: [], category: 'Department isolation',
      justification: 'Restricts Technology & Innovation access to the corporate, engineering and maintenance segments.',
    },
    {
      id: 4, name: 'DENY_CS_TO_BLOCKED', action: 'deny', control: 'C2',
      src: ['CS'], dst: ['PD', 'ED', 'MS'], srcLabel: 'Corporate_Services', dstLabel: 'GRP_CS_BLOCKED',
      srcintf: 'port1', dstintf: 'port3', schedule: 'always', service: 'ALL', nat: false,
      profiles: [], category: 'Department isolation',
      justification: 'Limits Corporate Services access to approved partners and protects delivery, engineering and maintenance.',
    },
    {
      id: 5, name: 'DENY_BLOCKED_TO_CS', action: 'deny', control: 'C2',
      src: ['PD', 'ED', 'MS'], dst: ['CS'], srcLabel: 'GRP_CS_BLOCKED', dstLabel: 'Corporate_Services',
      srcintf: 'port3', dstintf: 'port1', schedule: 'always', service: 'ALL', nat: false,
      profiles: [], category: 'Department isolation',
      justification: 'Blocks unauthorised access to Corporate Services in the reverse direction.',
    },
    {
      id: 6, name: 'DENY_ED_TO_BLOCKED', action: 'deny', control: 'C3',
      src: ['ED'], dst: ['EX', 'MS'], srcLabel: 'Engineering_Design', dstLabel: 'GRP_ED_BLOCKED',
      srcintf: 'port1', dstintf: 'port3', schedule: 'always', service: 'ALL', nat: false,
      profiles: [], category: 'Department isolation',
      justification: 'Restricts Engineering & Design access to the executive and maintenance segments.',
    },
    {
      id: 7, name: 'DENY_BLOCKED_TO_ED', action: 'deny', control: 'C3',
      src: ['EX', 'MS'], dst: ['ED'], srcLabel: 'GRP_ED_BLOCKED', dstLabel: 'Engineering_Design',
      srcintf: 'port3', dstintf: 'port1', schedule: 'always', service: 'ALL', nat: false,
      profiles: [], category: 'Department isolation',
      justification: 'Blocks reverse-direction access to protect engineering data and intellectual property.',
    },
    {
      id: 8, name: 'DENY_EX_TO_MS', action: 'deny', control: 'C4',
      src: ['EX'], dst: ['MS'], srcLabel: 'Executive_Strategy', dstLabel: 'Maintenance_Strategy',
      srcintf: 'port3', dstintf: 'port1', schedule: 'always', service: 'ALL', nat: false,
      profiles: [], category: 'Department isolation',
      justification: 'Separates Executive & Strategic Planning from Maintenance & Support.',
    },
    {
      id: 9, name: 'DENY_MS_TO_EX', action: 'deny', control: 'C4',
      src: ['MS'], dst: ['EX'], srcLabel: 'Maintenance_Strategy', dstLabel: 'Executive_Strategy',
      srcintf: 'port1', dstintf: 'port3', schedule: 'always', service: 'ALL', nat: false,
      profiles: [], category: 'Department isolation',
      justification: 'Prevents maintenance systems from initiating access to executive systems.',
    },
    {
      id: 10, name: 'ALLOW_EX_TO_CS', action: 'accept', control: 'C5',
      src: ['EX'], dst: ['CS'], srcLabel: 'Executive_Strategy', dstLabel: 'Corporate_Services',
      srcintf: 'port3', dstintf: 'port1', schedule: 'always', service: 'ALL', nat: true,
      profiles: [], category: 'Approved collaboration',
      justification: 'Allows Executive & Strategic Planning to reach Corporate Services for governance and reporting.',
    },
    {
      id: 11, name: 'ALLOW_CS_TO_EX', action: 'accept', control: 'C5',
      src: ['CS'], dst: ['EX'], srcLabel: 'Corporate_Services', dstLabel: 'Executive_Strategy',
      srcintf: 'port1', dstintf: 'port3', schedule: 'always', service: 'ALL', nat: true,
      profiles: [], category: 'Approved collaboration',
      justification: 'Allows the return path for Corporate Services to Executive & Strategic Planning.',
    },
    {
      id: 12, name: 'ALLOW_PD_TO_ED', action: 'accept', control: 'C5',
      src: ['PD'], dst: ['ED'], srcLabel: 'Project_Delivery', dstLabel: 'Engineering_Design',
      srcintf: 'port3', dstintf: 'port1', schedule: 'always', service: 'ALL', nat: true,
      profiles: [], category: 'Approved collaboration',
      justification: 'Allows Project Delivery to collaborate with Engineering & Design.',
    },
    {
      id: 13, name: 'ALLOW_ED_TO_PD', action: 'accept', control: 'C5',
      src: ['ED'], dst: ['PD'], srcLabel: 'Engineering_Design', dstLabel: 'Project_Delivery',
      srcintf: 'port1', dstintf: 'port3', schedule: 'always', service: 'ALL', nat: true,
      profiles: [], category: 'Approved collaboration',
      justification: 'Allows the return path from Engineering & Design to Project Delivery.',
    },
    {
      id: 14, name: 'ALLOW_PD_TO_MS', action: 'accept', control: 'C5',
      src: ['PD'], dst: ['MS'], srcLabel: 'Project_Delivery', dstLabel: 'Maintenance_Strategy',
      srcintf: 'port3', dstintf: 'port1', schedule: 'always', service: 'ALL', nat: true,
      profiles: [], category: 'Approved collaboration',
      justification: 'Allows Project Delivery to communicate with Maintenance & Support.',
    },
    {
      id: 15, name: 'ALLOW_MS_TO_PD', action: 'accept', control: 'C5',
      src: ['MS'], dst: ['PD'], srcLabel: 'Maintenance_Strategy', dstLabel: 'Project_Delivery',
      srcintf: 'port1', dstintf: 'port3', schedule: 'always', service: 'ALL', nat: true,
      profiles: [], category: 'Approved collaboration',
      justification: 'Allows the return path from Maintenance & Support to Project Delivery.',
    },
    {
      id: 16, name: 'ALLOW_INTERNET_WORKHOURS_AM', action: 'accept', control: 'C6',
      src: ['TI', 'EX', 'PD', 'CS', 'ED', 'MS'], dst: ['NET'], srcLabel: 'GRP_ALL_DEPARTMENT', dstLabel: 'all',
      srcintf: 'port3', dstintf: 'port2', schedule: 'WORK_HOUR_AM', service: 'ALL', nat: true,
      snat: 'IPPOOL_KAISA_SNAT', profiles: ['WF_KAISA_WorkHours', 'AC_KAISA', 'SHAPER_BUSINESS'],
      category: 'Internet access',
      justification: 'Work-hours internet access with web filtering, application control and business traffic shaping.',
    },
    {
      id: 17, name: 'ALLOW_INTERNET_WORKHOURS_PM', action: 'accept', control: 'C6',
      src: ['TI', 'EX', 'PD', 'CS', 'ED', 'MS'], dst: ['NET'], srcLabel: 'GRP_ALL_DEPARTMENT', dstLabel: 'all',
      srcintf: 'port3', dstintf: 'port1', schedule: 'WORK_HOUR_PM', service: 'ALL', nat: true,
      snat: 'IPPOOL_KAISA_SNAT', profiles: ['WF_KAISA_WorkHours', 'AC_KAISA', 'SHAPER_BUSINESS'],
      category: 'Internet access',
      justification: 'Afternoon work-hours internet access. The export shows port1 as the outgoing interface; the design expects port2.',
      audit: 'dstintf',
    },
    {
      id: 18, name: 'ALLOW_INTERNET_BREAK', action: 'accept', control: 'C7',
      src: ['TI', 'EX', 'PD', 'CS', 'ED', 'MS'], dst: ['NET'], srcLabel: 'GRP_ALL_DEPARTMENT', dstLabel: 'all',
      srcintf: 'port3', dstintf: 'port2', schedule: 'BREAK', service: 'ALL', nat: true,
      snat: 'IPPOOL_KAISA_SNAT', profiles: ['WF_KAISA_Break', 'AC_KAISA', 'SHAPER_BUSINESS'],
      category: 'Internet access',
      justification: 'Lunch-break internet access under a separate web-filter profile so social media is permitted only between 12:00 and 13:00.',
    },
    {
      id: 19, name: 'ALLOW_INBOUND_WEBSERVER', action: 'accept', control: 'C12',
      src: ['NET'], dst: ['SRV'], srcLabel: 'all', dstLabel: 'VIP_KAISA_WEBSERVER',
      srcintf: 'port2', dstintf: 'port1', schedule: 'always', service: 'HTTP, HTTPS', nat: true,
      vip: 'VIP_KAISA_WEBSERVER', profiles: [], category: 'Inbound publication',
      justification: 'Publishes 10.0.1.20 through a static-NAT VIP: external TCP/8080 maps to internal TCP/80.',
      audit: 'dstintf',
    },
  ],

  profiles: {
    web: [
      {
        name: 'WF_KAISA_WorkHours', applies: 'ALLOW_INTERNET_WORKHOURS_AM / PM',
        entries: [
          { label: 'Social Networking', action: 'block' },
          { label: 'Games / Gambling', action: 'block' },
          { label: 'Adult / Mature Content', action: 'block' },
          { label: 'Malicious Websites / Phishing / Spam / Newly Registered Domains', action: 'block' },
          { label: 'Streaming Media / Peer-to-peer File Sharing', action: 'block' },
          { label: 'Hacking / Proxy Avoidance / Illegal or Unethical', action: 'block' },
          { label: 'Finance and Banking', action: 'allow' },
          { label: 'Education / Information Technology / Business / Technology', action: 'allow' },
          { label: 'Government / Health / News and Media', action: 'allow' },
          { label: 'Safe Search enforcement (Google, Bing, YouTube, Yahoo, Yandex)', action: 'enforce' },
        ],
      },
      {
        name: 'WF_KAISA_Break', applies: 'ALLOW_INTERNET_BREAK',
        entries: [
          { label: 'Social Networking', action: 'allow' },
          { label: 'All other categories', action: 'same-as-work' },
        ],
      },
    ],
    app: [
      { label: 'P2P / BitTorrent', action: 'block' },
      { label: 'Proxy / VPN and Anonymiser', action: 'block' },
      { label: 'Remote Access (TeamViewer, AnyDesk, LogMeIn)', action: 'block' },
      { label: 'Games', action: 'block' },
      { label: 'Botnet / High risk / Unknown risk', action: 'block' },
      { label: 'Office 365 / Google Workspace / Microsoft Teams / Zoom / Webex', action: 'allow' },
      { label: 'Business / Update', action: 'allow' },
    ],
    shapers: [
      { name: 'SHAPER_BUSINESS', type: 'Shared shaper', guaranteed: '20,000 Kbps', maximum: '100,000 Kbps', priority: 'High', applies: 'Internet policies' },
      { name: 'SHAPER_NONWORK', type: 'Shared shaper', guaranteed: '1 Kbps', maximum: '5,000 Kbps', priority: 'Low', applies: 'TSP_NonWork · social media / video' },
    ],
  },

  controls: [
    { id: 'C1', title: 'Innovation-zone isolation', detail: 'Technology & Innovation is reachable only through the intended paths; three departments are explicitly blocked in both directions.', policies: ['DENY_TI_TO_P1', 'DENY_BLOCKED_TO_TI'] },
    { id: 'C2', title: 'Corporate Services boundary', detail: 'Corporate Services is protected from Project Delivery, Engineering & Design and Maintenance & Support.', policies: ['DENY_CS_TO_BLOCKED', 'DENY_BLOCKED_TO_CS'] },
    { id: 'C3', title: 'Engineering & Design protection', detail: 'Engineering data and intellectual property are isolated from executive and maintenance systems.', policies: ['DENY_ED_TO_BLOCKED', 'DENY_BLOCKED_TO_ED'] },
    { id: 'C4', title: 'Executive / Maintenance separation', detail: 'Executive systems and maintenance systems cannot initiate sessions to each other.', policies: ['DENY_EX_TO_MS', 'DENY_MS_TO_EX'] },
    { id: 'C5', title: 'Approved collaboration', detail: 'Six directional allow rules cover Executive ↔ Corporate, Project ↔ Engineering and Project ↔ Maintenance.', policies: ['ALLOW_EX_TO_CS', 'ALLOW_CS_TO_EX', 'ALLOW_PD_TO_ED', 'ALLOW_ED_TO_PD', 'ALLOW_PD_TO_MS', 'ALLOW_MS_TO_PD'] },
    { id: 'C6', title: 'Work-hours internet access', detail: 'All departments receive internet access only between 08:00–12:00 and 13:00–17:00 on weekdays, with SNAT, filtering and shaping.', policies: ['ALLOW_INTERNET_WORKHOURS_AM', 'ALLOW_INTERNET_WORKHOURS_PM'] },
    { id: 'C7', title: 'Break-time social media', detail: 'A separate BREAK schedule and break web-filter profile permit social networking only from 12:00 to 13:00.', policies: ['ALLOW_INTERNET_BREAK'] },
    { id: 'C8', title: 'Web content filtering', detail: 'Malicious, adult, gambling, streaming, P2P, hacking and proxy-avoidance categories are blocked; business categories are allowed.', policies: ['WF_KAISA_WorkHours', 'WF_KAISA_Break'] },
    { id: 'C9', title: 'Application control', detail: 'P2P, anonymisers, remote-control tools, games and high-risk applications are blocked; collaboration and update traffic is allowed.', policies: ['AC_KAISA'] },
    { id: 'C10', title: 'Financial services access', detail: 'Finance and Banking is explicitly allowed so online business banking is not caught by a broader block.', policies: ['WF_KAISA_WorkHours'] },
    { id: 'C11', title: 'Education and research access', detail: 'Education, IT, business and technology categories remain reachable for legitimate research and professional development.', policies: ['WF_KAISA_WorkHours'] },
    { id: 'C12', title: 'SafeSearch enforcement', detail: 'SafeSearch is enforced for Google, Bing, YouTube, Yahoo and Yandex at the profile level; inbound web publication is served through the VIP.', policies: ['WF_KAISA_WorkHours', 'ALLOW_INBOUND_WEBSERVER'] },
  ],

  tests: [
    { id: 1, title: 'Blocked department reachability', action: 'ping 10.200.1.150', expected: 'Request timed out — denied', detail: 'Corporate Services must not be reachable from the Tech & Innovation test client.' },
    { id: 2, title: 'Blocked department reachability', action: 'ping 10.200.1.241', expected: 'Request timed out — denied', detail: 'Engineering & Design must not be reachable.' },
    { id: 3, title: 'Blocked department reachability', action: 'ping 10.200.1.210', expected: 'Request timed out — denied', detail: 'Maintenance & Support must not be reachable.' },
    { id: 4, title: 'Internet reachability', action: 'ping 8.8.8.8', expected: 'Replies received', detail: 'Confirms the internet policy and source NAT are working.' },
    { id: 5, title: 'Web category filtering', action: 'Browse a known gambling or adult-content site', expected: 'FortiGuard block page', detail: 'Run during work hours.' },
    { id: 6, title: 'Social media during work hours', action: 'Browse a social-networking site', expected: 'Blocked by WF_KAISA_WorkHours', detail: 'Run during 08:00–12:00 or 13:00–17:00.' },
    { id: 7, title: 'Social media during break', action: 'Repeat the social-networking browse at 12:00–13:00', expected: 'Permitted by WF_KAISA_Break', detail: 'Confirms the two schedules do not overlap.' },
    { id: 8, title: 'Banking access', action: 'Browse an online banking site', expected: 'Permitted', detail: 'Finance and Banking is explicitly allowed.' },
    { id: 9, title: 'SafeSearch enforcement', action: 'Search on Google and inspect settings', expected: 'SafeSearch locked / enforced', detail: 'The user cannot disable it in the browser.' },
    { id: 10, title: 'Destination NAT', action: 'curl http://10.200.2.1:8080', expected: 'HTTP response from 10.0.1.20', detail: 'External TCP/8080 is mapped to internal TCP/80.' },
    { id: 11, title: 'Source NAT and logging', action: 'Log & Report → Forward Traffic', expected: 'Source translated to 10.200.2.100–120', detail: 'Filter on the internet policy.' },
    { id: 12, title: 'QoS behaviour', action: 'Generate non-work traffic; watch bandwidth', expected: 'Non-work traffic limited and de-prioritised', detail: 'Business traffic keeps its 20 Mbps guarantee.' },
  ],

  steps: [
    { n: 1, title: 'Address objects and groups', detail: 'Create seven address objects and four groups so every department is expressible even where no physical host exists.', cli: 'config firewall address\n    edit "Tech_Innovation"\n        set subnet 10.0.1.10 255.255.255.255\n    next\nend' },
    { n: 2, title: 'Recurring schedules', detail: 'Split the working day around lunch: WORK_HOUR_AM, WORK_HOUR_PM and BREAK can never overlap.', cli: 'config firewall schedule recurring\n    edit "BREAK"\n        set start 12:00\n        set end 13:00\n        set day monday tuesday wednesday thursday friday\n    next\nend' },
    { n: 3, title: 'Web filter profiles', detail: 'Create the work-hours profile, set the FortiGuard categories, enforce SafeSearch, then clone it for the break with Social Networking allowed.', cli: 'config webfilter profile\n    edit "WF_KAISA_WorkHours"\n        set feature-set flow\n        # category overrides + SafeSearch\n    next\nend' },
    { n: 4, title: 'Application control', detail: 'Create AC_KAISA: block P2P, anonymisers, remote access, games and high-risk categories; allow collaboration and updates.', cli: 'config application list\n    edit "AC_KAISA"\n        config entries\n            edit 1\n                set category 2 6\n            next\n        end\n    next\nend' },
    { n: 5, title: 'Traffic shapers and policy', detail: 'Create the business and non-work shared shapers, then attach TSP_NonWork to social and streaming applications.', cli: 'config firewall shaper traffic-shaper\n    edit "SHAPER_BUSINESS"\n        set guaranteed-bandwidth 20000\n        set maximum-bandwidth 100000\n    next\nend' },
    { n: 6, title: 'Source NAT pool', detail: 'Create IPPOOL_KAISA_SNAT (overload, 10.200.2.100–10.200.2.120, ARP reply enabled) and reference it from the internet policies.', cli: 'config firewall ippool\n    edit "IPPOOL_KAISA_SNAT"\n        set startip 10.200.2.100\n        set endip 10.200.2.120\n    next\nend' },
    { n: 7, title: 'Destination NAT VIP', detail: 'Create VIP_KAISA_WEBSERVER: external 10.200.2.1:8080 maps to 10.0.1.20:80 on port2.', cli: 'config firewall vip\n    edit "VIP_KAISA_WEBSERVER"\n        set extip 10.200.2.1\n        set mappedip "10.0.1.20"\n        set extintf "port2"\n        set portforward enable\n        set extport 8080\n        set mappedport 80\n    next\nend' },
    { n: 8, title: 'Firewall policies', detail: 'Build the 18 policies in sequence order: eight denies, six internal allows, three internet policies and the inbound VIP policy.', cli: '# Denies first, then internal allows, then internet, then DNAT.' },
    { n: 9, title: 'Verification', detail: 'Test from the Local-Client, not the FortiGate itself: forward policies are only evaluated for transiting traffic.', cli: 'ping 10.200.1.150\nping 8.8.8.8\ncurl http://10.200.2.1:8080' },
    { n: 10, title: 'Final backup', detail: 'Take a configuration backup after the tests and retain it as evidence that the policy set was committed.', cli: '# System → Configuration → Backup' },
  ],

  audit: [
    {
      id: 'pm-interface', level: 'verify', title: 'PM internet policy egress interface',
      detail: 'ALLOW_INTERNET_WORKHOURS_PM is stored with dstintf port1 in the export. The design expects port2 (the Linux router at 10.200.2.254). Traffic in the afternoon window would not follow the intended internet path.',
      objects: ['ALLOW_INTERNET_WORKHOURS_PM'],
    },
    {
      id: 'inbound-interface', level: 'verify', title: 'Inbound web-server egress interface',
      detail: 'ALLOW_INBOUND_WEBSERVER uses port1 as the outgoing interface, while the mapped server 10.0.1.20 is on port3. Verify the DNAT path before relying on the curl test.',
      objects: ['ALLOW_INBOUND_WEBSERVER', 'VIP_KAISA_WEBSERVER'],
    },
    {
      id: 'internal-nat', level: 'note', title: 'Source NAT on internal allow rules',
      detail: 'The six internal allow policies have set nat enable. The written design expects NAT off for department-to-department traffic, so source addresses are preserved for logging and troubleshooting.',
      objects: ['ALLOW_EX_TO_CS', 'ALLOW_CS_TO_EX', 'ALLOW_PD_TO_ED', 'ALLOW_ED_TO_PD', 'ALLOW_PD_TO_MS', 'ALLOW_MS_TO_PD'],
    },
    {
      id: 'utm-binding', level: 'verify', title: 'Security profiles absent from the export',
      detail: 'No WF_KAISA_WorkHours, WF_KAISA_Break or AC_KAISA stanza appears in the exported configuration, and the internet policies have no utm-status enable or profile bindings. The report and screenshots describe the profiles as created, so confirm them on the running device and take a fresh export before relying on the filtering controls.',
      objects: ['ALLOW_INTERNET_WORKHOURS_AM', 'ALLOW_INTERNET_WORKHOURS_PM', 'ALLOW_INTERNET_BREAK'],
    },
    {
      id: 'same-segment', level: 'limitation', title: 'Same-segment departments are not filtered',
      detail: 'Corporate Services, Engineering & Design and Maintenance & Support share 10.200.1.0/24 on port1. Traffic between them is switched and never reaches the FortiGate. The production recommendation is one VLAN per department.',
      objects: [],
    },
    {
      id: 'internet-ingress', level: 'limitation', title: 'Internet policy ingress is port3 only',
      detail: 'The internet policies take port3 as the incoming interface. Departments on port1 need a matching ingress policy (or a routed/VLAN redesign) before they can use the same internet path in production.',
      objects: ['ALLOW_INTERNET_WORKHOURS_AM', 'ALLOW_INTERNET_WORKHOURS_PM', 'ALLOW_INTERNET_BREAK'],
    },
  ],
};
