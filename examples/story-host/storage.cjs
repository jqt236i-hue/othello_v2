const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { validateBattleSave } = require('@card-reversi/battle');
function validate(value) {
  if (value && value.version !== 1) throw Object.assign(Error('この進行データの形式には対応していません'), {code:'STORY_SAVE_INCOMPATIBLE'});
  if (!value || !Number.isSafeInteger(value.chapter) || value.chapter < 0
    || !Number.isSafeInteger(value.rewards) || value.rewards < 0 || !Number.isSafeInteger(value.attempt) || value.attempt < 0
    || !Array.isArray(value.settledIds) || value.settledIds.length > 10000
    || value.settledIds.some(id => typeof id !== 'string' || id.length > 160) || new Set(value.settledIds).size !== value.settledIds.length) throw Error('進行データが不正です');
  if (value.battle !== null) validateBattleSave(value.battle);
  return value;
}
function encode(value) { const data = JSON.stringify(validate(value)); return JSON.stringify({ data, sha256: crypto.createHash('sha256').update(data).digest('hex') }); }
function decode(text) {
  if (text.length > 16 * 1024 * 1024) throw Error('保存データが大きすぎます');
  const {data,sha256} = JSON.parse(text);
  if (typeof data !== 'string' || crypto.createHash('sha256').update(data).digest('hex') !== sha256) throw Error('保存データが破損しています');
  return validate(JSON.parse(data));
}
function createStorage(directory) {
  let queue = Promise.resolve();
  const serial = work => { const result = queue.then(work); queue = result.catch(() => {}); return result; };
  const file = name => path.join(directory, name);
  const read = async name => { try { return await fs.readFile(file(name), 'utf8'); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } };
  const committed = async () => {
    const manifest = await read('manifest.json'); if (manifest === null) return null;
    const value = JSON.parse(manifest);
    if (value.version !== 1 || !['a','b'].includes(value.current) || (value.previous !== null && !['a','b'].includes(value.previous))) throw Error('保存の世代情報が不正です');
    for (const slot of [value.current,value.previous]) {
      if (!slot) continue;
      try { const data = await read(`${slot}.json`); if (data !== null) return {slot,current:value.current,value:decode(data)}; } catch (error) { if (error.code) throw error; }
    }
    throw Error('読み込める保存データがありません');
  };
  const atomic = async (name, value) => {
    const temp = file(name + '.tmp'); const handle = await fs.open(temp, 'w');
    try { await handle.writeFile(value); await handle.sync(); } finally { await handle.close(); }
    await fs.rename(temp, file(name));
  };
  return {
    load: () => serial(async () => (await committed())?.value ?? null),
    save: value => serial(async () => {
      const text = encode(value); await fs.mkdir(directory,{recursive:true});
      const old = await committed(), slot = old?.slot === 'a' ? 'b' : 'a';
      if (old && old.current !== old.slot) await atomic('manifest.json',JSON.stringify({version:1,current:old.slot,previous:null}));
      await atomic(slot + '.json',text); decode(await read(slot + '.json'));
      await atomic('manifest.json',JSON.stringify({version:1,current:slot,previous:old?.slot ?? null}));
    })
  };
}
module.exports = {createStorage, validate};
