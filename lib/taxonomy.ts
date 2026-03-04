import { Channel, ChannelGroup, DeliveryType } from '@/types/campaign';

// ─────────────────────────────────────────────────────────────────────────────
// MoEngage Campaign Taxonomy
// 6 groups · 11 channels · 34 valid creation paths
// ─────────────────────────────────────────────────────────────────────────────

export interface ChannelConfig {
  id: Channel;
  group: ChannelGroup;
  /** true  → show Delivery Type dropdown before entering creation flow  */
  hasSubTypes: boolean;
  /** true  → skip Delivery Type; go straight to creation flow           */
  directLaunch: boolean;
  subTypes: DeliveryType[];
  /** number of distinct creation paths for this channel                 */
  pathCount: number;
  /** hex colour used on the calendar and legend                         */
  color: string;
  /** emoji / icon used in the UI                                        */
  icon: string;
}

export interface GroupConfig {
  id: ChannelGroup;
  label: string;
  channels: Channel[];
}

// ─── Groups ──────────────────────────────────────────────────────────────────

export const GROUPS: GroupConfig[] = [
  { id: 'OUTBOUND',       label: 'Outbound',       channels: ['Push', 'Email', 'SMS', 'MMS', 'RCS'] },
  { id: 'INBOUND',        label: 'Inbound',         channels: ['In-App', 'On-site', 'Cards'] },
  { id: 'MESSAGING_APPS', label: 'Messaging Apps',  channels: ['WhatsApp'] },
  { id: 'PERSONALIZATION',label: 'Personalization', channels: ['Web'] },
  { id: 'AUDIENCE',       label: 'Audience',        channels: ['Facebook', 'Google Ads'] },
  { id: 'CONNECTOR',      label: 'Connector',       channels: ['Custom'] },
];

// ─── Channel definitions ─────────────────────────────────────────────────────
// Sub-type availability follows the taxonomy exactly:
//   • Device Triggered & Location Triggered  → Push only
//   • Business Event Triggered               → Outbound (Push, Email, SMS, MMS, RCS) only
//   • One Time / Periodic / Event Triggered  → all sub-typed channels

export const CHANNELS: Record<Channel, ChannelConfig> = {
  // ── OUTBOUND ────────────────────────────────────────────────────────────────
  Push: {
    id: 'Push',
    group: 'OUTBOUND',
    hasSubTypes: true,
    directLaunch: false,
    subTypes: [
      'One Time',
      'Periodic',
      'Event Triggered',
      'Business Event Triggered',
      'Device Triggered',
      'Location Triggered',
    ],
    pathCount: 6,
    color: '#818CF8',
    icon: '🔔',
  },
  Email: {
    id: 'Email',
    group: 'OUTBOUND',
    hasSubTypes: true,
    directLaunch: false,
    subTypes: ['One Time', 'Periodic', 'Event Triggered', 'Business Event Triggered'],
    pathCount: 4,
    color: '#34D399',
    icon: '✉️',
  },
  SMS: {
    id: 'SMS',
    group: 'OUTBOUND',
    hasSubTypes: true,
    directLaunch: false,
    subTypes: ['One Time', 'Periodic', 'Event Triggered', 'Business Event Triggered'],
    pathCount: 4,
    color: '#FCD34D',
    icon: '💬',
  },
  MMS: {
    id: 'MMS',
    group: 'OUTBOUND',
    hasSubTypes: true,
    directLaunch: false,
    subTypes: ['One Time', 'Periodic', 'Event Triggered', 'Business Event Triggered'],
    pathCount: 4,
    color: '#FB923C',
    icon: '🖼️',
  },
  RCS: {
    id: 'RCS',
    group: 'OUTBOUND',
    hasSubTypes: true,
    directLaunch: false,
    subTypes: ['One Time', 'Periodic', 'Event Triggered', 'Business Event Triggered'],
    pathCount: 4,
    color: '#38BDF8',
    icon: '📨',
  },
  // ── INBOUND ─────────────────────────────────────────────────────────────────
  'In-App': {
    id: 'In-App',
    group: 'INBOUND',
    hasSubTypes: false,
    directLaunch: true,
    subTypes: [],
    pathCount: 1,
    color: '#C084FC',
    icon: '📱',
  },
  'On-site': {
    id: 'On-site',
    group: 'INBOUND',
    hasSubTypes: false,
    directLaunch: true,
    subTypes: [],
    pathCount: 1,
    color: '#A78BFA',
    icon: '🌐',
  },
  Cards: {
    id: 'Cards',
    group: 'INBOUND',
    hasSubTypes: false,
    directLaunch: true,
    subTypes: [],
    pathCount: 1,
    color: '#818CF8',
    icon: '🃏',
  },
  // ── MESSAGING APPS ──────────────────────────────────────────────────────────
  // WhatsApp does NOT support: Business Event Triggered, Device Triggered, Location Triggered
  WhatsApp: {
    id: 'WhatsApp',
    group: 'MESSAGING_APPS',
    hasSubTypes: true,
    directLaunch: false,
    subTypes: ['One Time', 'Periodic', 'Event Triggered'],
    pathCount: 3,
    color: '#6EE7B7',
    icon: '💚',
  },
  // ── PERSONALIZATION ──────────────────────────────────────────────────────────
  Web: {
    id: 'Web',
    group: 'PERSONALIZATION',
    hasSubTypes: false,
    directLaunch: true,
    subTypes: [],
    pathCount: 1,
    color: '#F9A8D4',
    icon: '🖥️',
  },
  // ── AUDIENCE ─────────────────────────────────────────────────────────────────
  Facebook: {
    id: 'Facebook',
    group: 'AUDIENCE',
    hasSubTypes: false,
    directLaunch: true,
    subTypes: [],
    pathCount: 1,
    color: '#60A5FA',
    icon: '👥',
  },
  'Google Ads': {
    id: 'Google Ads',
    group: 'AUDIENCE',
    hasSubTypes: false,
    directLaunch: true,
    subTypes: [],
    pathCount: 1,
    color: '#FCA5A5',
    icon: '📣',
  },
  // ── CONNECTOR ────────────────────────────────────────────────────────────────
  // Custom does NOT support: Business Event Triggered, Device Triggered, Location Triggered
  Custom: {
    id: 'Custom',
    group: 'CONNECTOR',
    hasSubTypes: true,
    directLaunch: false,
    subTypes: ['One Time', 'Periodic', 'Event Triggered'],
    pathCount: 3,
    color: '#94A3B8',
    icon: '🔌',
  },
};

// ─── Sub-type availability index ─────────────────────────────────────────────
// For each DeliveryType, which channels support it — used for reverse lookup
// and for cross-channel validation.

export const SUBTYPE_AVAILABILITY: Record<DeliveryType, Channel[]> = {
  'One Time': ['Push', 'Email', 'SMS', 'MMS', 'RCS', 'WhatsApp', 'Custom'],
  'Periodic': ['Push', 'Email', 'SMS', 'MMS', 'RCS', 'WhatsApp', 'Custom'],
  'Event Triggered': ['Push', 'Email', 'SMS', 'MMS', 'RCS', 'WhatsApp', 'Custom'],
  'Business Event Triggered': ['Push', 'Email', 'SMS', 'MMS', 'RCS'],
  'Device Triggered': ['Push'],
  'Location Triggered': ['Push'],
};

// ─── Validation helpers ───────────────────────────────────────────────────────

/** Returns the channels that belong to a given group. */
export function getChannelsForGroup(groupId: ChannelGroup): ChannelConfig[] {
  const group = GROUPS.find(g => g.id === groupId);
  if (!group) return [];
  return group.channels.map(ch => CHANNELS[ch]);
}

/** Returns the delivery types available for a given channel. */
export function getSubTypesForChannel(channel: Channel): DeliveryType[] {
  return CHANNELS[channel]?.subTypes ?? [];
}

/** Returns true if the (channel, deliveryType) combination is valid per the taxonomy. */
export function isValidCombination(channel: Channel, deliveryType: DeliveryType): boolean {
  return SUBTYPE_AVAILABILITY[deliveryType]?.includes(channel) ?? false;
}

/** Returns true if the channel should skip Delivery Type and go direct to creation. */
export function isDirectLaunch(channel: Channel): boolean {
  return CHANNELS[channel]?.directLaunch ?? false;
}

/** Returns the group a channel belongs to. */
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
  { channel: 'Push',       color: '#818CF8', icon: '🔔' },
  { channel: 'Email',      color: '#34D399', icon: '✉️' },
  { channel: 'SMS',        color: '#FCD34D', icon: '💬' },
  { channel: 'MMS',        color: '#FB923C', icon: '🖼️' },
  { channel: 'RCS',        color: '#38BDF8', icon: '📨' },
  { channel: 'In-App',     color: '#C084FC', icon: '📱' },
  { channel: 'On-site',    color: '#A78BFA', icon: '🌐' },
  { channel: 'Cards',      color: '#818CF8', icon: '🃏' },
  { channel: 'WhatsApp',   color: '#6EE7B7', icon: '💚' },
  { channel: 'Web',        color: '#F9A8D4', icon: '🖥️' },
  { channel: 'Facebook',   color: '#60A5FA', icon: '👥' },
  { channel: 'Google Ads', color: '#FCA5A5', icon: '📣' },
  { channel: 'Custom',     color: '#94A3B8', icon: '🔌' },
];

// ─── API channel identifier → Channel label map ──────────────────────────────
// Used in lib/moengage.ts to normalise raw API responses.

export const API_CHANNEL_MAP: Record<string, Channel> = {
  PUSH:      'Push',
  EMAIL:     'Email',
  SMS:       'SMS',
  MMS:       'MMS',
  RCS:       'RCS',
  INAPP:     'In-App',
  IN_APP:    'In-App',
  ONSITE:    'On-site',
  ON_SITE:   'On-site',
  CARDS:     'Cards',
  WHATSAPP:  'WhatsApp',
  WEB:       'Web',
  FACEBOOK:  'Facebook',
  GOOGLEADS: 'Google Ads',
  GOOGLE_ADS:'Google Ads',
  CUSTOM:    'Custom',
};

// ─── API delivery type → DeliveryType label map ──────────────────────────────

export const API_DELIVERY_TYPE_MAP: Record<string, DeliveryType> = {
  ONE_TIME:                    'One Time',
  PERIODIC:                    'Periodic',
  EVENT_TRIGGERED:             'Event Triggered',
  BUSINESS_EVENT_TRIGGERED:    'Business Event Triggered',
  DEVICE_TRIGGERED:            'Device Triggered',
  LOCATION_TRIGGERED:          'Location Triggered',
};
