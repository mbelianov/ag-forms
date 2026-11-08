declare const describe: any;
declare const test: any;
declare const expect: any;

import {
    isBlockedIpv4,
    isBlockedIpv6,
    isPrivateOrBlockedIp,
    validateHost
} from '../../shared/email/hostGuard';

describe('SSRF Host Guard', () => {
    describe('isBlockedIpv4', () => {
        test('blocks loopback addresses (127.0.0.0/8)', () => {
            expect(isBlockedIpv4('127.0.0.1')).toBe(true);
            expect(isBlockedIpv4('127.0.1.1')).toBe(true);
            expect(isBlockedIpv4('127.255.255.255')).toBe(true);
        });

        test('blocks RFC 1918 private class A (10.0.0.0/8)', () => {
            expect(isBlockedIpv4('10.0.0.1')).toBe(true);
            expect(isBlockedIpv4('10.255.255.254')).toBe(true);
        });

        test('blocks RFC 1918 private class B (172.16.0.0/12)', () => {
            expect(isBlockedIpv4('172.16.0.1')).toBe(true);
            expect(isBlockedIpv4('172.31.255.254')).toBe(true);
            expect(isBlockedIpv4('172.20.10.5')).toBe(true);
            // 172.32.0.1 is public
            expect(isBlockedIpv4('172.32.0.1')).toBe(false);
            // 172.15.255.255 is public
            expect(isBlockedIpv4('172.15.255.255')).toBe(false);
        });

        test('blocks RFC 1918 private class C (192.168.0.0/16)', () => {
            expect(isBlockedIpv4('192.168.0.1')).toBe(true);
            expect(isBlockedIpv4('192.168.1.1')).toBe(true);
            expect(isBlockedIpv4('192.168.254.254')).toBe(true);
        });

        test('blocks link-local and cloud metadata (169.254.0.0/16)', () => {
            expect(isBlockedIpv4('169.254.169.254')).toBe(true);
            expect(isBlockedIpv4('169.254.0.1')).toBe(true);
        });

        test('blocks 0.0.0.0/8, CGNAT 100.64.0.0/10, Multicast, Broadcast', () => {
            expect(isBlockedIpv4('0.0.0.0')).toBe(true);
            expect(isBlockedIpv4('100.64.0.1')).toBe(true);
            expect(isBlockedIpv4('100.127.255.254')).toBe(true);
            expect(isBlockedIpv4('224.0.0.1')).toBe(true);
            expect(isBlockedIpv4('239.255.255.255')).toBe(true);
            expect(isBlockedIpv4('240.0.0.1')).toBe(true);
            expect(isBlockedIpv4('255.255.255.255')).toBe(true);
        });

        test('allows public routable IPv4 addresses', () => {
            expect(isBlockedIpv4('8.8.8.8')).toBe(false);
            expect(isBlockedIpv4('1.1.1.1')).toBe(false);
            expect(isBlockedIpv4('142.250.185.106')).toBe(false);
            expect(isBlockedIpv4('93.184.216.34')).toBe(false);
        });
    });

    describe('isBlockedIpv6', () => {
        test('blocks loopback ::1 and unspecified ::', () => {
            expect(isBlockedIpv6('::1')).toBe(true);
            expect(isBlockedIpv6('::')).toBe(true);
        });

        test('blocks IPv4-mapped IPv6 loopback / private / metadata', () => {
            expect(isBlockedIpv6('::ffff:127.0.0.1')).toBe(true);
            expect(isBlockedIpv6('::ffff:10.0.0.1')).toBe(true);
            expect(isBlockedIpv6('::ffff:169.254.169.254')).toBe(true);
            expect(isBlockedIpv6('::ffff:192.168.1.1')).toBe(true);
        });

        test('blocks link-local fe80::/10', () => {
            expect(isBlockedIpv6('fe80::1')).toBe(true);
            expect(isBlockedIpv6('fe80::211:22ff:fe33:4455')).toBe(true);
        });

        test('blocks unique local fc00::/7 (ULA)', () => {
            expect(isBlockedIpv6('fc00::1')).toBe(true);
            expect(isBlockedIpv6('fd00::1234')).toBe(true);
        });

        test('blocks multicast ff00::/8', () => {
            expect(isBlockedIpv6('ff02::1')).toBe(true);
        });

        test('allows public routable IPv6 addresses', () => {
            expect(isBlockedIpv6('2001:4860:4860::8888')).toBe(false);
            expect(isBlockedIpv6('2606:4700:4700::1111')).toBe(false);
        });
    });

    describe('validateHost', () => {
        test('rejects hosts with URL scheme, path, query or port (TC-EMAIL-013)', async () => {
            expect((await validateHost('http://smtp.example.com')).allowed).toBe(false);
            expect((await validateHost('smtp://smtp.example.com')).allowed).toBe(false);
            expect((await validateHost('smtp.example.com:587')).allowed).toBe(false);
            expect((await validateHost('smtp.example.com/path')).allowed).toBe(false);
            expect((await validateHost('user:pass@smtp.example.com')).allowed).toBe(false);
        });

        test('rejects literal loopback / private IP (TC-EMAIL-013)', async () => {
            expect((await validateHost('127.0.0.1')).allowed).toBe(false);
            expect((await validateHost('10.0.0.1')).allowed).toBe(false);
            expect((await validateHost('169.254.169.254')).allowed).toBe(false);
            expect((await validateHost('192.168.1.1')).allowed).toBe(false);
        });

        test('allows literal public IP', async () => {
            const result = await validateHost('93.184.216.34');
            expect(result.allowed).toBe(true);
            expect(result.addresses).toEqual(['93.184.216.34']);
        });

        test('resolves host via DNS and rejects if resolved to private address', async () => {
            const mockDns = async (h: string) => ['127.0.0.1'];
            const result = await validateHost('internal-smtp.local', mockDns);
            expect(result.allowed).toBe(false);
            expect(result.error).toContain('restricted address');
        });

        test('resolves host via DNS and rejects if ANY resolved IP is private', async () => {
            const mockDns = async (h: string) => ['93.184.216.34', '10.0.0.5'];
            const result = await validateHost('dual-smtp.example.com', mockDns);
            expect(result.allowed).toBe(false);
            expect(result.error).toContain('restricted address');
        });

        test('resolves host via DNS and allows if all resolved IPs are public', async () => {
            const mockDns = async (h: string) => ['93.184.216.34', '2606:4700:4700::1111'];
            const result = await validateHost('smtp.example.com', mockDns);
            expect(result.allowed).toBe(true);
            expect(result.addresses).toEqual(['93.184.216.34', '2606:4700:4700::1111']);
        });

        test('rejects host if DNS resolution returns no addresses', async () => {
            const mockDns = async (h: string) => [];
            const result = await validateHost('nonexistent.domain.invalid', mockDns);
            expect(result.allowed).toBe(false);
            expect(result.error).toContain('Could not resolve host');
        });
    });
});

// Made with Bob
