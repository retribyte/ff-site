import { describe, expect, it } from 'vitest';
import { canonicalRedirectUrl, requestHost } from './canonicalHost';

describe('requestHost', () => {
    it('prefers the last X-Forwarded-Host entry, then Host', () => {
        expect(requestHost('vortox.space', '127.0.0.1:41731')).toBe('vortox.space');
        expect(requestHost('evil.nfshost.com, vortox.space', '127.0.0.1:41731')).toBe('vortox.space');
        expect(requestHost(undefined, 'Vortox.NFSHost.com:443')).toBe('vortox.nfshost.com');
        expect(requestHost(null, null)).toBeNull();
    });
});

describe('canonicalRedirectUrl', () => {
    const c = 'vortox.space';
    it('sends nfshost.com and www to the canonical host', () => {
        expect(canonicalRedirectUrl(c, 'vortox.nfshost.com', '/archives/ff2?x=1')).toBe('https://vortox.space/archives/ff2?x=1');
        expect(canonicalRedirectUrl(c, 'www.vortox.space', '/')).toBe('https://vortox.space/');
    });
    it('leaves the canonical host, loopback, ACME challenges and dev alone', () => {
        expect(canonicalRedirectUrl(c, 'vortox.space', '/')).toBeNull();
        expect(canonicalRedirectUrl(c, '127.0.0.1', '/')).toBeNull();
        expect(canonicalRedirectUrl(c, 'vortox.nfshost.com', '/.well-known/acme-challenge/x')).toBeNull();
        expect(canonicalRedirectUrl(undefined, 'vortox.nfshost.com', '/')).toBeNull();
    });
});
