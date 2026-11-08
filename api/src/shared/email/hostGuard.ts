/**
 * SSRF Host Guard
 *
 * Implements REQ-EML-02 / Spec section 10 SSRF protection:
 * Rejects loopback, private (RFC 1918), link-local (169.254.x.x / metadata),
 * multicast, carrier-grade NAT, and other non-routable IPv4/IPv6 addresses.
 */

import * as dns from 'dns';
import * as net from 'net';

export type DnsLookupFunction = (host: string) => Promise<string[]>;

/**
 * Checks if a given IPv4 string is in a private, loopback, link-local, or reserved range.
 */
export const isBlockedIpv4 = (ip: string): boolean => {
    const parts = ip.split('.').map(p => Number(p));
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
        return true; // invalid IPv4 -> block
    }

    const [a, b, c, d] = parts;

    // 0.0.0.0/8 (Current network / "this host")
    if (a === 0) return true;

    // 10.0.0.0/8 (RFC 1918 private)
    if (a === 10) return true;

    // 100.64.0.0/10 (Shared address space / Carrier-grade NAT)
    if (a === 100 && b >= 64 && b <= 127) return true;

    // 127.0.0.0/8 (Loopback)
    if (a === 127) return true;

    // 169.254.0.0/16 (Link-local & cloud metadata)
    if (a === 169 && b === 254) return true;

    // 172.16.0.0/12 (RFC 1918 private: 172.16.0.0 - 172.31.255.255)
    if (a === 172 && b >= 16 && b <= 31) return true;

    // 192.0.0.0/24 (IETF Protocol Assignments)
    if (a === 192 && b === 0 && c === 0) return true;

    // 192.0.2.0/24 (TEST-NET-1)
    if (a === 192 && b === 0 && c === 2) return true;

    // 192.168.0.0/16 (RFC 1918 private)
    if (a === 192 && b === 168) return true;

    // 198.18.0.0/15 (Benchmarking)
    if (a === 198 && (b === 18 || b === 19)) return true;

    // 198.51.100.0/24 (TEST-NET-2)
    if (a === 198 && b === 51 && c === 100) return true;

    // 203.0.113.0/24 (TEST-NET-3)
    if (a === 203 && b === 0 && c === 113) return true;

    // 224.0.0.0/4 (Multicast: 224.0.0.0 - 239.255.255.255)
    if (a >= 224 && a <= 239) return true;

    // 240.0.0.0/4 (Reserved / Future use: 240.0.0.0 - 255.255.255.254)
    if (a >= 240 && a <= 255) return true;

    // 255.255.255.255 (Broadcast)
    if (a === 255 && b === 255 && c === 255 && d === 255) return true;

    return false;
};

/**
 * Checks if a given IPv6 string is loopback, link-local, unique-local, multicast, or IPv4-mapped private.
 */
export const isBlockedIpv6 = (ip: string): boolean => {
    const normalized = ip.toLowerCase();

    // Loopback ::1 / Unspecified ::
    if (normalized === '::1' || normalized === '::') {
        return true;
    }

    // IPv4-mapped IPv6 address (e.g. ::ffff:127.0.0.1 or ::ffff:7f00:1)
    if (normalized.startsWith('::ffff:')) {
        const mappedPart = normalized.substring(7);
        if (net.isIPv4(mappedPart)) {
            return isBlockedIpv4(mappedPart);
        }
    }

    // Link-local: fe80::/10 (fe80 to febf)
    if (/^fe[89ab][0-9a-f]:/i.test(normalized) || normalized.startsWith('fe80:')) {
        return true;
    }

    // Unique Local Address (ULA): fc00::/7 (fc00 to fdff)
    if (/^f[cd][0-9a-f]{2}:/i.test(normalized)) {
        return true;
    }

    // Multicast: ff00::/8
    if (normalized.startsWith('ff')) {
        return true;
    }

    // Discard prefix: 100::/64
    if (normalized.startsWith('100:')) {
        return true;
    }

    // Documentation: 2001:db8::/32
    if (normalized.startsWith('2001:db8:') || normalized.startsWith('2001:0db8:')) {
        return true;
    }

    return false;
};

/**
 * Checks if an IP (v4 or v6) is private, loopback, link-local, or reserved.
 */
export const isPrivateOrBlockedIp = (ip: string): boolean => {
    const version = net.isIP(ip);
    if (version === 4) {
        return isBlockedIpv4(ip);
    }
    if (version === 6) {
        return isBlockedIpv6(ip);
    }
    return true; // Not a valid IP -> treat as blocked
};

/**
 * Default DNS lookup resolving all A and AAAA records for a host.
 */
export const defaultDnsLookup: DnsLookupFunction = async (host: string): Promise<string[]> => {
    try {
        const results = await dns.promises.lookup(host, { all: true });
        return results.map(r => r.address);
    } catch {
        return [];
    }
};

export interface HostGuardResult {
    allowed: boolean;
    addresses: string[];
    error?: string;
}

/**
 * Validates a target host for SSRF safety.
 * Returns allowed: false if host is invalid or resolves to any blocked/private/loopback/link-local address.
 */
export const validateHost = async (
    host: string,
    lookupFn: DnsLookupFunction = defaultDnsLookup
): Promise<HostGuardResult> => {
    if (!host || typeof host !== 'string') {
        return { allowed: false, addresses: [], error: 'Host is required' };
    }

    const trimmed = host.trim();

    // Check for scheme, path, query, userinfo, or port
    if (/^[a-zA-Z]+:\/\//.test(trimmed) || trimmed.includes('/') || trimmed.includes('?') || trimmed.includes('@') || trimmed.includes(':')) {
        // Note: raw IPv6 with brackets e.g. [::1] or colons will be rejected as hostname input
        return { allowed: false, addresses: [], error: 'Host must be a valid hostname or IP without scheme, path or port' };
    }

    // Basic hostname sanity check
    if (trimmed.length > 255 || /[\s\x00-\x1F\x7F]/.test(trimmed)) {
        return { allowed: false, addresses: [], error: 'Invalid hostname format' };
    }

    // If host is already an IPv4 literal
    if (net.isIPv4(trimmed)) {
        if (isBlockedIpv4(trimmed)) {
            return { allowed: false, addresses: [trimmed], error: `IP ${trimmed} is in a private or restricted range` };
        }
        return { allowed: true, addresses: [trimmed] };
    }

    // Resolve DNS
    const addresses = await lookupFn(trimmed);
    if (!addresses || addresses.length === 0) {
        return { allowed: false, addresses: [], error: `Could not resolve host ${trimmed}` };
    }

    for (const address of addresses) {
        if (isPrivateOrBlockedIp(address)) {
            return {
                allowed: false,
                addresses,
                error: `Host ${trimmed} resolved to restricted address ${address}`
            };
        }
    }

    return { allowed: true, addresses };
};

// Made with Bob
