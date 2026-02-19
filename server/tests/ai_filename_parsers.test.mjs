import assert from 'node:assert/strict'
import { parseFilenameDate, extractFilenameLocationCandidate } from '../lib/ai_provider.mjs'

const main = () => {
  {
    const parsed = parseFilenameDate('Grégoire Thibaud 2024-06-14 04-45-05.jpg', 0)
    assert.equal(parsed?.iso, '2024-06-14T04:45:05+00:00')
    assert.equal(parsed?.dateOnly, '2024-06-14')
  }
  {
    const parsed = parseFilenameDate('IMG_20240501.jpg', -480)
    assert.equal(parsed?.iso, '2024-05-01T00:00:00+08:00')
    assert.equal(parsed?.dateOnly, '2024-05-01')
  }
  {
    const parsed = parseFilenameDate('IMG_2024-13-40.jpg', 0)
    assert.equal(parsed, null)
  }
  {
    const parsed = parseFilenameDate('no-date-here.jpg', 0)
    assert.equal(parsed, null)
  }
  {
    const candidate = extractFilenameLocationCandidate('Grégoire Thibaud 2024-06-14 04-45-05.jpg')
    assert.equal(candidate, 'Grégoire Thibaud')
  }
  {
    const candidate = extractFilenameLocationCandidate('2024-06-14.jpg')
    assert.equal(candidate, '')
  }
  {
    const candidate = extractFilenameLocationCandidate('____.jpg')
    assert.equal(candidate, '')
  }
}

main()
