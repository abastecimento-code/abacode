const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const root = process.cwd();
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const inputDir = path.join(root, 'relatorios', 'entrada');
const outputPath = path.join(root, 'dados', 'globus-importados.json');

function jsonConstant(name) {
  const match = html.match(new RegExp(`const ${name} = (\\{[\\s\\S]*?\\});`));
  if (!match) throw new Error(`Não localizei ${name} no index.html.`);
  return JSON.parse(match[1]);
}

function extractFunction(start, next) {
  const from = html.indexOf(start);
  const to = html.indexOf(next, from);
  if (from < 0 || to < 0) throw new Error(`Não localizei o trecho ${start}.`);
  return html.slice(from, to).trim();
}

const rawBase = { ...jsonConstant('FILLS_RAW'), ...jsonConstant('MACAE_FILLS_RAW') };
const fleetBlock = html.slice(html.indexOf('const FROTA = ['), html.indexOf('const FROTA_ORIGINAL'));
const knownPrefixes = new Set([
  ...[...fleetBlock.matchAll(/\bp:'([^']+)'/g)].map(m => m[1]),
  ...[...fleetBlock.matchAll(/"p":"([^"]+)"/g)].map(m => m[1]),
]);
const parserSource = extractFunction('function parsearRelatorioGerencialGlobus(', '\nfunction parsearRelatorioGlobus(');
const parseGerencial = vm.runInNewContext(`(${parserSource})`, { Date, Number, String, Math, Error, RegExp });

function coreKey(e) {
  return [e.prefixo, e.ano, e.data, e.tipo ?? e.origem, Number(e.litros), Number(e.km)].join('|');
}
function exactKey(e) { return [coreKey(e), e.cupom || '', Number(e.precoL), Number(e.valor ?? e.valorTotal)].join('|'); }
function formatDate(d) { return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; }

const coreCounts = new Map();
const exactCounts = new Map();
function countRecord(e) {
  const core = coreKey(e), exact = exactKey(e);
  coreCounts.set(core, (coreCounts.get(core) || 0) + 1);
  exactCounts.set(exact, (exactCounts.get(exact) || 0) + 1);
}
for (const [prefixo, rows] of Object.entries(rawBase)) {
  for (const row of rows) countRecord({ ...row, prefixo });
}

let pacote;
if (fs.existsSync(outputPath)) pacote = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
else pacote = { versao: 1, corte: '2026-10-29', lancamentos: [], relatorios: [] };
if (pacote.versao !== 1 || pacote.corte !== '2026-10-29' || !Array.isArray(pacote.lancamentos)) {
  throw new Error('O arquivo de dados publicado tem formato inesperado.');
}
for (const e of pacote.lancamentos) {
  countRecord({ ...e, tipo: e.origem, valor: e.valorTotal });
}

if (!fs.existsSync(inputDir)) throw new Error('A pasta relatorios/entrada não existe.');
const files = fs.readdirSync(inputDir).filter(n => /\.txt$/i.test(n)).sort();
if (!files.length) throw new Error('Nenhum .TXT foi enviado para relatorios/entrada/.');
const reportIds = new Set((pacote.relatorios || []).map(r => r.sha256));
const reportsToAdd = [];
let newlyAccepted = 0;

for (const filename of files) {
  const bytes = fs.readFileSync(path.join(inputDir, filename));
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  if (reportIds.has(sha256)) continue;
  let text = bytes.toString('utf8');
  if (text.includes('\uFFFD')) text = new TextDecoder('windows-1252').decode(bytes);
  const report = parseGerencial(text.replace(/^\uFEFF/, '').split(/\r?\n/), text);
  if (report.erros.length) {
    const details = report.erros.slice(0, 12).map(e => `linha ${e.linha}, prefixo ${e.prefixo}: ${(e.campos || []).join(', ')}`).join('\n');
    throw new Error(`${filename}: há campos inválidos no período analisado.\n${details}`);
  }
  for (const event of report.eventos) {
    if (!knownPrefixes.has(event.prefixo)) throw new Error(`${filename}: prefixo ${event.prefixo} não cadastrado (linha ${event.linha}).`);
    if ((event.camposInvalidos || []).length) throw new Error(`${filename}: linha ${event.linha} precisa de revisão: ${event.camposInvalidos.join(', ')}.`);
    const core = coreKey(event), exact = exactKey(event);
    const exactExisting = exactCounts.get(exact) || 0;
    if (exactExisting > 0) {
      exactCounts.set(exact, exactExisting - 1);
      coreCounts.set(core, (coreCounts.get(core) || 1) - 1);
      continue;
    }
    if ((coreCounts.get(core) || 0) > 0) {
      throw new Error(`${filename}: linha ${event.linha}, prefixo ${event.prefixo} coincide em data/origem/litros/KM com lançamento já cadastrado, mas cupom/preço/valor divergem. Revisão manual necessária.`);
    }
    const record = {
      prefixo: event.prefixo, data: event.data, ano: event.ano, litros: event.litros,
      precoL: event.precoL, valorTotal: event.valorTotal, km: event.km, origem: event.origem,
      linha: event.linha, bruto: event.bruto, hora: event.hora, cupom: event.cupom,
      fornecedor: event.fornecedor, hodometroInicial: event.hodometroInicial,
      hodometroFinal: event.hodometroFinal, kmAcumulado: event.kmAcumulado,
      kmPorLitro: event.kmPorLitro, idealKmL: event.idealKmL, perdaPct: event.perdaPct,
      arquivoFonte: filename,
    };
    pacote.lancamentos.push(record);
    countRecord({ ...record, tipo: record.origem, valor: record.valorTotal });
    newlyAccepted++;
  }
  reportsToAdd.push({ arquivo: filename, sha256, periodoDeclarado: `${report.faixaInicio} a ${report.fimOriginal ? formatDate(report.fimOriginal) : report.faixaFim}`, linhasOriginais: report.linhasOriginais.length, analisadasAteCorte: report.eventos.length });
}

if (!newlyAccepted) {
  console.log(`Sem novos lançamentos. ${reportsToAdd.length} relatório(s) novo(s) conferido(s); originais permanecem na pasta de entrada.`);
  process.exit(0);
}
pacote.relatorios = [...(pacote.relatorios || []), ...reportsToAdd];
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(pacote, null, 2) + '\n');
console.log(`Preparados ${newlyAccepted} lançamento(s) novo(s), até 29/10/2026. Original(is) preservado(s) na pasta de entrada.`);
