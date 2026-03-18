import { Channel, ChannelGroup, DeliveryType } from '@/types/campaign';

// ─────────────────────────────────────────────────────────────────────────────
// MoEngage Campaign Taxonomy
// 6 groups · 11 channels · 34 valid creation paths
// ─────────────────────────────────────────────────────────────────────────────

export interface ChannelConfig {
    id: Channel;
    group: ChannelGroup;
    /** true → show Delivery Type dropdown before entering creation flow */
  hasSubTypes: boolean;
    /** true → skip Delivery Type; go straight to creation flow */
  directLaunch: boolean;
    subTypes: DeliveryType[];
    /** number of distinct creation paths for this channel */
  pathCount: number;
    /** hex colour used on the calendar and legend */
  color: string;
    /** Material Symbols icon name used in the UI */
  icon: string;
}

export interface GroupConfig {
    id: ChannelGroup;
    label: string;
    channels: Channel[];
}

// ─── Groups ──────────────────────────────────────────────────────────────────
export const GROUPS: GroupConfig[] = [
  { id: 'OUTBOUND',        label: 'Outbound',        channels: ['Push', 'Email', 'SMS', 'MMS', 'RCS'] },
  { id: 'INBOUND',         label: 'Inbound',         channels: ['In-App', 'On-site', 'Cards'] },
  { id: 'MESSAGING_APPS',  label: 'Messaging Apps',  channels: ['WhatsApp'] },
  { id: 'PERSONALIZATION', label: 'Personalization', channels: ['Web'] },
  { id: 'AUDIENCE',        label: 'Audience',        channels: ['Facebook', 'Google Ads'] },
  { id: 'CONNECTOR',       label: 'Connector',       channels: ['Custom'] },
  ];

// ─── Channel definitions ───────────────────────────────────────────────────
export const CHANNELS: Record<Channel, ChannelConfig> = {
    // ── OUTBOUND ──────────────────────────────────────────────────────────────
    Push: {
          id: 'Push', group: 'OUTBOUND', hasSubTypes: true, directLaunch: false,
          subTypes: ['One Time', 'Periodic', 'Event Triggered', 'Business Event Triggered', 'Device Triggered', 'Location Triggered'],
          pathCount: 6, color: '#818CF8', icon: 'send_to_mobile',
    },
    Email: {
          id: 'Email', group: 'OUTBOUND', hasSubTypes: true, directLaunch: false,
          subTypes: ['One Time', 'Periodic', 'Event Triggered', 'Business Event Triggered'],
          pathCount: 4, color: '#34D399', icon: 'email',
    },
    SMS: {
          id: 'SMS', group: 'OUTBOUND', hasSubTypes: true, directLaunch: false,
          subTypes: ['One Time', 'Periodic', 'Event Triggered', 'Business Event Triggered'],
          pathCount: 4, color: '#FCD34D', icon: 'sms',
    },
    MMS: {
          id: 'MMS', group: 'OUTBOUND', hasSubTypes: true, directLaunch: false,
          subTypes: ['One Time', 'Periodic', 'Event Triggered', 'Business Event Triggered'],
          pathCount: 4, color: '#FB923C', icon: 'perm_media',
    },
    RCS: {
          id: 'RCS', group: 'OUTBOUND', hasSubTypes: true, directLaunch: false,
          subTypes: ['One Time', 'Periodic', 'Event Triggered', 'Business Event Triggered'],
          pathCount: 4, color: '#38BDF8', icon: 'forum',
    },
    // ── INBOUND ───────────────────────────────────────────────────────────────
    'In-App': {
          id: 'In-App', group: 'INBOUND', hasSubTypes: false, directLaunch: true,
          subTypes: [], pathCount: 1, color: '#C084FC', icon: 'smartphone',
    },
    'On-site': {
          id: 'On-site', group: 'INBOUND', hasSubTypes: false, directLaunch: true,
          subTypes: [], pathCount: 1, color: '#A78BFA', icon: 'web_asset',
    },
    Cards: {
          id: 'Cards', group: 'INBOUND', hasSubTypes: false, directLaunch: true,
          subTypes: [], pathCount: 1, color: '#818CF8', icon: 'view_carousel',
    },
    // ── MESSAGING APPS ────────────────────────────────────────────────────────
    WhatsApp: {
          id: 'WhatsApp', group: 'MESSAGING_APPS', hasSubTypes: true, directLaunch: false,
          subTypes: ['One Time', 'Periodic', 'Event Triggered'],
          pathCount: 3, color: '#6EE7B7', icon: 'chat_bubble',
    },
    // ── PERSONALIZATION ────────────────────────────────────────────────────────
    Web: {
          id: 'Web', group: 'PERSONALIZATION', hasSubTypes: false, directLaunch: true,
          subTypes: [], pathCount: 1, color: '#F9A8D4', icon: 'web',
    },
    // ── AUDIENCE ──────────────────────────────────────────────────────────────
    Facebook: {
          id: 'Facebook', group: 'AUDIENCE', hasSubTypes: false, directLaunch: true,
          subTypes: [], pathCount: 1, color: '#60A5FA', icon: 'groups',
    },
    'Google Ads': {
          id: 'Google Ads', group: 'AUDIENCE', hasSubTypes: false, directLaunch: true,
          subTypes: [], pathCount: 1, color: '#FCA5A5', icon: 'ads_click',
    },
    // ── CONNECTOR ─────────────────────────────────────────────────────────────
    Custom: {
          id: 'Custom', group: 'CONNECTOR', hasSubTypes: true, directLaunch: false,
          subTypes: ['One Time', 'Periodic', 'Event Triggered'],
          pathCount: 3, color: '#94A3B8', icon: 'extension',
    },
};

// ─── Sub-type availability index ─────────────────────────────────────────────
export const SUBTYPE_AVAILABILITY: Record<DeliveryType, Channel[]> = {
    'One Time':                   ['Push', 'Email', 'SMS', 'MMS', 'RCS', 'WhatsApp', 'Custom'],
    'Periodic':                   ['Push', 'Email', 'SMS', 'MMS', 'RCS', 'WhatsApp', 'Custom'],
    'Event Triggered':            ['Push', 'Email', 'SMS', 'MMS', 'RCS', 'WhatsApp', 'Custom'],
    'Business Event Triggered':   ['Push', 'Email', 'SMS', 'MMS', 'RCS'],
    'Device Triggered':           ['Push'],
    'Location Triggered':         ['Push'],
};

// ─── Validation helpers ───────────────────────────────────────────────────────
export function getChannelsForGroup(groupId: ChannelGroup): ChannelConfig[] {
    const group = GROUPS.find(g => g.id === groupId);
    if (!group) return [];
    return group.channels.map(ch => CHANNELS[ch]);
}
export function getSubTypesForChannel(channel: Channel): DeliveryType[] {
    return CHANNELS[channel]?.subTypes ?? [];
}
export function isValidCombination(channel: Channel, deliveryType: DeliveryType): boolean {
    return SUBTYPE_AVAILABILITY[deliveryType]?.includes(channel) ?? false;
}
export function isDirectLaunch(channel: Channel): boolean {
    return CHANNELS[channel]?.directLaunch ?? false;
}
export function getGroupForChannel(channel: Channel): ChannelGroup | undefined {
    return CHANNELS[channel]?.group;
}

// ─── Verification: total paths must equal 34 ─────────────────────────────────
export const TOTAL_VALID_PATHS: number = Object.values(CHANNELS).reduce(
    (sum, ch) => sum + ch.pathCount,
    0
  ); // 34

// ─── Channel legend (ordered for the calendar legend bar) ────────────────────
export const CHANNEL_LEGEND: { channel: Channel; color: string; icon: string }[] = [
  { channel: 'Push',       color: '#818CF8', icon: 'send_to_mobile'  },
  { channel: 'Email',      color: '#34D399', icon: 'email'            },
  { channel: 'SMS',        color: '#FCD34D', icon: 'sms'              },
  { channel: 'MMS',        color: '#FB923C', icon: 'perm_media'       },
  { channel: 'RCS',        color: '#38BDF8', icon: 'forum'            },
  { channel: 'In-App',     color: '#C084FC', icon: 'smartphone'       },
  { channel: 'On-site',    color: '#A78BFA', icon: 'web_asset'        },
  { channel: 'Cards',      color: '#818CF8', icon: 'view_carousel'    },
  { channel: 'WhatsApp',   color: '#6EE7B7', icon: 'chat_bubble'      },
  { channel: 'Web',        color: '#F9A8D4', icon: 'web'              },
  { channel: 'Facebook',   color: '#60A5FA', icon: 'groups'           },
  { channel: 'Google Ads', color: '#FCA5A5', icon: 'ads_click'        },
  { channel: 'Custom',     color: '#94A3B8', icon: 'extension'        },
  ];

// ─── API channel identifier → Channel label map ──────────────────────────────
export const API_CHANNEL_MAP: Record<string, Channel> = {
    PUSH: 'Push', EMAIL: 'Email', SMS: 'SMS', MMS: 'MMS', RCS: 'RCS',
    INAPP: 'In-App', IN_APP: 'In-App', ONSITE: 'On-site', ON_SITE: 'On-site',
    CARDS: 'Cards', WHATSAPP: 'WhatsApp', WEB: 'Web',
    FACEBOOK: 'Facebook', GOOGLEADS: 'Google Ads', GOOGLE_ADS: 'Google Ads',
    CUSTOM: 'Custom',
};

// ─── API delivery type → DeliveryType label map ──────────────────────────────
export const API_DELIVERY_TYPE_MAP: Record<string, DeliveryType> = {
    ONE_TIME:                  'One Time',
    PERIODIC:                  'Periodic',
    EVENT_TRIGGERED:           'Event Triggered',
    BUSINESS_EVENT_TRIGGERED:  'Business Event Triggered',
    DEVICE_TRIGGERED:          'Device Triggered',
    LOCATION_TRIGGERED:        'Location Triggered',
};
