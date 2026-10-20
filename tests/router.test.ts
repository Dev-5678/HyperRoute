/**
 * HyperRoute - Prefix Router Longest-Match Tests
 * 
 * @author Dev Jangid <https://github.com/Dev-5678>
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ProxyRouter } from '../src/proxy/router.js';
import { LoadBalancer } from '../src/balancer/load-balancer.js';

describe('Proxy Router Longest Prefix Match', () => {
  it('correctly matches more specific route prefixes over general ones', () => {
    const router = new ProxyRouter();
    const lbGeneral = new LoadBalancer([{ id: 'gen', url: 'http://gen:8080' }]);
    const lbSpecific = new LoadBalancer([{ id: 'spec', url: 'http://spec:8080' }]);

    router.registerRoute({ pathPrefix: '/api', loadBalancer: lbGeneral });
    router.registerRoute({ pathPrefix: '/api/v1/checkout', loadBalancer: lbSpecific, stripPrefix: true });

    const match1 = router.matchRoute('/api/v1/checkout/pay');
    assert.ok(match1);
    assert.strictEqual(match1.rule.pathPrefix, '/api/v1/checkout');
    assert.strictEqual(match1.targetPath, '/pay');

    const match2 = router.matchRoute('/api/users');
    assert.ok(match2);
    assert.strictEqual(match2.rule.pathPrefix, '/api');
  });
});
