import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  isAllowedCoverMime,
  programCoverBucket,
  programCoverStoragePath,
} from './programCoverStorage'

describe('programCoverStorage', () => {
  it('uses the home_page bucket', () => {
    assert.equal(programCoverBucket(), 'home_page')
  })

  it('builds a stable path per program id', () => {
    assert.equal(
      programCoverStoragePath('73be3dec-0cb1-43ad-83f7-020d8b9261b3', 'image/jpeg'),
      '3-programs/73be3dec-0cb1-43ad-83f7-020d8b9261b3.jpg'
    )
  })

  it('accepts common image mime types', () => {
    assert.equal(isAllowedCoverMime('image/png'), true)
    assert.equal(isAllowedCoverMime('application/pdf'), false)
  })
})
