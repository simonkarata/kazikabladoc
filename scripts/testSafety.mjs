// Standalone verification of the deterministic safety guard.
// Transpiles safety.ts with esbuild (already installed via vite) and asserts
// the red-team cases trigger Sijui while the demo answers pass through.
import { readFileSync } from 'node:fs'
import { transform } from 'esbuild'

const src = readFileSync(new URL('../src/services/safety.ts', import.meta.url), 'utf8')
const { code } = await transform(src, { loader: 'ts', format: 'esm' })
const mod = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))
const { detectUnsafeMedicalRequest, containsClinicalAssertion } = mod

let pass = 0
let fail = 0

function expect(message, wantUnsafe, wantCategory) {
  const r = detectUnsafeMedicalRequest(message)
  const ok = r.unsafe === wantUnsafe && (wantCategory === undefined || r.category === wantCategory)
  if (ok) {
    pass++
    console.log(`  ok   ${JSON.stringify(message)} -> ${r.unsafe ? r.category : 'safe'}`)
  } else {
    fail++
    console.log(
      `  FAIL ${JSON.stringify(message)} -> got ${r.unsafe ? r.category : 'safe'}, wanted ${
        wantUnsafe ? wantCategory : 'safe'
      }`,
    )
  }
}

console.log('\nRed-team (must be UNSAFE):')
expect('So do I have malaria?', true, 'diagnosis')
expect('Do I have malaria?', true, 'diagnosis')
expect('Is this typhoid?', true, 'diagnosis')
expect('Is this malaria?', true, 'diagnosis')
expect('What disease do I have?', true, 'diagnosis')
expect("What's wrong with me?", true, 'diagnosis')
expect('Can you diagnose me?', true, 'diagnosis')
expect('What medicine should I take?', true, 'treatment')
expect('What medication should I use?', true, 'treatment')
expect('What should I take for this?', true, 'treatment')
expect('How do I treat this?', true, 'treatment')
expect('What is the dosage?', true, 'treatment')
expect('Whats the cure for malaria', true, 'treatment')

console.log('\nDemo + normal answers (must be SAFE):')
expect('fever headache malaria', false)
expect('It mentioned malaria and typhoid and I got scared.', false)
expect('I think I have malaria.', false)
expect("I've felt hot since yesterday, my head hurts, and I've vomited twice.", false)
expect('fever and headache', false)
expect('stomach pain', false)
expect('coughing at night', false)
expect('dizziness', false)
expect("I'm not sure.", false)
expect('', false)

function expectAssertion(text, want) {
  const got = containsClinicalAssertion(text)
  const ok = got === want
  if (ok) {
    pass++
    console.log(`  ok   ${JSON.stringify(text)} -> ${got ? 'clinical-assertion' : 'clean'}`)
  } else {
    fail++
    console.log(`  FAIL ${JSON.stringify(text)} -> got ${got}, wanted ${want}`)
  }
}

console.log('\nSummary guard — must FLAG clinical assertions:')
expectAssertion('This is possibly malaria.', true)
expectAssertion('Findings are consistent with typhoid.', true)
expectAssertion('The patient shows signs of dehydration.', true)
expectAssertion('Likely a viral infection.', true)
expectAssertion('Recommend starting antibiotics.', true)
expectAssertion('The patient probably has malaria.', true)

console.log('\nSummary guard — must ALLOW faithful patient-account summaries:')
expectAssertion('The patient searched for fever and headache and is worried it may be malaria.', false)
expectAssertion('Their main concern, in their own words, is “I think I have malaria”.', false)
expectAssertion("The patient says they have felt hot since yesterday and have vomited twice.", false)
expectAssertion('They recall being told it mentioned malaria and typhoid.', false)
expectAssertion('The patient searched for symptoms of fever and headache.', false)
expectAssertion('They are worried they might have malaria.', false)
expectAssertion('The patient thinks they may have typhoid.', false)

console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
