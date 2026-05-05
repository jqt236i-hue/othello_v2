/**
 * Test: simulate what the browser does.
 * Read registry file, find a specific failing module, 
 * extract the raw template-literal content,
 * test what happens when you new Function() it.
 */
const fs = require('fs');
const r = fs.readFileSync('public/module-registry.js', 'utf8');

// Pick a failing module
const keysToCheck = [
    'card-system',
    'constants/animation-constants',  // 'require already declared'
    'game/ai/mcts-policy',             // 'Invalid token'
    'game/card-effects/clone',          // 'Invalid token'
];

for (const key of keysToCheck) {
    const marker = '_r("' + key + '",';
    const idx = r.indexOf(marker);
    if (idx < 0) { console.log('\n' + key + ': NOT FOUND'); continue; }
    
    const bt = r.indexOf('`', idx);
    const btEnd = r.indexOf('`));', bt);
    const rawBody = r.substring(bt + 1, btEnd);
    
    // Test 1: new Function with raw body (this is wrong - we should simulate template literal first)
    try {
        new Function('module', 'exports', 'require', '__dirname', '__filename', rawBody);
        console.log('\n' + key + ': raw body: PASS');
    } catch (e) {
        console.log('\n' + key + ': raw body: FAIL -', e.message.substring(0, 80));
    }
    
    // Test 2: Simulate template literal processing: \\ -> \, \` -> `, \${ -> ${
    const processed = rawBody
        .replace(/\\\\/g, '\\')   // double backslash -> single (but this reverses our original escape!)
        .replace(/\\`/g, '`')     // escaped backtick -> backtick
        .replace(/\\\$\{/g, '${'); // escaped ${ -> ${
    // Actually the above is WRONG because \\\\ in the file is two backslashes in the raw text.
    // Let me think more carefully.
    // In the registry file, the raw text inside backticks has:
    //   \\ for each original backslash -> this appears as \\ in the file (2 chars)
    //   \` for each original backtick -> this appears as \` in the file (2 chars)
    //   \${ for each original ${ -> this appears as \${ in the file (3 chars)
    // When JS evaluates the template literal:
    //   \\ (in source) -> \ (in result)
    //   \` (in source) -> ` (in result)
    //   \${ (in source) -> ${ (in result)
    // So to correctly simulate, we need:
    //   rawBody (as in file): \\ -> bytes are [0x5C, 0x5C]
    //   JS template processing: each \\ turns into \ -> [0x5C]
    
    // The rawBody read from the file IS doubly-escaped per the original intent.
    // Let me just check: what characters do we have around "bad" spots?
    
    // Find the first occurrence of unescaped \ followed by something weird
    const first200 = rawBody.substring(0, 200);
    const re_bad = /\\([^\\nrtrvb0'"`$/\\.])/g;
    let badMatch;
    let foundBad = [];
    while ((badMatch = re_bad.exec(rawBody)) !== null) {
        foundBad.push({ pos: badMatch.index, char: badMatch[1], context: rawBody.substring(Math.max(0,badMatch.index-5), badMatch.index+10) });
        if (foundBad.length > 10) break;
    }
    if (foundBad.length > 0) {
        console.log('  Suspicious escapes (first 10):');
        foundBad.forEach(f => console.log('    pos ' + f.pos + ': "\\' + f.char + '" -> context: ' + JSON.stringify(f.context)));
    } else {
        console.log('  No suspicious single-backslash escapes found');
    }
    
    // Check for backslash-newline (template literal continuation)
    const bsNL = rawBody.match(/\\\n/g);
    if (bsNL) {
        console.log('  Backslash-newline continuations:', bsNL.length);
    }
}