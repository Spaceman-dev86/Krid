import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createTempId, isTempEntityId, TempIdRegistry } from './tempIds'

describe('tempIds', () => {
  it('createTempId uses tmp- prefix', () => {
    const id = createTempId('week')
    assert.ok(isTempEntityId(id))
    assert.match(id, /^tmp-week-/)
  })

  it('registry resolves after remap', () => {
    const registry = new TempIdRegistry()
    const clientId = createTempId('session')
    registry.remap(clientId, 'server-uuid-1')
    assert.equal(registry.resolve(clientId), 'server-uuid-1')
    assert.equal(registry.resolve('server-uuid-1'), 'server-uuid-1')
  })
})
