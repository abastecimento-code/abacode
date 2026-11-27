const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = process.cwd();
let periodoComum = null;

function isoData(data) {
  return data.getFullYear() + '-' + String(data.getMonth() + 1).padStart(2, '0') + '-' + String(data.getDate()).padStart(2, '0');
}
const fontes = [
  { arquivo: '500-699.TXT', destino: 'dados/globus-500-699.json' },
  { arquivo: '1000-2999.TXT', destino: 'dados/globus-1000-2999.json' },
  { arquivo: '200-300.TXT', destino: 'dados/globus-200-300.json' },
];

function dataPt(valor) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(valor);
  if (!m) return null;
  const data = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return data.getFullYear() === Number(m[3]) &&
    data.getMonth() === Number(m[2]) - 1 &&
    data.getDate() === Number(m[1]) ? data : null;
}

function numeroPt(valor) {
  const texto = String(valor ?? '').trim().replace(/\*/g, '');
  if (!texto) return null;
  if (!/^\d+(?:,\d+)?$/.test(texto)) return null;
  const numero = Number(texto.replace(',', '.'));
  return Number.isFinite(numero) ? numero : null;
}

function numeroRodape(linha) {
  return [...linha.slice(100).matchAll(/\d[\d.]*,\d{2}/g)]
    .map(match => Number(match[0].replace(/\./g, '').replace(',', '.')));
}

function processarFonte(fonte) {
  const caminho = path.join(root, fonte.arquivo);
  if (!fs.existsSync(caminho)) throw new Error('Relatório ausente: ' + fonte.arquivo);
  const bytes = fs.readFileSync(caminho);
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  let texto = bytes.toString('utf8');
  if (texto.includes('\uFFFD')) texto = new TextDecoder('windows-1252').decode(bytes);
  texto = texto.replace(/^\uFEFF/, '');
  const linhas = texto.split(/\r?\n/);
  const faixa = texto.match(/Datas:\s*(\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}\s+a\s+(\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}/);
  if (!faixa) throw new Error(fonte.arquivo + ': período não identificado no cabeçalho.');
  const inicio = dataPt(faixa[1]), fim = dataPt(faixa[2]);
  if (!inicio || !fim || inicio > fim) throw new Error(fonte.arquivo + ': período inválido.');
  const periodoAtual = { inicio: faixa[1], fim: faixa[2], corte: isoData(fim) };
  if (periodoComum && (periodoComum.inicio !== periodoAtual.inicio || periodoComum.fim !== periodoAtual.fim)) {
    throw new Error(fonte.arquivo + ': período diferente dos demais relatórios.');
  }
  periodoComum = periodoAtual;

  let candidatas = 0;
  let linhasSemCombustivel = 0;
  const lancamentos = [];
  const linhasSemCombustivelDetalhadas = [];
  const erros = [];
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    if (!/^\s*\d{7}\s+\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}/.test(linha)) continue;
    candidatas++;

    const prefixo = linha.slice(0, 7).trim().replace(/^0+/, '') || '0';
    const dataCompleta = linha.slice(8, 18).trim();
    const data = dataPt(dataCompleta);
    const hora = linha.slice(20, 25).trim();
    const origem = linha.slice(26, 27).trim();
    if (!data || data < inicio || data > fim || !/^\d{2}:\d{2}$/.test(hora)) {
      erros.push('linha ' + (i + 1) + ': data/hora fora do padrão');
      continue;
    }

    const fatias = {
      combustivel: linha.slice(48, 56),
      motor: linha.slice(56, 64),
      graxa: linha.slice(64, 70),
      hidraulico: linha.slice(70, 77),
      diferencial: linha.slice(77, 84),
      cambio: linha.slice(84, 88),
      freio: linha.slice(88, 94),
      outros: linha.slice(94, 100),
    };
    const produtos = {};
    for (const [campo, fatia] of Object.entries(fatias)) {
      produtos[campo] = numeroPt(fatia);
      if (fatia.trim() && produtos[campo] === null) {
        erros.push('linha ' + (i + 1) + ': quantidade ' + campo + ' inválida');
      }
    }

    // Os valores podem ultrapassar a largura impressa da coluna (ex.: KM acumulado
    // acima de 999.999), por isso são lidos em sequência no rodapé, sem fatias fixas.
    const rodape = numeroRodape(linha);
    let hodometroInicial = null;
    let hodometroFinal = null;
    let km = null;
    let kmAcumulado = null;
    let kmPorLitro = null;
    if (rodape.length === 5) {
      [hodometroInicial, hodometroFinal, km, kmAcumulado, kmPorLitro] = rodape;
    } else if (rodape.length === 4) {
      [hodometroInicial, hodometroFinal, km, kmAcumulado] = rodape;
    } else if (rodape.length !== 0) {
      erros.push('linha ' + (i + 1) + ': rodapé numérico ambíguo (' + rodape.length + ' campos)');
      continue;
    }

    const litros = produtos.combustivel;
    if (litros === null || litros <= 0) {
      linhasSemCombustivel++;
      const temOutroProduto = Object.entries(produtos)
        .some(([campo, valor]) => campo !== 'combustivel' && valor !== null && valor > 0);
      const temHodometro = [hodometroInicial, hodometroFinal, km, kmAcumulado]
        .some(valor => valor !== null);
      const tipoLinha = temOutroProduto ? 'OUTRO_INSUMO'
        : temHodometro ? 'HODOMETRO_SEM_COMBUSTIVEL' : 'SEM_COMBUSTIVEL';
      linhasSemCombustivelDetalhadas.push({
        prefixo,
        data: dataCompleta.slice(0, 5),
        ano: data.getFullYear(),
        dataCompleta,
        hora,
        origem: origem === 'I' || origem === 'E' ? origem : null,
        litros,
        produtos,
        hodometroInicial,
        hodometroFinal,
        km,
        kmAcumulado,
        kmPorLitro,
        tipoLinha,
        linha: i + 1,
        arquivoFonte: fonte.arquivo,
        bruto: linha,
      });
      continue;
    }
    if (origem !== 'I' && origem !== 'E') {
      erros.push('linha ' + (i + 1) + ': origem de abastecimento inválida');
      continue;
    }

    lancamentos.push({
      prefixo,
      data: dataCompleta.slice(0, 5),
      ano: data.getFullYear(),
      hora,
      origem,
      litros,
      km,
      kmAcumulado,
      kmPorLitro,
      hodometroInicial,
      hodometroFinal,
      produtos,
      linha: i + 1,
      arquivoFonte: fonte.arquivo,
    });
  }

  if (erros.length) {
    throw new Error(fonte.arquivo + ': ' + erros.length + ' inconsistência(s):\n' + erros.slice(0, 20).join('\n'));
  }
  if (!lancamentos.length) throw new Error(fonte.arquivo + ': nenhum abastecimento foi identificado.');

  return {
    pacote: {
      versao: 1,
      corte: periodoAtual.corte,
      arquivo: fonte.arquivo,
      sha256,
      periodoInicio: faixa[1],
      periodoFim: faixa[2],
      linhasCandidatas: candidatas,
      lancamentos,
      linhasSemCombustivel: linhasSemCombustivelDetalhadas,
    },
    resumo: {
      arquivo: fonte.arquivo,
      origem: fonte.arquivo,
      sha256,
      lancamentos: lancamentos.length,
      candidatas,
      linhasSemCombustivel,
      linhasSemCombustivelComHodometro: linhasSemCombustivelDetalhadas.filter(e =>
        [e.hodometroInicial, e.hodometroFinal, e.km, e.kmAcumulado].some(v => v !== null)).length,
      linhasSemCombustivelComOutrosProdutos: linhasSemCombustivelDetalhadas.filter(e =>
        Object.entries(e.produtos).some(([campo, valor]) => campo !== 'combustivel' && valor !== null && valor > 0)).length,
    },
  };
}

const resultados = fontes.map(processarFonte);
const todos = resultados.flatMap(r => r.pacote.lancamentos);
const prefixos = [...new Set(todos.map(e => e.prefixo))]
  .sort((a, b) => Number(a) - Number(b));
const resumo = {
  lancamentos: todos.length,
  prefixos: prefixos.length,
  kmAusente: todos.filter(e => e.km == null).length,
  kmPorLitroAusente: todos.filter(e => e.kmPorLitro == null).length,
  precoEValorNaoDisponiveis: true,
  kmAcumuladoAusente: todos.filter(e => e.kmAcumulado == null).length,
  linhasSemCombustivel: resultados.reduce((soma, r) => soma + r.resumo.linhasSemCombustivel, 0),
  linhasSemCombustivelComHodometro: resultados.reduce((soma, r) => soma + r.resumo.linhasSemCombustivelComHodometro, 0),
  linhasSemCombustivelComOutrosProdutos: resultados.reduce((soma, r) => soma + r.resumo.linhasSemCombustivelComOutrosProdutos, 0),
};

if (!resumo.lancamentos || !resumo.prefixos) {
  throw new Error('Nenhum lançamento válido foi consolidado: ' + JSON.stringify(resumo));
}

for (let i = 0; i < resultados.length; i++) {
  const destino = path.join(root, fontes[i].destino);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, JSON.stringify(resultados[i].pacote) + '\n');
}

const manifesto = {
  versao: 1,
  corte: periodoComum.corte,
  geradoEm: new Date().toISOString().slice(0, 10),
  origem: 'Relatórios gerenciais Globus ABA - Abastecimento / Quilometragem',
  periodoInicio: periodoComum.inicio,
  periodoFim: periodoComum.fim,
  arquivos: resultados.map((r, i) => ({
    arquivo: fontes[i].destino,
    origem: fontes[i].arquivo,
    sha256: r.pacote.sha256,
    lancamentos: r.pacote.lancamentos.length,
    linhasSemCombustivel: r.pacote.linhasSemCombustivel.length,
    linhasSemCombustivelComHodometro: r.resumo.linhasSemCombustivelComHodometro,
    linhasSemCombustivelComOutrosProdutos: r.resumo.linhasSemCombustivelComOutrosProdutos,
  })),
  resumo,
  prefixos,
};
fs.writeFileSync(path.join(root, 'dados/globus-importados.json'), JSON.stringify(manifesto) + '\n');
console.log('Pacotes Globus reconstruídos e auditados: ' + JSON.stringify(resumo));
